// ============================================================
// Analítica académica: índice diario del historial completo + agregados
// por periodo (semana ISO o mes natural). Capa pura (sin React) para que
// cualquier interfaz pueda reutilizar la misma matemática.
//
// El tiempo de estudio SIEMPRE se deriva de `sessionSeconds` (segundos
// exactos); los minutos que se exponen aquí llevan decimales.
// ============================================================

import {
  differenceInCalendarDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfISOWeek,
  endOfMonth,
  format,
  isAfter,
  isValid,
  parseISO,
  startOfISOWeek,
  startOfMonth,
  startOfToday,
} from 'date-fns';
import type {
  ArchivedTask,
  DailyPerformance,
  Habit,
  StudyGoals,
  StudySession,
  TaskPriority,
} from '@/types';
import { sessionSeconds } from '@/lib/duration';
import { tr } from '@/lib/i18n';
import { isScheduled } from '@/lib/habit-schedule';
import { localDayKey } from '@/lib/dates';

/** getDay() (0 = domingo) → clave de StudyGoals. Mismo orden que Enfoque. */
export const GOAL_DAY_KEYS: (keyof StudyGoals)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const PRIORITIES: TaskPriority[] = ['Alta', 'Media', 'Baja'];

/** Asignatura imputada a las sesiones que no declararon ninguna. */
/** Grupo de las sesiones sin asignatura: se traduce al agrupar, y quien
 *  compara usa esta misma función, así que siempre coinciden. */
export const unassignedSubject = (): string => tr('Sin asignatura');

export type PeriodScope = 'week' | 'month';

export const dayKey = (d: Date): string => format(d, 'yyyy-MM-dd');

/** parseISO tolerante: los datos vienen de localStorage y pueden estar corruptos. */
const safeKey = (iso?: string | null): string | null => {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    return isValid(d) ? dayKey(d) : null;
  } catch {
    return null;
  }
};

export interface DayBucket {
  minutes: number;
  sessions: number;
  perceptionSum: number;
  tasksDone: number;
  tasksWithDue: number;
  tasksOnTime: number;
  habitChecks: number;
  minutesBySubject: Record<string, number>;
  tasksByCourse: Record<string, number>;
  tasksByPriority: Record<TaskPriority, number>;
}

/** Índice global por día ('yyyy-MM-dd'), construido UNA sola vez sobre todo el historial. */
export type DayIndex = Map<string, DayBucket>;

const emptyBucket = (): DayBucket => ({
  minutes: 0,
  sessions: 0,
  perceptionSum: 0,
  tasksDone: 0,
  tasksWithDue: 0,
  tasksOnTime: 0,
  habitChecks: 0,
  minutesBySubject: {},
  tasksByCourse: {},
  tasksByPriority: { Alta: 0, Media: 0, Baja: 0 },
});

export function buildDayIndex(
  studySessions: StudySession[],
  archivedTasks: ArchivedTask[],
  activeHabits: Habit[]
): DayIndex {
  const idx: DayIndex = new Map();
  const at = (k: string): DayBucket => {
    let b = idx.get(k);
    if (!b) {
      b = emptyBucket();
      idx.set(k, b);
    }
    return b;
  };

  for (const s of studySessions) {
    const k = safeKey(s.startTime);
    if (!k) continue;
    const b = at(k);
    const minutes = sessionSeconds(s) / 60;
    b.minutes += minutes;
    b.sessions += 1;
    b.perceptionSum += s.perception || 0;
    const subjects = s.subjects?.length ? s.subjects : [unassignedSubject()];
    // El tiempo se reparte a partes iguales entre las asignaturas de la sesión.
    const share = minutes / subjects.length;
    for (const subject of subjects) {
      b.minutesBySubject[subject] = (b.minutesBySubject[subject] || 0) + share;
    }
  }

  for (const t of archivedTasks) {
    const k = safeKey(t.archivedAt);
    if (!k) continue;
    const b = at(k);
    b.tasksDone += 1;
    const course = t.courseName || tr('Sin asignatura');
    b.tasksByCourse[course] = (b.tasksByCourse[course] || 0) + 1;
    const priority: TaskPriority = PRIORITIES.includes(t.priority) ? t.priority : 'Media';
    b.tasksByPriority[priority] += 1;
    if (t.dueDate) {
      try {
        const due = parseISO(t.dueDate);
        const done = parseISO(t.archivedAt);
        if (isValid(due) && isValid(done)) {
          b.tasksWithDue += 1;
          if (differenceInCalendarDays(done, due) <= 0) b.tasksOnTime += 1;
        }
      } catch {
        // Fecha corrupta: la tarea cuenta como hecha pero no puntúa en puntualidad.
      }
    }
  }

  for (const h of activeHabits) {
    for (const d of h.completedOn) at(d).habitChecks += 1;
  }

  return idx;
}

interface PeriodMetrics {
  start: Date;
  end: Date;
  totalDays: number;
  /** Días del periodo cuya fecha ya llegó (mínimo 1, para no dividir por cero). */
  elapsedDays: number;
  minutes: number;
  sessions: number;
  avgSessionMinutes: number;
  tasksDone: number;
  tasksWithDue: number;
  tasksOnTime: number;
  /** % de tareas entregadas antes de su fecha límite; null si ninguna tenía fecha. */
  punctuality: number | null;
  /** % de casillas de hábito marcadas; null si no hay hábitos activos. */
  habitConsistency: number | null;
  goalMinutes: number;
  goalCompliance: number;
  /** Indicador compuesto 0-100 (meta + puntualidad + constancia). */
  effectiveness: number;
  avgPerception: number | null;
  avgScore: number | null;
  activeDays: number;
  daysMeetingGoal: number;
  longestStreak: number;
  bestDay: { key: string; minutes: number } | null;
  minutesBySubject: Record<string, number>;
  tasksByCourse: Record<string, number>;
  tasksByPriority: Record<TaskPriority, number>;
}

export interface MetricsOptions {
  studyGoals: StudyGoals;
  /** Los hábitos activos: sus días y su alta deciden qué marcas eran posibles. */
  activeHabits: Pick<Habit, 'days' | 'createdAt'>[];
  performances: DailyPerformance[];
}

export function computeMetrics(
  index: DayIndex,
  start: Date,
  end: Date,
  { studyGoals, activeHabits, performances }: MetricsOptions
): PeriodMetrics {
  const days = eachDayOfInterval({ start, end });
  const today = startOfToday();
  const habitSince = activeHabits.map((habit) => (habit.createdAt ? localDayKey(habit.createdAt) : ''));

  let minutes = 0;
  let sessions = 0;
  let perceptionSum = 0;
  let tasksDone = 0;
  let tasksWithDue = 0;
  let tasksOnTime = 0;
  let habitChecks = 0;
  let habitPossible = 0;
  let goalMinutes = 0;
  let activeDays = 0;
  let daysMeetingGoal = 0;
  let elapsedDays = 0;
  let streak = 0;
  let longestStreak = 0;
  const minutesBySubject: Record<string, number> = {};
  const tasksByCourse: Record<string, number> = {};
  const tasksByPriority: Record<TaskPriority, number> = { Alta: 0, Media: 0, Baja: 0 };
  let bestDay: { key: string; minutes: number } | null = null;

  for (const d of days) {
    const k = dayKey(d);
    const isElapsed = !isAfter(d, today);
    const goal = studyGoals[GOAL_DAY_KEYS[d.getDay()]] || 0;
    if (isElapsed) {
      elapsedDays += 1;
      goalMinutes += goal;
      // Solo lo que tocaba ese día y desde el alta de cada hábito: un hábito de
      // lunes, miércoles y viernes cumplido entero daba un 43 % (13-oct-2026).
      activeHabits.forEach((habit, i) => {
        if (isScheduled(habit, d) && !(habitSince[i] && k < habitSince[i])) habitPossible += 1;
      });
    }

    const b = index.get(k);
    if (!b) {
      longestStreak = Math.max(longestStreak, streak);
      streak = 0;
      continue;
    }

    minutes += b.minutes;
    sessions += b.sessions;
    perceptionSum += b.perceptionSum;
    tasksDone += b.tasksDone;
    tasksWithDue += b.tasksWithDue;
    tasksOnTime += b.tasksOnTime;
    habitChecks += b.habitChecks;
    for (const [subject, m] of Object.entries(b.minutesBySubject)) {
      minutesBySubject[subject] = (minutesBySubject[subject] || 0) + m;
    }
    for (const [course, n] of Object.entries(b.tasksByCourse)) {
      tasksByCourse[course] = (tasksByCourse[course] || 0) + n;
    }
    for (const p of PRIORITIES) tasksByPriority[p] += b.tasksByPriority[p];

    if (b.minutes > 0) {
      activeDays += 1;
      streak += 1;
      if (!bestDay || b.minutes > bestDay.minutes) bestDay = { key: k, minutes: b.minutes };
    } else {
      longestStreak = Math.max(longestStreak, streak);
      streak = 0;
    }
    if (goal > 0 && b.minutes >= goal) daysMeetingGoal += 1;
  }
  longestStreak = Math.max(longestStreak, streak);
  elapsedDays = Math.max(1, elapsedDays);

  const goalCompliance =
    goalMinutes > 0 ? Math.min(100, (minutes / goalMinutes) * 100) : minutes > 0 ? 100 : 0;
  const punctuality = tasksWithDue > 0 ? (tasksOnTime / tasksWithDue) * 100 : null;
  const habitConsistency =
    activeHabits.length > 0 && habitPossible > 0 ? Math.min(100, (habitChecks / habitPossible) * 100) : null;

  // Media ponderada renormalizada sobre los sub-indicadores disponibles:
  // así la efectividad sigue siendo comparable aunque falten datos.
  const parts: { w: number; v: number }[] = [{ w: 0.45, v: goalCompliance }];
  if (punctuality !== null) parts.push({ w: 0.35, v: punctuality });
  if (habitConsistency !== null) parts.push({ w: 0.2, v: habitConsistency });
  const weightSum = parts.reduce((acc, p) => acc + p.w, 0);
  const effectiveness = Math.round(parts.reduce((acc, p) => acc + p.w * p.v, 0) / weightSum);

  const startKey = dayKey(start);
  const endKey = dayKey(end);
  const scores = performances
    .filter((p) => p.date >= startKey && p.date <= endKey)
    .map((p) => p.score);

  return {
    start,
    end,
    totalDays: days.length,
    elapsedDays,
    minutes,
    sessions,
    avgSessionMinutes: sessions > 0 ? minutes / sessions : 0,
    tasksDone,
    tasksWithDue,
    tasksOnTime,
    punctuality,
    habitConsistency,
    goalMinutes,
    goalCompliance: Math.round(goalCompliance),
    effectiveness,
    avgPerception: sessions > 0 ? perceptionSum / sessions : null,
    avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    activeDays,
    daysMeetingGoal,
    longestStreak,
    bestDay,
    minutesBySubject,
    tasksByCourse,
    tasksByPriority,
  };
}

/** Rango del periodo desplazado `delta` unidades respecto de `reference`. */
export function shiftRange(
  scope: PeriodScope,
  reference: Date,
  delta: number
): { start: Date; end: Date } {
  if (scope === 'week') {
    const anchor = addWeeks(reference, delta);
    return { start: startOfISOWeek(anchor), end: endOfISOWeek(anchor) };
  }
  const anchor = addMonths(reference, delta);
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

/** Periodo actual desplazado `offset` (0 = el de hoy, negativo = hacia atrás). */
export const periodRange = (scope: PeriodScope, offset: number) =>
  shiftRange(scope, startOfToday(), offset);

/** Misma letra de rendimiento que usa Enfoque para el marcador diario. */
export function gradeForScore(score: number): DailyPerformance['grade'] {
  if (score >= 18) return 'AD';
  if (score >= 14) return 'A';
  if (score >= 11) return 'B';
  return 'C';
}
