import { useSyncExternalStore } from 'react';
import { reportError } from '@/lib/error-report';

// ============================================================
// Estado de la sincronización de la cuenta (1.6.8).
//
// Hasta la 1.6.7 un fallo de sincronización solo quedaba en el equipo
// (`syncStatus_<uid>`) y nadie lo veía: en la tablet de Diego la nube no
// recibió nada en una hora de uso y no hubo ni un aviso. Ahora:
//   · la interfaz lo ve (useSyncStatus): el verificador de sincronización
//     lo cuenta y lo explica;
//   · si falla tres veces seguidas con el mismo motivo, se anota una vez por
//     sesión en el registro de errores (sin datos del usuario: solo el motivo).
// ============================================================

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  /** Última sincronización completa que salió bien (ms). */
  lastOkAt: number | null;
  /** Motivo del último fallo; null si el último intento salió bien. */
  lastError: string | null;
  /** Fallos seguidos. */
  failures: number;
  /** Último cambio recibido por el canal en vivo (ms). */
  lastLiveAt: number | null;
}

let status: SyncStatus = { phase: 'idle', lastOkAt: null, lastError: null, failures: 0, lastLiveAt: null };
const listeners = new Set<() => void>();
const reported = new Set<string>();

const emit = () => listeners.forEach((listener) => listener());

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}

function update(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  emit();
}

export function markSyncStarted() {
  if (status.phase !== 'syncing') update({ phase: 'syncing' });
}

/** Resultado de un ciclo de sincronización (sync.ts). */
export function markSyncResult(ok: boolean, error: string | null) {
  if (ok) {
    update({ phase: 'idle', lastOkAt: Date.now(), lastError: null, failures: 0 });
    return;
  }
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  // Sin error y sin éxito (p. ej. la cuenta se está borrando): nada que contar.
  if (!error && !offline) {
    update({ phase: 'idle' });
    return;
  }
  const failures = status.failures + 1;
  update({ phase: offline ? 'offline' : 'error', lastError: error, failures });
  if (!offline && error && failures >= 3 && !reported.has(error)) {
    reported.add(error);
    reportError({ scope: 'sync', name: 'SyncError', message: error });
  }
}

export function markLiveChange() {
  update({ lastLiveAt: Date.now() });
}

export function resetSyncStatus() {
  status = { phase: 'idle', lastOkAt: null, lastError: null, failures: 0, lastLiveAt: null };
  emit();
}
