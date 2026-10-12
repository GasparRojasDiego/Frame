import type React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MONTH_NAMES, type MonthCursor } from './calendar-model';

// ============================================================
// Fila del mes: ‹ Marzo 2026 › · Hoy a la izquierda y, a la derecha, lo que
// ponga quien la usa (el conmutador Google/Local y la acción de crear).
//
// No es una barra aparte: es la cabecera del propio calendario, pegada a su
// cuadrícula. Antes los botones vivían en una segunda franja encima, sin
// relación con el mes que se estaba viendo.
// ============================================================

export default function MonthBar({
  cursor,
  onPrev,
  onNext,
  onToday,
  status,
  children,
}: {
  cursor: MonthCursor;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Aviso pequeño junto al mes (p. ej. «Sin conexión»). */
  status?: React.ReactNode;
  /** Controles del extremo derecho. */
  children?: React.ReactNode;
}) {
  const monthName = MONTH_NAMES[cursor.month];
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center gap-1.5">
        <Button
          variant="fantasma"
          size="icon"
          className="h-8 w-8"
          onClick={onPrev}
          aria-label="Mes anterior"
          title="Mes anterior (Re Pág)"
        >
          <ChevronLeft />
        </Button>
        {/* Ancho fijo: las flechas no bailan al pasar de «Mayo» a «Septiembre». */}
        <h2
          className="w-[10.5rem] text-center font-headline text-lg font-bold leading-none tracking-tight"
          aria-live="polite"
        >
          <span className="text-primary">{monthName}</span>{' '}
          <span className="font-semibold text-muted-foreground">{cursor.year}</span>
        </h2>
        <Button
          variant="fantasma"
          size="icon"
          className="h-8 w-8"
          onClick={onNext}
          aria-label="Mes siguiente"
          title="Mes siguiente (Av Pág)"
        >
          <ChevronRight />
        </Button>
      </div>
      <Button variant="fantasma" size="sm" className="h-8 px-3 text-xs" onClick={onToday}>
        Hoy
      </Button>
      {status}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

export type CalendarMode = 'google' | 'local';

/**
 * Conmutador Google / Local. Como en la barra superior: lo inactivo es
 * fantasma y lo activo, sólido.
 */
export function CalendarModeSwitch({
  mode,
  onChange,
  className,
}: {
  mode: CalendarMode;
  onChange: (mode: CalendarMode) => void;
  className?: string;
}) {
  const options: { value: CalendarMode; label: string; hint: string; tour?: string }[] = [
    { value: 'google', label: 'Google', hint: 'Tu Google Calendar' },
    { value: 'local', label: 'Local', hint: 'El calendario de Frame: funciona sin internet', tour: 'cal-local' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Calendario que se muestra"
      className={cn('flex h-8 items-center rounded-md border border-primary bg-primary/10 p-0.5', className)}
    >
      {options.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint}
            data-tour={option.tour}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-full rounded-[5px] px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-primary hover:bg-primary/15'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
