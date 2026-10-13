// ============================================================
// Vídeos de estudio de la interfaz Enfoque.
//
// Guarda la FICHA del vídeo (título, canal, duración), no el vídeo: se ve
// siempre con el reproductor de YouTube.
//
// Vive en localStorage y no en el contexto general porque es una lista corta,
// propia de una sola pantalla, y nada más de la app la consulta.
// ============================================================

import type { StudyVideo } from '@/types';

/**
 * Tope de vídeos guardados.
 *
 * Es un estante de repaso, no una videoteca: pasados unos treinta la lista
 * deja de ser útil para encontrar nada. El tope avisa en vez de romperse.
 */
export const MAX_STUDY_VIDEOS = 30;

const storageKey = (uid: string) => `studyVideos_${uid}`;

export function readStudyVideos(uid: string | null | undefined): StudyVideo[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StudyVideo[]).filter((v) => v && v.id) : [];
  } catch {
    return [];
  }
}

export function writeStudyVideos(uid: string | null | undefined, videos: StudyVideo[]): void {
  if (!uid) return;
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(videos.slice(0, MAX_STUDY_VIDEOS)));
  } catch {
    /* sin espacio: la lista sigue viva en memoria hasta cerrar */
  }
}

/** Miniatura oficial de YouTube. Requiere internet; si falla se pinta un icono. */
export const videoThumbnail = (id: string): string => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

const thumbKey = (id: string) => `videoThumb_${id}`;
const inFlight = new Map<string, Promise<string | null>>();

/**
 * Miniatura del vídeo como data URL, guardada en el equipo.
 *
 * Cargarla directamente desde i.ytimg.com fallaba en el motor web de Windows
 * (la tarjeta se quedaba sin portada aunque hubiera internet). Ahora la baja
 * el núcleo nativo, sin restricciones del navegador, y se guarda: la segunda
 * vez aparece al instante y también sin conexión.
 */
export function cachedVideoThumbnail(id: string): Promise<string | null> {
  const running = inFlight.get(id);
  if (running) return running;
  const task = (async () => {
    const { getImage, saveImage } = await import('@/lib/music-db');
    const stored = await getImage(thumbKey(id)).catch(() => null);
    if (stored) return stored;
    const { invoke, isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) return null;
    for (const size of ['mqdefault', 'hqdefault', 'default']) {
      try {
        const dataUrl = await invoke<string>('http_get_data_url', { url: `https://i.ytimg.com/vi/${id}/${size}.jpg` });
        if (dataUrl.startsWith('data:image/')) {
          await saveImage(thumbKey(id), dataUrl).catch(() => undefined);
          return dataUrl;
        }
      } catch {
        /* se prueba el siguiente tamaño */
      }
    }
    return null;
  })().finally(() => inFlight.delete(id));
  inFlight.set(id, task);
  return task;
}

const videoWatchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/** "7:05" a partir de segundos. Cadena vacía si no se conoce la duración. */
export function formatVideoDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Aviso a cualquier pantalla que muestre la lista (el panel de Enfoque). */
export const STUDY_VIDEOS_EVENT = 'frame-study-videos-changed';

function notifyStudyVideosChanged(): void {
  window.dispatchEvent(new Event(STUDY_VIDEOS_EVENT));
}

type AddVideoResult = 'added' | 'duplicate' | 'full';

/**
 * Alta de un vídeo desde cualquier sitio (el panel de Enfoque o la interfaz
 * YouTube). Devuelve por qué NO se añadió, para que quien llame lo explique.
 */
export function addStudyVideo(uid: string | null | undefined, video: StudyVideo): AddVideoResult {
  const current = readStudyVideos(uid);
  if (current.some((v) => v.id === video.id)) return 'duplicate';
  if (current.length >= MAX_STUDY_VIDEOS) return 'full';
  writeStudyVideos(uid, [video, ...current]);
  notifyStudyVideosChanged();
  return 'added';
}

export interface YoutubeVideoInfo {
  id: string;
  title: string;
  uploader: string;
  /** Segundos; 0 si no se pudo saber. */
  duration: number;
}

/**
 * Ficha de un vídeo: título y canal salen del oEmbed público de YouTube; la
 * duración, de la propia página del vídeo (si no aparece, queda en 0).
 * Las peticiones van por el núcleo nativo (el motor web no puede: CORS).
 */
export async function readYoutubeVideo(id: string): Promise<YoutubeVideoInfo> {
  const { invoke } = await import('@tauri-apps/api/core');
  const watch = videoWatchUrl(id);
  const oembed = JSON.parse(
    await invoke<string>('http_get_text', { url: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}` })
  ) as { title?: string; author_name?: string };
  let duration = 0;
  try {
    const page = await invoke<string>('http_get_text', { url: watch });
    duration = Number(page.match(/"lengthSeconds":"(\d+)"/)?.[1] ?? 0) || 0;
  } catch {
    /* la duración es un extra */
  }
  return { id, title: oembed.title?.trim() || 'Vídeo de YouTube', uploader: oembed.author_name?.trim() || '', duration };
}

/** Identificador de YouTube dentro de una URL de vídeo. */
export function youtubeIdFromUrl(url: string): string | null {
  const watch = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (watch) return watch[1];
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (short) return short[1];
  const shorts = url.match(/\/shorts\/([A-Za-z0-9_-]{6,})/);
  if (shorts) return shorts[1];
  return null;
}
