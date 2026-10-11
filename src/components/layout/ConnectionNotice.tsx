import { useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { CONNECTION_FLASH_EVENT, getConnectionState } from '@/lib/connection-status';
import { cn } from '@/lib/utils';

/** Momento en que la campana recibe el aviso (la hace latir un instante). */
export const BELL_PING_EVENT = 'frame:bell-ping';

/**
 * «Sin conexión»: aparece abajo a la izquierda y, al poco, sube hasta la
 * campana de notificaciones, donde queda guardado (NotificationCenter). Sin
 * franjas ni textos largos: menos es más.
 */
export default function ConnectionNotice({ uid }: { uid: string }) {
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'flying'>('hidden');
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const play = () => {
      clear();
      setFlight(null);
      setPhase('shown');
      later(() => {
        const chip = chipRef.current?.getBoundingClientRect();
        const bell = document.querySelector<HTMLElement>('[data-notification-bell]')?.getBoundingClientRect();
        if (chip && bell && !reduced) {
          setFlight({
            x: bell.left + bell.width / 2 - (chip.left + chip.width / 2),
            y: bell.top + bell.height / 2 - (chip.top + chip.height / 2),
          });
        }
        setPhase('flying');
        later(() => {
          setPhase('hidden');
          window.dispatchEvent(new Event(BELL_PING_EVENT));
        }, reduced ? 250 : 750);
      }, 2200);
    };

    window.addEventListener(CONNECTION_FLASH_EVENT, play);
    // Si Frame abre ya sin conexión (o con la sesión perdida), se avisa una vez.
    const initial = getConnectionState();
    if (initial.offlineSince !== null || initial.sessionLostFor === uid) later(play, 1500);
    return () => {
      window.removeEventListener(CONNECTION_FLASH_EVENT, play);
      clear();
    };
  }, [uid]);

  if (phase === 'hidden') return null;

  return (
    // Dos capas: la de fuera VUELA hasta la campana (transición) y la de
    // dentro hace la entrada (animación). En una sola, la animación de entrada
    // pisaba la transformación del vuelo y el aviso se iba sin moverse.
    <div
      ref={chipRef}
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed bottom-4 left-4 z-[70]',
        phase === 'flying' && 'opacity-0 transition-[transform,opacity] duration-700 ease-in'
      )}
      style={
        phase === 'flying' && flight
          ? { transform: `translate(${flight.x}px, ${flight.y}px) scale(0.3)` }
          : undefined
      }
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border border-amber-500/40 bg-background/95 px-3.5 py-2',
          'text-xs font-semibold text-foreground shadow-lg backdrop-blur',
          'animate-in fade-in slide-in-from-bottom-2 duration-300'
        )}
      >
        <WifiOff className="h-3.5 w-3.5 text-amber-500" />
        Sin conexión
      </div>
    </div>
  );
}
