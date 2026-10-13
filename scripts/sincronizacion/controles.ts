// ============================================================
// Mandos de un dispositivo simulado: lo que el probador puede hacer en él
// (escribir como lo haría la interfaz, arrancar o parar la sincronización en
// vivo, cortar la red, ocultar la ventana…). Se publica como `frame` en el
// contexto del dispositivo.
// ============================================================

interface Engine {
  version: string;
  startLiveSync: (uid: string) => () => void;
  pushToCloud: (uid: string) => Promise<unknown>;
  collectLocalData: (uid: string) => Record<string, unknown>;
  rememberSongKeys?: (uid: string, songs: { id: string; title: string; artist?: string; fileName: string }[]) => void;
  localizePlaylists?: (uid: string) => boolean;
}

interface FakeDocument {
  visibilityState: string;
  dispatchEvent(event: Event): boolean;
}

export function expose(engine: Engine) {
  const g = globalThis as unknown as Record<string, unknown>;
  const uid = g.__uid as string;
  const scoped = (name: string) => `${name}_${uid}`;
  let stop: (() => void) | null = null;

  g.frame = {
    version: engine.version,
    start() {
      stop ??= engine.startLiveSync(uid);
    },
    stop() {
      stop?.();
      stop = null;
    },
    sync: () => engine.pushToCloud(uid),
    /** Escribe como la interfaz: por localStorage (lo vigila la sincronización en vivo). */
    put(name: string, value: unknown) {
      localStorage.setItem(scoped(name), JSON.stringify(value));
    },
    get(name: string) {
      const raw = localStorage.getItem(scoped(name));
      return raw === null ? undefined : JSON.parse(raw);
    },
    remove(name: string) {
      localStorage.removeItem(scoped(name));
    },
    /** Los datos tal como viajan (las canciones de las playlists, por su clave). */
    cloudForm: () => engine.collectLocalData(uid),
    songs(list: { id: string; title: string; artist?: string; fileName: string }[]) {
      engine.rememberSongKeys?.(uid, list);
    },
    /** Lo que hace el estado de la música al terminar de cargar (CourseContext). */
    localize: () => engine.localizePlaylists?.(uid) ?? false,
    setOnline(online: boolean) {
      (navigator as unknown as { onLine: boolean }).onLine = online;
      if (online) dispatchEvent(new Event('online'));
    },
    setVisible(visible: boolean) {
      const doc = document as unknown as FakeDocument;
      doc.visibilityState = visible ? 'visible' : 'hidden';
      doc.dispatchEvent(new Event('visibilitychange'));
    },
    reported: () => (g.__reported as unknown[] | undefined) ?? [],
  };
}
