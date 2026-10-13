import { useMemo, useState } from 'react';
import { WORLD_SHAPES, WORLD_VIEWBOX } from '@/lib/world-map';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';
import { countryName } from '@/components/uso/UsageBits';

// ============================================================
// Mapa del mundo del Panel de uso (1.6.9): cada país se pinta más fuerte
// cuantos más estudiantes tiene (escala de raíz: con uno solo ya se ve, y un
// país con cien no apaga a los demás). Al pasar por encima, su nombre y sus
// cifras; al pulsarlo, el panel se queda con ese país.
// ============================================================

export interface CountryValue {
  users: number;
  active: number;
}

export default function WorldMap({
  values,
  selected,
  onSelect,
}: {
  values: Record<string, CountryValue>;
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = useMemo(() => Math.max(1, ...Object.values(values).map((value) => value.users)), [values]);
  const shown = hover ?? selected;
  const info = shown ? values[shown] : undefined;

  return (
    <div className="relative">
      <svg viewBox={WORLD_VIEWBOX} className="h-auto w-full" role="img" aria-label={tr('Mapa de estudiantes por país')}>
        {Object.entries(WORLD_SHAPES).map(([code, d]) => {
          const value = values[code]?.users ?? 0;
          const level = value > 0 ? 0.25 + 0.75 * Math.sqrt(value / max) : 0;
          return (
            <path
              key={code}
              d={d}
              onMouseEnter={() => setHover(code)}
              onMouseLeave={() => setHover((current) => (current === code ? null : current))}
              onClick={() => value > 0 && onSelect(selected === code ? null : code)}
              className={cn(
                'stroke-background transition-[fill-opacity] [stroke-width:0.5]',
                value > 0 ? 'cursor-pointer' : 'cursor-default',
                selected && selected !== code && 'opacity-60'
              )}
              style={{ fill: value > 0 ? `hsl(var(--primary) / ${level})` : 'hsl(var(--muted-foreground) / 0.18)' }}
            >
              <title>{countryName(code)}</title>
            </path>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-border/70 bg-background/85 px-2.5 py-1.5 text-[11px] backdrop-blur">
        {shown ? (
          <>
            <p className="font-semibold text-foreground">{countryName(shown)}</p>
            <p className="tabular-nums text-muted-foreground">
              {info ? tr('{users} estudiantes · {active} activos en el plazo', { users: info.users, active: info.active }) : tr('Sin estudiantes')}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">{tr('Pasa por un país para ver sus cifras; púlsalo para filtrar')}</p>
        )}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        <span>1</span>
        <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(to right, hsl(var(--primary) / 0.25), hsl(var(--primary)))' }} />
        <span className="tabular-nums">{max}</span>
        <span>{tr('estudiantes')}</span>
      </div>
    </div>
  );
}
