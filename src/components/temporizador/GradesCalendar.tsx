import { useMemo, useState } from 'react';
import type { DailyPerformance, StudySession } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { studyDayparts } from '@/lib/study-dayparts';
import { cn } from '@/lib/utils';
import { sessionSeconds, formatDurationLabel, formatTotalMinutes, formatMinutes } from '@/lib/duration';
import { useCourse } from '@/context/CourseContext';
import EchoWord from '@/components/shared/EchoWord';
import SessionCard from '@/components/temporizador/SessionCard';
import { SessionDetailView } from '@/components/temporizador/SessionDetailDialog';
import { sessionHasFocus } from '@/components/temporizador/session-info';
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
// Al pulsar una casilla se abre el recuadro del día: sus cifras en una
// fila y TODAS sus sesiones como tarjetas; cada tarjeta abre su detalle
// en el mismo recuadro.
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

/** Par etiqueta → dato, en una línea (cifras del recuadro del día). */
function Pair({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-bold tabular-nums', accent ? 'text-primary' : 'text-foreground')}>{value}</dd>
    </div>
  );
}

export default function GradesCalendar({
  performances,
  studySessions,
  selectionMode,
  onDeleteSession,
  onEditSession,
}: GradesCalendarProps) {
  const { studyGoals } = useCourse();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [detailDay, setDetailDay] = useState<Date | null>(null);
  /** Sesión del día cuyo detalle ocupa el recuadro; null = el día entero. */
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const closeDetail = () => {
    setDetailDay(null);
    setOpenSessionId(null);
  };

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
  const openSession = openSessionId ? detailSessions.find((s) => s.id === openSessionId) ?? null : null;

  /** Solo las sesiones con enfoque puntúan: es lo que usa la calificación. */
  const focusSessions = useMemo(() => detailSessions.filter(sessionHasFocus), [detailSessions]);
  const detailFocusAvg =
    focusSessions.length > 0
      ? focusSessions.reduce((acc, s) => acc + s.perception, 0) / focusSessions.length
      : null;

  /**
   * Meta de tiempo DE AQUEL DÍA. La meta se puede cambiar en Perfil, así que
   * la de hoy no tiene por qué ser la que regía entonces — pero es
   * recuperable: la calificación guardada se calculó como
   * `score = enfoqueMedio × (minutos / meta)` sobre las sesiones con enfoque,
   * de donde la meta se despeja. Si la nota tocó el techo de 20 la división
   * ya no es fiable y se recurre a la meta configurada hoy.
   */
  const detailGoal = useMemo((): { minutes: number; historic: boolean } | null => {
    if (!detailDay) return null;
    const current = studyGoals?.[GOAL_KEYS[detailDay.getDay()]] ?? 0;

    if (detailPerf && detailPerf.score > 0 && detailPerf.score < 20 && detailFocusAvg !== null) {
      const minutes = focusSessions.reduce((acc, s) => acc + sessionSeconds(s), 0) / 60;
      const derived = (detailFocusAvg * minutes) / detailPerf.score;
      if (Number.isFinite(derived) && derived > 0) {
        return { minutes: Math.round(derived), historic: true };
      }
    }
    return current > 0 ? { minutes: current, historic: false } : null;
  }, [detailDay, detailPerf, focusSessions, detailFocusAvg, studyGoals]);

  const goalPercent =
    detailGoal && detailGoal.minutes > 0
      ? Math.min(100, Math.round((detailSeconds / 60 / detailGoal.minutes) * 100))
      : null;

  /** En qué momento del día se estudió (antes, «Dónde fue tu tiempo» en Inicio). */
  const detailDayparts = useMemo(
    () => studyDayparts(detailSessions, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY),
    [detailSessions]
  );

  /** Tiempo del día: en horas y minutos; los segundos solo si no llega al minuto. */
  const detailTimeLabel =
    detailSeconds > 0 && detailSeconds < 60 ? formatDurationLabel(detailSeconds) : formatMinutes(detailSeconds / 60);

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
        <h2 className="text-lg font-semibold text-primary font-headline first-letter:uppercase text-center">
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
          Recuadro del día: «Jueves 9» (el mes y el año ya están a la vista en
          el calendario). Arriba, en UNA fila, el tiempo frente a la meta y las
          tres cifras del día; debajo, sus sesiones como tarjetas. Cada tarjeta
          abre su detalle en este mismo recuadro, con la flecha de volver.
          ------------------------------------------------------------------ */}
      <Dialog open={!!detailDay} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {openSession ? (
            <SessionDetailView
              session={openSession}
              dayPerformance={detailPerf}
              onBack={() => setOpenSessionId(null)}
              onEdit={onEditSession}
              onDelete={(id) => {
                setOpenSessionId(null);
                onDeleteSession(id);
              }}
            />
          ) : (
            <>
              {/* ---------- Cabecera: el día de la semana, con su eco ---------- */}
              <div className="relative shrink-0 overflow-hidden px-6 pb-3 pt-6">
                {detailDay && <EchoWord word={format(detailDay, 'EEEE', { locale: es })} />}
                <DialogTitle className="relative text-center text-xl font-bold text-primary first-letter:uppercase">
                  {detailDay && format(detailDay, 'EEEE d', { locale: es })}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Tiempo estudiado, meta, cifras y sesiones de estudio del día.
                </DialogDescription>
              </div>

              {/* ---------- Cifras del día, en una sola fila ---------- */}
              <div className="shrink-0 space-y-3 px-6 pb-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  {/* Tiempo / meta: el tiempo, algo más grande. */}
                  <div
                    className="text-center"
                    title={
                      detailGoal
                        ? `${goalPercent ?? 0}% de la meta · ${
                            detailGoal.historic
                              ? 'meta reconstruida a partir de la calificación de ese día'
                              : 'meta configurada para este día de la semana'
                          }`
                        : 'Este día de la semana no tiene meta'
                    }
                  >
                    <p className="whitespace-nowrap font-headline tabular-nums leading-none">
                      <span className="text-2xl font-bold text-primary">{detailTimeLabel}</span>
                      <span className="mx-1.5 text-lg font-light text-muted-foreground">/</span>
                      {detailGoal ? (
                        <span className="text-base font-semibold text-foreground">
                          {formatMinutes(detailGoal.minutes)}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">sin meta</span>
                      )}
                    </p>
                    {goalPercent !== null && (
                      <div className="mx-auto mt-2 h-1 w-full max-w-[10rem] overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                          style={{ width: `${goalPercent}%` }}
                        />
                      </div>
                    )}
                    {/* La calificación, debajo de la barra (1.6.6). */}
                    <p className="mt-2 text-xs">
                      <span className="text-muted-foreground">Calificación </span>
                      <span className="font-bold tabular-nums text-primary">
                        {detailPerf ? `${detailPerf.score.toFixed(1)} ${detailPerf.grade}` : '—'}
                      </span>
                    </p>
                  </div>

                  {/* Divisoria fina, justo al medio de ambos bloques. */}
                  <span className="w-px self-stretch bg-border" />

                  {/* Etiqueta a la izquierda, dato a su derecha. */}
                  <dl className="mx-auto w-full max-w-[13rem] space-y-1 text-xs">
                    <Pair label="Sesiones" value={detailSessions.length} />
                    <Pair
                      label="Enfoque medio"
                      value={
                        detailFocusAvg !== null ? (
                          <>
                            {detailFocusAvg.toFixed(1)}
                            <span className="text-[10px] font-semibold text-muted-foreground">/20</span>
                          </>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </dl>
                </div>

                {/* Cuándo se estudió, como dato breve. */}
                {detailDayparts && (
                  <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
                    <Clock3 className="h-3 w-3 text-primary" aria-label="Cuándo estudiaste" />
                    {detailDayparts.buckets.map((bucket) => {
                      const top = bucket.key === detailDayparts.top.key && bucket.minutes > 0;
                      return (
                        <span key={bucket.key} className="flex items-baseline gap-1" title={bucket.hint}>
                          <span className="text-muted-foreground">{bucket.label}</span>
                          <span className={cn('font-semibold tabular-nums', top ? 'text-primary' : 'text-foreground')}>
                            {bucket.minutes > 0 ? formatMinutes(Math.round(bucket.minutes)) : '—'}
                          </span>
                        </span>
                      );
                    })}
                  </p>
                )}
              </div>

              <div className="mx-6 h-px shrink-0 bg-border" />

              {/* ---------- Sesiones del día, en orden: único carril de scroll ---------- */}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                {detailSessions.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No hay sesiones de estudio registradas este día.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {detailSessions.map((s) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onOpen={() => setOpenSessionId(s.id)}
                        // El lápiz solo aparece si la sesión aún se puede
                        // corregir (hoy); el pasado es registro y no se toca.
                        onEdit={onEditSession ? () => onEditSession(s) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

