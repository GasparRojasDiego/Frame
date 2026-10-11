import { useSyncExternalStore } from 'react';

// ============================================================
// «Descubrir»: el recorrido guiado de una respuesta de la ayuda.
//
// Oscurece la pantalla y deja a la vista solo el elemento que toca pulsar;
// cuando se pulsa, pasa al siguiente, y así hasta completar la acción. Apex,
// la mascota de VT Asvent, acompaña cada paso junto al elemento resaltado y
// cambia de pose. Los recorridos están en tours.ts; quien los pinta es
// components/help/TourHost.tsx, montado una vez en el layout (el recorrido
// sobrevive a los cambios de interfaz).
//
// Los elementos se encuentran por su atributo `data-tour`, que se pone a
// propósito en los botones de la app: así un cambio de texto o de estilo no
// rompe el recorrido.
// ============================================================

export type MascotPose = 'saluda' | 'apunta' | 'vuela' | 'mira' | 'frente' | 'abre' | 'celebra' | 'perfil';

export interface TourStep {
  /** Valor `data-tour` del elemento que se resalta. Sin él, el paso es un mensaje en el centro. */
  el?: string;
  /** Lo que explica Apex en este paso. */
  say: string;
  /** Interfaz a la que se va antes de buscar el elemento. */
  go?: string;
  /**
   * El paso avanza con «Siguiente», no al pulsar el elemento: campos de texto
   * y zonas que solo se señalan.
   */
  next?: boolean;
  /** Si el elemento no aparece (p. ej. un menú que ya estaba abierto), se salta el paso. */
  optional?: boolean;
  pose?: MascotPose;
}

export interface Tour {
  /** Id de la respuesta de la ayuda a la que pertenece. */
  id: string;
  title: string;
  steps: TourStep[];
  /** Despedida al terminar. */
  done?: string;
  /** Qué hace falta antes (p. ej. tener una tarea): se dice si un paso no encuentra su elemento. */
  needs?: string;
}

let current: Tour | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function startTour(tour: Tour): void {
  current = tour;
  emit();
}

export function stopTour(): void {
  if (!current) return;
  current = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** El recorrido en marcha (o null). */
export function useActiveTour(): Tour | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Primer elemento VISIBLE con ese `data-tour` (el menú del móvil también existe, oculto). */
export function findTourTarget(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(name)}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden') return node;
  }
  return null;
}
