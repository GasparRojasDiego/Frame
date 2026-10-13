import { tr } from '@/lib/i18n';

// ============================================================
// Escritura y lectura BLINDADAS de localStorage.
//
// El almacén local de Frame lo escriben tres manos distintas: la propia app,
// la fusión de la sincronización en la nube y las versiones antiguas. Basta
// con que una escritura se quede a medias —cuota llena, cierre brusco— para
// que un JSON quede truncado y esa colección se pierda entera al leerla.
//
// La defensa es una copia de la ÚLTIMA VERSIÓN BUENA junto a cada clave:
//   1. Antes de sobrescribir, lo que había (si era válido) pasa a `<clave>__bak`.
//   2. Se escribe y se RELEE para comprobar que quedó completo.
//   3. Al leer, si la clave principal está rota pero el respaldo se puede
//      interpretar, se restaura desde el respaldo.
//
// Cuesta el doble de espacio en texto plano, que para datos académicos es
// despreciable frente a perder un trimestre de sesiones.
// ============================================================

const BACKUP_SUFFIX = '__bak';

/** Aviso al usuario cuando el disco se llena; lo engancha la app al arrancar. */
type QuotaListener = (key: string) => void;
let quotaListener: QuotaListener | null = null;
export const onStorageQuotaError = (listener: QuotaListener | null): void => {
  quotaListener = listener;
};

const isQuotaError = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

const parseOrNull = <T,>(raw: string | null): T | null => {
  if (raw === null || raw === '') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/**
 * Guarda `value` en `key` conservando la versión anterior como respaldo.
 * Devuelve false si no se pudo dejar escrito (y en ese caso el respaldo
 * sigue en pie, que es justo lo que interesa).
 */
export function safeWrite<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;

  let payload: string;
  try {
    payload = JSON.stringify(value);
  } catch (error) {
    console.warn(`No se pudo serializar “${key}”:`, error);
    return false;
  }

  try {
    // La versión anterior, si era legible, pasa a ser la red de seguridad.
    const previous = window.localStorage.getItem(key);
    if (previous !== null && previous !== payload && parseOrNull(previous) !== null) {
      try {
        window.localStorage.setItem(`${key}${BACKUP_SUFFIX}`, previous);
      } catch {
        // Sin sitio para el respaldo: se sigue igualmente con la escritura
        // principal, que es la que de verdad no puede fallar.
      }
    }

    window.localStorage.setItem(key, payload);

    // Releer y comparar: una escritura truncada se detecta AQUÍ y no meses
    // después, cuando ya no hay nada que recuperar.
    if (window.localStorage.getItem(key) !== payload) {
      throw new Error(tr('la relectura no coincide con lo escrito'));
    }
    return true;
  } catch (error) {
    console.warn(`Error al guardar “${key}”:`, error);
    if (isQuotaError(error)) quotaListener?.(key);
    return false;
  }
}

/**
 * Lee `key`. Si su contenido está corrupto pero hay respaldo válido, lo
 * restaura y lo devuelve. `defaultValue` es el último recurso.
 */
export function safeRead<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;

  const raw = window.localStorage.getItem(key);
  const parsed = parseOrNull<T>(raw);
  if (parsed !== null) return parsed;

  // Cadena suelta no-JSON (formatos antiguos): se respeta tal cual.
  if (raw !== null && raw !== '' && typeof defaultValue === 'string') return raw as unknown as T;

  const backup = parseOrNull<T>(window.localStorage.getItem(`${key}${BACKUP_SUFFIX}`));
  if (backup !== null) {
    console.warn(`“${key}” estaba ilegible; restaurado desde el respaldo local.`);
    try {
      window.localStorage.setItem(key, JSON.stringify(backup));
    } catch {
      /* la restauración en disco es un extra; el valor ya se devuelve */
    }
    return backup;
  }

  return defaultValue;
}

/**
 * Lectura de una COLECCIÓN: devuelve siempre un array de objetos.
 * Si la clave principal trae basura pero el respaldo tiene una lista buena,
 * gana el respaldo — perder el orden de ayer es mejor que perderlo todo.
 */
export function safeReadArray<T>(key: string): T[] {
  const clean = (value: unknown): T[] | null => {
    if (!Array.isArray(value)) return null;
    return value.filter((item): item is T => item !== null && typeof item === 'object');
  };

  const direct = clean(safeRead<unknown>(key, []));
  if (direct !== null && direct.length > 0) return direct;

  const backup = clean(parseOrNull(localStorage.getItem(`${key}${BACKUP_SUFFIX}`)));
  // Solo se prefiere el respaldo si la clave principal quedó vacía Y el
  // respaldo tiene contenido: así una lista vaciada a propósito se respeta.
  if (direct !== null && direct.length === 0 && backup && backup.length > 0) {
    const raw = localStorage.getItem(key);
    if (raw === null || parseOrNull(raw) === null) return backup;
  }

  return direct ?? backup ?? [];
}
