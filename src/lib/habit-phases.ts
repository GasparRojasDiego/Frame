import type { Habit, HabitPhase } from '@/types';

// ============================================================
// Hábitos por fases del día.
//
// Con diez hábitos —dos de mañana, cuatro de tarde y cuatro de noche—, a las
// nueve de la mañana lo ÚNICO que se puede haber hecho son los dos primeros.
// Medir ese momento contra los diez da «20 %» a alguien que lo lleva perfecto.
// Por eso el avance de HOY se mide solo contra los hábitos cuya fase ya empezó,
// y el resultado completo del día se da cuando empieza la última (la noche).
//
// Un hábito sin fase es «de todo el día»: se evalúa al final, con la noche.
// ============================================================

export interface PhaseInfo {
  id: HabitPhase;
  label: string;
  /** Hora (0–23) a la que empieza. */
  startHour: number;
  range: string;
}

export const HABIT_PHASES: PhaseInfo[] = [
  { id: 'morning', label: 'Mañana', startHour: 5, range: '5:00 – 11:59' },
  { id: 'afternoon', label: 'Tarde', startHour: 12, range: '12:00 – 18:59' },
  { id: 'night', label: 'Noche', startHour: 19, range: 'desde las 19:00' },
];

export const ALL_DAY_LABEL = 'Todo el día';

export const phaseLabel = (phase: HabitPhase | undefined): string =>
  HABIT_PHASES.find((p) => p.id === phase)?.label ?? ALL_DAY_LABEL;

/** Orden de presentación: mañana, tarde, noche y, al final, todo el día. */
export const phaseRank = (phase: HabitPhase | undefined): number => {
  const index = HABIT_PHASES.findIndex((p) => p.id === phase);
  return index === -1 ? HABIT_PHASES.length : index;
};

/** ¿Ya empezó hoy la fase de este hábito? (Sin fase: cuenta desde la noche.) */
export function phaseStarted(phase: HabitPhase | undefined, now: Date = new Date()): boolean {
  const info = HABIT_PHASES.find((p) => p.id === phase) ?? HABIT_PHASES[HABIT_PHASES.length - 1];
  return now.getHours() >= info.startHour;
}

/** La fase en curso, o null antes de que empiece la mañana. */
export function currentPhase(now: Date = new Date()): HabitPhase | null {
  let current: HabitPhase | null = null;
  for (const phase of HABIT_PHASES) if (now.getHours() >= phase.startHour) current = phase.id;
  return current;
}

export const usesPhases = (habits: Habit[]): boolean => habits.some((habit) => !!habit.phase);
