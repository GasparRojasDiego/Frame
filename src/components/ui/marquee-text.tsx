import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Velocidad constante del desplazamiento: los nombres largos no tardan
 *  desproporcionadamente más que los cortos-pero-desbordados. */
const SPEED_PX_PER_SEC = 26;
/** Aire entre la copia que sale y la que entra (bucle sin costura). */
const GAP_PX = 40;

interface MarqueeTextProps {
  text: string;
  className?: string;
  /** Alineación cuando el texto SÍ cabe (si desborda, ocupa todo el ancho). */
  align?: 'center' | 'left';
  /** Detiene el desplazamiento al pasar el cursor. Por defecto, sí. */
  pauseOnHover?: boolean;
}

/**
 * Texto que se recorta al ancho disponible y, SOLO si no cabe, se desplaza de
 * derecha a izquierda en bucle continuo.
 *
 * La animación se hace con la Web Animations API en lugar de CSS: la distancia
 * depende del ancho medido en tiempo de ejecución, así que no hay keyframes
 * fijos que sirvan, y de paso permite pausar exactamente donde está.
 */
export default function MarqueeText({
  text,
  className,
  align = 'center',
  pauseOnHover = true,
}: MarqueeTextProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);

  const [overflows, setOverflows] = useState(false);

  // Medición: un único <span> invisible con el texto sin recortar contra el
  // ancho real del contenedor. ResizeObserver cubre el colapso del sidebar y
  // los cambios de tamaño de ventana.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const check = () => {
      const available = viewport.clientWidth;
      // 1 px de holgura: evita animar por errores de redondeo subpíxel.
      setOverflows(available > 0 && measure.scrollWidth > available + 1);
    };

    check();

    const observer = new ResizeObserver(check);
    observer.observe(viewport);
    observer.observe(measure);

    // Poppins se carga en local: hasta que el navegador la aplica, el texto se
    // mide con la tipografía de reserva y el ancho cambia después del montaje.
    // Sin esta segunda pasada, un nombre justo en el límite se quedaba quieto.
    let cancelled = false;
    const recheck = () => {
      if (!cancelled) check();
    };
    document.fonts?.ready.then(recheck).catch(() => {});
    const raf = requestAnimationFrame(recheck);

    // Red de seguridad si el ResizeObserver no entrega avisos.
    window.addEventListener('resize', check);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', check);
      observer.disconnect();
    };
  }, [text]);

  // Animación en bucle. Las dos copias miden lo mismo (el hueco va como
  // padding de cada una), así que desplazar el 50% del carril encadena la
  // segunda copia exactamente donde estaba la primera.
  useEffect(() => {
    animationRef.current?.cancel();
    animationRef.current = null;

    const track = trackRef.current;
    if (!overflows || !track) return;

    const halfWidth = track.scrollWidth / 2;
    if (halfWidth <= 0) return;

    animationRef.current = track.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(-${halfWidth}px)` }],
      {
        duration: (halfWidth / SPEED_PX_PER_SEC) * 1000,
        iterations: Infinity,
        easing: 'linear',
      }
    );

    return () => {
      animationRef.current?.cancel();
      animationRef.current = null;
    };
  }, [overflows, text]);

  const handleEnter = useCallback(() => {
    if (pauseOnHover) animationRef.current?.pause();
  }, [pauseOnHover]);

  const handleLeave = useCallback(() => {
    if (pauseOnHover) animationRef.current?.play();
  }, [pauseOnHover]);

  return (
    <div
      ref={viewportRef}
      className={cn('relative w-full overflow-hidden whitespace-nowrap', className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Sonda de medida: fuera de flujo, nunca visible, nunca recortada. */}
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap"
      >
        {text}
      </span>

      {overflows ? (
        <div ref={trackRef} className="flex w-max will-change-transform">
          <span style={{ paddingRight: GAP_PX }}>{text}</span>
          <span aria-hidden style={{ paddingRight: GAP_PX }}>
            {text}
          </span>
        </div>
      ) : (
        <div className={cn('w-full', align === 'center' ? 'text-center' : 'text-left')}>{text}</div>
      )}
    </div>
  );
}
