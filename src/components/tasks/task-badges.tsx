import { FolderKanban, GraduationCap, NotebookPen, PartyPopper, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskDifficulty, TaskKind } from '@/types';
import { tr } from '@/lib/i18n';

// ============================================================
// Distintivos de tipo y dificultad de un pendiente. Viven aparte porque los
// usan tanto la tarjeta de tarea como el formulario de creación, y no deben
// desincronizarse: si mañana se añade un tipo, se añade UNA sola vez.
// ============================================================

export const TASK_KINDS: TaskKind[] = ['Tarea', 'Examen', 'Proyecto', 'Actividad', 'Personal'];

export const TASK_KIND_META: Record<TaskKind, { icon: React.ElementType; hint: string }> = {
  Tarea: { icon: NotebookPen, get hint() { return tr('del profesor'); } },
  Examen: { icon: GraduationCap, get hint() { return tr('evaluación'); } },
  Proyecto: { icon: FolderKanban, get hint() { return tr('trabajo largo'); } },
  Actividad: { icon: PartyPopper, get hint() { return tr('evento del colegio'); } },
  Personal: { icon: UserRound, get hint() { return tr('cosa tuya'); } },
};

export const TASK_DIFFICULTIES: TaskDifficulty[] = ['Fácil', 'Media', 'Difícil'];

export const DIFFICULTY_META: Record<
  TaskDifficulty,
  { bars: number; text: string; badge: string }
> = {
  'Fácil': {
    bars: 1,
    text: 'text-emerald-500',
    badge: 'border-emerald-500 bg-emerald-500/15 text-emerald-500',
  },
  'Media': {
    bars: 2,
    text: 'text-amber-500',
    badge: 'border-amber-500 bg-amber-500/15 text-amber-500',
  },
  'Difícil': {
    bars: 3,
    text: 'text-red-400',
    badge: 'border-red-400 bg-red-400/15 text-red-400',
  },
};

/** Tres barras crecientes: llenas hasta el nivel, apagadas el resto. */
export function DifficultyBars({
  level,
  className,
}: {
  level?: TaskDifficulty | null;
  className?: string;
}) {
  const filled = level ? DIFFICULTY_META[level].bars : 0;
  return (
    <span className={cn('inline-flex items-end gap-[2px]', className)} aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            'w-[3px] rounded-sm transition-colors',
            index === 0 ? 'h-1.5' : index === 1 ? 'h-2.5' : 'h-3.5',
            index < filled ? 'bg-current' : 'bg-current opacity-25'
          )}
        />
      ))}
    </span>
  );
}
