/**
 * Preferencias de la grabadora de voz y formato de duración compartido.
 *
 * Las preferencias son de INTERFAZ (no forman parte del modelo de datos del
 * contexto), así que se persisten aparte con la clave `recordingSettings_<uid>`,
 * igual que hace el centro de notificaciones con `notificationsSeen_<uid>`.
 */

import type { RecordingImportance, RecordingKind } from '@/types';

/**
 * Color de cada grado de importancia, el mismo en la lista de grabaciones,
 * en su detalle y al guardarlas. Tres tonos que se leen sin etiqueta:
 * verde, ámbar y rojo.
 */
export const IMPORTANCE_STYLE: Record<RecordingImportance, string> = {
  baja: 'bg-green-500/15 text-green-500 border-green-500/40',
  media: 'bg-amber-500/15 text-amber-500 border-amber-500/40',
  alta: 'bg-red-500/15 text-red-500 border-red-500/40',
};

export const IMPORTANCE_LABEL: Record<RecordingImportance, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

/** Punto de color de cada importancia (en los desplegables). */
export const IMPORTANCE_DOT: Record<RecordingImportance, string> = {
  baja: 'bg-green-500',
  media: 'bg-amber-500',
  alta: 'bg-red-500',
};

export const RECORDING_KIND_LABEL: Record<RecordingKind, string> = {
  tarea: 'Tarea',
  recordatorio: 'Recordatorio',
  explicacion: 'Explicación',
  personal: 'Personal',
};

/** Desde la 1.4.8 solo existe la grabación continua: un audio, un archivo. */
export interface RecordingSettings {
  /** Tope duro de la grabación, en minutos (de 1 min a 4 h desde la 1.6.2;
   *  lo acota `clampLimit` de components/recordings/recording-limit.ts). */
  maxMinutes: number;
}

export const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  maxMinutes: 120,
};

export const recordingSettingsKey = (uid: string) => `recordingSettings_${uid}`;

/** Sin perfil (invitado) los ajustes viven solo en memoria durante la sesión. */
export function saveRecordingSettings(uid: string | null | undefined, settings: RecordingSettings) {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(recordingSettingsKey(uid), JSON.stringify(settings));
  } catch (e) {
    console.warn('No se pudieron guardar los ajustes de grabación', e);
  }
}

// ------------------------------------------------------------
// ¿Hay una grabación a medias? (grabando, en pausa o sin guardar todavía)
//
// La publica la grabadora y la consulta el actualizador: reiniciar para
// instalar perdería el audio que solo está en memoria. Vive aquí, fuera de
// React, porque el guardián del actualizador se pregunta en cualquier momento.
// ------------------------------------------------------------

let recorderBusy = false;
const recorderListeners = new Set<() => void>();

export function setRecorderBusy(busy: boolean): void {
  if (busy === recorderBusy) return;
  recorderBusy = busy;
  recorderListeners.forEach((listener) => listener());
}

export const isRecorderBusy = (): boolean => recorderBusy;

export function subscribeRecorderBusy(listener: () => void): () => void {
  recorderListeners.add(listener);
  return () => recorderListeners.delete(listener);
}

export const minutesLabel = (m: number): string =>
  m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`;

/** hh:mm:ss cuando pasa de la hora; mm:ss en caso contrario. */
export function formatDuration(totalSec: number): string {
  const safe = Number.isFinite(totalSec) && totalSec > 0 ? totalSec : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
