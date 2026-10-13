import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import {
  STUDY_VIDEO_SLOT_ATTR,
  setStudyVideoTheater,
  useStudyVideoPlayer,
} from '@/lib/study-video-player';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

// ============================================================
// El reproductor de vídeos de estudio, montado UNA vez en el layout.
//
// Se coloca encima del hueco que reserva Enfoque y lo sigue (scroll, cambios
// de tamaño, barra lateral). Cuando el hueco no está —otra interfaz, o la cara
// de métricas— se aparta fuera de la vista SIN desmontarse: el vídeo continúa
// y al volver está en su minuto.
//
// La pantalla completa nativa está desactivada a propósito: en una ventana de
// escritorio tapaba la pantalla ENTERA del equipo. «Ampliar» llena la ventana
// de Frame, que es lo que se espera, y Esc devuelve el vídeo a su sitio.
// ============================================================

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Recorte contra el área con scroll: nunca tapa la cabecera ni la música. */
  clipTop: number;
  clipBottom: number;
}

export default function StudyVideoHost() {
  const { video, theater } = useStudyVideoPlayer();
  const [box, setBox] = useState<Box | null>(null);
  const boxRef = useRef<Box | null>(null);

  // Seguimiento del hueco.
  useEffect(() => {
    if (!video) {
      setBox(null);
      boxRef.current = null;
      return;
    }
    let raf = 0;
    const measure = () => {
      const slot = document.querySelector<HTMLElement>(`[${STUDY_VIDEO_SLOT_ATTR}]`);
      let next: Box | null = null;
      if (slot) {
        const r = slot.getBoundingClientRect();
        const clipEl = slot.closest('.overflow-y-auto');
        const clip = clipEl ? clipEl.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
        if (r.width > 8 && r.height > 8) {
          next = {
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            clipTop: Math.max(0, clip.top - r.top),
            clipBottom: Math.max(0, r.bottom - clip.bottom),
          };
        }
      }
      const prev = boxRef.current;
      const same =
        (!prev && !next) ||
        (!!prev &&
          !!next &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5 &&
          prev.clipTop === next.clipTop &&
          prev.clipBottom === next.clipBottom);
      if (!same) {
        boxRef.current = next;
        setBox(next);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    // Red de seguridad para transiciones (colapso del sidebar, animaciones).
    const interval = setInterval(schedule, 350);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      clearInterval(interval);
    };
  }, [video]);

  // Esc sale del modo ampliado.
  useEffect(() => {
    if (!theater) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStudyVideoTheater(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [theater]);

  if (!video) return null;

  const hidden = !theater && !box;
  const style: React.CSSProperties = theater
    ? { left: 0, top: 0, width: '100vw', height: '100vh' }
    : box
      ? {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          clipPath:
            box.clipTop > 0 || box.clipBottom > 0 ? `inset(${box.clipTop}px 0 ${box.clipBottom}px 0)` : undefined,
        }
      : { left: -10000, top: 0, width: 320, height: 180 };

  return (
    <div
      className={cn(
        'group/video fixed overflow-hidden bg-black',
        theater ? 'z-[60]' : 'z-10 rounded-md border border-primary/40',
        hidden && 'pointer-events-none opacity-0'
      )}
      style={style}
      aria-hidden={hidden}
    >
      <iframe
        key={video.id}
        src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&fs=0`}
        title={video.title}
        allow="autoplay; encrypted-media"
        className="h-full w-full"
      />

      <button
        type="button"
        onClick={() => setStudyVideoTheater(!theater)}
        title={theater ? tr('Reducir (Esc)') : tr('Ampliar dentro de Frame')}
        aria-label={theater ? tr('Reducir el vídeo') : tr('Ampliar el vídeo')}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover/video:opacity-100"
      >
        {theater ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
