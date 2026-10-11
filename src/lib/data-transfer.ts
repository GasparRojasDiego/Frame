import { getAllImages, getImage, getRecordingAudio, saveImage } from '@/lib/music-db';
import { exportKnowledge, importKnowledge } from '@/lib/knowledge-db';
import { applyLocalData, collectLocalData, type LocalSnapshot } from '@/lib/storage-snapshot';
import { APP_VERSION } from '@/lib/version';
import type { Recording, UserProfile } from '@/types';

// ============================================================
// Traslado de datos entre perfiles y cuentas.
//
// Los datos de Frame cuelgan del id del perfil (`courses_<id>`, `tasks_<id>`…).
// Quien empezó como invitado y luego creó su cuenta estrena un id nuevo, y sus
// asignaturas, tareas y playlists se quedan en el id antiguo: la cuenta nace
// vacía. Esto lo resuelve a mano y a la vista:
//
//   1. «Exportar mis datos» en el perfil de origen → un archivo .json;
//   2. «Importar datos» en la cuenta de destino → ese archivo.
//
// El archivo lleva el estado (asignaturas, tareas, sesiones, hábitos, playlists,
// horario…), las portadas e imágenes, los adjuntos de los recursos, el banco de
// Conocimiento y las fichas de las grabaciones. La música NO viaja: las
// canciones viven en el equipo, fuera de los perfiles, y por eso «ya estaban».
// ============================================================

export const TRANSFER_FORMAT = 1;

export interface TransferFile {
  app: 'Frame';
  format: number;
  exportedAt: string;
  appVersion: string;
  profile: { username: string; isGuest: boolean };
  data: LocalSnapshot;
  recordings: Recording[];
  images: Record<string, string>;
  /** Respaldo del banco de Conocimiento (JSON en texto), si tenía contenido. */
  knowledge: string | null;
}

export type ImportMode = 'merge' | 'replace';

const AVATAR_SLOT = '__profileAvatar__';

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** Ids de todo lo que puede tener una imagen o un archivo asociado. */
function imageKeysFor(data: LocalSnapshot): string[] {
  const ids = (key: string): string[] =>
    Array.isArray(data[key]) ? (data[key] as { id?: string }[]).map((row) => String(row?.id ?? '')).filter(Boolean) : [];
  const notes = [...(Array.isArray(data.notes) ? (data.notes as { id: string; kind?: string }[]) : []),
    ...(Array.isArray(data.archivedNotes) ? (data.archivedNotes as { id: string; kind?: string }[]) : [])];
  return [
    ...ids('courses').map((id) => `courseImage_${id}`),
    ...ids('spaces').map((id) => `spaceImage_${id}`),
    ...ids('playlists').map((id) => `playlistImage_${id}`),
    ...notes.filter((note) => note.kind === 'file').map((note) => `noteFile_${note.id}`),
    'scheduleImage',
  ];
}

export async function buildTransferFile(profile: UserProfile): Promise<TransferFile> {
  const uid = profile.id;
  const data = collectLocalData(uid);

  const images: Record<string, string> = {};
  for (const key of imageKeysFor(data)) {
    const value = await getImage(key).catch(() => null);
    if (value) images[key] = value;
  }
  const avatar = await getImage(`profileAvatar_${uid}`).catch(() => null);
  if (avatar) images[AVATAR_SLOT] = avatar;

  let knowledge: string | null = null;
  try {
    const raw = await exportKnowledge(uid);
    const parsed = JSON.parse(raw) as { categories?: unknown[]; studyItems?: unknown[] };
    if ((parsed.categories?.length ?? 0) > 0 || (parsed.studyItems?.length ?? 0) > 0) knowledge = raw;
  } catch {
    knowledge = null;
  }

  return {
    app: 'Frame',
    format: TRANSFER_FORMAT,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    profile: { username: profile.username, isGuest: profile.isGuest },
    data,
    recordings: readJson<Recording[]>(`recordings_${uid}`, []),
    images,
    knowledge,
  };
}

const isRecordList = (value: unknown): value is { id: string }[] =>
  Array.isArray(value) && value.every((row) => row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string');

/** Los registros heredan el id del perfil que los creó: se re-sellan al de destino. */
function restamp(value: unknown, uid: string): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row) => (row && typeof row === 'object' && 'uid' in row ? { ...(row as object), uid } : row));
}

export interface ImportResult {
  /** Registros añadidos o reemplazados, en total. */
  records: number;
  images: number;
  knowledge: boolean;
  recordings: number;
}

/**
 * Vuelca el archivo en el perfil `uid`.
 *   · 'merge'   → suma lo que falta y conserva lo que la cuenta ya tiene;
 *   · 'replace' → lo del archivo manda.
 * Devuelve qué se trajo. Quien llama debe recargar el estado vivo después.
 */
export async function importTransferFile(file: TransferFile, uid: string, mode: ImportMode): Promise<ImportResult> {
  const current = collectLocalData(uid);
  const next: LocalSnapshot = {};
  let records = 0;

  for (const [key, incomingRaw] of Object.entries(file.data)) {
    const incoming = restamp(incomingRaw, uid);
    const existing = current[key];

    if (mode === 'replace' || existing === undefined) {
      next[key] = incoming;
      if (Array.isArray(incoming)) records += incoming.length;
      continue;
    }
    if (isRecordList(incoming) && isRecordList(existing)) {
      const known = new Set(existing.map((row) => row.id));
      const fresh = incoming.filter((row) => !known.has(row.id));
      if (fresh.length > 0) {
        next[key] = [...existing, ...fresh];
        records += fresh.length;
      }
      continue;
    }
    // Valores sueltos (metas, preferencias…): en «combinar» gana lo que ya hay.
  }

  const applied = applyLocalData(uid, next);
  if (!applied.ok) {
    throw new Error('No hay espacio suficiente en el almacenamiento del equipo para traer todos los datos.');
  }

  // Imágenes y adjuntos: nunca se pisa una imagen que el destino ya tenga, salvo al reemplazar.
  let images = 0;
  const present = mode === 'merge' ? new Set((await getAllImages().catch(() => [])).map((entry) => entry.key)) : new Set<string>();
  for (const [key, dataUrl] of Object.entries(file.images)) {
    const target = key === AVATAR_SLOT ? `profileAvatar_${uid}` : key;
    if (present.has(target)) continue;
    try {
      await saveImage(target, dataUrl);
      images += 1;
    } catch {
      /* una imagen que no entra no debe frenar el resto */
    }
  }

  // Grabaciones: solo las fichas cuyo audio está en ESTE equipo (si no, serían tarjetas mudas).
  let recordings = 0;
  if (file.recordings.length > 0) {
    const key = `recordings_${uid}`;
    const mine = readJson<Recording[]>(key, []);
    const known = new Set(mine.map((row) => row.id));
    const audible: Recording[] = [];
    for (const recording of file.recordings) {
      if (known.has(recording.id)) continue;
      const audio = await getRecordingAudio(recording.id).catch(() => undefined);
      if (audio) audible.push(recording);
    }
    if (audible.length > 0) {
      localStorage.setItem(key, JSON.stringify([...mine, ...audible]));
      recordings = audible.length;
    }
  }

  // Conocimiento: su importación REEMPLAZA, así que en «combinar» solo entra si el destino está vacío.
  let knowledge = false;
  if (file.knowledge) {
    let targetEmpty = true;
    try {
      const mineRaw = JSON.parse(await exportKnowledge(uid)) as { categories?: unknown[]; studyItems?: unknown[] };
      targetEmpty = (mineRaw.categories?.length ?? 0) === 0 && (mineRaw.studyItems?.length ?? 0) === 0;
    } catch {
      targetEmpty = true;
    }
    if (mode === 'replace' || targetEmpty) {
      await importKnowledge(uid, file.knowledge);
      knowledge = true;
    }
  }

  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  return { records, images, knowledge, recordings };
}
