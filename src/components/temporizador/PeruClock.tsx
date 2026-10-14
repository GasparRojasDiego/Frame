import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { intlLocale, tr } from '@/lib/i18n';

// Aparte de la tarjeta del temporizador (1.7.0): la ventana flotante lo
// importaba de MiniTimerCard y con él cargaba la app entera —el contexto, la
// sincronización, Supabase…, unos 420 KB— que esa ventana nunca usa.

// ============================================================
// Hora oficial de Perú (America/Lima) con máxima precisión: al activarse se
// sincroniza una vez contra un servidor de hora (corrige el desfase del
// reloj del equipo) y de ahí avanza con el reloj local, segundo a segundo.
// ============================================================
export const PERU_CLOCK_KEY = 'miniTimerShowPeruClock';
let peruOffsetMs = 0; // corrección servidor − equipo (0 si no se pudo sincronizar)
let peruOffsetSynced = false;

async function syncPeruOffset() {
  if (peruOffsetSynced || !navigator.onLine) return;
  try {
    const t0 = Date.now();
    const resp = await fetch('https://worldtimeapi.org/api/timezone/America/Lima');
    if (!resp.ok) return;
    const data = await resp.json();
    const t1 = Date.now();
    // Compensa la latencia de red asumiendo ida y vuelta simétricas.
    const serverNow = new Date(data.utc_datetime).getTime() + (t1 - t0) / 2;
    if (!Number.isFinite(serverNow)) return;
    peruOffsetMs = serverNow - t1;
    peruOffsetSynced = true;
  } catch {
    /* sin sincronización externa se usa el reloj del sistema */
  }
}

/** Bandera del Perú (franjas rojo-blanco-rojo), para acompañar a su hora. */
export function PeruFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={cn('shrink-0 rounded-[1.5px] ring-1 ring-border/70', className)} aria-hidden>
      <rect width="10" height="20" fill="#D91023" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#D91023" />
    </svg>
  );
}

export function PeruClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void syncPeruOffset();
    // Tick alineado al segundo para que el cambio de dígito sea exacto.
    let interval: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(() => {
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), 1000);
    }, 1000 - ((Date.now() + peruOffsetMs) % 1000));
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, []);

  const time = new Date(now + peruOffsetMs).toLocaleTimeString(intlLocale(), {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  if (compact) {
    return (
      <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
        {time}
      </span>
    );
  }
  return (
    <div className="mt-2 flex items-center justify-center gap-1.5 text-muted-foreground">
      <PeruFlag className="h-2.5 w-[15px]" />
      <span className="text-[10px] font-semibold">{tr('Perú')}</span>
      <span className="font-mono text-sm font-bold text-foreground tabular-nums">{time}</span>
    </div>
  );
}
