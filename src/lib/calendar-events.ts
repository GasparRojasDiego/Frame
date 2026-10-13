// ============================================================
// Reglas y catálogos del calendario LOCAL de Frame.
//
// Módulo puro (sin React) para que la cuadrícula, el formulario y el diálogo
// de edición compartan exactamente el mismo criterio: tipos disponibles,
// paleta, qué evento pinta la casilla y cuándo un evento queda inactivo.
// ============================================================

import type { LocalCalendarEvent, LocalEventDisplay, LocalEventKind } from '@/types';
import { tr } from '@/lib/i18n';

interface EventKindMeta {
  label: string;
}

/**
 * Sin emojis (1.6.7, Diego). Los cuatro primeros son los que ofrece el
 * formulario, más «Otro», cuyo nombre escribe el usuario (`kindLabel`). El
 * resto viene de versiones anteriores: esos eventos se siguen viendo y
 * editando con su nombre.
 */
export const EVENT_KIND_META: Record<LocalEventKind, EventKindMeta> = {
  entrega: { get label() { return tr('Entrega'); } },
  evento: { get label() { return tr('Evento'); } },
  examen: { get label() { return tr('Evaluación'); } },
  personal: { get label() { return tr('Personal'); } },
  otro: { get label() { return tr('Otro'); } },
  libre: { get label() { return tr('Día libre'); } },
  vacaciones: { get label() { return tr('Vacaciones'); } },
  reunion: { get label() { return tr('Reunión'); } },
  salida: { get label() { return tr('Salida de estudio'); } },
  cumple: { get label() { return tr('Cumpleaños'); } },
  recordatorio: { get label() { return tr('Recordatorio'); } },
};

/** Los tipos del desplegable del formulario, en este orden; después, «Otro…». */
export const EVENT_FORM_KINDS: LocalEventKind[] = ['entrega', 'evento', 'examen', 'personal'];

/** Tipos que ya no existen o datos corruptos caen en "personal". */
export const normalizeKind = (kind: string): LocalEventKind =>
  (EVENT_KIND_META as Record<string, EventKindMeta>)[kind] ? (kind as LocalEventKind) : 'personal';

/** Nombre del tipo de un evento: el escrito por el usuario o el del catálogo. */
export const kindLabelOf = (event: Pick<LocalCalendarEvent, 'kind' | 'kindLabel'>): string =>
  (normalizeKind(event.kind) === 'otro' && event.kindLabel?.trim()) || EVENT_KIND_META[normalizeKind(event.kind)].label;

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
function colorAlpha(color: string): number {
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

/**
 * Presentación efectiva. Desde la 1.6.7 la decide el formulario sin preguntar:
 * un evento de todo el día pinta su casilla; uno con hora va como etiqueta.
 * Los guardados antes del campo `display` se deducen como entonces.
 */
export const eventDisplay = (event: LocalCalendarEvent): LocalEventDisplay =>
  event.display ?? (event.kind === 'libre' || event.kind === 'vacaciones' ? 'casilla' : 'actividad');

/** Eventos que cubren un día (soporta rangos date..endDate). */
export function getEventsForDay(
  events: LocalCalendarEvent[] | undefined,
  dayStr: string
): LocalCalendarEvent[] {
  if (!events || events.length === 0) return [];
  return events.filter((e) => dayStr >= e.date && dayStr <= (e.endDate ?? e.date));
}
