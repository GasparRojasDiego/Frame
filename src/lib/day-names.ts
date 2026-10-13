import { getLang } from '@/lib/i18n';

// ============================================================
// Nombres de los días en el idioma de la interfaz (1.6.7). La semana de
// Frame empieza en lunes: el índice 0 es el lunes y el 6, el domingo.
// `fromSunday` convierte el `getDay()` de JavaScript (0 = domingo).
//
// En inglés las iniciales se repiten (T martes y jueves, S sábado y domingo):
// nunca sirven de `key` en una lista; para eso, el índice.
// ============================================================

const NAMES = {
  es: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};
const SHORT = {
  es: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
const INITIALS = {
  es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
};

/** `getDay()` (0 = domingo) → índice desde el lunes. */
export const fromSunday = (day: number): number => (day + 6) % 7;

/** «lunes» / «Monday». */
export const dayName = (index: number): string => NAMES[getLang()][index];

/** «Lunes» / «Monday». */
export const dayTitle = (index: number): string => {
  const name = dayName(index);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** «Lun» / «Mon». */
export const dayShort = (index: number): string => SHORT[getLang()][index];

/** «L» / «M». */
export const dayInitial = (index: number): string => INITIALS[getLang()][index];

/** Las siete iniciales, de lunes a domingo. */
export const dayInitials = (): string[] => INITIALS[getLang()];
