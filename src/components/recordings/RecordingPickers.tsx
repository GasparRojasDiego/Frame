import { ChevronDown, Flag, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IMPORTANCE_DOT, IMPORTANCE_LABEL, IMPORTANCE_STYLE, RECORDING_KIND_LABEL } from '@/lib/recordings';
import { cn } from '@/lib/utils';
import type { RecordingImportance, RecordingKind } from '@/types';
import { tr } from '@/lib/i18n';

// ============================================================
// Desplegables de una grabación (1.6.4): la importancia, como en las
// tarjetas de las tareas, y el tipo de audio. Un botón que muestra lo
// elegido y despliega las opciones.
// ============================================================

const IMPORTANCES: RecordingImportance[] = ['alta', 'media', 'baja'];
const KINDS: RecordingKind[] = ['tarea', 'recordatorio', 'explicacion', 'personal'];

export function ImportancePicker({
  value,
  onChange,
  disabled,
}: {
  value: RecordingImportance;
  onChange: (next: RecordingImportance) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={tr('Importancia: {p}', { p: IMPORTANCE_LABEL[value] })}
          className={cn('h-10 w-full justify-between gap-2 px-3 text-xs font-semibold', IMPORTANCE_STYLE[value])}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Flag className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{IMPORTANCE_LABEL[value]}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[9rem]">
        {IMPORTANCES.map((level) => (
          <DropdownMenuItem key={level} onSelect={() => onChange(level)} className="gap-2 text-xs font-semibold">
            <span className={cn('h-2 w-2 rounded-full', IMPORTANCE_DOT[level])} />
            {IMPORTANCE_LABEL[level]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function KindPicker({
  value,
  onChange,
  disabled,
}: {
  value: RecordingKind | undefined;
  onChange: (next: RecordingKind) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="fantasma"
          disabled={disabled}
          aria-label={value ? tr('Tipo de audio: {p}', { p: RECORDING_KIND_LABEL[value] }) : tr('Tipo de audio')}
          className="h-10 w-full justify-between gap-2 px-3 text-xs font-semibold"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{value ? RECORDING_KIND_LABEL[value] : tr('Elegir')}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[9rem]">
        {KINDS.map((kind) => (
          <DropdownMenuItem
            key={kind}
            onSelect={() => onChange(kind)}
            className={cn('text-xs', kind === value && 'font-semibold text-primary')}
          >
            {RECORDING_KIND_LABEL[kind]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
