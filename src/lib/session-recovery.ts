import type { InterruptedSession, SessionNote } from '@/types';

// ============================================================
// Rescate de una sesión de estudio que se perdió.
//
// El problema real: hasta ahora la sesión en curso solo existía en memoria y
// se guardaba en el último suspiro del webview (`beforeunload`). Ese suspiro
// NO llega cuando la app se cierra de golpe —una actualización que reinicia
// Frame, un cierre forzado, un corte de luz—, así que el tiempo estudiado se
// evaporaba y las anotaciones se quedaban huérfanas: visibles, sin sesión a
// la que pertenecer y sin forma de registrarlas.
//
// La solución es no depender de ningún aviso de cierre: mientras la sesión
// vive, se deja un LATIDO en disco cada segundo. Pase lo que pase, al abrir
// Frame hay una foto de la sesión con menos de un segundo de antigüedad.
//
// Este módulo es el que lee esas huellas al arrancar, en orden de calidad:
//
//   1. Suspensión deliberada  — el usuario aparcó la sesión. Trae el reloj.
//   2. Latido de la sesión viva — la app murió; trae el reloj hasta el
//      último segundo conocido. NUNCA cuenta el tiempo que la app estuvo
//      cerrada: nadie puede saber si se siguió estudiando.
//   3. Red de seguridad del cierre — registros antiguos, sin reloj.
//   4. Solo anotaciones — ni siquiera hubo latido (sesión anterior a esta
//      versión). El minuto de la última anotación da un suelo honesto de
//      cuánto duró: se ofrece ese tiempo, nunca uno inventado.
//
// Vive fuera de CourseContext porque el arranque de la app lo consulta
// ANTES de montar el proveedor, para decidir si abre el rescate.
// ============================================================

export const activeSessionKey = (uid: string) => `activeSession_${uid}`;
const interruptedSessionKey = (uid: string) => `interruptedSession_${uid}`;
const sessionNotesKey = (uid: string) => `sessionNotes_${uid}`;

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

/** Anotaciones de la sesión en curso, ordenadas como se escribieron. */
function readSessionNotes(uid: string): SessionNote[] {
  const notes = readJson<SessionNote[]>(sessionNotesKey(uid));
  return Array.isArray(notes) ? notes : [];
}

/**
 * Lo que se puede rescatar al abrir la app, o `null` si no hay nada que
 * rescatar. El resultado ya viene normalizado: quien lo consume no necesita
 * saber de qué huella salió, solo mirar `origin` para elegir las palabras.
 */
export function readRecoverableSession(uid: string): InterruptedSession | null {
  const live = readJson<InterruptedSession>(activeSessionKey(uid));
  const legacy = readJson<InterruptedSession>(interruptedSessionKey(uid));

  // 1. Suspensión deliberada: es la mejor huella y la única que el usuario
  //    dejó a propósito, así que manda sobre el latido.
  if (legacy?.suspendedAt && (legacy.duration ?? 0) > 0) {
    return { ...legacy, origin: 'suspend' };
  }

  // 2. Latido de la sesión viva.
  if (live && (live.duration ?? 0) > 0) {
    return { ...live, origin: 'live' };
  }

  // 3. Red de seguridad del cierre del webview (registros de versiones
  //    anteriores: traen el tiempo pero no el reloj).
  if (legacy && (legacy.duration ?? 0) > 0) {
    return { ...legacy, origin: 'unload' };
  }

  // 4. Ni rastro de la sesión, pero sus anotaciones siguen ahí. Sin esto
  //    quedan atascadas para siempre: ni se registran ni se pueden quitar.
  const notes = readSessionNotes(uid);
  if (notes.length > 0) {
    const floor = notes.reduce((max, note) => Math.max(max, note.elapsedSec ?? 0), 0);
    const last = notes[notes.length - 1];
    return {
      duration: Math.max(1, Math.round(floor)),
      selectionMode: readJson<'rendimiento' | 'tiempo'>(`selectionMode_${uid}`) ?? 'rendimiento',
      timerMode: 'stopwatch',
      origin: 'notes',
      updatedAt: last?.at,
    };
  }

  return null;
}

/** Borra TODAS las huellas: la sesión ya se registró, se retomó o se tiró. */
export function clearRecoverableSession(uid: string) {
  try {
    localStorage.removeItem(activeSessionKey(uid));
    localStorage.removeItem(interruptedSessionKey(uid));
  } catch {
    /* almacenamiento no disponible: no hay nada que limpiar */
  }
}
