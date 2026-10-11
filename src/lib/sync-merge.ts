// ============================================================
// Fusión de estado entre dispositivos.
//
// El problema que resuelve: hasta ahora cada dispositivo subía su estado
// COMPLETO cada minuto, así que el último en sincronizar pisaba al otro. Con
// un solo equipo daba igual; con Frame Móvil en paralelo es pérdida de datos.
//
// La solución NO es tocar el modelo de datos (ninguna pantalla escribe fechas
// de modificación) sino llevar una contabilidad aparte:
//
//   · `lastSyncedSnapshot_<uid>` guarda cómo estaban los datos la última vez
//     que se sincronizó.
//   · Al sincronizar se compara el estado actual contra esa foto: lo que
//     cambió recibe marca de modificación; lo que desapareció recibe una
//     LÁPIDA. Sin lápidas, borrar una tarea en el móvil la resucitaría desde
//     el escritorio en la siguiente vuelta.
//   · La fusión decide registro a registro por marca más reciente.
//
// Resultado: dos dispositivos pueden trabajar a la vez y ninguno pisa al otro.
// ============================================================

import { type LocalSnapshot } from '@/lib/storage-snapshot';

/** Colecciones: arrays de registros identificados por `id`. Se fusionan uno a uno. */
const COLLECTION_KEYS = [
  'courses',
  'tasks',
  'notes',
  'archivedTasks',
  'incompleteTasks',
  'archivedNotes',
  'localEvents',
  'habits',
  'studySessions',
  'dailyPerformances',
  'playlists',
  'spaces',
  // Horario mensual (su identificador es el mes) y las clases que genera.
  'schedules',
  'classSessions',
  // Índice de imágenes sincronizadas (id = clave de la imagen): cada imagen
  // se fusiona por separado, así cambiar dos en dos equipos no choca.
  'syncedImages',
] as const;

/** Bitácora que solo crece: se fusiona por unión, no por marca de tiempo. */
const LOG_KEY = 'playHistory';
const LOG_LIMIT = 800;

/** Las lápidas se conservan dos meses: tiempo de sobra para que un
 *  dispositivo apagado se entere del borrado sin engordar el respaldo. */
const TOMBSTONE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

type Iso = string;

export interface SyncMeta {
  /** clave de colección → id de registro → marca */
  collections: Record<string, Record<string, { u?: Iso; d?: Iso }>>;
  /** clave suelta → marca de última modificación */
  scalars: Record<string, Iso>;
}

export interface SyncState {
  data: LocalSnapshot;
  meta: SyncMeta;
  /** versión del formato; 2 = con fusión por registro */
  v: 2;
}

const isCollection = (key: string): boolean =>
  (COLLECTION_KEYS as readonly string[]).includes(key);

const emptyMeta = (): SyncMeta => ({ collections: {}, scalars: {} });

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

const recordId = (record: Record<string, unknown>): string | null => {
  // Un horario mensual no tiene `id`: lo identifica su mes ("yyyy-MM").
  const id = record?.id ?? record?.month;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
};

const stable = (value: unknown): string => JSON.stringify(value ?? null);

/**
 * Huella de 53 bits (cyrb53) de un texto. Se usa para saber si un registro
 * cambió desde la última sincronización SIN guardar una copia entera de él:
 * la foto de referencia pesaba lo mismo que todos los datos del usuario y
 * duplicaba el espacio ocupado en localStorage.
 */
export function fingerprint(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const printOf = (value: unknown): string => fingerprint(stable(value));

const newer = (a: Iso | undefined, b: Iso | undefined): boolean => {
  if (!a) return false;
  if (!b) return true;
  return a > b; // ISO 8601 en UTC: el orden lexicográfico ES el cronológico
};

// ---------------------------------------------------------------------------
// Contabilidad local
// ---------------------------------------------------------------------------

const metaKey = (uid: string) => `syncMeta_${uid}`;
const baseKey = (uid: string) => `lastSyncedSnapshot_${uid}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Foto de referencia de la última sincronización, en formato compacto: por
 * cada registro solo su huella. Basta para las dos preguntas que se le hacen
 * (¿existía este id?, ¿cambió?) y ocupa una fracción de la copia completa que
 * se guardaba antes.
 */
interface SyncBase {
  v: 3;
  collections: Record<string, Record<string, string>>;
  scalars: Record<string, string>;
}

function compactBase(data: LocalSnapshot): SyncBase {
  const base: SyncBase = { v: 3, collections: {}, scalars: {} };
  for (const key of Object.keys(data)) {
    if (key === LOG_KEY) continue;
    if (isCollection(key)) {
      if (!Array.isArray(data[key])) continue;
      const prints: Record<string, string> = {};
      for (const record of asArray(data[key])) {
        const id = recordId(record);
        if (id) prints[id] = printOf(record);
      }
      base.collections[key] = prints;
    } else {
      base.scalars[key] = printOf(data[key]);
    }
  }
  return base;
}

/** Lee la foto de referencia; convierte al vuelo la del formato antiguo. */
function readBase(uid: string): SyncBase | null {
  const raw = readJson<unknown>(baseKey(uid), null);
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<SyncBase>;
  if (candidate.v === 3 && candidate.collections && candidate.scalars) return candidate as SyncBase;
  // Formato anterior: la copia completa de los datos.
  return compactBase(raw as LocalSnapshot);
}

/**
 * Compara el estado actual con la foto de la última sincronización y actualiza
 * las marcas. Devuelve el estado listo para fusionar.
 *
 * `now` se pasa como parámetro para que las pruebas y las llamadas encadenadas
 * usen exactamente el mismo instante.
 */
export function buildLocalState(uid: string, data: LocalSnapshot, now: Iso): SyncState {
  const meta = readJson<SyncMeta>(metaKey(uid), emptyMeta());
  meta.collections = meta.collections ?? {};
  meta.scalars = meta.scalars ?? {};

  const base = readBase(uid);
  // Primera vez: no hay con qué comparar, así que todo lo presente se marca
  // como recién modificado. Es deliberado — ver la nota de migración del README.
  const first = base === null;

  for (const key of Object.keys(data)) {
    if (isCollection(key)) {
      // Una colección que no es una lista está CORRUPTA (escritura truncada,
      // JSON ilegible leído como texto). Tratarla como "lista vacía" lapidaría
      // todos sus registros en la nube y en los demás dispositivos: se la
      // considera ausente, y la fusión traerá la copia buena de la nube.
      if (!Array.isArray(data[key])) {
        delete data[key];
        continue;
      }

      const marks = (meta.collections[key] = meta.collections[key] ?? {});
      const current = asArray(data[key]);
      const previous = base?.collections[key] ?? {};

      const seen = new Set<string>();
      for (const record of current) {
        const id = recordId(record);
        if (!id) continue;
        seen.add(id);
        const before = previous[id];
        if (first || before === undefined || before !== printOf(record)) {
          marks[id] = { u: now };
        } else if (!marks[id]) {
          marks[id] = { u: now };
        }
      }

      // Lo que estaba y ya no está: lápida.
      for (const id of Object.keys(previous)) {
        if (!seen.has(id)) marks[id] = { d: now };
      }
    } else if (key !== LOG_KEY) {
      if (first || base?.scalars[key] !== printOf(data[key]) || !meta.scalars[key]) {
        meta.scalars[key] = now;
      }
    }
  }

  return { data, meta, v: 2 };
}

// ---------------------------------------------------------------------------
// Fusión
// ---------------------------------------------------------------------------

/** Normaliza un estado remoto: acepta el formato antiguo (snapshot pelado). */
export function normalizeRemote(raw: unknown, rowUpdatedAt: Iso | null): SyncState | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<SyncState> & LocalSnapshot;

  if (candidate.v === 2 && candidate.data && candidate.meta) {
    return {
      data: candidate.data,
      meta: {
        collections: candidate.meta.collections ?? {},
        scalars: candidate.meta.scalars ?? {},
      },
      v: 2,
    };
  }

  // Formato 1: el respaldo era el snapshot tal cual, sin marcas. Se le asigna
  // como marca la fecha de la fila, que es lo más cercano a la verdad.
  const stamp = rowUpdatedAt ?? new Date(0).toISOString();
  const meta = emptyMeta();
  const data = raw as LocalSnapshot;
  for (const key of Object.keys(data)) {
    if (isCollection(key)) {
      const marks: Record<string, { u?: Iso; d?: Iso }> = {};
      for (const record of asArray(data[key])) {
        const id = recordId(record);
        if (id) marks[id] = { u: stamp };
      }
      meta.collections[key] = marks;
    } else if (key !== LOG_KEY) {
      meta.scalars[key] = stamp;
    }
  }
  return { data, meta, v: 2 };
}

/** Une dos bitácoras de reproducción sin duplicar y respetando el tope. */
function mergeLog(a: unknown, b: unknown): unknown[] {
  const seen = new Set<string>();
  const all = [...asArray(a), ...asArray(b)].filter((entry) => {
    const key = `${entry.s}|${entry.t}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  all.sort((x, y) => String(x.t).localeCompare(String(y.t)));
  return all.slice(-LOG_LIMIT);
}

/**
 * Fusiona dos estados registro a registro. Gana siempre la marca más reciente,
 * y una lápida gana a una modificación anterior (borrar es una decisión tan
 * válida como editar, y si no, lo borrado reaparecería para siempre).
 */
export function mergeStates(local: SyncState, remote: SyncState, now: Iso): SyncState {
  const merged: LocalSnapshot = {};
  const meta = emptyMeta();
  const cutoff = new Date(Date.parse(now) - TOMBSTONE_TTL_MS).toISOString();

  const keys = new Set([...Object.keys(local.data), ...Object.keys(remote.data)]);

  for (const key of keys) {
    if (key === LOG_KEY) {
      merged[key] = mergeLog(local.data[key], remote.data[key]);
      continue;
    }

    if (!isCollection(key)) {
      const localAt = local.meta.scalars[key];
      const remoteAt = remote.meta.scalars[key];
      const takeLocal = key in local.data && (!(key in remote.data) || !newer(remoteAt, localAt));
      merged[key] = takeLocal ? local.data[key] : remote.data[key];
      meta.scalars[key] = (takeLocal ? localAt : remoteAt) ?? now;
      continue;
    }

    const localMarks = local.meta.collections[key] ?? {};
    const remoteMarks = remote.meta.collections[key] ?? {};
    const byId = new Map<string, Record<string, unknown>>();
    const order: string[] = [];

    const index = (records: Record<string, unknown>[], into: Map<string, Record<string, unknown>>) => {
      for (const record of records) {
        const id = recordId(record);
        if (id) into.set(id, record);
      }
    };
    const localById = new Map<string, Record<string, unknown>>();
    const remoteById = new Map<string, Record<string, unknown>>();
    index(asArray(local.data[key]), localById);
    index(asArray(remote.data[key]), remoteById);

    // El orden lo marca el local (es el que el usuario está viendo); lo que
    // solo existe en remoto se añade al final.
    for (const record of asArray(local.data[key])) {
      const id = recordId(record);
      if (id) order.push(id);
    }
    for (const id of remoteById.keys()) {
      if (!localById.has(id)) order.push(id);
    }

    const marks: Record<string, { u?: Iso; d?: Iso }> = {};
    for (const id of new Set(order)) {
      const lm = localMarks[id];
      const rm = remoteMarks[id];
      const localStamp = lm?.d ?? lm?.u;
      const remoteStamp = rm?.d ?? rm?.u;
      const winner = newer(remoteStamp, localStamp) ? 'remote' : 'local';
      const mark = winner === 'remote' ? rm : lm;

      if (mark?.d) {
        // Lápida vigente: el registro no viaja, pero la marca sí (para que el
        // otro dispositivo también lo borre). Las viejas se descartan.
        if (mark.d > cutoff) marks[id] = { d: mark.d };
        continue;
      }

      // Si el lado que gana no tiene el registro (y no hay lápida que lo
      // explique), se toma el del otro: sin una lápida explícita NUNCA se
      // pierde un dato. Pasa, por ejemplo, cuando la colección local estaba
      // corrupta y se descartó: quedan sus marcas pero no sus registros.
      const record =
        (winner === 'remote' ? remoteById.get(id) : localById.get(id)) ??
        remoteById.get(id) ??
        localById.get(id);
      if (!record) continue;
      byId.set(id, record);
      marks[id] = { u: mark?.u ?? now };
    }

    // LÁPIDAS SIN REGISTRO. El bucle de arriba solo recorre ids que siguen
    // presentes en algún lado. En cuanto un borrado se propagaba a la nube, el
    // id dejaba de estar en ambos y su lápida se perdía en la sincronización
    // siguiente: un dispositivo rezagado (apagado unos días) llegaba después
    // con el registro intacto y LO RESUCITABA en todos. La lápida tiene que
    // vivir sus dos meses completos, exista o no el registro.
    const resolved = new Set(order);
    for (const id of new Set([...Object.keys(localMarks), ...Object.keys(remoteMarks)])) {
      if (resolved.has(id)) continue;
      const localD = localMarks[id]?.d;
      const remoteD = remoteMarks[id]?.d;
      const d = newer(localD, remoteD) ? localD : remoteD ?? localD;
      if (d && d > cutoff) marks[id] = { d };
    }

    merged[key] = [...new Set(order)].map((id) => byId.get(id)).filter(Boolean);
    meta.collections[key] = marks;
  }

  return { data: merged, meta, v: 2 };
}

/** Guarda el resultado como nueva foto de referencia y contabilidad. */
export function commitState(uid: string, state: SyncState): void {
  // La contabilidad primero: es lo pequeño y lo que guarda las lápidas.
  try {
    localStorage.setItem(metaKey(uid), JSON.stringify(state.meta));
  } catch {
    /* sin espacio: se reintentará en el próximo ciclo */
  }
  try {
    localStorage.setItem(baseKey(uid), JSON.stringify(compactBase(state.data)));
  } catch {
    // Si ni la foto compacta cabe se conserva la anterior: comparar contra una
    // foto vieja solo re-marca cambios; quedarse SIN foto haría que cada ciclo
    // fuese "la primera vez" y que nada de lo borrado llegara a lapidarse.
  }
}

