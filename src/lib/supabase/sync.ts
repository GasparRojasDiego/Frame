import { getSupabase } from './client';
import { collectLocalData, applyLocalData, type LocalSnapshot } from '@/lib/storage-snapshot';
import {
  buildLocalState,
  mergeStates,
  normalizeRemote,
  commitState,
  fingerprint,
  type SyncState,
} from '@/lib/sync-merge';

const TABLE = 'backups';

// ============================================================
// Sincronización con la nube, en FUSIÓN — no en sobrescritura.
//
// Cada ciclo es leer → fusionar → escribir con control de concurrencia:
//
//   1. Se lee la fila remota junto con su `updated_at`.
//   2. Se fusiona registro a registro con el estado local (ver sync-merge.ts).
//   3. Se escribe CONDICIONANDO a que `updated_at` siga siendo el que se leyó.
//      Si otro dispositivo escribió mientras tanto, la condición no encaja, no
//      se escribe nada y se reintenta con el estado ya actualizado.
//
// El paso 3 es lo que evita que dos dispositivos se pisen: sin él, dos
// fusiones simultáneas escribirían la última y perderían la otra. El resultado
// fusionado se aplica también en local, así que ambos equipos convergen.
//
// EL CICLO OCIOSO NO CUESTA NADA. Antes cada vuelta bajaba la fila entera y la
// volvía a subir entera aunque nadie hubiera tocado nada: con un estado de
// 200 KB y un ciclo por minuto eran ~24 MB por hora y estudiante, y con cien
// estudiantes los 5 GB mensuales del plan gratuito de Supabase duraban un día.
// Ahora se guarda un CURSOR (la fecha de la fila que dejamos en la nube y la
// huella de lo local en ese momento): si la fila sigue con esa fecha y lo local
// sigue con esa huella, no hay nada que fusionar y el ciclo termina tras una
// sonda de unos pocos bytes.
// ============================================================

const MAX_ATTEMPTS = 4;

interface RemoteRow {
  data: unknown;
  updated_at: string | null;
}

interface SyncCursor {
  /** `updated_at` de la fila tal como quedó tras nuestra última escritura. */
  remoteAt: string | null;
  /** Huella de los datos locales en ese mismo instante. */
  localPrint: string;
}

const cursorKey = (uid: string) => `syncCursor_${uid}`;

function readCursor(uid: string): SyncCursor | null {
  try {
    const raw = localStorage.getItem(cursorKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncCursor>;
    return typeof parsed?.localPrint === 'string'
      ? { remoteAt: parsed.remoteAt ?? null, localPrint: parsed.localPrint }
      : null;
  } catch {
    return null;
  }
}

function writeCursor(uid: string, cursor: SyncCursor): void {
  try {
    localStorage.setItem(cursorKey(uid), JSON.stringify(cursor));
  } catch {
    /* sin cursor el próximo ciclo será completo: más caro, igual de correcto */
  }
}

const sameInstant = (a: string | null, b: string | null): boolean => {
  if (a === null || b === null) return a === b;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return !Number.isNaN(ta) && ta === tb;
};

const printOfLocal = (uid: string): string => fingerprint(JSON.stringify(collectLocalData(uid)));

/** Un ciclo completo de sincronización: leer, fusionar y escribir. */
async function syncOnce(uid: string): Promise<{
  ok: boolean;
  applied: boolean;
  error: string | null;
  /** Se escribió en la nube (hay algo nuevo que los otros dispositivos deben traer). */
  wrote?: boolean;
}> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, applied: false, error: 'Supabase no está configurado.' };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, applied: false, error: 'Sin conexión.' };
  }

  // `getSession` lee la sesión guardada en el equipo; `getUser` hacía una
  // petición al servidor en CADA ciclo solo para confirmar lo que ya se sabía.
  // La autoridad real es la RLS de la tabla: con un token ajeno no escribe.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id !== uid) {
    return { ok: false, applied: false, error: 'Sesión inválida.' };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const now = new Date().toISOString();
    const localPrint = printOfLocal(uid);

    // --- Sonda: ¿ha cambiado algo, aquí o allí, desde la última vez? ---
    const cursor = readCursor(uid);
    if (cursor && cursor.localPrint === localPrint) {
      const { data: probe, error: probeError } = await supabase
        .from(TABLE)
        .select('updated_at')
        .eq('user_id', uid)
        .maybeSingle<{ updated_at: string | null }>();
      if (probeError) return { ok: false, applied: false, error: probeError.message };
      // Se comparan INSTANTES, no cadenas: Postgres devuelve la fecha como
      // «…+00:00» y aquí se guardó como «…Z»; son el mismo momento.
      if (probe && sameInstant(probe.updated_at, cursor.remoteAt)) {
        return { ok: true, applied: false, error: null, wrote: false };
      }
    }

    const { data: row, error: readError } = await supabase
      .from(TABLE)
      .select('data, updated_at')
      .eq('user_id', uid)
      .maybeSingle<RemoteRow>();
    if (readError) return { ok: false, applied: false, error: readError.message };

    const local = buildLocalState(uid, collectLocalData(uid), now);
    const remote = row ? normalizeRemote(row.data, row.updated_at) : null;
    const merged: SyncState = remote ? mergeStates(local, remote, now) : local;

    const payload = { user_id: uid, data: merged as unknown, updated_at: now };

    if (!row) {
      // Primera vez para este usuario: no hay fila que proteger.
      const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: 'user_id' });
      if (error) return { ok: false, applied: false, error: error.message };
    } else {
      // Escritura condicionada: solo si nadie tocó la fila mientras fusionábamos.
      const guarded =
        row.updated_at === null
          ? supabase.from(TABLE).update(payload).eq('user_id', uid).is('updated_at', null)
          : supabase.from(TABLE).update(payload).eq('user_id', uid).eq('updated_at', row.updated_at);

      const { data: written, error } = await guarded.select('user_id');
      if (error) return { ok: false, applied: false, error: error.message };

      if (!written || written.length === 0) {
        // Otro dispositivo se adelantó: se vuelve a leer y a fusionar.
        if (attempt === MAX_ATTEMPTS) {
          return {
            ok: false,
            applied: false,
            error: 'La nube cambió mientras se sincronizaba; se reintentará luego.',
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }
    }

    // ¿Tocó algo el usuario mientras hablábamos con la nube? Entonces lo
    // fusionado ya es viejo: volcarlo en disco PISARÍA ese cambio (la interfaz
    // lo tiene en memoria, pero el disco y la foto de referencia no, y en la
    // vuelta siguiente se daría por borrado). Se repite el ciclo con lo nuevo.
    if (printOfLocal(uid) !== localPrint) {
      if (attempt === MAX_ATTEMPTS) {
        return {
          ok: false,
          applied: false,
          error: 'Los datos cambiaron mientras se sincronizaba; se reintentará luego.',
        };
      }
      continue;
    }

    // El resultado fusionado manda también en local: así este dispositivo ve
    // enseguida lo que hizo el otro, sin esperar a una bajada aparte.
    const outcome = applyLocalData(uid, merged.data as LocalSnapshot);
    if (!outcome.ok) {
      // Sin espacio en disco NO se da por sincronizado: fijar la foto de
      // referencia sobre un volcado a medias convertiría lo que faltó en
      // "borrado por el usuario" en el ciclo siguiente.
      return {
        ok: false,
        applied: false,
        error: 'No hay espacio en el equipo para guardar lo que llegó de la nube.',
      };
    }
    commitState(uid, merged);
    writeCursor(uid, { remoteAt: now, localPrint: printOfLocal(uid) });
    return { ok: true, applied: outcome.changed, error: null, wrote: true };
  }

  return { ok: false, applied: false, error: 'No se pudo sincronizar.' };
}

// ------------------------------------------------------------
// Testigo del respaldo
//
// Sincronizar en silencio tiene un problema: si lleva días fallando, el
// usuario cree que está a salvo cuando no lo está. Se deja constancia de
// cada intento para poder decírselo.
// ------------------------------------------------------------
interface SyncStatus {
  lastOkAt: string | null;
  lastTryAt: string | null;
  lastError: string | null;
}

const syncStatusKey = (uid: string) => `syncStatus_${uid}`;

function readSyncStatus(uid: string): SyncStatus {
  try {
    const raw = localStorage.getItem(syncStatusKey(uid));
    if (!raw) return { lastOkAt: null, lastTryAt: null, lastError: null };
    const parsed = JSON.parse(raw);
    return {
      lastOkAt: typeof parsed?.lastOkAt === 'string' ? parsed.lastOkAt : null,
      lastTryAt: typeof parsed?.lastTryAt === 'string' ? parsed.lastTryAt : null,
      lastError: typeof parsed?.lastError === 'string' ? parsed.lastError : null,
    };
  } catch {
    return { lastOkAt: null, lastTryAt: null, lastError: null };
  }
}

function recordSyncAttempt(uid: string, ok: boolean, error: string | null): void {
  try {
    const now = new Date().toISOString();
    const previous = readSyncStatus(uid);
    localStorage.setItem(
      syncStatusKey(uid),
      JSON.stringify({
        lastOkAt: ok ? now : previous.lastOkAt,
        lastTryAt: now,
        lastError: ok ? null : error,
      })
    );
  } catch {
    /* si ni esto cabe, el aviso de cuota ya habrá saltado */
  }
}

/**
 * Sube los cambios locales fusionándolos con lo que haya en la nube.
 * Conserva el nombre de siempre: lo llaman el ciclo automático, el cierre de
 * sesión y la creación de perfil.
 */
import { isAccountDeletionInProgress } from '@/lib/account-deletion';

export async function pushToCloud(
  uid: string
): Promise<{ ok: boolean; applied: boolean; error: string | null; wrote?: boolean }> {
  // Cuenta en proceso de borrado: nada vuelve a escribir en la nube.
  if (isAccountDeletionInProgress()) return { ok: false, applied: false, error: null };
  const result = await syncOnce(uid);
  recordSyncAttempt(uid, result.ok, result.error);
  return result;
}

/**
 * Aviso a la interfaz viva de que el disco cambió por debajo de ella (llegó
 * algo de otro dispositivo). Sin él, el proveedor de datos seguiría con su
 * copia en memoria y la volvería a escribir encima en su siguiente guardado,
 * deshaciendo lo que acaba de llegar.
 */
export const CLOUD_APPLIED_EVENT = 'frame:cloud-applied';

/**
 * Trae lo que haya en la nube fusionándolo con lo local. Es el MISMO ciclo:
 * bajar sin fusionar destruiría el trabajo hecho sin conexión.
 */
export async function pullFromCloud(
  uid: string
): Promise<{ ok: boolean; applied: boolean; error: string | null }> {
  const result = await syncOnce(uid);
  recordSyncAttempt(uid, result.ok, result.error);
  return result;
}
