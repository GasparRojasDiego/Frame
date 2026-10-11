// ============================================================
// Adjuntos de archivo de las tareas.
//
// La gracia está en NO copiar el documento: se guarda un *manejador* al
// archivo real del disco (File System Access API). Así, cuando el usuario
// sigue trabajando en su Word y lo guarda, Frame lee la versión nueva —el
// avance se ve reflejado sin volver a adjuntar nada—.
//
// Cuando el navegador no ofrece esa API se cae a una COPIA congelada, que se
// puede ver pero no se actualiza sola; la interfaz lo dice con todas las letras.
//
// Base de datos propia y minúscula, aparte de AetherMusicDB: subir la versión
// de aquella podría quedarse bloqueada mientras la ventana flotante del
// temporizador la tiene abierta.
// ============================================================

const DB_NAME = 'FrameFileHandles';
/** Nombre de la base, para que el borrado de cuenta pueda eliminarla. */
export const FILE_HANDLES_DB_NAME = DB_NAME;
const DB_VERSION = 1;
const STORE = 'handles';

type StoredEntry =
  | { key: string; kind: 'handle'; handle: FileSystemFileHandle }
  | { key: string; kind: 'copy'; blob: Blob; fileName: string; lastModified: number };

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const put = async (entry: StoredEntry): Promise<void> => {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

const get = async (key: string): Promise<StoredEntry | undefined> => {
  const db = await openDB();
  const entry = await new Promise<StoredEntry | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as StoredEntry | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return entry;
};

export const attachmentKey = (attachmentId: string) => `taskFile_${attachmentId}`;

/** ¿Puede el sistema quedarse con un enlace vivo al archivo del disco? */
export const supportsLiveFiles = (): boolean =>
  typeof window !== 'undefined' && 'showOpenFilePicker' in window;

export interface PickedFile {
  fileName: string;
  mime: string;
  /** true si quedó enlazado al archivo real (se actualizará solo). */
  live: boolean;
}

/**
 * Pide un archivo al usuario y lo deja asociado a `attachmentId`.
 * Devuelve null si el usuario cerró el selector.
 */
export async function pickAndStoreFile(attachmentId: string): Promise<PickedFile | null> {
  const key = attachmentKey(attachmentId);

  if (supportsLiveFiles()) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({ multiple: false });
      if (!handle) return null;
      const file: File = await handle.getFile();
      await put({ key, kind: 'handle', handle });
      return { fileName: file.name, mime: file.type, live: true };
    } catch (error: any) {
      // Cerrar el selector no es un fallo.
      if (error?.name === 'AbortError') return null;
      // Cualquier otro tropiezo cae al camino de la copia.
    }
  }

  // Reserva: copia congelada mediante un <input type="file"> efímero.
  return new Promise<PickedFile | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (value: PickedFile | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      try {
        await put({
          key,
          kind: 'copy',
          blob: file,
          fileName: file.name,
          lastModified: file.lastModified,
        });
        finish({ fileName: file.name, mime: file.type, live: false });
      } catch {
        finish(null); // sin espacio para la copia: mejor nada que una promesa colgada
      }
    };
    // CANCELAR. Antes solo se retiraba el <input>, pero la promesa no se
    // resolvía nunca y el botón de adjuntar se quedaba "cargando" para siempre.
    input.addEventListener('cancel', () => finish(null));
    // Respaldo para motores sin el evento `cancel`: al volver el foco a la
    // ventana, si no se eligió nada, se da por cancelado.
    window.addEventListener(
      'focus',
      () => setTimeout(() => { if (!input.files?.length) finish(null); }, 800),
      { once: true }
    );
    input.click();
  });
}

export interface ResolvedFile {
  file: File;
  live: boolean;
}

/**
 * Lee el archivo adjunto AHORA MISMO. Con manejador vivo devuelve el contenido
 * actual del disco; con copia, la que se guardó. `null` si el permiso se
 * revocó, el archivo se movió o nunca existió.
 */
export async function readAttachment(attachmentId: string): Promise<ResolvedFile | null> {
  const entry = await get(attachmentKey(attachmentId)).catch(() => undefined);
  if (!entry) return null;

  if (entry.kind === 'copy') {
    return {
      file: new File([entry.blob], entry.fileName, { lastModified: entry.lastModified }),
      live: false,
    };
  }

  try {
    const handle: any = entry.handle;
    // El permiso sobrevive a la sesión, pero hay que volver a pedirlo tras
    // reiniciar la app; se hace en silencio y solo si hace falta.
    if (typeof handle.queryPermission === 'function') {
      const status = await handle.queryPermission({ mode: 'read' });
      if (status !== 'granted') {
        const asked = await handle.requestPermission({ mode: 'read' });
        if (asked !== 'granted') return null;
      }
    }
    return { file: await handle.getFile(), live: true };
  } catch {
    return null;
  }
}

/** Olvida el archivo asociado. No borra nada del disco del usuario. */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(attachmentKey(attachmentId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* si no se puede borrar el rastro, tampoco pasa nada grave */
  }
}
