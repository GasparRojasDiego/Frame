import { useSyncExternalStore } from 'react';
import { signOut } from '@/lib/supabase/auth';

// ============================================================
// «Sin conexión»: un solo estado para la falta de internet y para la sesión
// en la nube que se cerró por su cuenta.
//
// Antes cada caso tenía su franja bajo la cabecera («Tu sesión en la nube se
// cerró…»). Ahora, menos es más: aparece un mensaje breve «Sin conexión» en la
// esquina inferior izquierda, que sube hasta la campana (ConnectionNotice), y
// queda como notificación mientras dure (NotificationCenter). Desde ella, si
// lo que se perdió fue la sesión, se vuelve a entrar.
// ============================================================

const LOST_KEY = 'frameSessionLost';
export const CONNECTION_FLASH_EVENT = 'frame:connection-flash';
/** Un corte más corto que esto no se anuncia (el wifi del colegio parpadea). */
const OFFLINE_GRACE_MS = 3000;

export interface ConnectionState {
  /** Sin internet desde (ms), o null con conexión. */
  offlineSince: number | null;
  /** Cuenta cuya sesión en la nube se cerró sola (persiste entre arranques). */
  sessionLostFor: string | null;
}

const readLost = (): string | null => {
  try {
    return localStorage.getItem(LOST_KEY);
  } catch {
    return null;
  }
};

let state: ConnectionState = {
  offlineSince: typeof navigator !== 'undefined' && navigator.onLine === false ? Date.now() : null,
  sessionLostFor: typeof window !== 'undefined' ? readLost() : null,
};
const listeners = new Set<() => void>();

function setState(next: Partial<ConnectionState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function getConnectionState(): ConnectionState {
  return state;
}

export const useConnectionState = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );

/** Pide el aviso animado («Sin conexión» que sube a la campana). */
function flash(): void {
  window.dispatchEvent(new Event(CONNECTION_FLASH_EVENT));
}

export function markSessionLost(uid: string): void {
  try {
    localStorage.setItem(LOST_KEY, uid);
  } catch {
    /* solo es el aviso */
  }
  setState({ sessionLostFor: uid });
  flash();
}

export function clearSessionLost(): void {
  try {
    localStorage.removeItem(LOST_KEY);
  } catch {
    /* nada */
  }
  setState({ sessionLostFor: null });
}

/** Volver a entrar tras perder la sesión: los datos se quedan en el equipo. */
export async function signInAgain(): Promise<void> {
  try {
    await signOut();
  } catch {
    /* la sesión ya no existe: da igual */
  }
  localStorage.removeItem('userProfile');
  clearSessionLost();
  window.dispatchEvent(new Event('profileUpdated'));
}

// --- Internet: se vigila desde que se carga el módulo ---
if (typeof window !== 'undefined') {
  let pending: number | null = null;
  window.addEventListener('offline', () => {
    if (pending !== null) window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      pending = null;
      if (navigator.onLine) return;
      setState({ offlineSince: Date.now() });
      flash();
    }, OFFLINE_GRACE_MS);
  });
  window.addEventListener('online', () => {
    if (pending !== null) window.clearTimeout(pending);
    pending = null;
    if (state.offlineSince !== null) setState({ offlineSince: null });
  });
}
