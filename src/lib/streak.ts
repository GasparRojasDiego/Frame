import { format, isSameDay, parseISO, subDays } from 'date-fns';
import { GOAL_DAY_KEYS, gradeForScore } from '@/lib/academic-metrics';
import type { DailyPerformance, StreakGoal, StudyGoals, StudySession } from '@/types';

// ============================================================
// La racha: días seguidos cumpliendo la meta de racha de Ajustes (una nota
// mínima en modo Rendimiento o unos minutos mínimos en modo Tiempo).
//
// Una sola regla para «Días de racha» de Inicio y la frase de la barra
// superior: la barra contaba cualquier día con estudio y, en la misma
// pantalla, salían dos cifras distintas de «días seguidos».
//
// Los días pasados se juzgan con lo guardado (minutos o la nota del día); hoy,
// en vivo. Hoy sin cumplir no cuenta, pero tampoco rompe: la racha se rompe
// por un día PASADO sin cumplir.
// ============================================================

const GRADE_VALUE: Record<DailyPerformance['grade'], number> = { C: 0, B: 1, A: 2, AD: 3 };

/** Día LOCAL de un instante ISO. Cortar la cadena daría el día en UTC. */
const localDayKey = (iso: string): string => {
  try {
    return format(parseISO(iso), 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

export interface StreakData {
  now: Date;
  streakGoal: StreakGoal;
  studySessions: StudySession[];
  dailyPerformances: DailyPerformance[];
  studyGoals: StudyGoals | null | undefined;
}

/** Días seguidos que se cumple la meta de racha, contando hoy si ya se cumplió. */
export function currentStreak({ now, streakGoal, studySessions, dailyPerformances, studyGoals }: StreakData): number {
  const perfMap = new Map(dailyPerformances.map((p) => [p.date, p]));
  const sessionMap = new Map<string, number>();
  studySessions.forEach((session) => {
    const dateStr = localDayKey(session.startTime);
    sessionMap.set(dateStr, (sessionMap.get(dateStr) || 0) + session.duration);
  });

  let streak = 0;
  let dayToCheck = now;

  for (let i = 0; i < 365; i++) {
    const dateStr = format(dayToCheck, 'yyyy-MM-dd');
    const isToday = isSameDay(dayToCheck, now);
    let dayGoalMet = false;

    if (streakGoal.mode === 'tiempo') {
      dayGoalMet = (sessionMap.get(dateStr) || 0) >= streakGoal.minutes;
    } else if (isToday) {
      // Hoy aún no tiene nota guardada: se calcula en vivo con sus sesiones.
      const todaysPerfSessions = studySessions.filter(
        (s) => localDayKey(s.startTime) === dateStr && s.mode === 'rendimiento'
      );
      const tObj = studyGoals?.[GOAL_DAY_KEYS[dayToCheck.getDay()]] || 0;
      if (todaysPerfSessions.length > 0 && tObj > 0) {
        const totalMinutes = todaysPerfSessions.reduce((acc, s) => acc + s.duration, 0);
        const pAvg = todaysPerfSessions.reduce((acc, s) => acc + s.perception, 0) / todaysPerfSessions.length;
        const grade = gradeForScore(Math.min(20, pAvg * (totalMinutes / tObj)));
        dayGoalMet = GRADE_VALUE[grade] >= GRADE_VALUE[streakGoal.grade];
      }
    } else {
      const perf = perfMap.get(dateStr);
      dayGoalMet = Boolean(perf && GRADE_VALUE[perf.grade] >= GRADE_VALUE[streakGoal.grade]);
    }

    if (dayGoalMet) streak++;
    else if (!isToday) break;
    dayToCheck = subDays(dayToCheck, 1);
  }

  return streak;
}
