import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EchoWord from '@/components/shared/EchoWord';
import { PHASE_ICON } from '@/components/habits/HabitPhases';
import { HABIT_PHASES, currentPhase } from '@/lib/habit-phases';
import { WEEK_ORDER, WEEKDAY_INITIAL, describeSchedule } from '@/lib/habit-schedule';
import { cn } from '@/lib/utils';
import type { Habit, HabitPhase } from '@/types';

// ============================================================
// Alta de un hábito.
//
// Tres decisiones, en este orden: cómo se llama, en qué momento del día va
// (mañana, tarde o noche, que es como se agrupan y se dibujan) y con qué
// frecuencia: cada día o solo ciertos días de la semana. Un hábito de «solo
// los sábados» no puede aparecer como fallado de lunes a viernes, y eso solo
// es posible si Frame sabe desde el principio qué días le tocan.
// ============================================================

/** Tope por fase: más anillos de cinco dejan cada uno demasiado fino. */
export const MAX_HABITS_PER_PHASE = 5;

const HABIT_NAME_MAX = 140;

const PRESETS: { label: string; days: number[] }[] = [
  { label: 'Entre semana', days: [1, 2, 3, 4, 5] },
  { label: 'Fin de semana', days: [6, 0] },
  { label: 'Días alternos', days: [1, 3, 5] },
];

export default function NewHabitDialog({
  open,
  onOpenChange,
  habits,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hábitos activos, para saber qué fases están llenas. */
  habits: Habit[];
  onCreate: (name: string, phase: HabitPhase, days: number[] | undefined) => void;
}) {
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<HabitPhase | null>(null);
  const [frequency, setFrequency] = useState<'daily' | 'custom'>('daily');
  const [days, setDays] = useState<number[]>([]);

  const countByPhase = useMemo(() => {
    const counts: Record<HabitPhase, number> = { morning: 0, afternoon: 0, night: 0 };
    for (const habit of habits) if (habit.phase) counts[habit.phase] += 1;
    return counts;
  }, [habits]);

  // Cada vez que se abre: en blanco, con la fase del momento preseleccionada
  // si aún le cabe un hábito.
  useEffect(() => {
    if (!open) return;
    setName('');
    setFrequency('daily');
    setDays([]);
    const now = currentPhase() ?? 'morning';
    const free = HABIT_PHASES.find((p) => p.id === now && countByPhase[p.id] < MAX_HABITS_PER_PHASE)
      ?? HABIT_PHASES.find((p) => countByPhase[p.id] < MAX_HABITS_PER_PHASE);
    setPhase(free?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleDay = (day: number) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const allFull = HABIT_PHASES.every((p) => countByPhase[p.id] >= MAX_HABITS_PER_PHASE);
  const canCreate =
    name.trim().length > 0 && phase !== null && (frequency === 'daily' || days.length > 0);

  const create = () => {
    if (!canCreate || !phase) return;
    onCreate(name.trim(), phase, frequency === 'custom' ? days : undefined);
    onOpenChange(false);
  };

  const optionCard =
    'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg">
        <div className="relative -mx-6 -mt-6 overflow-hidden px-6 pb-4 pt-6 after:absolute after:inset-x-6 after:bottom-0 after:h-px after:bg-border">
          <EchoWord word="Hábito" />
          <DialogHeader className="relative">
            <DialogTitle className="text-center text-lg font-bold text-primary">Nuevo hábito</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Frame lo medirá solo en los días que le toquen.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="habit-name" className="text-xs">Nombre</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create();
              }}
              placeholder="Por ejemplo: leer veinte minutos" data-tour="habito-nombre"
              maxLength={HABIT_NAME_MAX}
              className="border-primary bg-card"
              autoFocus
            />
          </div>

          {/* Momento del día */}
          <div className="space-y-2" data-tour="habito-momento">
            <Label className="text-xs">¿En qué momento del día?</Label>
            <div className="grid grid-cols-3 gap-2">
              {HABIT_PHASES.map((info) => {
                const Icon = PHASE_ICON[info.id];
                const count = countByPhase[info.id];
                const full = count >= MAX_HABITS_PER_PHASE;
                const selected = phase === info.id;
                return (
                  <button
                    key={info.id}
                    type="button"
                    disabled={full}
                    onClick={() => setPhase(info.id)}
                    aria-pressed={selected}
                    className={cn(
                      optionCard,
                      selected
                        ? 'border-primary bg-primary/15 text-primary shadow-sm'
                        : 'border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-semibold">{info.label}</span>
                    <span className="text-[10px] tabular-nums opacity-80">
                      {full ? 'Completo' : `${count} de ${MAX_HABITS_PER_PHASE}`}
                    </span>
                  </button>
                );
              })}
            </div>
            {allFull && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Las tres fases tienen ya {MAX_HABITS_PER_PHASE} hábitos. Archiva alguno para añadir otro.
              </p>
            )}
          </div>

          {/* Frecuencia */}
          <div className="space-y-2" data-tour="habito-frecuencia">
            <Label className="text-xs">¿Con qué frecuencia?</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'daily', icon: Repeat, title: 'Cada día', hint: 'Los siete días de la semana' },
                  { id: 'custom', icon: CalendarDays, title: 'Cada cierto tiempo', hint: 'Solo los días que elijas' },
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                const selected = frequency === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFrequency(option.id)}
                    aria-pressed={selected}
                    className={cn(
                      optionCard,
                      'items-start text-left',
                      selected
                        ? 'border-primary bg-primary/15 shadow-sm'
                        : 'border-border/70 hover:border-primary/50'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', selected ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-foreground')}>
                      {option.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{option.hint}</span>
                  </button>
                );
              })}
            </div>

            {frequency === 'custom' && (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3 animate-in fade-in-0 slide-in-from-top-1">
                <div className="flex justify-between gap-1">
                  {WEEK_ORDER.map((day) => {
                    const on = days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        aria-pressed={on}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition-all',
                          on
                            ? 'scale-105 border-primary bg-primary text-primary-foreground shadow-md'
                            : 'border-border/70 bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
                        )}
                      >
                        {WEEKDAY_INITIAL[day]}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDays(preset.days)}
                      className="rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {days.length === 0 ? (
                    'Elige al menos un día.'
                  ) : (
                    <>
                      Toca: <span className="font-semibold text-foreground">{describeSchedule({ days })}</span>. Los
                      demás días no aparecerán como casilla ni contarán como fallo.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={create} disabled={!canCreate} data-tour="habito-crear">
            Crear hábito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
