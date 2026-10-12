import { BellPlus, CalendarPlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoColorSwatch, Swatch } from './CalendarBits';
import { PAINT_COLORS, daysBetween, rangeLabel, type DayRange } from './calendar-model';

// ============================================================
// Barra flotante de los días seleccionados (arrastrando o con mayús+clic).
//
// Todo lo que se hace «en bloque» está aquí y en este orden: qué se
// selecciona, qué se crea (evento o recordatorio para esos días), el color
// de las casillas y, al final, vaciar o soltar la selección.
// ============================================================

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

export default function SelectionBar({
  range,
  currentColor,
  onEvent,
  onReminder,
  onPaint,
  onClear,
  onDismiss,
}: {
  range: DayRange;
  /** Color común de todos los días seleccionados ('' = ninguno; null = mezclados). */
  currentColor: string | null;
  onEvent: () => void;
  onReminder: () => void;
  onPaint: (color: string | null) => void;
  onClear: () => void;
  onDismiss: () => void;
}) {
  const count = daysBetween(range.start, range.end) + 1;
  return (
    <div
      role="toolbar"
      aria-label={`${count} ${count === 1 ? 'día seleccionado' : 'días seleccionados'}`}
      className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-xl border border-border bg-card/95 p-1.5 shadow-[0_14px_36px_-14px_rgb(0_0_0/0.5)] backdrop-blur-md duration-200 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      <div className="flex items-baseline gap-1.5 pl-2 pr-1">
        <span className="text-sm font-bold tabular-nums text-foreground">{count}</span>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {count === 1 ? 'día' : 'días'} · {rangeLabel(range)}
        </span>
      </div>

      <Divider />

      <Button variant="fantasma" size="sm" className="h-8 px-2.5 text-xs" onClick={onEvent}>
        <CalendarPlus />
        Evento
      </Button>
      <Button variant="fantasma" size="sm" className="h-8 px-2.5 text-xs" onClick={onReminder}>
        <BellPlus />
        Recordatorio
      </Button>

      <Divider />

      <div className="flex items-center gap-1.5 px-1" role="group" aria-label="Color de las casillas">
        {PAINT_COLORS.map(({ hex, name }) => (
          <Swatch
            key={hex}
            size="sm"
            color={hex}
            name={name}
            active={currentColor === hex}
            onClick={() => onPaint(hex)}
          />
        ))}
        <NoColorSwatch size="sm" active={currentColor === ''} onClick={() => onPaint(null)} />
      </div>

      <Divider />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onClear}
        aria-label="Vaciar estos días"
        title="Vaciar estos días (Supr)"
      >
        <Trash2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        onClick={onDismiss}
        aria-label="Soltar la selección"
        title="Soltar la selección (Esc)"
      >
        <X />
      </Button>
    </div>
  );
}
