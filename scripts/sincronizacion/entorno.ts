// ============================================================
// Entorno de UN dispositivo simulado (scripts/probar-sincronizacion.mjs).
//
// Cada dispositivo corre en su propio contexto de Node (node:vm), así que
// este archivo se evalúa una vez por dispositivo: su almacenamiento local, su
// `window`, su `document` y su clase Storage (live-sync parchea el prototipo)
// son solo suyos. La nube y el canal en vivo son compartidos: los inyecta el
// probador como `__supabase`.
// ============================================================

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const g = globalThis as unknown as Record<string, unknown>;
const windowEvents = new EventTarget();
const documentEvents = new EventTarget();

g.Storage = MemoryStorage;
g.localStorage = new MemoryStorage();
g.sessionStorage = new MemoryStorage();
g.addEventListener = windowEvents.addEventListener.bind(windowEvents);
g.removeEventListener = windowEvents.removeEventListener.bind(windowEvents);
g.dispatchEvent = windowEvents.dispatchEvent.bind(windowEvents);
g.window = globalThis;
g.navigator = { onLine: true, language: 'es-PE', userAgent: 'frame-prueba' };
g.document = {
  visibilityState: 'visible',
  documentElement: {},
  addEventListener: documentEvents.addEventListener.bind(documentEvents),
  removeEventListener: documentEvents.removeEventListener.bind(documentEvents),
  dispatchEvent: documentEvents.dispatchEvent.bind(documentEvents),
};
