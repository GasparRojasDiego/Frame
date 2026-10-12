import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIMIT_MAX_MINUTES, LIMIT_MIN_MINUTES, clampLimit } from '@/components/recordings/recording-limit';

// ============================================================
// Límite de la grabación, en horas y minutos.
//
// La misma estética que la duración exacta del Temporizador de Estudio
// (FocusTimePicker): dos columnas con el número grande y sus botones − y +.
// Además de los botones, cada columna responde a la rueda del ratón y al
// teclado: el número se escribe encima o se sube y baja con las flechas.
// Cada cambio se aplica al momento; no hay «Confirmar».
// ============================================================

const pad = (n: number) => String(n).padStart(2, '0');

/** Una columna: número grande (editable) con sus dos botones y la rueda. */
function LimitColumn({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef({ value, min, max, onChange });
  stateRef.current = { value, min, max, onChange };
  /** Lo que se está escribiendo; `null` = se muestra el valor real. */
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  // Rueda del ratón: hace falta un oyente no pasivo para que la rueda mueva
  // el número y no desplace nada detrás.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let acc = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      acc += event.deltaY;
      if (Math.abs(acc) < 40) return;
      const { value: current, min: low, max: top, onChange: set } = stateRef.current;
      const step = acc > 0 ? -1 : 1;
      acc = 0;
      setDraft(null);
      set(Math.max(low, Math.min(top, current + step)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // Lo tecleado se aplica al momento (acotado), sin esperar a salir de la
  // casilla: si el recuadro se cierra con la casilla activa, no se pierde.
  // Mientras tanto se ve tal cual se escribe; al salir, ya acotado.
  const typeDigits = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(-2);
    setDraft(digits);
    if (digits !== '') onChange(clamp(Number.parseInt(digits, 10)));
  };

  // Tras una flecha el número queda seleccionado: lo siguiente que se teclee
  // lo reemplaza entero, como al entrar en la casilla. Solo si la casilla
  // tiene el foco: con los botones − y + no se le roba.
  const reselect = () =>
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (input && document.activeElement === input) input.select();
    });

  const step = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta));
    reselect();
  };

  const round =
    'flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-30';

  return (
    <div
      ref={ref}
      className="flex flex-1 cursor-ns-resize select-none flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-3 py-3"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <button
        type="button"
        className={round}
        onClick={() => step(1)}
        disabled={value >= max}
        aria-label={`${label}: uno más`}
      >
        <Plus className="h-5 w-5" />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        value={draft ?? pad(value)}
        onFocus={(event) => {
          setDraft(null);
          event.currentTarget.select();
        }}
        // Sin esto, soltar el clic deshace la selección del foco y lo tecleado
        // se sumaría a las cifras que ya había.
        onMouseUp={(event) => event.preventDefault()}
        onChange={(event) => typeDigits(event.target.value)}
        onBlur={() => setDraft(null)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            step(1);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            step(-1);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            setDraft(null);
            reselect();
          }
        }}
        className="w-[2.4ch] cursor-text select-text rounded-lg bg-transparent text-center font-mono text-5xl font-bold tabular-nums text-foreground caret-primary outline-none transition-colors focus:bg-primary/10"
      />
      <button
        type="button"
        className={round}
        onClick={() => step(-1)}
        disabled={value <= min}
        aria-label={`${label}: uno menos`}
      >
        <Minus className="h-5 w-5" />
      </button>
    </div>
  );
}

/**
 * Horas y minutos del tope. `value` va en minutos totales y siempre sale
 * acotado entre `floor` (1 min por defecto) y 4 h.
 */
export default function RecordingLimitPicker({
  value,
  onChange,
  floor = LIMIT_MIN_MINUTES,
  className,
}: {
  value: number;
  onChange: (minutes: number) => void;
  /** Mínimo admitido: mientras se graba, lo ya grabado más un minuto. */
  floor?: number;
  className?: string;
}) {
  const total = clampLimit(value, floor);
  const low = clampLimit(floor, floor);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  const maxHours = Math.floor(LIMIT_MAX_MINUTES / 60);
  const lowHours = Math.floor(low / 60);
  // En la hora tope no caben minutos de más; en la hora mínima, no caben
  // minutos de menos (0 h 00 min no es un límite).
  const maxMinutesNow = hours >= maxHours ? LIMIT_MAX_MINUTES - maxHours * 60 : 59;
  const minMinutesNow = hours <= lowHours ? low - lowHours * 60 : 0;

  const set = (next: number) => onChange(clampLimit(next, floor));

  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      <LimitColumn label="Horas" value={hours} min={lowHours} max={maxHours} onChange={(h) => set(h * 60 + minutes)} />
      <LimitColumn
        label="Minutos"
        value={minutes}
        min={minMinutesNow}
        max={maxMinutesNow}
        onChange={(m) => set(hours * 60 + m)}
      />
    </div>
  );
}
