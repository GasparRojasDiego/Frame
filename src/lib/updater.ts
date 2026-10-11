// ============================================================
// Actualización de Frame (solo escritorio).
//
// LA APP NUNCA SE ACTUALIZA SOLA. Los sondeos solo MIRAN si hay versión nueva
// y, si la hay, encienden el testigo junto al perfil y la entrada de la
// campana. La descarga y el reinicio los dispara el usuario, y nadie más,
// pulsando "Actualizar ahora" en cualquiera de esos dos sitios.
//
// La razón es simple: reiniciar es lo más invasivo que puede hacer una app de
// escritorio. Que ocurra sin avisar, aunque sea al arrancar, es una decisión
// que le corresponde a quien está usando el programa.
// ============================================================
import { isTauri } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from '@/hooks/use-toast';

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'installing';

export interface UpdateState {
  phase: UpdatePhase;
  /** versión disponible; null si no hay ninguna */
  version: string | null;
  /** 0–1 mientras se descarga; null si no aplica */
  progress: number | null;
}

let state: UpdateState = { phase: 'idle', version: null, progress: null };

/** Devuelve true si hay trabajo en curso que un reinicio interrumpiría. La
 *  registra el layout, que es quien conoce el estado de la app. Ya no decide
 *  nada por su cuenta: solo sirve para avisar al usuario de lo que va a pasar
 *  cuando es él quien pulsa actualizar. */
let busyGuard: (() => boolean) | null = null;

export function setUpdateBusyGuard(guard: (() => boolean) | null): void {
  busyGuard = guard;
}
/** Handle del plugin: se guarda para no volver a consultar al instalar. */
let pending: Update | null = null;
let busy = false;

const listeners = new Set<() => void>();

function setState(next: Partial<UpdateState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function getUpdateState(): UpdateState {
  return state;
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Versión ya anunciada: evita repetir el aviso en cada sondeo. */
const ANNOUNCED_KEY = 'lastAnnouncedUpdate';

/**
 * Consulta si hay versión nueva. NUNCA instala: como mucho enciende el testigo
 * y avisa una vez. `silent` calla el aviso de "ya estás al día" en los sondeos
 * de fondo, para no molestar cada media hora.
 */
export async function checkForUpdates(options?: { silent?: boolean }): Promise<void> {
  if (!isTauri() || busy) return;
  busy = true;
  setState({ phase: state.version ? 'available' : 'checking' });
  try {
    // Con límite de tiempo: si el servidor no responde, `busy` se quedaba a
    // true y ni los sondeos ni el botón de actualizar volvían a funcionar.
    const update = await check({ timeout: 20_000 });

    if (!update) {
      pending = null;
      setState({ phase: 'idle', version: null, progress: null });
      if (!options?.silent) {
        toast({ title: 'Frame está actualizado', description: 'Ya tienes la última versión.' });
      }
      return;
    }

    pending = update;
    setState({ phase: 'available', version: update.version, progress: null });

    // Aviso UNA vez por versión: en cada sondeo posterior el testigo del
    // sidebar sigue encendido, pero no se vuelve a interrumpir al usuario.
    const alreadyAnnounced = localStorage.getItem(ANNOUNCED_KEY) === update.version;
    if (!alreadyAnnounced || !options?.silent) {
      localStorage.setItem(ANNOUNCED_KEY, update.version);
      toast({
        title: `Frame ${update.version} disponible`,
        description: 'Pulsa el icono de descarga junto a tu perfil para actualizar.',
      });
    }
  } catch (e) {
    // Sin red o GitHub caído: silencio absoluto, se reintenta después.
    console.warn('checkForUpdates failed', e);
    setState({ phase: state.version ? 'available' : 'idle' });
  } finally {
    busy = false;
  }
}

/**
 * Descarga e instala la actualización pendiente. ES EL ÚNICO CAMINO QUE
 * INSTALA, y solo lo llaman el botón junto al perfil y la entrada de la
 * campana: nada lo dispara por su cuenta. El instalador corre en modo
 * silencioso (`installMode: "quiet"` en tauri.conf.json), así que no aparece
 * ningún asistente: la app se cierra y vuelve sola ya actualizada.
 */
export async function installPendingUpdate(): Promise<void> {
  if (!isTauri() || busy) return;
  const update = pending ?? (await check().catch(() => null));
  if (!update) {
    toast({ title: 'Frame está actualizado', description: 'No hay nada que instalar.' });
    setState({ phase: 'idle', version: null, progress: null });
    return;
  }

  // El usuario ya decidió; no se le bloquea. Pero si hay algo en marcha se le
  // dice qué va a pasar, en vez de reiniciarle la app sin explicación.
  if (busyGuard?.()) {
    toast({
      title: 'Actualizando con trabajo en curso',
      description:
        'Tu sesión de estudio se guardará y podrás retomarla al volver; la música se detendrá.',
    });
  }

  busy = true;
  setState({ phase: 'downloading', version: update.version, progress: 0 });

  try {
    let downloaded = 0;
    let total = 0;

    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength ?? 0;
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength;
        setState({ progress: total > 0 ? Math.min(1, downloaded / total) : null });
      } else if (event.event === 'Finished') {
        setState({ phase: 'installing', progress: 1 });
        toast({
          title: 'Instalando…',
          description: 'Frame se cerrará un momento y volverá a abrirse actualizado.',
        });
      }
    });

    // En Windows el instalador cierra la app por sí mismo; relaunch cubre el
    // resto de plataformas y cualquier caso en que siga viva.
    await relaunch();
  } catch (e) {
    console.warn('installPendingUpdate failed', e);
    setState({ phase: 'available', progress: null });
    toast({
      variant: 'destructive',
      title: 'No se pudo actualizar',
      description: 'Revisa tu conexión e inténtalo de nuevo.',
    });
  } finally {
    busy = false;
  }
}

/** Sondeo: 20 s tras arrancar y luego cada 30 minutos. SOLO MIRA Y AVISA;
 *  ninguna de las dos llamadas instala nada. */
export function startUpdaterLoop(): () => void {
  if (!isTauri()) return () => {};
  const first = setTimeout(() => void checkForUpdates({ silent: true }), 20000);
  const interval = setInterval(() => void checkForUpdates({ silent: true }), 30 * 60 * 1000);
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}
