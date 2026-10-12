import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bell, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  addDays,
  capitalize,
  cursorOf,
  fromKey,
  inRange,
  layoutWeek,
  longDayLabel,
  orderRange,
  toKey,
  viewWeek,
  type DayRange,
  type GridItem,
  type MonthCursor,
  type Segment,
} from './calendar-model';
import { EVENT_TINT, PAINT_TINT, eventInk, tintVar } from './CalendarBits';

// ============================================================
// Cuadrícula de un mes.
//
// Dos capas por semana: debajo, las siete casillas (fondo, color propio,
// selección, foco); encima, las barras repartidas en carriles. Un evento de
// varios días es UNA barra que cruza las casillas, cortada solo donde cambia
// la semana o donde un día lleno muestra «+N más».
//
// Cuántos carriles caben se mide con la altura real de la fila: en una
// ventana grande se ven más elementos antes de recurrir a «+N más».
//
// Interacción (toda en el contenedor, por coordenadas, para que funcione
// igual sobre una casilla que sobre una barra):
//   · clic en un día → onOpenDay · clic en un evento → onOpenItem
//   · arrastrar, o mayús+clic → selección de un rango de días
//   · teclado: flechas, Inicio/Fin, Re Pág/Av Pág, Intro, Esc y Supr;
//     mayús+flechas amplía la selección.
// ============================================================

const WEEKDAYS = [
  { long: 'Lunes', short: 'Lun' },
  { long: 'Martes', short: 'Mar' },
  { long: 'Miércoles', short: 'Mié' },
  { long: 'Jueves', short: 'Jue' },
  { long: 'Viernes', short: 'Vie' },
  { long: 'Sábado', short: 'Sáb' },
  { long: 'Domingo', short: 'Dom' },
];

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** Medidas de la capa de barras, en píxeles. */
const HEAD_H = 30;
const LANE_H = 20;
const LANE_GAP = 2;

export interface GridSelection {
  anchor: string;
  focus: string;
}

interface DragState {
  start: string;
  last: string;
  moved: boolean;
  itemId: string | null;
  rects: DOMRect[];
}

export default function MonthGrid({
  weeks,
  cursor,
  items,
  fills,
  todayKey,
  selection = null,
  onSelect,
  onClearSelection,
  onOpenDay,
  onOpenItem,
  onClearRequest,
  onMonthChange,
  focusRequest,
  ariaLabel,
  tourId,
  className,
}: {
  weeks: string[][];
  cursor: MonthCursor;
  items: GridItem[];
  /** Color de fondo de cada día ('' o ausente = sin color). */
  fills?: Map<string, string>;
  todayKey: string;
  selection?: GridSelection | null;
  /** Sin él, la cuadrícula es de solo lectura (no se seleccionan rangos). */
  onSelect?: (selection: GridSelection, phase: 'live' | 'done') => void;
  onClearSelection?: () => void;
  onOpenDay: (day: string) => void;
  onOpenItem?: (id: string) => void;
  /** Supr: vaciar la selección (o el día enfocado). */
  onClearRequest?: (range: DayRange) => void;
  onMonthChange: (cursor: MonthCursor) => void;
  /** Pide el foco para un día (p. ej. al pulsar «Hoy»). */
  focusRequest?: { day: string; nonce: number } | null;
  ariaLabel: string;
  tourId?: string;
  className?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const weekRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<DragState | null>(null);
  /** Último día pulsado: punto de partida de mayús+clic. */
  const anchorRef = useRef<string | null>(null);
  /** Día que debe recibir el foco cuando la cuadrícula termine de pintarse. */
  const pendingFocus = useRef<string | null>(null);

  const first = weeks[0][0];
  const last = weeks[weeks.length - 1][6];
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const range = selection ? orderRange(selection.anchor, selection.focus) : null;

  // ---- Foco itinerante: una sola casilla es tabulable ----
  const defaultFocus = todayKey >= first && todayKey <= last ? todayKey : `${monthPrefix}-01`;
  const [focusDay, setFocusDay] = useState(defaultFocus);
  const activeFocus = focusDay >= first && focusDay <= last ? focusDay : defaultFocus;

  // ---- Carriles que caben, medidos con la altura real de una semana ----
  const [maxLanes, setMaxLanes] = useState(3);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      const row = weekRefs.current.find(Boolean);
      const height = row ? row.clientHeight : body.clientHeight / weeks.length;
      const lanes = Math.floor((height - HEAD_H - 4 + LANE_GAP) / (LANE_H + LANE_GAP));
      setMaxLanes(Math.max(1, Math.min(8, lanes)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [weeks.length]);

  // ---- Reparto en carriles: una vez por mes y por cambio de datos ----
  const layouts = useMemo(() => weeks.map((week) => layoutWeek(week, items)), [weeks, items]);
  const views = useMemo(
    () => layouts.map((layout, index) => viewWeek(layout, maxLanes, weeks[index])),
    [layouts, maxLanes, weeks]
  );

  /** `reveal`: desplaza hasta la casilla si queda fuera de la vista (teclado y
   *  «Hoy»; con el ratón la casilla ya está a la vista y no se mueve nada). */
  const focusCell = useCallback((day: string, reveal = false) => {
    const cell = bodyRef.current?.querySelector<HTMLElement>(`[data-day="${day}"]`);
    cell?.focus({ preventScroll: true });
    if (reveal) cell?.scrollIntoView({ block: 'nearest' });
  }, []);

  // Tras cambiar de mes con el teclado, el foco aterriza en su día.
  useEffect(() => {
    const day = pendingFocus.current;
    if (!day || day < first || day > last) return;
    pendingFocus.current = null;
    focusCell(day, true);
  }, [first, last, focusCell]);

  useEffect(() => {
    if (!focusRequest) return;
    setFocusDay(focusRequest.day);
    pendingFocus.current = focusRequest.day;
    if (focusRequest.day >= first && focusRequest.day <= last) {
      pendingFocus.current = null;
      focusCell(focusRequest.day, true);
    }
    // Solo reacciona a una petición nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce]);

  // ---- Ratón: arrastrar para seleccionar, clic para abrir ----
  const dayAt = (x: number, y: number, rects: DOMRect[]): string => {
    let w = rects.findIndex((rect) => y < rect.bottom);
    if (w < 0) w = rects.length - 1;
    const rect = rects[w];
    const col = Math.min(6, Math.max(0, Math.floor((x - rect.left) / (rect.width / 7))));
    return weeks[w][col];
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // La barra de desplazamiento (meses de seis filas en ventanas bajas) no es un día.
    const body = event.currentTarget;
    if (event.clientX >= body.getBoundingClientRect().left + body.clientWidth) return;
    const rects = weekRefs.current.slice(0, weeks.length).map((row) => row?.getBoundingClientRect() ?? new DOMRect());
    const day = dayAt(event.clientX, event.clientY, rects);
    setFocusDay(day);

    if (event.shiftKey && onSelect) {
      event.preventDefault();
      onSelect({ anchor: selection?.anchor ?? anchorRef.current ?? activeFocus, focus: day }, 'done');
      focusCell(day);
      return;
    }

    const itemEl = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
    dragRef.current = { start: day, last: day, moved: false, itemId: itemEl?.dataset.itemId ?? null, rects };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !onSelect) return;
    const day = dayAt(event.clientX, event.clientY, drag.rects);
    if (day === drag.last) return;
    drag.last = day;
    drag.moved = true;
    onSelect({ anchor: drag.start, focus: day }, 'live');
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    anchorRef.current = drag.start;
    focusCell(drag.last);
    if (drag.moved && onSelect) {
      setFocusDay(drag.last);
      onSelect({ anchor: drag.start, focus: drag.last }, 'done');
      return;
    }
    // Con una selección a la vista, el primer clic solo la descarta.
    if (selection && onClearSelection) {
      onClearSelection();
      return;
    }
    if (drag.itemId && onOpenItem) onOpenItem(drag.itemId);
    else onOpenDay(drag.start);
  };

  const handlePointerCancel = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) onClearSelection?.();
  };

  // ---- Teclado ----
  const moveFocus = (target: string, extend: boolean) => {
    setFocusDay(target);
    if (extend && onSelect) onSelect({ anchor: selection?.anchor ?? activeFocus, focus: target }, 'done');
    else if (selection) onClearSelection?.();
    if (target < first || target > last) {
      pendingFocus.current = target;
      onMonthChange(cursorOf(target));
    } else {
      focusCell(target, true);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const day = activeFocus;
    const date = fromKey(day);
    const extend = event.shiftKey && !!onSelect;
    let target: string | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        target = addDays(day, -1);
        break;
      case 'ArrowRight':
        target = addDays(day, 1);
        break;
      case 'ArrowUp':
        target = addDays(day, -7);
        break;
      case 'ArrowDown':
        target = addDays(day, 7);
        break;
      case 'Home':
        target = addDays(day, -((date.getDay() + 6) % 7));
        break;
      case 'End':
        target = addDays(day, 6 - ((date.getDay() + 6) % 7));
        break;
      case 'PageUp':
      case 'PageDown': {
        // Mismo día del mes anterior/siguiente (el 31 cae en el último que haya).
        const delta = event.key === 'PageUp' ? -1 : 1;
        const lastDay = new Date(date.getFullYear(), date.getMonth() + delta + 1, 0).getDate();
        const next = toKey(new Date(date.getFullYear(), date.getMonth() + delta, Math.min(date.getDate(), lastDay)));
        event.preventDefault();
        event.stopPropagation();
        if (selection) onClearSelection?.();
        setFocusDay(next);
        pendingFocus.current = next;
        onMonthChange(cursorOf(next));
        return;
      }
      case 'Enter':
      case ' ':
        event.preventDefault();
        event.stopPropagation();
        onOpenDay(day);
        return;
      case 'Escape':
        if (selection && onClearSelection) {
          event.preventDefault();
          event.stopPropagation();
          dragRef.current = null; // también cancela un arrastre a medias
          onClearSelection();
        }
        return;
      case 'Delete':
      case 'Backspace':
        if (onClearRequest) {
          event.preventDefault();
          event.stopPropagation();
          onClearRequest(range ?? { start: day, end: day });
        }
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    moveFocus(target, extend);
  };

  // ---- Pintado ----
  const isSelected = (w: number, c: number) =>
    w >= 0 && w < weeks.length && c >= 0 && c < 7 && inRange(weeks[w][c], range);

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      aria-multiselectable={onSelect ? true : undefined}
      data-tour={tourId}
      className={cn('flex min-h-0 flex-1 select-none flex-col', className)}
    >
      {/* Días de la semana */}
      <div role="row" className="grid shrink-0 grid-cols-7">
        {WEEKDAYS.map((weekday, index) => (
          <div
            key={weekday.long}
            role="columnheader"
            aria-label={weekday.long}
            className={cn(
              'border-b-2 border-r-2 border-border bg-card/80 p-2 text-center text-xs font-bold',
              index >= 5 ? 'text-muted-foreground/70' : 'text-muted-foreground'
            )}
          >
            <span className="hidden lg:inline">{weekday.long}</span>
            <span className="lg:hidden">{weekday.short}</span>
          </div>
        ))}
      </div>

      {/* Semanas: llenan el alto disponible y, si no cabe, desplazan. */}
      <div
        ref={bodyRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        {weeks.map((week, w) => {
          const view = views[w];
          const counts = layouts[w].counts;
          return (
            <div
              key={week[0]}
              role="row"
              ref={(el) => {
                weekRefs.current[w] = el;
              }}
              className="relative flex min-h-[6.5rem] flex-1"
            >
              {week.map((day, c) => {
                const inMonth = day.startsWith(monthPrefix);
                const isToday = day === todayKey;
                const fill = fills?.get(day) || '';
                const selected = isSelected(w, c);
                const date = fromKey(day);
                const count = counts[c];
                const label = [
                  capitalize(longDayLabel(day, todayKey)),
                  isToday ? 'hoy' : '',
                  count ? `${count} ${count === 1 ? 'elemento' : 'elementos'}` : '',
                  fill ? 'con color' : '',
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <div
                    key={day}
                    role="gridcell"
                    data-day={day}
                    tabIndex={day === activeFocus ? 0 : -1}
                    aria-selected={onSelect ? selected : undefined}
                    aria-label={label}
                    onFocus={() => setFocusDay(day)}
                    className={cn(
                      'group relative min-w-0 flex-1 basis-0 cursor-pointer border-b-2 border-r-2 border-border bg-background outline-none',
                      !fill && !inMonth && 'bg-muted/30',
                      fill && PAINT_TINT,
                      'focus-visible:z-[2] focus-visible:shadow-[inset_0_0_0_2px_hsl(var(--primary))]'
                    )}
                    style={fill ? tintVar(fill) : undefined}
                  >
                    {/* Brillo al pasar el ratón (encima del color, debajo de las barras). */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 transition-colors duration-150 group-hover:bg-foreground/[0.04] motion-reduce:transition-none"
                    />
                    {selected && (
                      <span
                        aria-hidden
                        className={cn(
                          'pointer-events-none absolute inset-0 z-[1] border-primary bg-primary/10',
                          !isSelected(w - 1, c) && 'border-t-2',
                          !isSelected(w + 1, c) && 'border-b-2',
                          !isSelected(w, c - 1) && 'border-l-2',
                          !isSelected(w, c + 1) && 'border-r-2'
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'absolute right-1.5 top-1.5 z-[2] flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                        isToday
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : inMonth
                            ? 'text-foreground/85'
                            : 'text-muted-foreground/55'
                      )}
                    >
                      {date.getDate() === 1 ? `1 ${MONTH_SHORT[date.getMonth()]}` : date.getDate()}
                    </span>
                  </div>
                );
              })}

              {/* Capa de barras: no recibe el ratón salvo en los eventos. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-1 z-[3] grid grid-cols-7 content-start"
                style={{ top: HEAD_H, gridAutoRows: `${LANE_H}px`, rowGap: LANE_GAP }}
              >
                {view.segments.map((segment) => (
                  <Bar key={`${segment.item.id}-${segment.from}`} segment={segment} />
                ))}
                {view.more.map((more, c) =>
                  more.count > 0 ? (
                    <span
                      key={`more-${c}`}
                      className="pointer-events-auto flex cursor-pointer items-center truncate px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                      style={{ gridColumn: c + 1, gridRow: more.lane + 1 }}
                      title="Ver todo el día"
                    >
                      +{more.count} más
                    </span>
                  ) : null
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Un tramo de barra dentro de una semana. */
function Bar({ segment }: { segment: Segment }) {
  const { item, from, to, lane, continuesLeft, continuesRight } = segment;
  const isEvent = item.variant === 'event';
  return (
    <div
      data-item-id={item.openable ? item.id : undefined}
      title={item.hint ?? item.label}
      className={cn(
        'flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap px-1.5 text-[11px] font-semibold leading-none',
        'rounded-none',
        !continuesLeft && 'ml-[3px]',
        !continuesRight && 'mr-[3px]',
        isEvent && EVENT_TINT,
        isEvent && item.color && eventInk(item.color),
        // En oscuro, el filo de color marca dónde EMPIEZA el evento.
        isEvent && !continuesLeft && 'dark:shadow-[inset_2px_0_0_var(--tint)]',
        item.variant === 'task' && 'bg-secondary text-foreground/85 ring-1 ring-inset ring-border/70',
        item.variant === 'external' && 'bg-secondary text-foreground/90',
        item.openable &&
          'pointer-events-auto cursor-pointer transition-[filter] duration-150 hover:brightness-95 dark:hover:brightness-125 motion-reduce:transition-none',
        item.faded && 'opacity-45 saturate-50'
      )}
      style={{
        gridColumn: `${from + 1} / ${to + 2}`,
        gridRow: lane + 1,
        ...(item.color ? tintVar(item.color) : null),
      }}
    >
      {item.variant === 'task' && <ClipboardList className="h-3 w-3 shrink-0 text-primary" />}
      {item.variant === 'external' && (
        <span
          className="h-1.5 w-1.5 shrink-0 bg-primary"
          style={item.color ? { backgroundColor: item.color } : undefined}
        />
      )}
      {item.glyph && <span className="shrink-0 text-[10px]">{item.glyph}</span>}
      {item.time && <span className="shrink-0 tabular-nums opacity-75">{item.time}</span>}
      <span className="min-w-0 truncate">{item.label}</span>
      {item.bell && <Bell className="ml-auto h-2.5 w-2.5 shrink-0 opacity-70" />}
    </div>
  );
}
