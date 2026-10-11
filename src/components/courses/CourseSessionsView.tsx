import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatMinutes } from '@/lib/duration';
import { addMonths, differenceInCalendarDays, format, parseISO, startOfISOWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  FolderOpen,
  Radio,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import { classMinutes, classSessionKey } from '@/lib/schedule';
import { classMoment, type ClassMoment } from '@/lib/class-link';
import type { ClassSession, Note, Task } from '@/types';

// ============================================================
// Clases del mes de una asignatura, como LÍNEA DE TIEMPO.
//
// Las clases NO se generan aquí: nacen al guardar el horario en Asignaturas.
// Esta vista las muestra semana a semana y, dentro de cada clase, TODO lo que
// salió de ella: el tema visto, los recursos que se guardaron ese día y las
// tareas que se dejaron.
//
// El tiempo se lee de un vistazo, sin mirar fechas:
//   · pasada   → atenuada, con su visto y su balance (tema, recursos, tareas);
//   · hoy      → contorno del color de la app y la etiqueta «Hoy»;
//   · en curso → lo mismo, con el pulso de «En curso»;
//   · futura   → borde discontinuo y cuenta atrás («en 3 días»).
// El riel de la izquierda repite ese estado con su punto.
// ============================================================

const WEEKDAY_SHORT = ['', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

function WeekDivider({ number, range, isCurrent }: { number: number; range: string; isCurrent: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className={cn('h-px flex-1', isCurrent ? 'bg-primary/50' : 'bg-border')} />
      <span
        className={cn(
          'shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em]',
          isCurrent ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        Semana {number}
        <span className="ml-2 font-semibold normal-case tracking-normal opacity-70">· {range}</span>
        {isCurrent && <span className="ml-2 normal-case tracking-normal">· esta semana</span>}
      </span>
      <span className={cn('h-px flex-1', isCurrent ? 'bg-primary/50' : 'bg-border')} />
    </div>
  );
}

const MOMENT_STYLE: Record<ClassMoment, { card: string; tile: string; dot: string }> = {
  past: {
    card: 'border-border/60 bg-card/50',
    tile: 'bg-secondary text-muted-foreground',
    dot: 'border-border bg-muted-foreground/40',
  },
  today: {
    card: 'border-primary/70 bg-card shadow-[0_0_22px_hsl(var(--primary)/0.14)]',
    tile: 'bg-primary text-primary-foreground',
    dot: 'border-primary bg-primary',
  },
  now: {
    card: 'border-primary bg-card shadow-[0_0_28px_hsl(var(--primary)/0.22)]',
    tile: 'bg-primary text-primary-foreground',
    dot: 'border-primary bg-primary',
  },
  future: {
    card: 'border-dashed border-border bg-card/30',
    tile: 'border border-dashed border-primary/50 bg-primary/5 text-primary',
    dot: 'border-primary/60 bg-background',
  },
};

function momentLabel(moment: ClassMoment, date: Date): string {
  if (moment === 'now') return 'En curso';
  if (moment === 'today') return 'Hoy';
  const days = differenceInCalendarDays(date, new Date());
  if (moment === 'future') return days === 1 ? 'Mañana' : `En ${days} días`;
  if (days === 0) return 'Hoy · terminada';
  return days === -1 ? 'Ayer' : `Hace ${Math.abs(days)} días`;
}

function SessionCard({
  session,
  moment,
  resources,
  tasks,
  renderResource,
  onOpenTask,
  onChangeTopic,
  onDelete,
}: {
  session: ClassSession;
  moment: ClassMoment;
  resources: Note[];
  tasks: Task[];
  renderResource: (note: Note) => ReactNode;
  onOpenTask: (task: Task) => void;
  onChangeTopic: (topic: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.topic ?? '');
  const minutes = classMinutes(session);
  const date = parseISO(`${session.date}T00:00:00`);
  const style = MOMENT_STYLE[moment];
  const isLive = moment === 'now';
  const isPast = moment === 'past';

  const commit = () => {
    onChangeTopic(draft.trim());
    setEditing(false);
  };

  return (
    <div className="relative pl-7">
      {/* Riel: el punto de esta clase en la línea de tiempo. */}
      <span className={cn('absolute left-[5px] top-6 z-10 h-3 w-3 rounded-full border-2', style.dot)}>
        {isLive && <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />}
      </span>

      <Card className={cn('group relative overflow-hidden p-0 transition-colors hover:border-primary/60', style.card)}>
        <div className="flex items-stretch gap-3.5 p-3.5">
          {/* Fecha: una ficha de calendario */}
          <div className={cn('flex w-[54px] shrink-0 flex-col items-center justify-center rounded-lg py-1.5', style.tile)}>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{WEEKDAY_SHORT[session.weekday]}</span>
            <span className="font-headline text-2xl font-bold leading-none tabular-nums">{format(date, 'd')}</span>
            <span className="text-[9px] font-semibold uppercase opacity-80">{format(date, 'MMM', { locale: es })}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cn('font-mono text-sm font-semibold tabular-nums', isPast ? 'text-muted-foreground' : 'text-foreground')}>
                  {session.start} – {session.end}
                  {minutes > 0 && <span className="ml-2 font-sans text-[11px] font-medium text-muted-foreground">{minutes} min</span>}
                </p>
                {(session.room || session.teacher) && (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {session.room && (
                      <span className="flex items-center gap-1">
                        <DoorOpen className="h-3 w-3" /> {session.room}
                      </span>
                    )}
                    {session.teacher && (
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3 w-3" /> {session.teacher}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    isLive || moment === 'today'
                      ? 'bg-primary text-primary-foreground'
                      : isPast
                        ? 'bg-secondary text-muted-foreground'
                        : 'border border-primary/40 text-primary'
                  )}
                >
                  {isLive ? <Radio className="h-3 w-3" /> : isPast ? <CheckCircle2 className="h-3 w-3" /> : null}
                  {momentLabel(moment, date)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={onDelete}
                  title="Quitar esta clase"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Qué se vio en clase */}
            <div className="mt-2">
              {editing ? (
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commit();
                    }
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  placeholder={isPast ? '¿Qué se vio en esta clase?' : '¿Qué toca en esta clase?'}
                  rows={2}
                  autoFocus
                  className="resize-none text-xs"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(session.topic ?? '');
                    setEditing(true);
                  }}
                  className={cn(
                    'w-full text-left text-xs transition-colors hover:text-primary',
                    session.topic ? 'font-medium text-foreground' : 'italic text-muted-foreground/70'
                  )}
                >
                  {session.topic || (isPast ? 'Anotar qué se vio en clase…' : 'Anotar qué toca en esta clase…')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lo que salió de esta clase: recursos y tareas */}
        {(resources.length > 0 || tasks.length > 0) && (
          <div className="space-y-2.5 border-t border-border/60 bg-background/40 px-3.5 py-3">
            {resources.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <FolderOpen className="h-3 w-3 text-primary" />
                  Recursos · {resources.length}
                </p>
                <div className="space-y-1.5">{resources.map((note) => renderResource(note))}</div>
              </div>
            )}
            {tasks.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <ClipboardList className="h-3 w-3 text-primary" />
                  Tareas que se dejaron · {tasks.length}
                </p>
                <ul className="space-y-1">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5 text-left transition-colors hover:border-primary/50"
                        title="Ver la tarea"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{task.name}</span>
                        {task.dueDate && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {format(parseISO(task.dueDate), 'd MMM', { locale: es })}
                          </span>
                        )}
                        <span className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-secondary">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(task.progress ?? 0)}%` }} />
                        </span>
                        <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums text-primary">
                          {Math.round(task.progress ?? 0)}%
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function CourseSessionsView({
  courseId,
  month,
  onMonthChange,
  notes,
  tasks,
  renderResource,
  onOpenTask,
}: {
  courseId: string;
  /** "yyyy-MM". Lo gobierna la página porque el botón "Añadir" está fuera. */
  month: string;
  onMonthChange: (month: string) => void;
  /** Recursos y tareas pendientes de ESTA asignatura. */
  notes: Note[];
  tasks: Task[];
  /** La página sabe abrir, editar y borrar un recurso; aquí solo se coloca. */
  renderResource: (note: Note) => ReactNode;
  onOpenTask: (task: Task) => void;
}) {
  const { classSessions, schedules, updateClassSession, deleteClassSession } = useCourse();

  // El estado de cada clase depende de la hora: se repinta cada minuto.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const monthDate = parseISO(`${month}-01`);
  const monthLabel = format(monthDate, "MMMM 'de' yyyy", { locale: es });

  const sessions = useMemo(
    () =>
      (classSessions ?? [])
        .filter((c) => c.courseId === courseId && c.date.startsWith(month))
        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
    [classSessions, courseId, month]
  );

  const notesByClass = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const note of notes) {
      if (!note.classKey) continue;
      const list = map.get(note.classKey);
      if (list) list.push(note);
      else map.set(note.classKey, [note]);
    }
    return map;
  }, [notes]);

  const tasksByClass = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.classKey) continue;
      const list = map.get(task.classKey);
      if (list) list.push(task);
      else map.set(task.classKey, [task]);
    }
    return map;
  }, [tasks]);

  const schedule = schedules.find((s) => s.month === month);
  const totalMinutes = sessions.reduce((acc, s) => acc + classMinutes(s), 0);
  const givenCount = sessions.filter((s) => classMoment(s, now) === 'past').length;
  const currentWeekKey = format(startOfISOWeek(now), 'yyyy-MM-dd');

  /** Las clases repartidas en semanas de lunes a domingo. */
  const weeks = useMemo(() => {
    const groups = new Map<string, ClassSession[]>();
    for (const session of sessions) {
      const key = format(startOfISOWeek(parseISO(`${session.date}T00:00:00`)), 'yyyy-MM-dd');
      const list = groups.get(key);
      if (list) list.push(session);
      else groups.set(key, [session]);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, items], index) => {
        const first = parseISO(`${items[0].date}T00:00:00`);
        const last = parseISO(`${items[items.length - 1].date}T00:00:00`);
        const range =
          items[0].date === items[items.length - 1].date
            ? format(first, "d 'de' MMMM", { locale: es })
            : `${format(first, 'd')} – ${format(last, "d 'de' MMMM", { locale: es })}`;
        return { weekStart, number: index + 1, range, sessions: items };
      });
  }, [sessions]);

  return (
    <div className="space-y-4">
      {/* Navegación de meses + resumen del mes visible. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onMonthChange(format(addMonths(monthDate, -1), 'yyyy-MM'))}
          title="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[10rem] text-center font-headline text-sm font-bold uppercase tracking-wider text-primary">
          {monthLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onMonthChange(format(addMonths(monthDate, 1), 'yyyy-MM'))}
          title="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {sessions.length > 0 && (
        <div className="mx-auto max-w-md space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              <span className="font-semibold tabular-nums text-foreground">{givenCount}</span> de{' '}
              <span className="font-semibold tabular-nums text-foreground">{sessions.length}</span>{' '}
              {sessions.length === 1 ? 'clase dada' : 'clases dadas'}
            </span>
            {totalMinutes > 0 && (
              <span>
                <span className="font-semibold tabular-nums text-foreground">{formatMinutes(totalMinutes)}</span> de clase en el mes
              </span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${(givenCount / sessions.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-14 text-center">
          <CalendarClock className="h-9 w-9 text-muted-foreground/60" />
          <p className="text-sm font-semibold text-foreground">Sin clases en {monthLabel}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {schedule
              ? 'El horario de este mes está importado, pero no incluye ninguna clase de esta asignatura.'
              : 'Todavía no has importado el horario de este mes. Ve a Asignaturas y usa el botón «Horario»: al guardarlo, las clases se crean solas.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {weeks.map((week) => (
            <div key={week.weekStart} className="space-y-3">
              <WeekDivider number={week.number} range={week.range} isCurrent={week.weekStart === currentWeekKey} />
              <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-2">
                {week.sessions.map((session) => {
                  const key = classSessionKey(session);
                  return (
                    <div key={session.id} className="relative">
                      {/* Tramo del riel de esta tarjeta */}
                      <span className="absolute bottom-[-16px] left-[10px] top-0 w-px bg-border" aria-hidden />
                      <SessionCard
                        session={session}
                        moment={classMoment(session, now)}
                        resources={notesByClass.get(key) ?? []}
                        tasks={tasksByClass.get(key) ?? []}
                        renderResource={renderResource}
                        onOpenTask={onOpenTask}
                        onChangeTopic={(topic) => updateClassSession(session.id, { topic: topic || undefined })}
                        onDelete={() => deleteClassSession(session.id)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
