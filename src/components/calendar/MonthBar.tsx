import type React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MONTH_NAMES, type MonthCursor } from './calendar-model';

// ============================================================
// Fila del mes: ‹ Marzo 2026 › · Hoy a la izquierda y, a la derecha, lo que
// ponga quien la usa (la acción de crear).
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
          className="w-[12rem] text-center font-headline text-lg font-semibold uppercase leading-none tracking-wider text-primary"
          aria-live="polite"
        >
          {monthName} {cursor.year}
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
