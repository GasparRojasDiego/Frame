import { useMemo } from 'react';
import { eachDayOfInterval, format, parseISO, startOfToday, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Flame, Target, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import { sessionSeconds, formatMinutes } from '@/lib/duration';
import type { DailyPerformance } from '@/types';

// ============================================================
// Estado de la racha, junto a la meta que la define.
//
// La tarjeta de la meta decía cuál era el objetivo pero no si se estaba
// cumpliendo, que es justo lo que uno quiere saber al mirarla. Aquí se ve la
// racha viva, la mejor histórica y los últimos 14 días de un vistazo.
// ============================================================

const GRADE_ORDER: DailyPerformance['grade'][] = ['C', 'B', 'A', 'AD'];

/** Días hacia atrás que dibuja la tira. */
const STRIP_DAYS = 14;

export default function StreakStatusCard() {
  const { studySessions, dailyPerformances, streakGoal, selectionMode } = useCourse();

  const data = useMemo(() => {
    const today = startOfToday();

    // Minutos y calificación por día, en una sola pasada.
    const minutesByDay = new Map<string, number>();
    for (const session of studySessions ?? []) {
      try {
        const key = format(parseISO(session.startTime), 'yyyy-MM-dd');
        minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + sessionSeconds(session) / 60);
      } catch {
        /* fecha corrupta: se ignora */
      }
    }
    const gradeByDay = new Map<string, DailyPerformance['grade']>();
    for (const p of dailyPerformances ?? []) gradeByDay.set(p.id, p.grade);

    /** ¿Ese día cumplió la meta vigente? */
    const met = (key: string): boolean => {
      if (selectionMode === 'rendimiento') {
        const grade = gradeByDay.get(key);
        if (!grade) return false;
        return GRADE_ORDER.indexOf(grade) >= GRADE_ORDER.indexOf(streakGoal.grade);
      }
      return (minutesByDay.get(key) ?? 0) >= (streakGoal.minutes || 0);
    };

    // Racha viva: se cuenta hacia atrás desde hoy. Que hoy aún no esté
    // cumplido no rompe la racha — el día no ha terminado.
    let current = 0;
    for (let i = 0; i < 400; i++) {
      const key = format(subDays(today, i), 'yyyy-MM-dd');
      if (met(key)) current += 1;
      else if (i > 0) break;
    }

    // Mejor racha histórica sobre todos los días con actividad registrada.
    const keys = new Set<string>([...minutesByDay.keys(), ...gradeByDay.keys()]);
    let best = 0;
    let run = 0;
    if (keys.size > 0) {
      const sorted = [...keys].sort();
      const first = parseISO(`${sorted[0]}T00:00:00`);
      for (const day of eachDayOfInterval({ start: first, end: today })) {
        if (met(format(day, 'yyyy-MM-dd'))) {
          run += 1;
          best = Math.max(best, run);
        } else {
          run = 0;
        }
      }
    }

    const strip = eachDayOfInterval({ start: subDays(today, STRIP_DAYS - 1), end: today }).map(
      (day) => {
        const key = format(day, 'yyyy-MM-dd');
        return {
          key,
          label: format(day, 'EEEEE', { locale: es }),
          title: format(day, "EEEE d 'de' MMMM", { locale: es }),
          met: met(key),
          minutes: minutesByDay.get(key) ?? 0,
        };
      }
    );

    return { current, best, strip };
  }, [studySessions, dailyPerformances, streakGoal, selectionMode]);

  const goalLabel =
    selectionMode === 'rendimiento'
      ? `calificación ${streakGoal.grade} o mejor`
      : `${formatMinutes(streakGoal.minutes || 0)} de estudio`;

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
          <Flame className={cn('h-4 w-4', data.current > 0 ? 'text-primary' : 'text-muted-foreground/60')} />
          Tu racha
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border border-primary/30 bg-primary/5 py-2">
            <p className="font-headline text-2xl font-bold tabular-nums text-primary">
              {data.current}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {data.current === 1 ? 'día seguido' : 'días seguidos'}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/40 py-2">
            <p className="flex items-center justify-center gap-1 font-headline text-2xl font-bold tabular-nums text-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              {data.best}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">mejor racha</p>
          </div>
        </div>

        {/* Últimos 14 días: cumplido o no, de un vistazo. */}
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Target className="h-3 w-3 text-primary" />
            Últimos {STRIP_DAYS} días · meta: {goalLabel}
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
                    day.minutes > 0 ? ` · ${formatMinutes(Math.round(day.minutes))}` : ' · sin estudio'
                  }${day.met ? ' · meta cumplida' : ''}`}
                />
                <span className="text-[8px] uppercase text-muted-foreground/70">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-auto text-center text-[10px] leading-relaxed text-muted-foreground/80">
          {data.current === 0
            ? 'La racha arranca en cuanto cumplas la meta de un día.'
            : `Llevas ${data.current} ${data.current === 1 ? 'día' : 'días'} cumpliendo. El día de hoy aún cuenta hasta medianoche.`}
        </p>
      </CardContent>
    </Card>
  );
}
