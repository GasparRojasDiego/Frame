import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Rueda de selección: el valor elegido va en el centro, con el anterior y el
// siguiente asomando arriba y abajo. Se gira con la RUEDA DEL RATÓN; también
// con las flechas del teclado, las de los extremos o tocando un vecino.
// Da la vuelta al llegar al final (de 23 se pasa a 00).
// ============================================================

export function WheelColumn<T extends string | number>({
  values,
  value,
  onChange,
  format = (v) => String(v),
  label,
  className,
}: {
  values: readonly T[];
  value: T;
  onChange: (next: T) => void;
  format?: (value: T) => string;
  /** Nombre accesible de la columna («Hora», «Minutos»…). */
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const index = Math.max(0, values.indexOf(value));
  const at = (offset: number) => values[(index + offset + values.length * 8) % values.length];

  // Espejos para el listener nativo, que se registra una sola vez.
  const stateRef = useRef({ index, values, onChange });
  stateRef.current = { index, values, onChange };

  // `wheel` a mano y NO pasivo: el onWheel de React no permite frenar el scroll
  // de la página, y girar la rueda movería a la vez la hora y la pantalla.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let carry = 0;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      carry += event.deltaY;
      // Un «clic» de rueda son ~100 px; los trackpads mandan muchos pequeños.
      const steps = Math.trunc(carry / 60);
      if (steps === 0) return;
      carry -= steps * 60;
      const current = stateRef.current;
      const size = current.values.length;
      current.onChange(current.values[(((current.index + steps) % size) + size) % size]);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const step = (delta: number) => onChange(at(delta));

  const neighbor = 'h-6 w-full text-center font-mono text-xs tabular-nums text-muted-foreground/60 transition-colors hover:text-foreground';

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={format(value)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          step(-1);
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          step(1);
        }
      }}
      className={cn(
        'group/wheel flex w-14 cursor-ns-resize select-none flex-col items-center rounded-lg border border-border/70 bg-card py-0.5 outline-none transition-colors focus-visible:border-primary',
        className
      )}
    >
      <button type="button" tabIndex={-1} onClick={() => step(-1)} aria-label={`${label}: anterior`} className="flex h-4 w-full items-center justify-center text-muted-foreground/50 hover:text-primary">
        <ChevronUp className="h-3 w-3" />
      </button>
      <button type="button" tabIndex={-1} onClick={() => step(-1)} className={neighbor}>
        {format(at(-1))}
      </button>
      <div className="flex h-8 w-full items-center justify-center border-y border-primary/40 bg-primary/10 font-mono text-lg font-bold tabular-nums text-primary">
        {format(value)}
      </div>
      <button type="button" tabIndex={-1} onClick={() => step(1)} className={neighbor}>
        {format(at(1))}
      </button>
      <button type="button" tabIndex={-1} onClick={() => step(1)} aria-label={`${label}: siguiente`} className="flex h-4 w-full items-center justify-center text-muted-foreground/50 hover:text-primary">
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
}
