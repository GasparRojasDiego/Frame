/**
 * Preferencias de la grabadora de voz y formato de duración compartido.
 *
 * Las preferencias son de INTERFAZ (no forman parte del modelo de datos del
 * contexto), así que se persisten aparte con la clave `recordingSettings_<uid>`,
 * igual que hace el centro de notificaciones con `notificationsSeen_<uid>`.
 */

import type { RecordingImportance } from '@/types';

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

/** El mismo color, apagado: la opción aún no elegida sigue viéndose de su tono. */
export const IMPORTANCE_IDLE: Record<RecordingImportance, string> = {
  baja: 'border-green-500/25 text-green-500/70 hover:bg-green-500/10',
  media: 'border-amber-500/25 text-amber-500/70 hover:bg-amber-500/10',
  alta: 'border-red-500/25 text-red-500/70 hover:bg-red-500/10',
};

export const IMPORTANCE_LABEL: Record<RecordingImportance, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
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
