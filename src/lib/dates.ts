import { isValid, parseISO } from 'date-fns';

// ============================================================
// Fechas leídas sin riesgo.
//
// `parseISO` nunca lanza: con una cadena ilegible devuelve una fecha inválida,
// y es `format` quien lanza después. Un `try` alrededor de `parseISO` no
// protegía nada: una fecha corrupta (un respaldo antiguo, una fusión) tumbaba
// la campana —y con ella la app entera— o Inicio (Diego, 13-oct-2026).
// ============================================================

/** La fecha de una cadena ISO, o null si no se puede leer. */
export function parseIsoSafe(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = parseISO(iso);
  return isValid(date) ? date : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * El día local `yyyy-MM-dd` de una fecha, sin date-fns: en los bucles sobre
 * todo el historial, `format(parseISO(…))` costaba unas 15 veces más. Una
 * cadena que ya es un día se devuelve tal cual (`new Date` la leería en UTC);
 * una ilegible da ''.
 */
export function localDayKey(value: Date | string | number): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
