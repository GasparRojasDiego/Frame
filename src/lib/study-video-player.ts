import { useSyncExternalStore } from 'react';
import type { StudyVideo } from '@/types';

// ============================================================
// Qué vídeo de estudio está puesto, FUERA de la pantalla de Enfoque.
//
// El reproductor vive en el layout (`StudyVideoHost`) y no en la página: así
// el vídeo no se desmonta al cambiar de interfaz. Sigue corriendo —o sigue en
// pausa, en su minuto— y al volver a Enfoque está exactamente donde se dejó.
// La página solo reserva el hueco (`data-study-video-slot`) sobre el que el
// reproductor se coloca.
// ============================================================

interface StudyVideoPlayerState {
  video: StudyVideo | null;
  /** Ampliado: ocupa la ventana de Frame (no la pantalla del equipo). */
  theater: boolean;
}

type Listener = () => void;

let state: StudyVideoPlayerState = { video: null, theater: false };
const listeners = new Set<Listener>();

function emit(next: StudyVideoPlayerState) {
  state = next;
  for (const listener of [...listeners]) listener();
}

export const getStudyVideoPlayer = (): StudyVideoPlayerState => state;

export function playStudyVideo(video: StudyVideo) {
  emit({ video, theater: state.video?.id === video.id ? state.theater : false });
}

export function stopStudyVideo() {
  if (!state.video && !state.theater) return;
  emit({ video: null, theater: false });
}

export function setStudyVideoTheater(theater: boolean) {
  if (!state.video || state.theater === theater) return;
  emit({ ...state, theater });
}

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useStudyVideoPlayer(): StudyVideoPlayerState {
  return useSyncExternalStore(subscribe, getStudyVideoPlayer, getStudyVideoPlayer);
}

/** Atributo del hueco que reserva la página para el reproductor. */
export const STUDY_VIDEO_SLOT_ATTR = 'data-study-video-slot';
