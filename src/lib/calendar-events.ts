// ============================================================
// Reglas y catálogos del calendario LOCAL de Frame.
//
// Módulo puro (sin React) para que la cuadrícula, el formulario y el diálogo
// de edición compartan exactamente el mismo criterio: tipos disponibles,
// paleta, qué evento pinta la casilla y cuándo un evento queda inactivo.
// ============================================================

import type { LocalCalendarEvent, LocalEventDisplay, LocalEventKind } from '@/types';

export interface EventKindMeta {
  label: string;
  /** Emoji que precede al título en la casilla: se lee de un vistazo y no
   *  depende de cargar un icono dentro de una etiqueta de 10 píxeles. */
  glyph: string;
  hint: string;
  /** Presentación por defecto al elegir este tipo (el usuario puede cambiarla). */
  defaultDisplay: LocalEventDisplay;
  /** Estos tipos suelen abarcar varios días: el formulario ofrece el rango. */
  suggestsRange?: boolean;
}

/** Orden deliberado: primero lo que afecta al calendario escolar entero,
 *  después lo académico y al final lo personal. */
export const EVENT_KIND_META: Record<LocalEventKind, EventKindMeta> = {
  libre:        { label: 'Día libre',            glyph: '🏖', hint: 'Feriado o jornada sin clases', defaultDisplay: 'casilla', suggestsRange: true },
  vacaciones:   { label: 'Vacaciones',           glyph: '🌴', hint: 'Periodo largo sin clases',     defaultDisplay: 'casilla', suggestsRange: true },
  evento:       { label: 'Evento institucional', glyph: '🎓', hint: 'Aniversario, actuación, feria',defaultDisplay: 'actividad' },
  examen:       { label: 'Evaluación',           glyph: '📝', hint: 'Examen, práctica calificada',  defaultDisplay: 'actividad' },
  entrega:      { label: 'Entrega',              glyph: '📤', hint: 'Fecha tope de un trabajo',     defaultDisplay: 'actividad' },
  reunion:      { label: 'Reunión',              glyph: '👥', hint: 'Padres, tutoría, asesoría',    defaultDisplay: 'actividad' },
  salida:       { label: 'Salida de estudio',    glyph: '🚌', hint: 'Viaje o visita guiada',        defaultDisplay: 'actividad', suggestsRange: true },
  cumple:       { label: 'Cumpleaños',           glyph: '🎂', hint: 'Tuyo o de alguien',            defaultDisplay: 'actividad' },
  personal:     { label: 'Personal',             glyph: '🙂', hint: 'Cualquier cosa tuya',          defaultDisplay: 'actividad' },
  recordatorio: { label: 'Recordatorio',         glyph: '🔔', hint: 'Un aviso y nada más',          defaultDisplay: 'actividad' },
};

export const EVENT_KINDS = Object.keys(EVENT_KIND_META) as LocalEventKind[];

/** Tipos que ya no existen o datos corruptos caen en "personal". */
export const normalizeKind = (kind: string): LocalEventKind =>
  (EVENT_KIND_META as Record<string, EventKindMeta>)[kind] ? (kind as LocalEventKind) : 'personal';

/**
 * Paleta en tres filas: los MISMOS ocho tonos, cada fila más transparente.
 * La transparencia se guarda en el propio color (hex de 8 dígitos), así que
 * un evento sigue siendo un solo campo de texto y los datos antiguos —hex de
 * 6 dígitos, es decir opacos— siguen siendo válidos sin migración.
 */
const BASE_COLORS = [
  '#BFD7FF', '#C9F2C7', '#FFE4A1', '#FFC9C9',
  '#E5C9FF', '#C9F0FF', '#FFD9F0', '#EAE6C9',
];

/** Sufijos alfa: opaco, ~70 % y ~40 %. */
const ALPHA_ROWS = ['', 'B3', '66'];

export const EVENT_COLOR_ROWS: string[][] = ALPHA_ROWS.map((alpha) =>
  BASE_COLORS.map((hex) => `${hex}${alpha}`)
);

export const DEFAULT_EVENT_COLOR = EVENT_COLOR_ROWS[0][0];

/** Alfa de un color de la paleta, en 0..1. */
export function colorAlpha(color: string): number {
  if (/^#[0-9a-f]{8}$/i.test(color)) return parseInt(color.slice(7), 16) / 255;
  return 1;
}

/**
 * Clase de texto legible sobre un color de la paleta.
 * Con el tono casi opaco el fondo manda y hace falta tinta oscura; cuando es
 * translúcido, quien manda es el fondo de la app, así que se usa el color de
 * texto del tema (legible tanto en claro como en oscuro).
 */
export const eventTextClass = (color: string): string =>
  colorAlpha(color) >= 0.75 ? 'text-neutral-800' : 'text-foreground';

/** Presentación efectiva, rellenando los eventos guardados antes del campo. */
export const eventDisplay = (event: LocalCalendarEvent): LocalEventDisplay =>
  event.display ?? (event.kind === 'libre' || event.kind === 'vacaciones' ? 'casilla' : 'actividad');

/** ¿El evento ya pasó? Sigue visible, pero atenuado. */
export function isEventInactive(event: LocalCalendarEvent, today = new Date()): boolean {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return (event.endDate ?? event.date) < `${y}-${m}-${d}`;
}

/** Eventos que cubren un día (soporta rangos date..endDate). */
export function getEventsForDay(
  events: LocalCalendarEvent[] | undefined,
  dayStr: string
): LocalCalendarEvent[] {
  if (!events || events.length === 0) return [];
  return events.filter((e) => dayStr >= e.date && dayStr <= (e.endDate ?? e.date));
}

/**
 * Reparto de un día: como mucho UN evento pinta la casilla; el resto son
 * etiquetas. Si por lo que sea hubiera dos "casilla" el mismo día (datos
 * heredados, un rango que se solapa), gana el primero y el otro pasa a
 * etiqueta en lugar de desaparecer.
 */
export function splitDayEvents(dayEvents: LocalCalendarEvent[]): {
  cell: LocalCalendarEvent | null;
  chips: LocalCalendarEvent[];
} {
  let cell: LocalCalendarEvent | null = null;
  const chips: LocalCalendarEvent[] = [];
  for (const event of dayEvents) {
    if (eventDisplay(event) === 'casilla' && cell === null) cell = event;
    else chips.push(event);
  }
  return { cell, chips };
}

/**
 * ¿Choca este evento "casilla" con otro que ya pinta alguno de sus días?
 * Devuelve la fecha del primer choque, o null si está libre. `ignoreId`
 * excluye al propio evento cuando se está editando.
 */
export function findCellClash(
  events: LocalCalendarEvent[] | undefined,
  start: string,
  end: string | undefined,
  ignoreId?: string
): string | null {
  if (!events) return null;
  const last = end ?? start;
  for (const other of events) {
    if (other.id === ignoreId) continue;
    if (eventDisplay(other) !== 'casilla') continue;
    const otherLast = other.endDate ?? other.date;
    // Dos intervalos se solapan si cada uno empieza antes de que acabe el otro.
    if (start <= otherLast && other.date <= last) {
      return start > other.date ? start : other.date;
    }
  }
  return null;
}
