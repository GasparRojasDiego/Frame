import { useSyncExternalStore } from 'react';

// ============================================================
// Extensiones de Frame: se añaden desde el «+» de la barra de ayuda de Inicio
// y aparecen como etiqueta dentro de la barra. Hoy hay una, Notion, que abre
// el importador de tareas y fechas (atajo: /notion). Qué extensiones hay
// añadidas se recuerda en este dispositivo.
// ============================================================

export type ExtensionId = 'notion';

export interface ExtensionInfo {
  id: ExtensionId;
  name: string;
  /** Una línea: qué hace. */
  tagline: string;
  /** Qué ocurre al añadirla. */
  detail: string;
  /** Atajo con barra. */
  slash: string;
}

export const EXTENSIONS: ExtensionInfo[] = [
  {
    id: 'notion',
    name: 'Notion',
    tagline: 'Importa tus tareas y fechas de Notion',
    detail: 'Elige la exportación de tu base de datos de Notion (el .zip o el .csv) y Frame crea las tareas con sus fechas.',
    slash: '/notion',
  },
];

export const extensionInfo = (id: ExtensionId) => EXTENSIONS.find((e) => e.id === id)!;

const STORAGE_KEY = 'frameExtensions';
const EVENT = 'frame:extensions';

function read(): ExtensionId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    // Las de la 1.5.8 que ya no existen (calculadora, diccionario, traductor) se descartan.
    return Array.isArray(raw) ? raw.filter((id): id is ExtensionId => EXTENSIONS.some((e) => e.id === id)) : [];
  } catch {
    return [];
  }
}

interface Snapshot {
  installed: ExtensionId[];
  notionOpen: boolean;
}

let snapshot: Snapshot = { installed: typeof window !== 'undefined' ? read() : [], notionOpen: false };

function update(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot.installed));
  } catch {
    /* sin espacio: se pierde solo la preferencia */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addExtension(id: ExtensionId) {
  update({ installed: snapshot.installed.includes(id) ? snapshot.installed : [...snapshot.installed, id], notionOpen: true });
}

export function removeExtension(id: ExtensionId) {
  update({ installed: snapshot.installed.filter((x) => x !== id), notionOpen: false });
}

export function setNotionOpen(open: boolean) {
  update({ notionOpen: open });
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
