import { useSyncExternalStore } from 'react';

// ============================================================
// Extensiones de Frame. Hoy hay una, Notion: el importador de tareas y fechas.
// Ya no se añade ni se quita (el «+» de la barra de la Ayuda se retiró en la
// 1.6.2): lo abren el botón «Importar de Notion» de Ajustes (menú de la
// rueda, con su propio recuadro) y el atajo /notion de la Ayuda, que es lo
// único que pasa por aquí. Este módulo guarda solo si el importador global
// (el que monta el layout) está abierto.
// ============================================================

export type ExtensionId = 'notion';

// Hasta la 1.6.1 se recordaba aquí qué extensiones había «añadidas». Ya no
// significa nada: se borra lo que quedara guardado. No viaja en los respaldos.
try {
  if (typeof window !== 'undefined') window.localStorage.removeItem('frameExtensions');
} catch {
  /* almacenamiento vetado: no hay nada que limpiar */
}

const EVENT = 'frame:extensions';

interface Snapshot {
  notionOpen: boolean;
}

let snapshot: Snapshot = { notionOpen: false };

/** Abre o cierra el importador de Notion global (atajo /notion). */
export function setNotionOpen(open: boolean) {
  if (snapshot.notionOpen === open) return;
  snapshot = { ...snapshot, notionOpen: open };
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

const getSnapshot = () => snapshot;

/** Estado de las extensiones, compartido por toda la app. */
export function useExtensions(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
