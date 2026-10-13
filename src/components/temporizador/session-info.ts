import { parseISO } from 'date-fns';
import { sessionSeconds } from '@/lib/duration';
import type { Course, StudySession } from '@/types';

// ============================================================
// Lecturas comunes de una sesión de estudio guardada: su tramo horario, sus
// asignaturas y si lleva enfoque. Las usan la tarjeta de sesión, su detalle
// y el calendario de calificaciones; tres copias acabarían discrepando.
// ============================================================

/**
 * Tramo horario real de una sesión. `startTime` y `endTime` guardan ambos el
 * instante en que la sesión se REGISTRÓ, así que la hora de inicio se deduce
 * restando la duración. Las pausas alargan el tramo de verdad, de modo que
 * esto es el mínimo: nunca inventa tiempo que no se estudió.
 */
export function sessionRange(session: StudySession): { start: Date; end: Date } | null {
  try {
    const end = parseISO(session.endTime || session.startTime);
    if (Number.isNaN(end.getTime())) return null;
    return { start: new Date(end.getTime() - sessionSeconds(session) * 1000), end };
  } catch {
    return null;
  }
}

/** Asignatura de una sesión: la del catálogo si sigue existiendo y, si no,
 *  solo el nombre con el que se guardó (portada de olas). */
interface SessionSubject {
  key: string;
  name: string;
  course: Course | null;
}

/**
 * Asignaturas de la sesión en el orden en que se marcaron. Las sesiones
 * antiguas no guardan el id, solo el nombre: se resuelven por nombre.
 *
 * Los ids y los nombres NO se emparejan por posición: hasta la 1.6.2 el
 * cierre de sesión guardaba los ids en el orden de marcado y los nombres en
 * el del catálogo. Primero se resuelven los ids; a los que ya no existen (una
 * asignatura borrada) les tocan los nombres que no son de ninguna asignatura
 * ya encontrada, prefiriendo el de su misma posición si está entre ellos.
 */
export function sessionSubjects(session: StudySession, courses: Course[]): SessionSubject[] {
  const names = session.subjects ?? [];
  const ids = session.subjectIds ?? [];
  const out: SessionSubject[] = [];
  const seen = new Set<string>();

  const byId = ids.map((id) => (id ? courses.find((c) => c.id === id) ?? null : null));
  const found = new Set(byId.flatMap((course) => (course ? [course.name] : [])));
  const spare = names.filter((name) => !found.has(name));
  const takeSpare = (index: number): string | undefined => {
    const same = spare.indexOf(names[index]);
    return spare.length > 0 ? spare.splice(same >= 0 ? same : 0, 1)[0] : undefined;
  };

  const longest = Math.max(names.length, ids.length);
  for (let index = 0; index < longest; index++) {
    const id = ids[index];
    let course = byId[index] ?? null;
    let name: string | undefined;
    if (!course) {
      name = takeSpare(index);
      course = (name ? courses.find((c) => c.name === name) : undefined) ?? null;
    }
    const key = course?.id ?? id ?? `name:${name ?? index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // El nombre vigente manda: si la asignatura se renombró, se lee el nuevo.
    out.push({ key, name: course?.name ?? name ?? 'Asignatura', course });
  }
  return out;
}

/** La sesión se puntuó con enfoque (las del modo «tiempo» guardan 0). */
export function sessionHasFocus(session: StudySession): boolean {
  return session.mode !== 'tiempo' && session.perception > 0;
}
