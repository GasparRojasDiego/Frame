import { classSessionKey } from '@/lib/schedule';
import type { ClassSession } from '@/types';

// ============================================================
// A qué CLASE pertenece lo que se crea en una asignatura.
//
// Un recurso o una tarea nace en una clase concreta: «lo que dejó hoy el
// profesor». Regla, en este orden:
//   1. Si HOY hay clase de la asignatura, esa (si hay varias: la que está en
//      curso, o la más cercana a la hora actual).
//   2. Si hoy no hay, la ÚLTIMA clase ya dada.
//   3. Sin clases anteriores (asignatura sin horario), nada: queda «sin clase».
//
// El vínculo se guarda con la clave ESTABLE de la clase (asignatura|día|hora),
// no con su id: reimportar el horario recrea las clases con ids nuevos, y los
// recursos no deben quedarse huérfanos por eso.
// ============================================================

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const minutesOf = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

export function resolveClassKey(
  classSessions: ClassSession[],
  courseId: string,
  now: Date = new Date()
): string | undefined {
  if (!courseId) return undefined;
  const mine = classSessions.filter((session) => session.courseId === courseId);
  if (mine.length === 0) return undefined;

  const today = dayKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todays = mine.filter((session) => session.date === today);
  if (todays.length > 0) {
    const running = todays.find(
      (session) => minutesOf(session.start) <= nowMinutes && nowMinutes <= minutesOf(session.end)
    );
    const nearest = [...todays].sort(
      (a, b) => Math.abs(minutesOf(a.start) - nowMinutes) - Math.abs(minutesOf(b.start) - nowMinutes)
    )[0];
    return classSessionKey(running ?? nearest);
  }

  const past = mine
    .filter((session) => session.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))[0];
  return past ? classSessionKey(past) : undefined;
}

export type ClassMoment = 'past' | 'today' | 'now' | 'future';

/** Pasada, de hoy, en curso ahora mismo o futura. */
export function classMoment(session: Pick<ClassSession, 'date' | 'start' | 'end'>, now: Date = new Date()): ClassMoment {
  const today = dayKey(now);
  if (session.date < today) return 'past';
  if (session.date > today) return 'future';
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes > minutesOf(session.end)) return 'past';
  if (nowMinutes >= minutesOf(session.start)) return 'now';
  return 'today';
}
