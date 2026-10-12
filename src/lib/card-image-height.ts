import { useSyncExternalStore } from 'react';

// ============================================================
// Alto de la imagen de las tarjetas de Asignaturas (1.6.4): uno solo para
// todas las tarjetas de colecciones y asignaturas. Se elige con el engranaje
// de la interfaz y se recuerda en este dispositivo.
// ============================================================

export const CARD_IMAGE_DEFAULT = 112; // el antiguo `h-28`
export const CARD_IMAGE_MIN = 64;
export const CARD_IMAGE_MAX = 240;

const KEY = 'frameCardImageHeight';
const listeners = new Set<() => void>();

const clamp = (value: number) => Math.min(CARD_IMAGE_MAX, Math.max(CARD_IMAGE_MIN, Math.round(value)));

let height = (() => {
  try {
    const saved = Number(localStorage.getItem(KEY));
    return Number.isFinite(saved) && saved > 0 ? clamp(saved) : CARD_IMAGE_DEFAULT;
  } catch {
    return CARD_IMAGE_DEFAULT;
  }
})();

export function setCardImageHeight(next: number) {
  height = clamp(next);
  try {
    if (height === CARD_IMAGE_DEFAULT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(height));
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const get = () => height;

export function useCardImageHeight(): number {
  return useSyncExternalStore(subscribe, get, get);
}
