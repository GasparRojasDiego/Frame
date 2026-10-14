import { subDays } from 'date-fns';
import { GOAL_DAY_KEYS, gradeForScore } from '@/lib/academic-metrics';
import { localDayKey } from '@/lib/dates';
import type { DailyPerformance, StreakGoal, StudyGoals, StudySession } from '@/types';

// ============================================================
// La racha: días seguidos cumpliendo la meta de racha de Ajustes (una nota
// mínima en modo Rendimiento o unos minutos mínimos en modo Tiempo).
//
// Una sola regla para «Días de racha» de Inicio, la frase de la barra
// superior y «Tu racha» de Ajustes: cada sitio tenía la suya y, en la misma
// pantalla, salían cifras distintas (Ajustes no contaba nunca el día de hoy
// en modo Rendimiento, porque la nota de hoy no se guarda hasta mañana).
//
// Los días pasados se juzgan con lo guardado (minutos o la nota del día); hoy,
// en vivo. Hoy sin cumplir no cuenta, pero tampoco rompe: la racha se rompe
// por un día PASADO sin cumplir.
// ============================================================

const GRADE_VALUE: Record<DailyPerformance['grade'], number> = { C: 0, B: 1, A: 2, AD: 3 };

interface StreakData {
  now: Date;
  streakGoal: StreakGoal;
  studySessions: StudySession[];
  dailyPerformances: DailyPerformance[];
  studyGoals: StudyGoals | null | undefined;
}

/** La regla de un día (`yyyy-MM-dd`): ¿cumplió la meta de racha? */
export function streakJudge({ now, streakGoal, studySessions, dailyPerformances, studyGoals }: StreakData): (key: string) => boolean {
  const todayKey = localDayKey(now);
  const perfMap = new Map(dailyPerformances.map((p) => [p.date, p]));
  const minutesByDay = new Map<string, number>();
  const todayPerf: StudySession[] = [];
  for (const session of studySessions) {
    const key = localDayKey(session.startTime);
    if (!key) continue;
    minutesByDay.set(key, (minutesByDay.get(key) || 0) + session.duration);
    if (key === todayKey && session.mode === 'rendimiento') todayPerf.push(session);
  }

  // Hoy aún no tiene nota guardada: se calcula en vivo con sus sesiones.
  let todayMet = false;
  const target = studyGoals?.[GOAL_DAY_KEYS[now.getDay()]] || 0;
  if (todayPerf.length > 0 && target > 0) {
    const totalMinutes = todayPerf.reduce((acc, s) => acc + s.duration, 0);
    const pAvg = todayPerf.reduce((acc, s) => acc + s.perception, 0) / todayPerf.length;
    const grade = gradeForScore(Math.min(20, pAvg * (totalMinutes / target)));
    todayMet = GRADE_VALUE[grade] >= GRADE_VALUE[streakGoal.grade];
  }

  return (key) => {
    if (streakGoal.mode === 'tiempo') return (minutesByDay.get(key) || 0) >= streakGoal.minutes;
    if (key === todayKey) return todayMet;
    const perf = perfMap.get(key);
    return Boolean(perf && GRADE_VALUE[perf.grade] >= GRADE_VALUE[streakGoal.grade]);
  };
}

/** Días seguidos que se cumple la meta de racha, contando hoy si ya se cumplió. */
export function currentStreak(data: StreakData): number {
  const met = streakJudge(data);
  let streak = 0;
  let day = data.now;
  // Sin tope de un año: una racha más larga se mostraba como 365.
  for (let i = 0; i < 36_500; i++) {
    if (met(localDayKey(day))) streak++;
    else if (i > 0) break;
    day = subDays(day, 1);
  }
  return streak;
}
