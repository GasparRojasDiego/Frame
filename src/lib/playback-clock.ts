import { useSyncExternalStore } from 'react';

// ============================================================
// El punto de reproducción de la música, FUERA del reproductor.
//
// El <audio> vive en la barra inferior (`MusicPlayer`), pero hay otras piezas
// que necesitan saber por dónde va la canción y poder moverla: la vista
// «Reproduciendo» con sus letras sincronizadas y la escucha previa al crear una
// playlist. El reproductor publica aquí su avance y registra cómo saltar; las
// demás solo se suscriben. Cambia cuatro veces por segundo, así que NO vive en
// el contexto de la app (lo repintaría todo).
// ============================================================

interface PlaybackPosition {
  progress: number;
  duration: number;
}

type Listener = () => void;

let position: PlaybackPosition = { progress: 0, duration: 0 };
let seekHandler: ((seconds: number) => void) | null = null;
const listeners = new Set<Listener>();

export const playbackClock = {
  get: (): PlaybackPosition => position,

  publish(progress: number, duration: number): void {
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const safeProgress = Number.isFinite(progress) && progress > 0 ? progress : 0;
    if (safeProgress === position.progress && safeDuration === position.duration) return;
    position = { progress: safeProgress, duration: safeDuration };
    for (const listener of [...listeners]) listener();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** El reproductor dice cómo se salta; devuelve cómo dejar de hacerlo. */
  registerSeek(handler: (seconds: number) => void): () => void {
    seekHandler = handler;
    return () => {
      if (seekHandler === handler) seekHandler = null;
    };
  },

  seek(seconds: number): void {
    seekHandler?.(Math.max(0, seconds));
  },
};

export function usePlaybackPosition(): PlaybackPosition {
  return useSyncExternalStore(playbackClock.subscribe, playbackClock.get, playbackClock.get);
}

export const formatClock = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};
