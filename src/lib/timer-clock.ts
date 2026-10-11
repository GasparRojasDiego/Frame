import { useSyncExternalStore } from 'react';

// ============================================================
// El segundero de la sesión de estudio, FUERA del estado de React.
//
// Mientras el reloj corre cambia una vez por segundo. Cuando ese valor vivía
// en el estado del proveedor de datos, cada tic volvía a renderizar el
// proveedor y, con él, los 56 archivos que llaman a `useCourse()`: listas de
// tareas, el calendario, la biblioteca de música y los gráficos de Enfoque se
// redibujaban una vez por segundo durante toda la sesión, para nada — solo
// tres componentes pintan el reloj.
//
// Aquí el valor es un almacén mínimo con suscripción. Quien necesita el
// segundero usa `useTimerTime()` y se entera del tic; el resto de la app no
// se mueve. El proveedor sigue siendo quien lo gobierna (arrancar, pausar,
// fijar la duración), a través de `timerClock.set`.
// ============================================================

type Listener = () => void;

let seconds = 0;
const listeners = new Set<Listener>();

export const timerClock = {
  /** Segundos que marca el reloj ahora mismo. */
  get: (): number => seconds,

  set(next: number): void {
    const value = Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0;
    if (value === seconds) return;
    seconds = value;
    for (const listener of [...listeners]) listener();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** El segundero, para los pocos componentes que lo pintan. */
export function useTimerTime(): number {
  return useSyncExternalStore(timerClock.subscribe, timerClock.get, timerClock.get);
}
