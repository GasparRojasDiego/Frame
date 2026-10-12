import { useCallback, useSyncExternalStore } from 'react';
import { CLOUD_APPLIED_EVENT } from '@/lib/supabase/sync';

// ============================================================
// Anotaciones sin asignatura.
//
// El «+» de la barra superior ya dejaba apuntar una tarea sin decidir dónde
// va; la anotación, en cambio, exigía elegir asignatura antes de guardar, y
// eso es justo lo que hace que algo dictado en el pasillo no se apunte. Ahora
// la anotación suelta se guarda tal cual y aparece en Inicio como tarjeta,
// hasta que se coloque en su asignatura o se borre.
//
// No entra en el modelo de notas del contexto a propósito: una nota de
// asignatura es un recurso suyo y todas las pantallas que las leen dan por
// hecho que tiene `courseId`. Meter notas con `courseId` vacío las habría
// colado en recuentos e informes de asignatura.
//
// Clave por perfil (`looseNotes_<uid>`), en la lista de claves que viajan a
// la nube (storage-snapshot.ts) y fusionada registro a registro por su `id`
// (sync-merge.ts), igual que las notas.
// ============================================================

export interface LooseNote {
  id: string;
  /** Texto tal cual se escribió (con sus saltos de línea). */
  content: string;
  /** Alta (ISO 8601). */
  createdAt: string;
}

export const looseNotesKey = (uid: string) => `looseNotes_${uid}`;

/** Aviso interno: alguien escribió en la lista (este u otro componente). */
const CHANGED_EVENT = 'frame:loose-notes-changed';

const EMPTY: LooseNote[] = [];

/** Nunca confía en lo guardado: descarta lo que no tenga forma de anotación. */
function sanitize(raw: unknown): LooseNote[] {
  if (!Array.isArray(raw)) return EMPTY;
  return raw.filter(
    (row): row is LooseNote =>
      Boolean(row) &&
      typeof row === 'object' &&
      typeof (row as LooseNote).id === 'string' &&
      typeof (row as LooseNote).content === 'string' &&
      typeof (row as LooseNote).createdAt === 'string'
  );
}

// Instantánea por clave: `useSyncExternalStore` exige devolver el MISMO array
// mientras el texto guardado no cambie, o repintaría en bucle.
const cache = new Map<string, { raw: string | null; notes: LooseNote[] }>();

function snapshot(uid: string): LooseNote[] {
  const key = looseNotesKey(uid);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.notes;
  let notes = EMPTY;
  if (raw) {
    try {
      notes = sanitize(JSON.parse(raw));
    } catch {
      notes = EMPTY;
    }
  }
  cache.set(key, { raw, notes });
  return notes;
}

export function readLooseNotes(uid: string | null | undefined): LooseNote[] {
  if (typeof window === 'undefined' || !uid) return EMPTY;
  return snapshot(uid);
}

/** Devuelve false si no se pudo escribir (cuota llena, almacenamiento vetado). */
function writeLooseNotes(uid: string, notes: LooseNote[]): boolean {
  try {
    window.localStorage.setItem(looseNotesKey(uid), JSON.stringify(notes));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
  return true;
}

/** Guarda una anotación suelta; la más reciente va primero. Null si no entró. */
export function addLooseNote(uid: string, content: string): LooseNote | null {
  const text = content.trim();
  if (!text) return null;
  const note: LooseNote = { id: crypto.randomUUID(), content: text, createdAt: new Date().toISOString() };
  return writeLooseNotes(uid, [note, ...readLooseNotes(uid)]) ? note : null;
}

export function deleteLooseNote(uid: string, id: string): boolean {
  return writeLooseNotes(
    uid,
    readLooseNotes(uid).filter((note) => note.id !== id)
  );
}

function subscribe(listener: () => void) {
  // Cambios de este mismo equipo, de otra ventana (evento `storage`) y de
  // otro dispositivo (la sincronización vuelca la nube en localStorage).
  window.addEventListener(CHANGED_EVENT, listener);
  window.addEventListener(CLOUD_APPLIED_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGED_EVENT, listener);
    window.removeEventListener(CLOUD_APPLIED_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/** Anotaciones sueltas del perfil, vivas: se repinta al añadir, borrar o sincronizar. */
export function useLooseNotes(uid: string | null | undefined): LooseNote[] {
  const get = useCallback(() => readLooseNotes(uid), [uid]);
  return useSyncExternalStore(subscribe, get, get);
}
