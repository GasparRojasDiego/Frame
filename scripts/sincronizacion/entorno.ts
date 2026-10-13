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
  createElement: (tag: string) => (tag === 'canvas' ? new FakeCanvas() : {}),
};

// ------------------------------------------------------------
// Imágenes (1.6.9): un IndexedDB en memoria con lo que usa music-db.ts, y una
// galería y un lienzo de mentira. El lienzo «dibuja» el recorte en el texto
// de la imagen: así se comprueba que el otro dispositivo rehízo el mismo
// encuadre, no solo que guardó algo.
// ------------------------------------------------------------
class FakeRequest<T = unknown> {
  result: T | undefined;
  error: unknown = null;
  onsuccess: ((event: { target: FakeRequest<T> }) => void) | null = null;
  onerror: ((event: { target: FakeRequest<T> }) => void) | null = null;
  onupgradeneeded: ((event: { target: FakeRequest<T> }) => void) | null = null;
  succeed(value: T) {
    setTimeout(() => {
      this.result = value;
      this.onsuccess?.({ target: this });
    }, 0);
    return this;
  }
}

type Rows = Map<string, unknown>;
const databases = new Map<string, { stores: Map<string, Rows>; keyPaths: Map<string, string> }>();

function fakeDatabase(name: string) {
  const base = databases.get(name)!;
  const store = (storeName: string) => {
    const rows = base.stores.get(storeName)!;
    const keyPath = base.keyPaths.get(storeName)!;
    return {
      put: (value: Record<string, unknown>) => {
        rows.set(String(value[keyPath]), structuredClone(value));
        return new FakeRequest().succeed(value[keyPath]);
      },
      get: (key: string) => new FakeRequest().succeed(rows.has(key) ? structuredClone(rows.get(key)) : undefined),
      delete: (key: string) => {
        rows.delete(key);
        return new FakeRequest().succeed(undefined);
      },
      getAllKeys: () => new FakeRequest().succeed([...rows.keys()]),
      getAll: () => new FakeRequest().succeed([...rows.values()].map((row) => structuredClone(row))),
      clear: () => {
        rows.clear();
        return new FakeRequest().succeed(undefined);
      },
    };
  };
  return {
    objectStoreNames: { contains: (storeName: string) => base.stores.has(storeName) },
    createObjectStore: (storeName: string, options: { keyPath: string }) => {
      base.stores.set(storeName, new Map());
      base.keyPaths.set(storeName, options.keyPath);
    },
    deleteObjectStore: (storeName: string) => base.stores.delete(storeName),
    transaction: () => ({ objectStore: store }),
    close: () => undefined,
  };
}

g.indexedDB = {
  open(name: string) {
    const request = new FakeRequest<ReturnType<typeof fakeDatabase>>();
    setTimeout(() => {
      const fresh = !databases.has(name);
      if (fresh) databases.set(name, { stores: new Map(), keyPaths: new Map() });
      request.result = fakeDatabase(name);
      if (fresh) request.onupgradeneeded?.({ target: request });
      request.onsuccess?.({ target: request });
    }, 0);
    return request;
  },
};

/** Las imágenes de la galería de este dispositivo (ruta → tamaño). */
const gallery = new Map<string, [number, number]>([['/native_pictures/ciudades/central-park.webp', [1280, 660]]]);
(g as { __gallery?: typeof gallery }).__gallery = gallery;

class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    setTimeout(() => {
      const size = gallery.get(value);
      if (!size) return this.onerror?.();
      [this.naturalWidth, this.naturalHeight] = size;
      this.onload?.();
    }, 5);
  }
}
g.Image = FakeImage;

class FakeCanvas {
  width = 0;
  height = 0;
  private drawn: unknown[] = [];
  getContext() {
    return {
      imageSmoothingQuality: 'low',
      drawImage: (_image: unknown, ...box: number[]) => {
        this.drawn = box.map((n) => Math.round(n));
      },
    };
  }
  toDataURL(type = 'image/png') {
    return `data:${type};base64,${btoa(JSON.stringify({ box: this.drawn, size: [this.width, this.height] }))}`;
  }
}
