import type { Habit } from '@/types';

// ============================================================
// Qué días toca cada hábito.
//
// Un hábito es «cada día» o «cada cierto tiempo»: en el segundo caso guarda
// los días de la semana en que se repite (`days`, con 0 = domingo … 6 =
// sábado, como `Date.getDay()`). Un día que no le toca NO es un día fallado:
// no aparece como casilla en la tabla, no entra en los porcentajes ni corta
// las rachas. Todas las cuentas de cumplimiento de Frame pasan por aquí.
// ============================================================

/** Días de la semana en el orden en que se muestran: de lunes a domingo. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const WEEKDAY_INITIAL: Record<number, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 0: 'D' };

/** Nombre del día en singular, para las listas («lunes, sábado y domingo»). */
const WEEKDAY_NAME: Record<number, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  0: 'domingo',
};

/** En plural, para «Solo los …». Los cinco primeros no cambian. */
const WEEKDAY_PLURAL: Record<number, string> = { ...WEEKDAY_NAME, 6: 'sábados', 0: 'domingos' };

/** ¿Tiene días concretos? Sin lista (o con los siete) es un hábito diario. */
export const hasSchedule = (habit: Pick<Habit, 'days'>): boolean =>
  Array.isArray(habit.days) && habit.days.length > 0 && habit.days.length < 7;

/** ¿Le toca este día de la semana (0 = domingo)? */
export const scheduledOnWeekday = (habit: Pick<Habit, 'days'>, weekday: number): boolean =>
  !hasSchedule(habit) || (habit.days as number[]).includes(weekday);

/** ¿Le toca esta fecha? */
export const isScheduled = (habit: Pick<Habit, 'days'>, date: Date): boolean =>
  scheduledOnWeekday(habit, date.getDay());

/** Lo mismo a partir de una clave «yyyy-MM-dd». */
export const isScheduledKey = (habit: Pick<Habit, 'days'>, key: string): boolean =>
  scheduledOnWeekday(habit, new Date(`${key}T12:00:00`).getDay());

/** «Cada día», «Lunes, miércoles y viernes», «Solo los sábados». */
export function describeSchedule(habit: Pick<Habit, 'days'>): string {
  if (!hasSchedule(habit)) return 'Cada día';
  const days = WEEK_ORDER.filter((day) => (habit.days as number[]).includes(day));
  if (days.length === 1) return `Solo los ${WEEKDAY_PLURAL[days[0]]}`;
  const names = days.map((day) => WEEKDAY_NAME[day]);
  const text = `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
