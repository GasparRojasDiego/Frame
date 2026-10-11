import { CalendarClock, Moon, Sun, Sunrise } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ALL_DAY_LABEL,
  HABIT_PHASES, phaseLabel
} from '@/lib/habit-phases';
import { cn } from '@/lib/utils';
import type { HabitPhase } from '@/types';

export const PHASE_ICON: Record<HabitPhase | 'all', typeof Sun> = {
  morning: Sunrise,
  afternoon: Sun,
  night: Moon,
  all: CalendarClock,
};

/** Selector compacto de la fase de un hábito (icono + menú). */
export function PhaseMenu({
  value,
  onChange,
  fullPhases = [],
  className,
}: {
  value: HabitPhase | undefined;
  onChange: (phase: HabitPhase | undefined) => void;
  /** Fases que ya tienen el máximo de hábitos: no admiten uno más. */
  fullPhases?: HabitPhase[];
  className?: string;
}) {
  const Icon = PHASE_ICON[value ?? 'all'];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`Fase del día: ${phaseLabel(value)}`}
          className={cn(
            'flex h-7 shrink-0 items-center gap-1 rounded-md border border-border/70 px-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary',
            className
          )}
        >
          <Icon className="h-3.5 w-3.5 text-primary" />
          {phaseLabel(value)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        {HABIT_PHASES.map((phase) => {
          const PhaseIcon = PHASE_ICON[phase.id];
          const full = phase.id !== value && fullPhases.includes(phase.id);
          return (
            <DropdownMenuItem key={phase.id} disabled={full} onSelect={() => onChange(phase.id)} className="text-xs">
              <PhaseIcon className="mr-2 h-3.5 w-3.5 text-primary" />
              <span className="flex-1">{phase.label}</span>
              <span className="text-[10px] text-muted-foreground">{full ? 'Completa' : phase.range}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem onSelect={() => onChange(undefined)} className="text-xs">
          <CalendarClock className="mr-2 h-3.5 w-3.5 text-primary" />
          {ALL_DAY_LABEL}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
