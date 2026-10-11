import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Tiempo estimado en HORAS Y MINUTOS: nadie piensa «esto me lleva 150 minutos».

const PRESETS = [30, 60, 90, 120, 180, 240];

/** Minutos -> "2 h 30 min". */
export function formatEstimate(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default function EstimateEditor({
  minutes,
  onChange,
  className,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
  className?: string;
}) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

  return (
    <div className={cn('w-56 space-y-3', className)}>
      <p className="text-xs font-semibold text-foreground">Tiempo estimado</p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          value={hours === 0 ? '' : hours}
          onChange={(e) => onChange(clamp(Number(e.target.value), 99) * 60 + rest)}
          placeholder="0"
          aria-label="Horas"
          className="h-8 w-16 text-center text-xs"
        />
        <span className="text-xs text-muted-foreground">h</span>
        <Input
          type="number"
          min={0}
          max={59}
          step={5}
          inputMode="numeric"
          value={rest === 0 ? '' : rest}
          onChange={(e) => onChange(hours * 60 + clamp(Number(e.target.value), 59))}
          placeholder="0"
          aria-label="Minutos"
          className="h-8 w-16 text-center text-xs"
        />
        <span className="text-xs text-muted-foreground">min</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={cn(
              'h-6 rounded-md border px-2 text-[10.5px] font-semibold transition-colors',
              minutes === preset
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {formatEstimate(preset)}
          </button>
        ))}
        {minutes > 0 && (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="h-6 rounded-md px-2 text-[10.5px] font-semibold text-muted-foreground hover:text-destructive"
          >
            Quitar
          </button>
        )}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Al cerrar una sesión de estudio podrás elegir esta tarea y su avance subirá en proporción a este tiempo.
      </p>
    </div>
  );
}
