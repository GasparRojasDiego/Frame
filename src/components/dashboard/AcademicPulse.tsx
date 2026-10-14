import { useMemo } from 'react';
import {
  eachDayOfInterval,
  endOfISOWeek,
  format,
  startOfISOWeek,
  startOfToday,
  subWeeks,
} from 'date-fns';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import { buildDayIndex, dayKey, GOAL_DAY_KEYS } from '@/lib/academic-metrics';
import { formatMinutes } from '@/lib/duration';
import { EchoTileHeader } from '@/components/shared/EchoWord';
import { dateLocale, tr } from '@/lib/i18n';
import { dayInitial, fromSunday } from '@/lib/day-names';
import { useTodayKey } from '@/hooks/use-today';

/** Iniciales de los 7 días en el orden de la semana ISO (lunes primero). */

interface DayColumn {
  key: string;
  label: string;
  minutes: number;
  goal: number;
  isToday: boolean;
  isFuture: boolean;
}

function DeltaBadge({ value, unit }: { value: number; unit: string }) {
  const rounded = Math.round(value);
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        rounded > 0 && 'bg-green-500/15 text-green-500',
        rounded < 0 && 'bg-red-500/15 text-red-400',
        rounded === 0 && 'bg-secondary text-muted-foreground'
      )}
    >
      <Icon className="h-3 w-3" />
      {rounded === 0 ? tr('igual') : `${Math.abs(rounded)}${unit}`}
    </span>
  );
}

export default function AcademicPulse() {
  const { studySessions, archivedTasks, studyGoals } = useCourse();
  const todayKey = useTodayKey();

  const metrics = useMemo(() => {
    const today = startOfToday();
    const weekStart = startOfISOWeek(today);
    const weekEnd = endOfISOWeek(today);
    const prevStart = startOfISOWeek(subWeeks(today, 1));
    const prevEnd = endOfISOWeek(subWeeks(today, 1));

    // Los hábitos no intervienen en esta franja: se pasa lista vacía.
    const index = buildDayIndex(studySessions ?? [], archivedTasks ?? [], []);

    const sumRange = (start: Date, end: Date) => {
      let minutes = 0;
      let tasksDone = 0;
      let activeDays = 0;
      for (const day of eachDayOfInterval({ start, end })) {
        const bucket = index.get(dayKey(day));
        if (!bucket) continue;
        minutes += bucket.minutes;
        tasksDone += bucket.tasksDone;
        if (bucket.minutes > 0) activeDays += 1;
      }
      return { minutes, tasksDone, activeDays };
    };

    const week = sumRange(weekStart, weekEnd);
    const previous = sumRange(prevStart, prevEnd);

    const days: DayColumn[] = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((day) => {
      const key = dayKey(day);
      return {
        key,
        label: dayInitial(fromSunday(day.getDay())),
        minutes: index.get(key)?.minutes ?? 0,
        goal: studyGoals?.[GOAL_DAY_KEYS[day.getDay()]] ?? 0,
        isToday: key === dayKey(today),
        isFuture: day.getTime() > today.getTime(),
      };
    });

    // Días ya transcurridos de la semana (hoy incluido): denominador honesto
    // de la constancia — el domingo no cuenta como fallo si es martes.
    const elapsedDays = days.filter((d) => !d.isFuture).length || 1;

    const goalWeek = days.reduce((acc, d) => acc + (d.isFuture ? 0 : d.goal), 0);

    return {
      weekStart,
      weekEnd,
      days,
      elapsedDays,
      minutes: week.minutes,
      tasksDone: week.tasksDone,
      activeDays: week.activeDays,
      prevMinutes: previous.minutes,
      prevTasksDone: previous.tasksDone,
      goalWeek,
    };
  }, [studySessions, archivedTasks, studyGoals, todayKey]);

  const maxColumn = Math.max(
    1,
    ...metrics.days.map((d) => Math.max(d.minutes, Math.min(d.goal, 600)))
  );

  const minutesDelta = metrics.minutes - metrics.prevMinutes;
  const goalPercent =
    metrics.goalWeek > 0 ? Math.min(999, Math.round((metrics.minutes / metrics.goalWeek) * 100)) : null;
  const consistency = Math.round((metrics.activeDays / metrics.elapsedDays) * 100);

  const rangeLabel = `${format(metrics.weekStart, tr('d \'de\' MMMM'), { locale: dateLocale() })} — ${format(
    metrics.weekEnd,
    tr('d \'de\' MMMM'),
    { locale: dateLocale() }
  )}`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-headline text-lg font-bold text-primary">{tr('Tu semana en datos')}</h2>
        <p className="text-xs text-muted-foreground">{rangeLabel}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* ---------------- Ritmo de la semana ---------------- */}
        <Card className="lg:col-span-2">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <EchoTileHeader word={tr('Ritmo')}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {tr('Ritmo de estudio')}
                </div>
                <DeltaBadge value={minutesDelta} unit=" min" />
              </div>
            </EchoTileHeader>

            <div className="flex items-baseline gap-2">
              <p className="font-headline text-3xl font-bold text-primary">
                {formatMinutes(metrics.minutes)}
              </p>
              {goalPercent !== null && (
                <span className="text-xs text-muted-foreground">
                  {goalPercent}{tr('% de tu meta (')}{formatMinutes(metrics.goalWeek)})
                </span>
              )}
            </div>

            <TooltipProvider delayDuration={150}>
              <div className="flex flex-1 items-end gap-2 pt-1">
                {metrics.days.map((day) => {
                  const heightPercent = Math.max(2, Math.round((day.minutes / maxColumn) * 100));
                  const goalPercentOfMax =
                    day.goal > 0 ? Math.min(100, Math.round((day.goal / maxColumn) * 100)) : null;
                  const metGoal = day.goal > 0 && day.minutes >= day.goal;
                  return (
                    <Tooltip key={day.key}>
                      <TooltipTrigger asChild>
                        <div className="flex flex-1 cursor-default flex-col items-center gap-1.5">
                          <div className="relative h-20 w-full overflow-hidden rounded-md bg-secondary/60">
                            <div
                              className={cn(
                                'absolute bottom-0 w-full rounded-md transition-all duration-500',
                                metGoal
                                  ? 'bg-gradient-to-t from-primary to-primary/60'
                                  : 'bg-gradient-to-t from-primary/60 to-primary/25',
                                day.minutes === 0 && 'bg-none bg-transparent'
                              )}
                              style={{ height: day.minutes > 0 ? `${heightPercent}%` : 0 }}
                            />
                            {goalPercentOfMax !== null && (
                              <span
                                className="absolute w-full border-t border-dashed border-primary/50"
                                style={{ bottom: `${goalPercentOfMax}%` }}
                              />
                            )}
                          </div>
                          <span
                            className={cn(
                              'text-[10px] font-semibold',
                              day.isToday ? 'text-primary' : 'text-muted-foreground',
                              day.isFuture && 'opacity-40'
                            )}
                          >
                            {day.label}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="font-semibold capitalize">
                          {format(new Date(`${day.key}T00:00:00`), tr('EEEE d'), { locale: dateLocale() })}
                        </p>
                        <p className="text-muted-foreground">
                          {day.minutes > 0 ? formatMinutes(day.minutes) : tr('Sin estudio')}
                          {day.goal > 0 && tr(' · meta {minutes}', { minutes: formatMinutes(day.goal) })}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* ---------------- Constancia ---------------- */}
        <Card>
          <CardContent className="flex h-full flex-col gap-2 p-4 text-center">
            <EchoTileHeader word={tr('Constancia')}>
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
                <CalendarCheck2 className="h-4 w-4 text-primary" />
                {tr('Constancia')}
              </div>
            </EchoTileHeader>
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg viewBox="0 0 36 36" className="absolute inset-0 h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-secondary" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 15.5}
                  strokeDashoffset={2 * Math.PI * 15.5 * (1 - Math.min(1, consistency / 100))}
                  className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
                />
              </svg>
              <div className="relative">
                <p className="font-headline text-2xl font-bold text-primary tabular-nums">
                  {consistency}%
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {metrics.activeDays}{' '}{tr('de')}{' '}{metrics.elapsedDays}{' '}
              {metrics.elapsedDays === 1 ? tr('día') : tr('días')}{' '}{tr('con estudio')}
            </p>
            </div>
          </CardContent>
        </Card>

        {/* ---------------- Tareas culminadas ---------------- */}
        <Card>
          <CardContent className="flex h-full flex-col gap-2 p-4 text-center">
            <EchoTileHeader word={tr('Tareas')}>
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {tr('Tareas culminadas')}
              </div>
            </EchoTileHeader>
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <p className="font-headline text-4xl font-bold text-primary tabular-nums">
                {metrics.tasksDone}
              </p>
              <DeltaBadge value={metrics.tasksDone - metrics.prevTasksDone} unit="" />
              <p className="text-[11px] text-muted-foreground">{tr('frente a la semana pasada')}</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </section>
  );
}
