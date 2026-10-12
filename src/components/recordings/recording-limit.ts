/**
 * Límite de duración de la grabadora, elegido al minuto.
 *
 * Hasta la 1.6.1 el tope salía de una lista fija (15, 30, 45, 60, 90 y 120
 * minutos). Desde la 1.6.2 el estudiante pone horas y minutos a su gusto,
 * entre 1 minuto y 4 horas. El techo no es capricho: mientras se graba, el
 * audio se acumula en memoria y solo se escribe al terminar, así que una
 * grabación sin tope podría tumbar la app.
 *
 * Se guarda con la misma clave de siempre (`recordingSettings_<uid>`), de
 * modo que lo elegido en la lista vieja se conserva tal cual: todos aquellos
 * valores caben en el rango nuevo.
 */

import {
  DEFAULT_RECORDING_SETTINGS,
  recordingSettingsKey,
  type RecordingSettings,
} from '@/lib/recordings';

/** Lo mínimo que tiene sentido grabar con tope. */
export const LIMIT_MIN_MINUTES = 1;

/** Techo inamovible: 4 horas de audio en memoria. */
export const LIMIT_MAX_MINUTES = 240;

/** Acota al rango válido, a minutos enteros. `floor` sube el mínimo (al grabar,
 *  el tope no puede quedar por debajo de lo ya grabado). */
export function clampLimit(minutes: number, floor: number = LIMIT_MIN_MINUTES): number {
  const low = Math.min(LIMIT_MAX_MINUTES, Math.max(LIMIT_MIN_MINUTES, Math.ceil(floor)));
  if (!Number.isFinite(minutes)) return Math.max(low, DEFAULT_RECORDING_SETTINGS.maxMinutes);
  return Math.min(LIMIT_MAX_MINUTES, Math.max(low, Math.round(minutes)));
}

/** Nunca confía en lo que haya en localStorage: normaliza y acota. Lo que
 *  traigan versiones anteriores (`mode`, `segmentMinutes`) se ignora. */
export function sanitizeRecordingLimit(raw: unknown): RecordingSettings {
  const value = (raw ?? {}) as { maxMinutes?: unknown };
  const stored =
    typeof value.maxMinutes === 'number'
      ? value.maxMinutes
      : typeof value.maxMinutes === 'string'
        ? Number(value.maxMinutes)
        : Number.NaN;
  return {
    maxMinutes: Number.isFinite(stored) ? clampLimit(stored) : DEFAULT_RECORDING_SETTINGS.maxMinutes,
  };
}

/** Sin perfil (invitado) no hay dónde leer: vale el tope por defecto. */
export function loadRecordingLimit(uid: string | null | undefined): RecordingSettings {
  if (typeof window === 'undefined' || !uid) return { ...DEFAULT_RECORDING_SETTINGS };
  try {
    return sanitizeRecordingLimit(JSON.parse(window.localStorage.getItem(recordingSettingsKey(uid)) ?? '{}'));
  } catch {
    return { ...DEFAULT_RECORDING_SETTINGS };
  }
}
