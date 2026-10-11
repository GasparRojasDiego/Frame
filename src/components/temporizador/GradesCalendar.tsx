import { NoteText } from '@/components/temporizador/NoteEditor';
import { useMemo, useState } from 'react';
import type { DailyPerformance, StudySession } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { ChevronLeft, ChevronRight, Clock3, Pencil, Trash2, Target, Hourglass, ListChecks } from 'lucide-react';
import { studyDayparts } from '@/lib/study-dayparts';
import { cn } from '@/lib/utils';
import { sessionSeconds, formatDurationLabel, formatTotalMinutes, formatMinutes } from '@/lib/duration';
import { useCourse } from '@/context/CourseContext';
import SessionNotesList, { SessionNotesHeading } from '@/components/temporizador/SessionNotesList';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday as isTodayDateFns,
  startOfWeek,
  endOfWeek,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { StudyGoals } from '@/types';

// ============================================================
// Calendario de ENFOQUE: la calificación (o el tiempo) de cada día.
// Es el calendario LOCAL de rendimiento; el de la interfaz Calendario
// (tareas y eventos) es otro componente distinto (FullCalendarView).
// Al pulsar una casilla se abre la tarjeta con TODAS las sesiones de
// estudio de ese día, con opción de eliminarlas.
// ============================================================

interface GradesCalendarProps {
  performances: DailyPerformance[];
  studySessions: StudySession[];
  selectionMode: 'rendimiento' | 'tiempo';
  onDeleteSession: (id: string) => void;
  /** Abre el diálogo de corrección. Como eliminar, solo para el día de hoy. */
  onEditSession?: (session: StudySession) => void;
}

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** getDay() (0 = domingo) → clave de StudyGoals. */
const GOAL_KEYS: (keyof StudyGoals)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

/**
 * Tramo horario real de una sesión. `startTime` y `endTime` guardan ambos el
 * instante en que la sesión se REGISTRÓ, así que la hora de inicio se deduce
 * restando la duración. Las pausas alargan el tramo de verdad, de modo que
 * esto es el mínimo: nunca inventa tiempo que no se estudió.
 */
const sessionRange = (s: StudySession): { start: Date; end: Date } | null => {
  try {
    const end = parseISO(s.endTime || s.startTime);
    return { start: new Date(end.getTime() - sessionSeconds(s) * 1000), end };
  } catch {
    return null;
  }
};

export default function GradesCalendar({
  performances,
  studySessions,
  selectionMode,
  onDeleteSession,
  onEditSession,
}: GradesCalendarProps) {
  const { studyGoals, tasks, archivedTasks } = useCourse();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [detailDay, setDetailDay] = useState<Date | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StudySession | null>(null);

  /** Nombre de una tarea avanzada, esté pendiente o ya archivada. */
  const taskNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks ?? []) map.set(t.id, t.name);
    for (const t of archivedTasks ?? []) map.set(t.id, t.name);
    return map;
  }, [tasks, archivedTasks]);

  const weeks = useMemo(() => {
    const first = startOfMonth(currentDate);
    const days = eachDayOfInterval({
      start: startOfWeek(first, { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(first), { weekStartsOn: 1 }),
    });
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [currentDate]);

  // Sesiones agrupadas por día local (YYYY-MM-DD), más recientes primero.
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const s of studySessions ?? []) {
      let key: string;
      try {
        key = format(parseISO(s.startTime), 'yyyy-MM-dd');
      } catch {
        continue;
      }
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    for (const list of map.values()) {
      // Orden CRONOLÓGICO (la primera del día arriba): así el detalle se lee
      // como el relato de la jornada y el acumulado tiene sentido.
      list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    return map;
  }, [studySessions]);

  const performanceByDay = useMemo(() => {
    const map = new Map<string, DailyPerformance>();
    for (const p of performances ?? []) map.set(p.id, p);
    return map;
  }, [performances]);

  const detailKey = detailDay ? format(detailDay, 'yyyy-MM-dd') : null;
  const detailSessions = detailKey ? sessionsByDay.get(detailKey) ?? [] : [];
  const detailPerf = detailKey ? performanceByDay.get(detailKey) ?? null : null;
  const detailSeconds = detailSessions.reduce((acc, s) => acc + sessionSeconds(s), 0);
  const detailIsToday = detailDay ? isTodayDateFns(detailDay) : false;

  /**
   * Meta de tiempo DE AQUEL DÍA. La meta se puede cambiar en Perfil, así que
   * la de hoy no tiene por qué ser la que regía entonces — pero es
   * recuperable: la calificación guardada se calculó como
   * `score = enfoqueMedio × (minutos / meta)`, de donde la meta se despeja.
   * Si la nota tocó el techo de 20 la división ya no es fiable y se recurre
   * a la meta configurada hoy, avisando de ello.
   */
  const detailGoal = useMemo((): { minutes: number; historic: boolean } | null => {
    if (!detailDay) return null;
    const current = studyGoals?.[GOAL_KEYS[detailDay.getDay()]] ?? 0;

    if (detailPerf && detailPerf.score > 0 && detailPerf.score < 20 && detailSessions.length > 0) {
      const minutes = detailSeconds / 60;
      const focusAvg =
        detailSessions.reduce((acc, s) => acc + (s.perception || 0), 0) / detailSessions.length;
      const derived = (focusAvg * minutes) / detailPerf.score;
      if (Number.isFinite(derived) && derived > 0) {
        return { minutes: Math.round(derived), historic: true };
      }
    }
    return current > 0 ? { minutes: current, historic: false } : null;
  }, [detailDay, detailPerf, detailSessions, detailSeconds, studyGoals]);

  const goalPercent =
    detailGoal && detailGoal.minutes > 0
      ? Math.min(100, Math.round((detailSeconds / 60 / detailGoal.minutes) * 100))
      : null;

  /** En qué momento del día se estudió (antes, «Dónde fue tu tiempo» en Inicio). */
  const detailDayparts = useMemo(
    () => studyDayparts(detailSessions, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY),
    [detailSessions]
  );

  /** Enfoque medio del día (solo tiene sentido en modo rendimiento). */
  const detailFocusAvg =
    detailSessions.length > 0
      ? detailSessions.reduce((acc, s) => acc + (s.perception || 0), 0) / detailSessions.length
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          title="Mes anterior"
          onClick={() => setCurrentDate((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold text-primary font-headline uppercase tracking-wider text-center">
          {format(currentDate, 'MMMM yyyy', { locale: es })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          title="Mes siguiente"
          onClick={() => setCurrentDate((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <Card className="bg-transparent border-0 shadow-none">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-t-2 border-l-2 border-border">
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-bold text-muted-foreground p-2 border-r-2 border-b-2 border-border bg-card/80"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 border-l-2 border-border">
            {weeks.map((week) => (
              <div key={week[0].toISOString()} className="grid grid-cols-7">
                {week.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isTodayDateFns(day);
                  const perf = performanceByDay.get(key);
                  const daySessions = sessionsByDay.get(key) ?? [];
                  const daySeconds = daySessions.reduce((acc, s) => acc + sessionSeconds(s), 0);
                  const timeLabel = formatTotalMinutes(daySeconds / 60);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDetailDay(day)}
                      title={format(day, "EEEE d 'de' MMMM", { locale: es })}
                      className={cn(
                        'border-r-2 border-b-2 border-border p-1 flex flex-col gap-1 bg-background min-h-24 text-left transition-colors hover:bg-secondary/30',
                        !isCurrentMonth && 'text-muted-foreground/60'
                      )}
                    >
                      <div
                        className={cn(
                          'self-end text-xs font-semibold',
                          isToday &&
                            'flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground'
                        )}
                      >
                        {format(day, 'd')}
                      </div>
                      <div className="flex flex-col gap-1">
                        {selectionMode === 'rendimiento' && perf && (
                          <div className="p-1 rounded-md bg-secondary/50 text-center">
                            <p className="font-bold text-sm text-primary">
                              {perf.score.toFixed(1)}{' '}
                              <span className="font-bold text-xs text-primary">
                                {perf.grade.toUpperCase()}
                              </span>
                            </p>
                          </div>
                        )}
                        {selectionMode === 'tiempo' && timeLabel && (
                          <div className="p-1 rounded-md bg-secondary/50 text-center">
                            <p className="font-bold text-sm text-primary">{timeLabel}</p>
                          </div>
                        )}
                        {daySessions.length > 0 && (
                          <p className="text-center text-[10px] text-muted-foreground">
                            {daySessions.length} {daySessions.length === 1 ? 'sesión' : 'sesiones'}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------
          Tarjeta del día: la jornada contada en orden, con la meta que regía
          entonces y el acumulado tras cada sesión. Solo el día de hoy admite
          borrar sesiones; el pasado es registro y no se toca.
          ------------------------------------------------------------------ */}
      <Dialog open={!!detailDay} onOpenChange={(open) => !open && setDetailDay(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-3 border-b px-6 pb-4 pt-6">
            <DialogTitle className="text-center text-xl font-bold text-primary first-letter:uppercase">
              {detailDay && format(detailDay, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
            </DialogTitle>

            {/* Resumen: tiempo frente a meta + las dos cifras del modo. */}
            <div className="space-y-2.5 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Tiempo estudiado
                  </p>
                  <p className="font-headline text-2xl font-bold tabular-nums text-primary">
                    {formatDurationLabel(detailSeconds)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Target className="h-3 w-3" /> Meta del día
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {detailGoal ? formatMinutes(detailGoal.minutes) : 'Sin meta'}
                    {goalPercent !== null && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {goalPercent}%
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {goalPercent !== null && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      goalPercent >= 100 ? 'bg-emerald-500' : 'bg-primary'
                    )}
                    style={{ width: `${goalPercent}%` }}
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 border-t border-primary/20 pt-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">Sesiones</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {detailSessions.length}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Enfoque medio</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {detailSessions.length > 0 ? `${detailFocusAvg.toFixed(1)}/20` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Calificación</p>
                  <p className="text-sm font-bold tabular-nums text-primary">
                    {detailPerf ? `${detailPerf.score.toFixed(1)} ${detailPerf.grade}` : '—'}
                  </p>
                </div>
              </div>

              {detailDayparts && (
                <div className="space-y-1.5 border-t border-primary/20 pt-2">
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Clock3 className="h-3 w-3" /> Cuándo estudiaste
                  </p>
                  <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-secondary">
                    {detailDayparts.buckets.map((bucket) =>
                      bucket.minutes > 0 ? (
                        <span
                          key={bucket.key}
                          className={cn(
                            'h-full transition-all duration-500',
                            bucket.key === detailDayparts.top.key ? 'bg-primary' : 'bg-primary/35'
                          )}
                          style={{ width: `${(bucket.minutes / detailDayparts.total) * 100}%` }}
                        />
                      ) : null
                    )}
                  </div>
                  <ul className="grid grid-cols-3 gap-2">
                    {detailDayparts.buckets.map((bucket) => (
                      <li
                        key={bucket.key}
                        className={cn(
                          'rounded-md px-1.5 py-1 text-center',
                          bucket.key === detailDayparts.top.key && bucket.minutes > 0 ? 'bg-primary/10' : 'bg-secondary/40'
                        )}
                      >
                        <p
                          className={cn(
                            'text-xs font-bold tabular-nums',
                            bucket.key === detailDayparts.top.key && bucket.minutes > 0 ? 'text-primary' : 'text-foreground'
                          )}
                        >
                          {bucket.minutes > 0 ? formatMinutes(Math.round(bucket.minutes)) : '—'}
                        </p>
                        <p className="text-[10px] leading-tight text-muted-foreground">
                          {bucket.label} · {Math.round((bucket.minutes / detailDayparts.total) * 100)}%
                        </p>
                        <p className="text-[9px] leading-tight text-muted-foreground/70">{bucket.hint}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detailGoal && (
                <p className="text-center text-[10px] text-muted-foreground/80">
                  {detailGoal.historic
                    ? 'Meta reconstruida a partir de la calificación de ese día.'
                    : 'Meta configurada actualmente para este día de la semana.'}
                </p>
              )}
            </div>
          </DialogHeader>

          {/* Relato de la jornada, en orden y con acumulado. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {detailSessions.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No hay sesiones de estudio registradas este día.
              </p>
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-5">
                {(() => {
                  let running = 0;
                  return detailSessions.map((s, index) => {
                    const seconds = sessionSeconds(s);
                    running += seconds;
                    const range = sessionRange(s);
                    const advanced = (s.taskIds ?? [])
                      .map((id) => taskNameById.get(id))
                      .filter((n): n is string => Boolean(n));

                    return (
                      <li key={s.id} className="relative">
                        <span className="absolute -left-[1.4rem] top-3 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-primary text-[9px] font-bold text-primary-foreground">
                          {index + 1}
                        </span>

                        <div className="rounded-lg border border-border/70 bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-semibold text-foreground tabular-nums">
                                {range
                                  ? `${format(range.start, 'HH:mm')} – ${format(range.end, 'HH:mm')}`
                                  : format(parseISO(s.startTime), 'HH:mm')}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{s.sessionType}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">
                                {formatDurationLabel(seconds)}
                              </span>
                              {detailIsToday && onEditSession && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                                  onClick={() => onEditSession(s)}
                                  title="Corregir esta sesión"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {detailIsToday && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 shrink-0 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                  onClick={() => setPendingDelete(s)}
                                  title="Eliminar esta sesión"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {s.subjects?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {s.subjects.map((subject) => (
                                <span
                                  key={subject}
                                  className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground"
                                >
                                  {subject}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-[10px] italic text-muted-foreground">
                              Sin asignatura declarada
                            </p>
                          )}

                          {s.notes && (
                            <NoteText
                              text={s.notes}
                              className="mt-2 rounded-md bg-secondary/50 p-2 text-[11px] leading-relaxed text-foreground"
                            />
                          )}

                          {/* Lo anotado DURANTE la sesión: el relato minuto a
                              minuto, no el resumen del final. */}
                          {s.progressNotes && s.progressNotes.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <SessionNotesHeading count={s.progressNotes.length} />
                              <SessionNotesList notes={s.progressNotes} />
                            </div>
                          )}

                          {advanced.length > 0 && (
                            <p className="mt-2 flex items-start gap-1.5 text-[10px] text-muted-foreground">
                              <ListChecks className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                              <span className="min-w-0">Avanzaste: {advanced.join(' · ')}</span>
                            </p>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Hourglass className="h-3 w-3 text-primary/70" />
                              Acumulado: {formatDurationLabel(running)}
                              {detailGoal && detailGoal.minutes > 0 && (
                                <span className="text-muted-foreground/70">
                                  {' '}
                                  ({Math.round((running / 60 / detailGoal.minutes) * 100)}% de la meta)
                                </span>
                              )}
                            </span>
                            {s.mode === 'rendimiento' && (
                              <span>
                                Enfoque <span className="font-bold text-primary">{s.perception}</span>/20
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  });
                })()}
              </ol>
            )}
          </div>

          {!detailIsToday && detailSessions.length > 0 && (
            <p className="shrink-0 border-t px-6 py-2.5 text-center text-[10px] text-muted-foreground">
              Las sesiones de días pasados no se editan ni se eliminan: son tu registro.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta sesión de estudio?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  Se borrará la sesión de {formatDurationLabel(sessionSeconds(pendingDelete))}
                  {pendingDelete.subjects?.length
                    ? ` en ${pendingDelete.subjects.join(', ')}`
                    : ''}
                  . La calificación de ese día se recalculará. Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onDeleteSession(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
