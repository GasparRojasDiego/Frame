import { useEffect, useState } from 'react';
import { useSearchParams } from '@/lib/navigation';

// ============================================================
// «Ir a lo que suena»: al pulsar el nombre de la playlist (o «Música») en el
// reproductor, la interfaz recibe `?song=<id>&t=<marca>`. Este gancho
// devuelve qué canción resaltar, la centra en pantalla y quita el resaltado
// al terminar el parpadeo (3 latidos del borde, como «Próxima tarea»).
// `t` cambia en cada pulsación: así vuelve a parpadear aunque ya estés ahí.
// ============================================================

export const songCardId = (id: string) => `song-card-${id}`;

/** Ruta del contexto con la canción a ubicar. */
export function withSong(href: string, songId: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}song=${encodeURIComponent(songId)}&t=${Date.now()}`;
}

/**
 * @param ready la lista ya está pintada (si no, se espera).
 * @returns el id de la canción a resaltar (o null).
 */
export function useSongHighlight(ready: boolean): string | null {
  const searchParams = useSearchParams();
  const songId = searchParams.get('song');
  const stamp = searchParams.get('t');
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!songId || !ready) return;
    setActive(songId);
    let tries = 0;
    let timer = 0;
    // La tarjeta puede tardar un fotograma en existir (cambio de carpeta).
    const locate = () => {
      const element = document.getElementById(songCardId(songId));
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (tries++ < 10) timer = window.setTimeout(locate, 60);
    };
    timer = window.setTimeout(locate, 30);
    const clear = window.setTimeout(() => setActive(null), 4700);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clear);
    };
  }, [songId, stamp, ready]);

  return active;
}
