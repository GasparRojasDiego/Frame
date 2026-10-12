import { Hourglass } from 'lucide-react';
import { WheelColumn } from '@/components/ui/wheel-picker';
import { cn } from '@/lib/utils';

// ============================================================
// Tiempo estimado en HORAS Y MINUTOS: nadie piensa «esto me lleva 150
// minutos». Desde la 1.6.5 se elige con las mismas ruedas que la hora del
// recordatorio (horas de 0 a 99, minutos de 5 en 5).
// ============================================================

const HOURS = Array.from({ length: 100 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const two = (n: number) => String(n).padStart(2, '0');

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
  const hours = Math.min(99, Math.floor(minutes / 60));
  // La rueda va de 5 en 5: un tiempo heredado como 1 h 32 min se muestra como 1 h 30 min.
  const rest = Math.min(55, Math.round((minutes % 60) / 5) * 5);

  return (
    <div className={cn('w-[220px] space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Hourglass className={cn('h-3.5 w-3.5', minutes > 0 ? 'text-primary' : 'text-muted-foreground')} />
          Tiempo estimado
        </span>
        {minutes > 0 && (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Quitar
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <WheelColumn label="Horas" values={HOURS} value={hours} format={(h) => String(h)} onChange={(h) => onChange(h * 60 + rest)} />
        <span className="text-xs font-semibold text-muted-foreground">h</span>
        <WheelColumn label="Minutos" values={MINUTES} value={rest} format={two} onChange={(m) => onChange(hours * 60 + m)} />
        <span className="text-xs font-semibold text-muted-foreground">min</span>
      </div>
    </div>
  );
}
