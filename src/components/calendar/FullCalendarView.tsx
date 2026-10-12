import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import { useTodayKey } from '@/hooks/use-today';
import { ensureNotificationPermission } from '@/lib/notify';
import { cn } from '@/lib/utils';
import type { LocalCalendarEvent, Task } from '@/types';
import { EVENT_KIND_META, eventDisplay, normalizeKind } from '@/lib/calendar-events';
import MonthBar from './MonthBar';
import MonthGrid, { type GridSelection } from './MonthGrid';
import SelectionBar from './SelectionBar';
import DayEventsDialog, { type CalendarPanel } from './DayEventsDialog';
import type { EventPreset } from './LocalEventDialog';
import {
  MONTH_NAMES,
  buildFills,
  buildTaskItems,
  capitalize,
  cursorOf,
  daysBetween,
  daysOf,
  eventEnd,
  groupTasksByDay,
  inRange,
  monthKeyOf,
  monthWeeks,
  orderRange,
  paintedByEvent,
  planClear,
  planUnpaint,
  rangeLabel,
  remindLabel,
  shiftMonth,
  shortDayLabel,
  type ClearPlan,
  type DayRange,
  type GridItem,
  type MonthCursor,
} from './calendar-model';

// ============================================================
// Calendario LOCAL de la interfaz Calendario: eventos propios, colores de
// casilla y tareas con fecha de entrega. Funciona sin internet y se
// sincroniza con la cuenta.
//
// Deliberadamente NO muestra calificaciones ni tiempo de estudio: eso es el
// calendario de Estudio, y tenerlo en los dos sitios era la misma información
// contada dos veces. Aquí manda la agenda; allí, el rendimiento.
//
// Sin modos ni explicaciones, todo sale de la propia cuadrícula:
//   · clic en un día → el recuadro de ese día (ver, crear, color);
//   · clic en un evento → editarlo;
//   · arrastrar o mayús+clic → varios días, y la barra flotante aplica en
//     bloque: evento (p. ej. unas vacaciones), recordatorio, color, quitar el
//     color o vaciar (también con Supr);
//   · «Evento» en la fila del mes crea para la selección, o para hoy.
// ============================================================

/** Elementos de la cuadrícula para los días visibles: eventos y tareas. */
function buildItems(
  events: LocalCalendarEvent[],
  tasks: Task[],
  first: string,
  last: string,
  todayKey: string
): GridItem[] {
  const items: GridItem[] = buildTaskItems(tasks, first, last);
  for (const event of events) {
    const end = eventEnd(event);
    if (end < first || event.date > last) continue;
    const meta = EVENT_KIND_META[normalizeKind(event.kind)];
    const remind = event.time ? remindLabel(event.remindBefore) : null;
    items.push({
      id: event.id,
      start: event.date,
      end,
      label: event.title,
      glyph: meta.glyph,
      time: event.time,
      color: event.color,
      variant: 'event',
      faded: end < todayKey,
      bell: !!remind,
      openable: true,
      hint: [
        event.title,
        meta.label,
        event.time,
        end !== event.date ? rangeLabel({ start: event.date, end }) : '',
        remind ? `Aviso ${remind.toLowerCase()}` : '',
        event.description ?? '',
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }
  return items;
}

export default function FullCalendarView({
  trailing,
  className,
}: {
  /** Controles extra a la derecha de la fila del mes (el conmutador Google/Local). */
  trailing?: ReactNode;
  className?: string;
}) {
  const {
    tasks,
    localEvents,
    addLocalEvent,
    updateLocalEvent,
    deleteLocalEvent,
    dayColors,
    setDayColors,
  } = useCourse();
  const { toast } = useToast();
  const todayKey = useTodayKey();

  const [cursor, setCursor] = useState<MonthCursor>(() => cursorOf(todayKey));
  const [selection, setSelection] = useState<GridSelection | null>(null);
  const [dragging, setDragging] = useState(false);
  const [panel, setPanel] = useState<CalendarPanel | null>(null);
  const [pendingClear, setPendingClear] = useState<{ range: DayRange; plan: ClearPlan } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ day: string; nonce: number } | null>(null);

  // ---- Lo que se pinta: calculado una vez por mes y por cambio de datos ----
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weeks = useMemo(() => monthWeeks(cursor), [cursor.year, cursor.month]);
  const first = weeks[0][0];
  const last = weeks[weeks.length - 1][6];

  const items = useMemo(
    () => buildItems(localEvents, tasks, first, last, todayKey),
    [localEvents, tasks, first, last, todayKey]
  );
  const fills = useMemo(
    () => buildFills(localEvents, dayColors, first, last),
    [localEvents, dayColors, first, last]
  );

  const tasksByDay = useMemo(() => groupTasksByDay(tasks), [tasks]);

  const range = selection ? orderRange(selection.anchor, selection.focus) : null;

  /** Color con que se ve una casilla, también fuera del mes visible. */
  const fillOf = useCallback(
    (day: string) => (day >= first && day <= last ? fills.get(day) ?? '' : buildFills(localEvents, dayColors, day, day).get(day) ?? ''),
    [fills, first, last, localEvents, dayColors]
  );

  // Color común de la selección (para marcar su muestra en la barra).
  const selectionColor = useMemo(() => {
    if (!range || daysBetween(range.start, range.end) > 62) return null;
    const colors = new Set(daysOf(range).map(fillOf));
    return colors.size === 1 ? [...colors][0] : null;
  }, [range?.start, range?.end, fillOf]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Acciones ----
  const paintDays = useCallback(
    (days: string[], color: string | null) => {
      if (days.length === 0) return;
      if (color) {
        setDayColors(days, color);
        return;
      }
      // Quitar el color: lo propio se olvida; lo que pinta un evento se tapa.
      const { forget, blank } = planUnpaint(localEvents, days);
      if (forget.length) setDayColors(forget, null);
      if (blank.length) setDayColors(blank, '');
    },
    [localEvents, setDayColors]
  );

  const saveEvent = useCallback(
    (payload: Omit<LocalCalendarEvent, 'id'>, existing?: LocalCalendarEvent) => {
      if (existing) updateLocalEvent(existing.id, payload);
      else addLocalEvent(payload);

      // «Pintar las casillas» manda sobre los días que se dejaron sin color, pero
      // solo en los que el evento empieza a pintar ahora: los que ya pintaba y se
      // dejaron sin color a mano siguen así aunque se edite otra cosa.
      if (payload.display === 'casilla') {
        const end = eventEnd(payload);
        const painted = existing && eventDisplay(existing) === 'casilla' ? { start: existing.date, end: eventEnd(existing) } : null;
        const blanks = dayColors
          .filter((c) => !c.color && c.id >= payload.date && c.id <= end && !inRange(c.id, painted))
          .map((c) => c.id);
        if (blanks.length) setDayColors(blanks, null);
      }

      if (payload.time && payload.remindBefore !== undefined) {
        void ensureNotificationPermission().catch(() => undefined);
        if (!existing) {
          const when = payload.endDate
            ? `Del ${rangeLabel({ start: payload.date, end: payload.endDate })}, cada día a las ${payload.time}`
            : `${shortDayLabel(payload.date)} a las ${payload.time}`;
          toast({
            title: 'Aviso programado',
            description: `${when} · ${remindLabel(payload.remindBefore)?.toLowerCase()}`,
          });
        }
      }
      if (!existing) setSelection(null);
    },
    [addLocalEvent, updateLocalEvent, dayColors, setDayColors, toast]
  );

  const deleteEvent = useCallback(
    (event: LocalCalendarEvent) => {
      deleteLocalEvent(event.id);
      // Las marcas «sin color» que solo tapaban a este evento ya no hacen falta.
      const others = localEvents.filter((e) => e.id !== event.id);
      const end = eventEnd(event);
      const stale = dayColors
        .filter((c) => !c.color && c.id >= event.date && c.id <= end && !paintedByEvent(others, c.id))
        .map((c) => c.id);
      if (stale.length) setDayColors(stale, null);
    },
    [deleteLocalEvent, localEvents, dayColors, setDayColors]
  );

  const requestClear = useCallback(
    (target: DayRange) => {
      const plan = planClear(localEvents, dayColors, target, todayKey);
      if (plan.eventCount === 0 && plan.colorDays.length === 0) {
        toast({ title: 'Nada que vaciar', description: 'Esos días no tienen eventos ni color.' });
        return;
      }
      setPendingClear({ range: target, plan });
    },
    [localEvents, dayColors, todayKey, toast]
  );

  const applyClear = () => {
    if (!pendingClear) return;
    const { plan } = pendingClear;
    plan.remove.forEach(deleteLocalEvent);
    plan.update.forEach(({ id, changes }) => updateLocalEvent(id, changes));
    plan.add.forEach(addLocalEvent);
    if (plan.colorDays.length) setDayColors(plan.colorDays, null);
    setPendingClear(null);
    setSelection(null);
  };

  const openForm = (preset: EventPreset, target?: DayRange) => {
    const fallback = todayKey >= first && todayKey <= last ? todayKey : `${monthKeyOf(cursor)}-01`;
    setPanel({ view: 'form', range: target ?? range ?? { start: fallback, end: fallback }, preset });
  };

  const goToday = () => {
    setCursor(cursorOf(todayKey));
    setFocusRequest({ day: todayKey, nonce: Date.now() });
  };

  // ---- Esc y Supr con la selección a la vista, aunque el foco esté fuera ----
  useEffect(() => {
    if (!range || panel || pendingClear) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') {
        setSelection(null);
      } else if (event.key === 'Delete') {
        event.preventDefault();
        requestClear(range);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [range?.start, range?.end, panel, pendingClear, requestClear]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lo que hará «Vaciar», separando lo que se borra de lo que solo se recorta
  // (un evento que sigue en otros días no se pierde).
  const clearSummary = (() => {
    if (!pendingClear) return '';
    const removed = pendingClear.plan.remove.length;
    const trimmed = pendingClear.plan.update.length;
    const colors = pendingClear.plan.colorDays.length;
    const parts = [
      removed ? (removed === 1 ? 'se borrará 1 evento' : `se borrarán ${removed} eventos`) : '',
      trimmed
        ? trimmed === 1
          ? 'se recortará 1 evento que sigue en otros días'
          : `se recortarán ${trimmed} eventos que siguen en otros días`
        : '',
      colors ? `se quitará el color de ${colors} ${colors === 1 ? 'casilla' : 'casillas'}` : '',
    ].filter(Boolean);
    const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0] ?? '';
    return capitalize(text);
  })();

  return (
    <section className={cn('flex min-h-0 flex-col gap-3', className)} aria-label="Calendario local">
      <MonthBar
        cursor={cursor}
        onPrev={() => setCursor((c) => shiftMonth(c, -1))}
        onNext={() => setCursor((c) => shiftMonth(c, 1))}
        onToday={goToday}
        status={
          // Primer uso: lo único que no se descubre mirando es arrastrar.
          localEvents.length === 0 && dayColors.length === 0 && !range ? (
            <span className="hidden text-[11px] text-muted-foreground xl:inline">
              Arrastra sobre varios días para marcarlos a la vez
            </span>
          ) : null
        }
      >
        {trailing}
        <Button
          variant="fantasma"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={() => openForm('evento')}
          title={range ? `Crear un evento del ${rangeLabel(range)}` : 'Crear un evento'}
          data-tour="cal-crear"
        >
          <Plus />
          Evento
        </Button>
      </MonthBar>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/40 shadow-sm">
        <MonthGrid
          weeks={weeks}
          cursor={cursor}
          items={items}
          fills={fills}
          todayKey={todayKey}
          selection={selection}
          onSelect={(next, phase) => {
            setSelection(next);
            setDragging(phase === 'live');
          }}
          onClearSelection={() => {
            setSelection(null);
            setDragging(false);
          }}
          onOpenDay={(day) => setPanel({ view: 'day', day })}
          onOpenItem={(id) => {
            const event = localEvents.find((e) => e.id === id);
            if (event) setPanel({ view: 'form', event, range: { start: event.date, end: eventEnd(event) } });
          }}
          onClearRequest={requestClear}
          onMonthChange={setCursor}
          focusRequest={focusRequest}
          ariaLabel={`${MONTH_NAMES[cursor.month]} de ${cursor.year}`}
          tourId="cal-editar"
        />

        {range && !dragging && !panel && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
            <SelectionBar
              range={range}
              currentColor={selectionColor}
              onEvent={() => openForm('evento', range)}
              onReminder={() => openForm('recordatorio', range)}
              onPaint={(color) => paintDays(daysOf(range), color)}
              onClear={() => requestClear(range)}
              onDismiss={() => setSelection(null)}
            />
          </div>
        )}
      </div>

      <DayEventsDialog
        panel={panel}
        onPanelChange={setPanel}
        todayKey={todayKey}
        events={localEvents}
        tasksOfDay={(day) => tasksByDay.get(day) ?? []}
        fillOf={fillOf}
        onSave={saveEvent}
        onDelete={deleteEvent}
        onPaint={paintDays}
      />

      {/* Vaciar unos días: lo único irreversible del calendario, se confirma. */}
      <AlertDialog open={!!pendingClear} onOpenChange={(open) => !open && setPendingClear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingClear && pendingClear.range.start === pendingClear.range.end
                ? `¿Vaciar el ${shortDayLabel(pendingClear.range.start)}?`
                : `¿Vaciar del ${pendingClear ? rangeLabel(pendingClear.range) : ''}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clearSummary}. Las tareas no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={applyClear}>
              Vaciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
