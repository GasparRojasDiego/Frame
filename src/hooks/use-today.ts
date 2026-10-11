import { useSyncExternalStore } from 'react';

// ============================================================
// «Hoy», vivo.
//
// Frame es una app de escritorio que se queda abierta días enteros. Calcular
// `new Date()` al pintar congela el día: a las 00:05 Hábitos seguía mostrando
// la semana anterior (y guardaba ahí las marcas), Tareas seguía diciendo «vence
// hoy» y Enfoque sumaba a la meta de ayer. Este reloj compartido avisa a quien
// lo use cuando cambia la fecha local —por temporizador a la medianoche y al
// volver a la ventana, porque un equipo suspendido no dispara temporizadores—.
// ============================================================

const keyOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

let current = keyOf(new Date());
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function check() {
  const next = keyOf(new Date());
  if (next !== current) {
    current = next;
    listeners.forEach((listener) => listener());
  }
  schedule();
}

function schedule() {
  if (timer) clearTimeout(timer);
  if (listeners.size === 0) {
    timer = null;
    return;
  }
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
  // Tope de una hora: un temporizador larguísimo se desajusta si el equipo duerme.
  timer = setTimeout(check, Math.min(midnight.getTime() - now.getTime(), 60 * 60 * 1000));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    schedule();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}

const get = () => current;

/** Fecha local de hoy (YYYY-MM-DD). Quien la usa se repinta al cambiar de día. */
export function useTodayKey(): string {
  return useSyncExternalStore(subscribe, get, get);
}
