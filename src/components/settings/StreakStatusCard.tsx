import { useMemo } from 'react';
import { eachDayOfInterval, format, startOfToday, subDays } from 'date-fns';
import { Flame, Target, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import { sessionSeconds, formatMinutes } from '@/lib/duration';
import { EchoTileHeader } from '@/components/shared/EchoWord';
import { dateLocale, tr } from '@/lib/i18n';
import { localDayKey } from '@/lib/dates';
import { currentStreak, streakJudge } from '@/lib/streak';
import { useTodayKey } from '@/hooks/use-today';

// ============================================================
// Estado de la racha, junto a la meta que la define.
//
// La tarjeta de la meta decía cuál era el objetivo pero no si se estaba
// cumpliendo, que es justo lo que uno quiere saber al mirarla. Aquí se ve la
// racha viva, la mejor histórica y los últimos 14 días de un vistazo.
// ============================================================

/** Días hacia atrás que dibuja la tira. */
const STRIP_DAYS = 14;

export default function StreakStatusCard() {
  const { studySessions, dailyPerformances, streakGoal, studyGoals } = useCourse();
  // Al cambiar el día, la tira y la racha se recalculan solas.
  const todayKey = useTodayKey();

  const data = useMemo(() => {
    const today = startOfToday();
    // La misma regla que Inicio y la barra superior (lib/streak.ts).
    const streakData = {
      now: new Date(),
      streakGoal,
      studySessions: studySessions ?? [],
      dailyPerformances: dailyPerformances ?? [],
      studyGoals,
    };
    const met = streakJudge(streakData);
    const current = currentStreak(streakData);

    // Minutos por día, para el detalle de la tira.
    const minutesByDay = new Map<string, number>();
    for (const session of studySessions ?? []) {
      const key = localDayKey(session.startTime);
      if (key) minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + sessionSeconds(session) / 60);
    }

    // Mejor racha histórica sobre todos los días con actividad registrada.
    let firstKey = '';
    for (const key of minutesByDay.keys()) if (!firstKey || key < firstKey) firstKey = key;
    for (const p of dailyPerformances ?? []) if (p.date && (!firstKey || p.date < firstKey)) firstKey = p.date;
    let best = 0;
    let run = 0;
    if (firstKey && firstKey <= todayKey) {
      for (const day of eachDayOfInterval({ start: new Date(`${firstKey}T00:00:00`), end: today })) {
        if (met(localDayKey(day))) {
          run += 1;
          best = Math.max(best, run);
        } else if (localDayKey(day) !== todayKey) {
          run = 0;
        }
      }
    }

    const strip = eachDayOfInterval({ start: subDays(today, STRIP_DAYS - 1), end: today }).map(
      (day) => {
        const key = localDayKey(day);
        return {
          key,
          label: format(day, tr('EEEEE'), { locale: dateLocale() }),
          title: format(day, tr('EEEE d \'de\' MMMM'), { locale: dateLocale() }),
          met: met(key),
          minutes: minutesByDay.get(key) ?? 0,
        };
      }
    );

    return { current, best: Math.max(best, current), strip };
  }, [studySessions, dailyPerformances, streakGoal, studyGoals, todayKey]);

  const goalLabel =
    streakGoal.mode === 'rendimiento'
      ? tr('calificación {grade} o mejor', { grade: streakGoal.grade })
      : tr('{minutes} de estudio', { minutes: formatMinutes(streakGoal.minutes || 0) });

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <EchoTileHeader word={tr('Racha')}>
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
            <Flame className={cn('h-4 w-4', data.current > 0 ? 'text-primary' : 'text-muted-foreground/60')} />
            {tr('Tu racha')}
          </div>
        </EchoTileHeader>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border border-primary/30 bg-primary/5 py-2">
            <p className="font-headline text-2xl font-bold tabular-nums text-primary">
              {data.current}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {data.current === 1 ? tr('día seguido') : tr('días seguidos')}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/40 py-2">
            <p className="flex items-center justify-center gap-1 font-headline text-2xl font-bold tabular-nums text-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              {data.best}
            </p>
            <p className="text-[10px] text-muted-foreground">{tr('mejor racha')}</p>
          </div>
        </div>

        {/* Últimos 14 días: cumplido o no, de un vistazo. */}
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Target className="h-3 w-3 text-primary" />
            {tr('Últimos')}{' '}{STRIP_DAYS}{' '}{tr('días · meta:')}{' '}{goalLabel}
          </p>
          <div className="flex items-end gap-1">
            {data.strip.map((day) => (
              <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={cn(
                    'h-6 w-full rounded-sm transition-colors',
                    day.met ? 'bg-primary' : day.minutes > 0 ? 'bg-primary/30' : 'bg-secondary'
                  )}
                  title={`${day.title}${
                    day.minutes > 0 ? ` · ${formatMinutes(Math.round(day.minutes))}` : tr(' · sin estudio')
                  }${day.met ? tr(' · meta cumplida') : ''}`}
                />
                <span className="text-[8px] uppercase text-muted-foreground/70">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-auto text-center text-[10px] leading-relaxed text-muted-foreground/80">
          {data.current === 0
            ? tr('La racha arranca en cuanto cumplas la meta de un día.')
            : tr('Llevas {current} {p} cumpliendo. El día de hoy aún cuenta hasta medianoche.', { current: data.current, p: data.current === 1 ? tr('día') : tr('días') })}
        </p>
      </CardContent>
    </Card>
  );
}
