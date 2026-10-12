// ============================================================
// Modelo de la cuadrícula del calendario LOCAL.
//
// Módulo puro (sin React): fechas como claves "YYYY-MM-DD", la rejilla del
// mes, el reparto de eventos en carriles (para que un evento de varios días
// sea UNA barra continua) y el plan para vaciar unos días. La vista solo
// pinta lo que sale de aquí, y todo se calcula una vez por mes, no en cada
// render.
//
// Las claves "YYYY-MM-DD" se comparan como texto: el orden lexicográfico ES
// el cronológico, así que un rango se resuelve sin crear fechas.
// ============================================================

import type { CalendarDayColor, LocalCalendarEvent, Task } from '@/types';
import { EVENT_COLOR_ROWS, eventDisplay } from '@/lib/calendar-events';

// ---------------------------------------------------------------------------
// Claves de día
// ---------------------------------------------------------------------------

export const toKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const fromKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Suma días por calendario (no por milisegundos): inmune al cambio de hora. */
export const addDays = (key: string, days: number): string => {
  const date = fromKey(key);
  return toKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
};

/** Días entre dos claves (b − a). */
export const daysBetween = (a: string, b: string): number =>
  Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);

export interface DayRange {
  start: string;
  end: string;
}

/** El orden en que se arrastró da igual: el rango sale siempre ordenado. */
export const orderRange = (a: string, b: string): DayRange => (a <= b ? { start: a, end: b } : { start: b, end: a });

export const inRange = (key: string, range: DayRange | null | undefined): boolean =>
  !!range && key >= range.start && key <= range.end;

/** Último día de un evento (los guardados con el rango invertido se toleran). */
export const eventEnd = (event: Pick<LocalCalendarEvent, 'date' | 'endDate'>): string =>
  event.endDate && event.endDate > event.date ? event.endDate : event.date;

// ---------------------------------------------------------------------------
// Rejilla del mes (lunes primero)
// ---------------------------------------------------------------------------

export interface MonthCursor {
  year: number;
  /** 0 = enero */
  month: number;
}

export const monthKeyOf = ({ year, month }: MonthCursor): string =>
  `${year}-${String(month + 1).padStart(2, '0')}`;

export const shiftMonth = ({ year, month }: MonthCursor, delta: number): MonthCursor => {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
};

export const cursorOf = (key: string): MonthCursor => {
  const date = fromKey(key);
  return { year: date.getFullYear(), month: date.getMonth() };
};

/** Semanas completas que cubren el mes: 4 a 6 filas de 7 claves. */
export function monthWeeks({ year, month }: MonthCursor): string[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  const weeks: string[][] = [];
  for (let i = 0; i < total; i += 7) {
    const week: string[] = [];
    for (let j = 0; j < 7; j++) week.push(toKey(new Date(year, month, 1 - lead + i + j)));
    weeks.push(week);
  }
  return weeks;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const weekdayName = (key: string): string => WEEKDAY_NAMES[fromKey(key).getDay()];

/** «martes 12 de marzo» (con el año solo si no es el actual). */
export function longDayLabel(key: string, todayKey: string): string {
  const date = fromKey(key);
  const year = date.getFullYear() !== fromKey(todayKey).getFullYear() ? ` de ${date.getFullYear()}` : '';
  return `${WEEKDAY_NAMES[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()].toLowerCase()}${year}`;
}

/** «12 mar» */
export const shortDayLabel = (key: string): string => {
  const date = fromKey(key);
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
};

/** «12 – 18 mar», «28 feb – 3 mar» o «12 mar» para un solo día. */
export function rangeLabel({ start, end }: DayRange): string {
  if (start === end) return shortDayLabel(start);
  const a = fromKey(start);
  const b = fromKey(end);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`;
  }
  return `${shortDayLabel(start)} – ${shortDayLabel(end)}`;
}

/** «Hoy», «Mañana», «Hace 3 días»… para el subtítulo del día. */
export function relativeDayLabel(key: string, todayKey: string): string {
  const diff = daysBetween(todayKey, key);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return diff > 0 ? `Dentro de ${diff} días` : `Hace ${-diff} días`;
}

export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

// ---------------------------------------------------------------------------
// Paleta de las casillas: los ocho tonos base de los eventos, opacos. La vista
// los mezcla con el fondo según el tema (más presentes en claro, más tenues
// en oscuro), así un mismo dato se lee bien en los dos.
// ---------------------------------------------------------------------------

const COLOR_NAMES = ['azul', 'verde', 'amarillo', 'coral', 'lila', 'celeste', 'rosa', 'arena'];

export const PAINT_COLORS: { hex: string; name: string }[] = EVENT_COLOR_ROWS[0].map((hex, index) => ({
  hex,
  name: COLOR_NAMES[index] ?? hex,
}));

/** Avisos que ofrece el formulario (minutos de antelación). */
export const REMIND_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: 'A la hora' },
  { minutes: 10, label: '10 min antes' },
  { minutes: 30, label: '30 min antes' },
  { minutes: 60, label: '1 h antes' },
  { minutes: 1440, label: 'El día antes' },
];

export const remindLabel = (minutes: number | undefined): string | null => {
  if (minutes === undefined || minutes === null) return null;
  return REMIND_OPTIONS.find((option) => option.minutes === minutes)?.label ?? `${minutes} min antes`;
};

// ---------------------------------------------------------------------------
// Elementos de la cuadrícula y su reparto en carriles
// ---------------------------------------------------------------------------

export interface GridItem {
  id: string;
  /** Primer y último día (ambos incluidos). */
  start: string;
  end: string;
  label: string;
  /** Emoji del tipo de evento. */
  glyph?: string;
  /** "HH:mm" delante del título. */
  time?: string;
  /** Tinte del evento; sin él, estilo neutro (tareas y Google). */
  color?: string;
  variant: 'event' | 'task' | 'external';
  /** Ya pasó: se ve, pero atenuado. */
  faded?: boolean;
  /** Lleva aviso nativo. */
  bell?: boolean;
  /** Un clic lo abre directamente (los eventos locales). */
  openable?: boolean;
  /** Texto completo para el globo al pasar el ratón. */
  hint?: string;
}

export interface PlacedItem {
  item: GridItem;
  /** Columnas (0 = lunes) que ocupa en ESTA semana. */
  from: number;
  to: number;
  lane: number;
}

export interface WeekLayout {
  placed: PlacedItem[];
  /** Elementos por columna (para «+N más» y las etiquetas accesibles). */
  counts: number[];
}

/** Orden de los carriles: lo largo arriba, después lo que empieza antes, y
 *  las tareas al final de cada día. */
const variantRank = { event: 0, external: 0, task: 1 } as const;

export function layoutWeek(week: string[], items: GridItem[]): WeekLayout {
  const first = week[0];
  const last = week[6];
  const candidates: PlacedItem[] = [];
  for (const item of items) {
    if (item.end < first || item.start > last) continue;
    const from = item.start <= first ? 0 : week.indexOf(item.start);
    const to = item.end >= last ? 6 : week.indexOf(item.end);
    if (from < 0 || to < 0) continue;
    candidates.push({ item, from, to, lane: 0 });
  }

  candidates.sort(
    (a, b) =>
      variantRank[a.item.variant] - variantRank[b.item.variant] ||
      a.from - b.from ||
      b.to - b.from - (a.to - a.from) ||
      (a.item.time ?? '').localeCompare(b.item.time ?? '') ||
      a.item.label.localeCompare(b.item.label)
  );

  // Reparto voraz: cada elemento al carril libre más alto en todo su tramo.
  const occupied: boolean[][] = [];
  const counts = Array(7).fill(0) as number[];
  for (const placed of candidates) {
    let lane = 0;
    for (;;) {
      const row = occupied[lane] ?? (occupied[lane] = Array(7).fill(false));
      let free = true;
      for (let c = placed.from; c <= placed.to; c++) {
        if (row[c]) {
          free = false;
          break;
        }
      }
      if (free) {
        for (let c = placed.from; c <= placed.to; c++) row[c] = true;
        break;
      }
      lane++;
    }
    placed.lane = lane;
    for (let c = placed.from; c <= placed.to; c++) counts[c]++;
  }
  return { placed: candidates, counts };
}

export interface Segment {
  item: GridItem;
  from: number;
  to: number;
  lane: number;
  /** La barra sigue a la izquierda / a la derecha (esquinas rectas). */
  continuesLeft: boolean;
  continuesRight: boolean;
}

export interface WeekView {
  segments: Segment[];
  /** Por columna: cuántos elementos quedan detrás de «+N más» (0 = ninguno)
   *  y en qué carril va ese indicador. */
  more: { count: number; lane: number }[];
}

/**
 * Lo que cabe de una semana con `maxLanes` carriles por casilla.
 *
 * Una casilla que se desborda reserva su último carril para «+N más»; una
 * barra que cruza esa casilla se corta ahí y sigue en las vecinas, así el
 * resto de la semana no pierde nada por culpa de un día lleno.
 */
export function viewWeek(layout: WeekLayout, maxLanes: number, week: string[]): WeekView {
  const top = Array(7).fill(-1) as number[];
  for (const p of layout.placed) for (let c = p.from; c <= p.to; c++) top[c] = Math.max(top[c], p.lane);
  const limit = top.map((lane) => (lane >= maxLanes ? maxLanes - 1 : maxLanes));
  const more = limit.map((lim) => ({ count: 0, lane: lim }));

  const segments: Segment[] = [];
  for (const p of layout.placed) {
    let runStart = -1;
    for (let c = p.from; c <= p.to + 1; c++) {
      const visible = c <= p.to && p.lane < limit[c];
      if (c <= p.to && !visible) more[c].count++;
      if (visible && runStart < 0) runStart = c;
      if (!visible && runStart >= 0) {
        const runEnd = c - 1;
        segments.push({
          item: p.item,
          from: runStart,
          to: runEnd,
          lane: p.lane,
          continuesLeft: runStart > p.from || (runStart === 0 && p.item.start < week[0]),
          continuesRight: runEnd < p.to || (runEnd === 6 && p.item.end > week[6]),
        });
        runStart = -1;
      }
    }
  }
  return { segments, more };
}

// ---------------------------------------------------------------------------
// Tareas con fecha de entrega
// ---------------------------------------------------------------------------

/** Día local de la fecha de entrega de una tarea (null si no tiene o es inválida). */
export function taskDay(task: Pick<Task, 'dueDate'>): string | null {
  if (!task.dueDate) return null;
  const due = new Date(task.dueDate);
  return Number.isNaN(due.getTime()) ? null : toKey(due);
}

/** Tareas agrupadas por su día de entrega. */
export function groupTasksByDay(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    const day = taskDay(task);
    if (!day) continue;
    const list = map.get(day);
    if (list) list.push(task);
    else map.set(day, [task]);
  }
  return map;
}

/** Las tareas que vencen entre `first` y `last`, como elementos de la cuadrícula. */
export function buildTaskItems(tasks: Task[], first: string, last: string): GridItem[] {
  const items: GridItem[] = [];
  for (const task of tasks) {
    const day = taskDay(task);
    if (!day || day < first || day > last) continue;
    items.push({
      id: `task:${task.id}`,
      start: day,
      end: day,
      label: task.name,
      variant: 'task',
      hint: `${task.name} · ${task.courseName || 'Sin asignatura'}`,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Casillas pintadas
// ---------------------------------------------------------------------------

/**
 * Color de fondo de cada día visible: primero los eventos con «Pintar las
 * casillas» (el primero gana, como siempre), y encima el color propio de
 * cada casilla, que manda. Un color propio vacío deja la casilla sin pintar.
 */
export function buildFills(
  events: LocalCalendarEvent[],
  dayColors: CalendarDayColor[],
  first: string,
  last: string
): Map<string, string> {
  const fills = new Map<string, string>();
  for (const event of events) {
    if (eventDisplay(event) !== 'casilla') continue;
    const end = eventEnd(event);
    if (end < first || event.date > last) continue;
    let day = event.date < first ? first : event.date;
    const stop = end > last ? last : end;
    while (day <= stop) {
      if (!fills.has(day)) fills.set(day, event.color);
      day = addDays(day, 1);
    }
  }
  for (const { id, color } of dayColors) {
    if (id < first || id > last) continue;
    if (color) fills.set(id, color);
    else fills.delete(id);
  }
  return fills;
}

/** ¿Algún evento con «Pintar las casillas» cubre este día? */
export const paintedByEvent = (events: LocalCalendarEvent[], day: string): boolean =>
  events.some((event) => eventDisplay(event) === 'casilla' && day >= event.date && day <= eventEnd(event));

/**
 * Qué escribir para dejar unos días SIN color: los que pinta un evento
 * necesitan la marca vacía; el resto basta con olvidarlos.
 */
export function planUnpaint(
  events: LocalCalendarEvent[],
  days: string[]
): { forget: string[]; blank: string[] } {
  const forget: string[] = [];
  const blank: string[] = [];
  for (const day of days) (paintedByEvent(events, day) ? blank : forget).push(day);
  return { forget, blank };
}

/** Todas las claves de un rango, en orden. */
export function daysOf({ start, end }: DayRange): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

// ---------------------------------------------------------------------------
// Vaciar unos días (tecla Supr o la papelera de la selección)
// ---------------------------------------------------------------------------

export interface ClearPlan {
  remove: string[];
  update: { id: string; changes: Partial<Omit<LocalCalendarEvent, 'id'>> }[];
  add: Omit<LocalCalendarEvent, 'id'>[];
  /** Días con color propio que se olvidan. */
  colorDays: string[];
  /** Eventos tocados: borrados (`remove`) más recortados o partidos (`update`). */
  eventCount: number;
}

/**
 * Quita de un rango todo lo que es del calendario —eventos y colores—, sin
 * tocar nada fuera de él: un evento que asoma por un lado se recorta, y uno
 * que cubre el rango por los dos lados se parte en dos. Las tareas no son del
 * calendario y no se tocan.
 *
 * `todayKey` decide qué parte de un evento partido conserva su id: la que
 * tiene los avisos de hoy y mañana, porque la marca de «aviso ya dado» va por
 * id y una copia con id nuevo lo repetiría.
 */
export function planClear(
  events: LocalCalendarEvent[],
  dayColors: CalendarDayColor[],
  range: DayRange,
  todayKey?: string
): ClearPlan {
  const { start: s, end: e } = range;
  const plan: ClearPlan = { remove: [], update: [], add: [], colorDays: [], eventCount: 0 };
  const single = (from: string, to: string) => (to > from ? to : undefined);

  for (const event of events) {
    const a = event.date;
    const b = eventEnd(event);
    if (b < s || a > e) continue;
    plan.eventCount++;
    if (s <= a && b <= e) {
      plan.remove.push(event.id);
    } else if (a < s && b <= e) {
      plan.update.push({ id: event.id, changes: { endDate: single(a, addDays(s, -1)) } });
    } else if (s <= a && e < b) {
      const from = addDays(e, 1);
      plan.update.push({ id: event.id, changes: { date: from, endDate: single(from, b) } });
    } else {
      // Cubre el rango por los dos lados: una parte se queda con el evento y
      // la otra nace como copia. Normalmente se queda la de antes; si la de
      // después empieza mañana o antes, la de antes ya pasó y se queda esa.
      const from = addDays(e, 1);
      const before = { endDate: single(a, addDays(s, -1)) };
      const after = { date: from, endDate: single(from, b) };
      const keepAfter = !!todayKey && from <= addDays(todayKey, 1);
      const { id: _id, ...rest } = event;
      plan.update.push({ id: event.id, changes: keepAfter ? after : before });
      plan.add.push({ ...rest, ...(keepAfter ? before : after) });
    }
  }
  for (const { id } of dayColors) if (id >= s && id <= e) plan.colorDays.push(id);
  return plan;
}
