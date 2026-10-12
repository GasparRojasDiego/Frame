import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EchoWord from '@/components/shared/EchoWord';
import { cn } from '@/lib/utils';

// ============================================================
// Duración exacta del temporizador.
//
// Se abre al pulsar el número grande del dial. El dial se arrastra de cinco
// en cinco minutos, que es lo cómodo para el gesto; aquí se pone el tiempo
// al minuto: horas y minutos por separado, con botones grandes, con la
// rueda del ratón sobre cada columna, o con un atajo de duración habitual.
// Nada se aplica hasta «Confirmar».
// ============================================================

/** Duraciones habituales de una sesión, en minutos. */
const PRESETS = [15, 25, 45, 60, 90, 120];

/** Una columna: número grande con sus dos botones y la rueda del ratón. */
function Column({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ value, max, onChange });
  stateRef.current = { value, max, onChange };

  // Rueda del ratón: hace falta un oyente no pasivo para que la rueda mueva
  // el número y no desplace el recuadro.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let acc = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      acc += event.deltaY;
      if (Math.abs(acc) < 40) return;
      const { value: current, max: top, onChange: set } = stateRef.current;
      const step = acc > 0 ? -1 : 1;
      acc = 0;
      set(Math.max(0, Math.min(top, current + step)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const round =
    'flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-30';

  return (
    <div
      ref={ref}
      className="flex flex-1 cursor-ns-resize select-none flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-3 py-4"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <button
        type="button"
        className={round}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`${label}: uno más`}
      >
        <Plus className="h-5 w-5" />
      </button>
      <span className="font-mono text-5xl font-bold tabular-nums text-foreground">
        {String(value).padStart(2, '0')}
      </span>
      <button
        type="button"
        className={round}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`${label}: uno menos`}
      >
        <Minus className="h-5 w-5" />
      </button>
    </div>
  );
}

/** «1 hora 25 min», «2 horas», «45 min». */
export function describeMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const h = hours === 1 ? '1 hora' : `${hours} horas`;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? h : `${h} ${minutes} min`;
}

export default function FocusTimePicker({
  open,
  onOpenChange,
  initialMinutes,
  maxMinutes,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMinutes: number;
  maxMinutes: number;
  onConfirm: (minutes: number) => void;
}) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  // Cada vez que se abre, parte del tiempo que marca el dial.
  useEffect(() => {
    if (!open) return;
    setHours(Math.floor(initialMinutes / 60));
    setMinutes(initialMinutes % 60);
  }, [open, initialMinutes]);

  const maxHours = Math.floor(maxMinutes / 60);
  // En la hora tope no caben minutos de más.
  const maxMinutesNow = hours >= maxHours ? maxMinutes - maxHours * 60 : 59;
  const total = Math.min(maxMinutes, hours * 60 + Math.min(minutes, maxMinutesNow));

  const setHoursClamped = (next: number) => {
    setHours(next);
    if (next >= maxHours) setMinutes((m) => Math.min(m, maxMinutes - maxHours * 60));
  };

  const applyPreset = (preset: number) => {
    setHours(Math.floor(preset / 60));
    setMinutes(preset % 60);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-sm">
        <div className="relative -mx-6 -mt-6 overflow-hidden px-6 pb-4 pt-6 after:absolute after:inset-x-6 after:bottom-0 after:h-px after:bg-border">
          <EchoWord word="Tiempo" />
          <DialogHeader className="relative">
            <DialogTitle className="text-center text-lg font-bold text-primary">Duración de la sesión</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Ajusta horas y minutos. También puedes girar la rueda del ratón sobre cada número.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex items-stretch gap-3">
          <Column label="Horas" value={hours} max={maxHours} onChange={setHoursClamped} />
          <Column label="Minutos" value={Math.min(minutes, maxMinutesNow)} max={maxMinutesNow} onChange={setMinutes} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {total === 0 ? (
            'Elige una duración'
          ) : (
            <>
              Sesión de <span className="font-semibold text-foreground">{describeMinutes(total)}</span>
            </>
          )}
        </p>

        <div className="flex flex-wrap justify-center gap-1.5">
          {PRESETS.filter((preset) => preset <= maxMinutes).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                total === preset
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/70 text-muted-foreground hover:border-primary/60 hover:text-foreground'
              )}
            >
              {preset < 60 ? `${preset} min` : describeMinutes(preset)}
            </button>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={total === 0}
            onClick={() => {
              onConfirm(total);
              onOpenChange(false);
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
