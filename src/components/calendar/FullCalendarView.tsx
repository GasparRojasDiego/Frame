import React, { useState, useEffect } from 'react';
import { useRouter } from '@/lib/navigation';
import type { Task, LocalCalendarEvent } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday as isTodayDateFns,
  isSameDay,
  startOfWeek,
  endOfWeek,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  EVENT_KIND_META,
  eventTextClass,
  getEventsForDay,
  isEventInactive,
  normalizeKind,
  splitDayEvents,
} from '@/lib/calendar-events';

// Helper to get tasks for a specific day
const getTasksForDay = (tasks: Task[] | undefined, day: Date): Task[] => {
  if (!tasks) return [];
  return tasks.filter(task => {
    if (!task.dueDate) return false;
    try {
      // The dueDate is an ISO string, parse it to a Date object for comparison.
      return isSameDay(parseISO(task.dueDate), day);
    } catch (e) {
      // Gracefully handle potential malformed date strings in localStorage.
      return false;
    }
  });
};

/** Etiqueta pequeña dentro de la casilla: la presentación "actividad". */
const EventChip = ({ event }: { event: LocalCalendarEvent }) => {
  const meta = EVENT_KIND_META[normalizeKind(event.kind)];
  return (
    <div
      className={cn('w-full rounded-md px-1 py-0.5', isEventInactive(event) && 'opacity-40 grayscale')}
      style={{ backgroundColor: event.color }}
      title={`${meta.label}${event.description ? ` · ${event.description}` : ''}`}
    >
      <p className={cn('truncate text-[10px] font-bold', eventTextClass(event.color))}>
        {meta.glyph} {event.title}
      </p>
    </div>
  );
};

const CalendarTaskButton = ({ task }: { task: Task }) => {
  const router = useRouter();
  const [isDialogOpen, setDialogOpen] = useState(false);

  const handleNavigateToTasksPanel = () => {
    setDialogOpen(false);
    // Disable Next.js's default scroll restoration to allow manual scrolling to take over.
    router.push(`/tareas?highlightTaskId=${task.id}`, { scroll: false });
  };

  const handleNavigateToCourse = () => {
    setDialogOpen(false);
    // Disable Next.js's default scroll restoration here as well for consistency.
    router.push(`/cursos/?id=${task.courseId}&highlightTaskId=${task.id}`, { scroll: false });
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <button className="text-left bg-secondary rounded-md p-1 w-full hover:bg-accent/80 transition-colors">
          <p className="text-primary text-[10px] font-bold text-center">{task.courseName}</p>
          <p className={cn(
            "text-muted-foreground text-[10px] whitespace-pre-wrap text-center"
          )}>
            {task.name}
          </p>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-primary text-xl font-bold text-center">Interfaz</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 pt-4">
          <Button
            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary"
            onClick={handleNavigateToTasksPanel}
          >
            Galería de tareas
          </Button>
          <Button
            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary"
            onClick={handleNavigateToCourse}
          >
            Ir a la asignatura
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// Calendario LOCAL de la interfaz Calendario: eventos propios y tareas.
//
// Deliberadamente NO muestra calificaciones ni tiempo de estudio: eso es el
// calendario de Enfoque, y tenerlo en los dos sitios era la misma información
// contada dos veces. Aquí manda la agenda; allí, el rendimiento.
// ============================================================
export default function FullCalendarView({
  tasks,
  localEvents,
  editMode = false,
  onOpenDay,
}: {
  tasks?: Task[];
  localEvents?: LocalCalendarEvent[];
  /** Con el modo edición encendido, cada casilla abre la gestión del día. */
  editMode?: boolean;
  onOpenDay?: (day: Date) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  // Día abierto en el detalle de solo lectura (casillas saturadas → "+N más").
  const [detailDay, setDetailDay] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);


  const firstDayCurrentMonth = startOfMonth(currentDate);

  const calendarStart = startOfWeek(firstDayCurrentMonth, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(firstDayCurrentMonth), { weekStartsOn: 1 });

  const daysInGrid = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const weeks: Date[][] = [];
  for (let i = 0; i < daysInGrid.length; i += 7) {
      weeks.push(daysInGrid.slice(i, i + 7));
  }

  const prevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return (
    <div className="px-6 md:px-8 pb-6 flex flex-col gap-6">
      <div className="flex flex-row items-center justify-center gap-2">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold text-primary font-headline uppercase tracking-wider text-center capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: es })}
        </h2>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {editMode && (
        <p className="flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
          <Pencil className="h-3.5 w-3.5" />
          Modo edición: pulsa cualquier día para ver, editar o borrar sus eventos.
        </p>
      )}

      <Card className="bg-transparent border-0 shadow-none">
          <CardContent className="p-0">
              <div className="grid grid-cols-7 border-t-2 border-l-2 border-border">
                  {daysOfWeek.map((day) => (
                      <div key={day} className="text-center text-xs font-bold text-muted-foreground p-2 border-r-2 border-b-2 border-border bg-card/80">
                          {day}
                      </div>
                  ))}
              </div>
              <div className="grid grid-cols-1 border-l-2 border-border">
                {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-7">
                        {week.map((day) => {
                            const dayStr = format(day, 'yyyy-MM-dd');
                            const isCurrentMonth = isSameMonth(day, currentDate);
                            const isToday = isTodayDateFns(day);
                            const tasksForDay = getTasksForDay(tasks, day);
                            // El evento "casilla" pinta el día entero; el resto
                            // van como etiquetas dentro, junto a tareas y cifras.
                            const { cell, chips } = splitDayEvents(getEventsForDay(localEvents, dayStr));
                            const cellInactive = cell ? isEventInactive(cell) : false;
                            const cellMeta = cell ? EVENT_KIND_META[normalizeKind(cell.kind)] : null;

                            const nodes: React.ReactNode[] = [
                              ...chips.map((ev) => <EventChip key={`ev-${ev.id}`} event={ev} />),
                              ...(tasks
                                ? tasksForDay.map((task) => (
                                    <CalendarTaskButton key={task.id} task={task} />
                                  ))
                                : []),
                            ];

                            // Anti-saturación: con más de 3 elementos se muestran
                            // 2 + un indicador; el detalle completo va en un recuadro.
                            const isSaturated = nodes.length > 3;

                            return (
                                <div
                                  key={day.toString()}
                                  role={editMode ? 'button' : undefined}
                                  tabIndex={editMode ? 0 : undefined}
                                  onClick={editMode ? () => onOpenDay?.(day) : undefined}
                                  onKeyDown={
                                    editMode
                                      ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onOpenDay?.(day);
                                          }
                                        }
                                      : undefined
                                  }
                                  className={cn(
                                    "relative border-r-2 border-b-2 border-border p-1 flex flex-col gap-1 min-h-24 transition-colors",
                                    // Sin evento de casilla, el fondo normal.
                                    !cell && "bg-background",
                                    !isCurrentMonth && "text-muted-foreground/60",
                                    cellInactive && "grayscale",
                                    editMode && "cursor-pointer ring-inset hover:ring-2 hover:ring-primary/60"
                                  )}
                                  style={cell ? { backgroundColor: cell.color } : undefined}
                                >
                                    <div className={cn(
                                      "self-end text-xs font-semibold",
                                      cell && eventTextClass(cell.color),
                                      isToday && "flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground"
                                    )}>
                                        {format(day, 'd')}
                                    </div>

                                    {/* Título del evento que pinta la casilla: sin
                                        recuadro propio, porque el recuadro ES la casilla. */}
                                    {cell && cellMeta && (
                                      <p
                                        className={cn(
                                          'truncate px-0.5 text-[10px] font-bold',
                                          eventTextClass(cell.color)
                                        )}
                                        title={cell.description || cell.title}
                                      >
                                        {cellMeta.glyph} {cell.title}
                                      </p>
                                    )}

                                    <div className="flex flex-col gap-1 overflow-y-auto">
                                      {isSaturated ? (
                                        <>
                                          {nodes.slice(0, 2)}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDetailDay(day);
                                            }}
                                            className="w-full rounded-md border border-dashed border-primary/50 bg-primary/10 p-1 text-center text-[10px] font-bold text-primary transition-colors hover:bg-primary/20"
                                          >
                                            +{nodes.length - 2} más
                                          </button>
                                        </>
                                      ) : (
                                        nodes
                                      )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
              </div>
          </CardContent>
      </Card>

      {/* Detalle de un día saturado: TODO lo que hay ese día, en solo lectura.
          Editar y borrar viven en el modo edición, no aquí. */}
      <Dialog open={!!detailDay} onOpenChange={(o) => !o && setDetailDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-primary capitalize">
              {detailDay && format(detailDay, "EEEE d 'de' MMMM", { locale: es })}
            </DialogTitle>
          </DialogHeader>
          {detailDay && (
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {getEventsForDay(localEvents, format(detailDay, 'yyyy-MM-dd')).map((ev) => {
                const meta = EVENT_KIND_META[normalizeKind(ev.kind)];
                return (
                  <div
                    key={ev.id}
                    className={cn('rounded-md p-2.5', isEventInactive(ev) && 'opacity-50 grayscale')}
                    style={{ backgroundColor: ev.color }}
                  >
                    <p className={cn('truncate text-sm font-bold', eventTextClass(ev.color))}>
                      {meta.glyph} {ev.title}
                    </p>
                    <p className={cn('text-[10px] opacity-80', eventTextClass(ev.color))}>
                      {meta.label}
                      {isEventInactive(ev) && ' · pasado'}
                    </p>
                    {ev.description && (
                      <p className={cn('mt-0.5 text-xs opacity-90', eventTextClass(ev.color))}>
                        {ev.description}
                      </p>
                    )}
                  </div>
                );
              })}
              {tasks && getTasksForDay(tasks, detailDay).map((task) => (
                <div key={task.id} className="rounded-md bg-secondary/60 p-2.5">
                  <p className="truncate text-sm font-semibold text-foreground">{task.name}</p>
                  <p className="text-[10px] text-muted-foreground">Tarea · {task.courseName}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
