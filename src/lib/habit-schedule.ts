import type { Habit } from '@/types';
import { tr } from '@/lib/i18n';
import { dayInitial } from '@/lib/day-names';

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

export const WEEKDAY_INITIAL: Record<number, string> = {
  get 1() { return dayInitial(0); },
  get 2() { return dayInitial(1); },
  get 3() { return dayInitial(2); },
  get 4() { return dayInitial(3); },
  get 5() { return dayInitial(4); },
  get 6() { return dayInitial(5); },
  get 0() { return dayInitial(6); },
};

/** Nombre del día en singular, para las listas («lunes, sábado y domingo»). */
const WEEKDAY_NAME: Record<number, string> = {
  get 1() { return tr('lunes'); },
  get 2() { return tr('martes'); },
  get 3() { return tr('miércoles'); },
  get 4() { return tr('jueves'); },
  get 5() { return tr('viernes'); },
  get 6() { return tr('sábado'); },
  get 0() { return tr('domingo'); },
};

/** En plural, para «Solo los …». Los cinco primeros no cambian. */
const WEEKDAY_PLURAL: Record<number, string> = { ...WEEKDAY_NAME, get 6() { return tr('sábados'); }, get 0() { return tr('domingos'); } };

/** ¿Tiene días concretos? Sin lista (o con los siete) es un hábito diario. */
export const hasSchedule = (habit: Pick<Habit, 'days'>): boolean =>
  Array.isArray(habit.days) && habit.days.length > 0 && habit.days.length < 7;

/** ¿Le toca este día de la semana (0 = domingo)? */
const scheduledOnWeekday = (habit: Pick<Habit, 'days'>, weekday: number): boolean =>
  !hasSchedule(habit) || (habit.days as number[]).includes(weekday);

/** ¿Le toca esta fecha? */
export const isScheduled = (habit: Pick<Habit, 'days'>, date: Date): boolean =>
  scheduledOnWeekday(habit, date.getDay());

/** «Cada día», «Lunes, miércoles y viernes», «Solo los sábados». */
export function describeSchedule(habit: Pick<Habit, 'days'>): string {
  if (!hasSchedule(habit)) return tr('Cada día');
  const days = WEEK_ORDER.filter((day) => (habit.days as number[]).includes(day));
  if (days.length === 1) return tr('Solo los {p}', { p: WEEKDAY_PLURAL[days[0]] });
  const names = days.map((day) => WEEKDAY_NAME[day]);
  const text = `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
