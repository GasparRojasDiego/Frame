// Claves de estado de negocio sincronizables (sufijo `_<uid>`).
// Excluye música (archivos en IndexedDB) e imágenes; solo se respalda el estado de negocio.
//
// Grabaciones ('recordings'): la ficha es JSON, pero el audio vive en
// IndexedDB igual que la música. Restaurar solo la ficha dejaría tarjetas
// mudas, así que queda fuera a propósito.
//
// 'school': clave heredada de Aether OS que el Perfil de Frame ya no escribe.
// Se mantiene solo de arrastre, para no perder el dato de quien migró.
export const SCOPED_KEYS = [
  'courses',
  'tasks',
  'notes',
  // El archivo histórico es dato de usuario irrecuperable: alimenta
  // "Archivados" (Tareas y asignatura) y toda la analítica académica.
  'archivedTasks',
  // Tareas que no se pudieron terminar: fuera de las métricas de culminadas.
  'incompleteTasks',
  'archivedNotes',
  'localEvents',
  // Color propio de cada casilla del calendario local (1.6.2).
  'dayColors',
  'habits',
  'studySessions',
  'dailyPerformances',
  'playlists',
  'spaces',
  'studyGoals',
  'streakGoal',
  'selectionMode',
  'completedTasks',
  'completedTasksByCourse',
  'taskSortMode',
  'isPlayerVisible',
  'competencyCourseIds',
  // Bitácora de reproducciones: desde la 1.5.4 ya no se escribe (se quitaron
  // «Tu banda sonora» y «Lo que más escuchas»). Sigue en la lista solo para
  // no descartar la de quien aún use una versión anterior en otro equipo.
  'playHistory',
  'school',
  // Horario del colegio y las clases del mes, con los temas que el estudiante
  // anota en cada una. Faltaban: quien reinstalaba o cambiaba de equipo perdía
  // el horario entero aunque "todo estuviera en la nube".
  'schedules',
  'classSessions',
  // Acumulado real de reproducciones: sin respaldo, al reinstalar se resembraba
  // con la longitud del registro rodante y la cifra del expediente bajaba.
  'playCount',
  // Índice de las imágenes que viajan entre dispositivos (foto de perfil,
  // horario, portadas de playlists, asignaturas y colecciones). Los archivos
  // van a Supabase Storage; aquí solo qué versión tiene cada una (image-sync.ts).
  'syncedImages',
  // Anotaciones sin asignatura del «+» de la barra (src/lib/loose-notes.ts).
  'looseNotes',
  // 'studyVideos' queda FUERA a propósito: cada ficha puede llevar la ruta
  // del archivo descargado en ESTE equipo, que en otro no existe.
] as const;

// No hay claves globales (sin uid): la única, 'headerQuote' (la frase propia
// de la barra superior), se retiró en la 1.6.2. Un respaldo antiguo que aún la
// traiga no rompe nada: `applyLocalData` solo escribe las de SCOPED_KEYS, así
// que la ignora.

export type LocalSnapshot = Record<string, unknown>;

const read = (key: string): unknown => {
  if (typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

/** Devuelve false si no se pudo escribir (cuota llena, almacenamiento vetado). */
const write = (key: string, value: unknown): boolean => {
  if (typeof window === 'undefined' || value === undefined) return true;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export function collectLocalData(uid: string): LocalSnapshot {
  const snapshot: LocalSnapshot = {};
  for (const key of SCOPED_KEYS) {
    const value = read(`${key}_${uid}`);
    if (value !== undefined) snapshot[key] = value;
  }
  return snapshot;
}

interface ApplyResult {
  /** Todas las escrituras entraron. Si es false, NO se debe dar por aplicada. */
  ok: boolean;
  /** Alguna clave cambió de verdad respecto a lo que había en disco. */
  changed: boolean;
}

/**
 * Vuelca un estado fusionado en localStorage, tocando SOLO las claves cuyo
 * contenido cambia. Reescribir lo idéntico no es inocuo: cada escritura es un
 * bloqueo del hilo principal y, sobre todo, `changed` es lo que decide si la
 * interfaz viva tiene que recargarse desde disco.
 */
/** Escrituras que llegan de la nube (no son cambios del usuario: no se re-suben). */
let applyingRemote = 0;
export const isApplyingRemote = (): boolean => applyingRemote > 0;

export function applyLocalData(uid: string, snapshot: LocalSnapshot | null | undefined): ApplyResult {
  applyingRemote += 1;
  try {
    return applyLocalDataInner(uid, snapshot);
  } finally {
    applyingRemote -= 1;
  }
}

function applyLocalDataInner(uid: string, snapshot: LocalSnapshot | null | undefined): ApplyResult {
  if (!snapshot || typeof snapshot !== 'object') return { ok: false, changed: false };
  let ok = true;
  let changed = false;

  const put = (storageKey: string, value: unknown) => {
    if (value === undefined) return;
    const next = JSON.stringify(value);
    if (window.localStorage.getItem(storageKey) === next) return;
    changed = true;
    if (!write(storageKey, value)) ok = false;
  };

  // Lo que no esté en SCOPED_KEYS (p. ej. 'headerQuote' de un respaldo
  // anterior a la 1.6.2) no se escribe: se ignora.
  for (const key of SCOPED_KEYS) {
    if (key in snapshot) put(`${key}_${uid}`, snapshot[key]);
  }
  return { ok, changed };
}
