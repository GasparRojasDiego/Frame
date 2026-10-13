import type React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { monthName, type MonthCursor } from './calendar-model';
import { tr } from '@/lib/i18n';

// ============================================================
// Fila del mes: ‹ Marzo 2026 › centrado de verdad y, a la derecha, lo que
// ponga quien la usa (la acción de crear).
//
// 1.6.7 (Diego): las flechas van solas, sin botón alrededor, como en el
// calendario de Estudio; fuera «Hoy» y el texto de ayuda de arrastrar. Tres
// columnas (vacía · mes · acciones) para que el mes quede en el centro exacto
// aunque a la derecha haya botones.
// ============================================================

export default function MonthBar({
  cursor,
  onPrev,
  onNext,
  children,
}: {
  cursor: MonthCursor;
  onPrev: () => void;
  onNext: () => void;
  /** Controles del extremo derecho. */
  children?: React.ReactNode;
}) {
  const name = monthName(cursor.month);
  const arrow = 'h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-primary [&_svg]:size-5';
  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
      <span aria-hidden />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className={arrow} onClick={onPrev} aria-label={tr('Mes anterior')} title={tr('Mes anterior (Re Pág)')}>
          <ChevronLeft />
        </Button>
        {/* Ancho fijo: las flechas no bailan al pasar de «Mayo» a «Septiembre». */}
        <h2 className="w-[12rem] text-center font-headline text-lg font-semibold leading-none text-primary" aria-live="polite">
          {name} {cursor.year}
        </h2>
        <Button variant="ghost" size="icon" className={arrow} onClick={onNext} aria-label={tr('Mes siguiente')} title={tr('Mes siguiente (Av Pág)')}>
          <ChevronRight />
        </Button>
      </div>
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
