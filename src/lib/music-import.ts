import { invoke } from '@tauri-apps/api/core';
import { guessFromFileName, readAudioTags } from '@/lib/id3';
import { importLyrics, lyricsFromText, type SongLyrics } from '@/lib/lyrics';
import { addSongFileToDB } from '@/lib/music-db';
import type { Song } from '@/types';

// ============================================================
// «Importar» (Música): canciones o carpetas que el usuario ya tiene.
//
// Se elige con el explorador de archivos de Windows (comando `music_pick`):
// canciones sueltas —con sus .lrc, si las tiene— o una carpeta entera, con
// subcarpetas. De cada audio salen el título, el artista, el álbum, la
// portada y la letra de sus etiquetas ID3; si hay un .lrc con el mismo nombre
// o una imagen con el mismo nombre, también se usan.
//
// Una carpeta creada por «Exportar música» de versiones anteriores de Frame
// trae su índice (frame-musica.json): de él salen el orden, los nombres, las
// favoritas, las letras y las playlists.
//
// Cada audio se COPIA dentro de Frame: la biblioteca sigue funcionando
// aunque después se borre o se mueva la carpeta original.
// ============================================================

export interface PickedFile {
  path: string;
  /** Ruta relativa dentro de lo elegido («Portadas/x.jpg»). */
  rel: string;
  name: string;
  size: number;
}

export interface PickedSource {
  kind: 'folder' | 'files';
  name: string;
  files: PickedFile[];
}

/** Índice de una carpeta exportada por Frame (versiones hasta la 1.6.0). */
const EXPORT_MANIFEST = 'frame-musica.json';

interface ManifestSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  isFavorite: boolean;
  order: number;
  file: string;
  originalFileName: string;
  cover: string | null;
  lyrics: SongLyrics | null;
  picture?: string;
}

interface Manifest {
  app: 'Frame';
  kind: 'music';
  songs: ManifestSong[];
  playlists?: { name: string; songIds: string[] }[];
}

const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|opus|flac|wav|webm|weba)$/i;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  wav: 'audio/wav',
  webm: 'audio/webm',
  weba: 'audio/webm',
};
/** El «001 - » con que numeraba sus archivos «Exportar música». */
const EXPORT_NUMBER_PREFIX = /^\s*\d{2,4}\s+-\s+/;

const extensionOf = (name: string) => AUDIO_EXTENSIONS.exec(name)?.[1]?.toLowerCase() ?? 'mp3';
const baseName = (name: string) => name.replace(/\.[a-z0-9]+$/i, '');
const dirName = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const joinPath = (dir: string, path: string) => (dir ? `${dir}/${path}` : path);
const withoutExportNumber = (name: string) => name.replace(EXPORT_NUMBER_PREFIX, '').trim() || name;

// ------------------------------------------------------------
// Explorador y lectura
// ------------------------------------------------------------

/** Abre el explorador. null si se canceló. */
export const pickMusic = (folder: boolean): Promise<PickedSource | null> =>
  invoke<PickedSource | null>('music_pick', { folder });

/** Al terminar, lo elegido deja de poder leerse. */
export const releasePickedMusic = (): Promise<void> => invoke<void>('music_pick_release').catch(() => undefined);

const readBytes = async (file: PickedFile, max?: number): Promise<ArrayBuffer> =>
  invoke<ArrayBuffer>('music_read', { path: file.path, max: max ?? null });

const readText = async (file: PickedFile): Promise<string> =>
  new TextDecoder('utf-8').decode(await readBytes(file, 8 * 1024 * 1024));

async function coverDataUrl(file: PickedFile): Promise<string> {
  if (file.size > 6 * 1024 * 1024) return '';
  const ext = IMAGE_EXTENSIONS.exec(file.name)?.[1]?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const blob = new Blob([await readBytes(file)], { type: mime });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

// ------------------------------------------------------------
// Plan: qué entra, sin tocar todavía la biblioteca
// ------------------------------------------------------------

interface ImportEntry {
  song: Song;
  audio: PickedFile;
  ext: string;
  lyrics: SongLyrics | null;
  lrc?: PickedFile;
  cover?: PickedFile;
  /** Sin índice: título, artista, portada y letra salen de las etiquetas. */
  readTags: boolean;
}

export interface MusicImportPlan {
  source: PickedSource;
  fromManifest: boolean;
  entries: ImportEntry[];
  /** Canciones que ya estaban (id de origen → id en Frame). */
  existing: Map<string, string>;
  playlists: { name: string; songIds: string[] }[];
  /** Bytes de audio que se van a copiar. */
  bytes: number;
}

export async function planMusicImport(source: PickedSource, library: Song[]): Promise<MusicImportPlan> {
  const byRel = new Map(source.files.map((file) => [file.rel, file]));
  const byName = new Map<string, PickedFile>();
  for (const file of source.files) if (!byName.has(file.name)) byName.set(file.name, file);
  const byId = new Map(library.map((song) => [song.id, song]));
  const byFileName = new Map<string, Song>();
  for (const song of library) byFileName.set(song.fileName.toLowerCase(), song);

  const plan: MusicImportPlan = { source, fromManifest: false, entries: [], existing: new Map(), playlists: [], bytes: 0 };

  // El índice más cercano a la raíz de lo elegido.
  const manifestFile = source.files
    .filter((file) => file.name === EXPORT_MANIFEST)
    .sort((a, b) => a.rel.split('/').length - b.rel.split('/').length)[0];
  let manifest: Manifest | null = null;
  if (manifestFile) {
    try {
      const parsed = JSON.parse(await readText(manifestFile)) as Manifest;
      if (parsed?.app === 'Frame' && parsed.kind === 'music' && Array.isArray(parsed.songs)) manifest = parsed;
    } catch {
      manifest = null;
    }
  }

  /** Audios ya cubiertos por el índice: el resto entra por sus etiquetas. */
  const covered = new Set<string>();
  const taken = new Set<string>();
  if (manifest && manifestFile) {
    plan.fromManifest = true;
    const base = dirName(manifestFile.rel);
    for (const entry of [...manifest.songs].sort((a, b) => a.order - b.order)) {
      const cleanName = withoutExportNumber(entry.originalFileName || entry.file.split('/').pop() || entry.title);
      const already = byId.get(entry.id) ?? byFileName.get(cleanName.toLowerCase());
      if (already) {
        plan.existing.set(entry.id, already.id);
        continue;
      }
      const audio = byRel.get(joinPath(base, entry.file)) ?? byName.get(entry.file.split('/').pop() ?? entry.file);
      if (audio) covered.add(audio.rel);
      if (!audio || taken.has(cleanName.toLowerCase())) continue;
      taken.add(cleanName.toLowerCase());
      plan.entries.push({
        song: {
          id: entry.id,
          title: entry.title,
          artist: entry.artist,
          album: entry.album,
          picture: entry.picture ?? '',
          fileName: cleanName,
          isFavorite: entry.isFavorite || undefined,
        },
        audio,
        ext: extensionOf(audio.name),
        lyrics: entry.lyrics && !entry.lyrics.missing ? entry.lyrics : null,
        cover: entry.cover ? byRel.get(joinPath(base, entry.cover)) : undefined,
        readTags: !entry.picture && !entry.cover,
      });
      plan.bytes += Math.max(0, audio.size);
    }
    const known = new Set([...plan.entries.map((e) => e.song.id), ...plan.existing.keys()]);
    plan.playlists = (manifest.playlists ?? [])
      .map((playlist) => ({
        name: playlist.name,
        songIds: playlist.songIds.filter((id) => known.has(id)).map((id) => plan.existing.get(id) ?? id),
      }))
      .filter((playlist) => playlist.name.trim() && playlist.songIds.length > 0);
  }

  // Lo que no está en un índice (o todo, si no lo hay): cada audio con sus
  // etiquetas, su .lrc y su portada.
  const lrcByKey = new Map<string, PickedFile>();
  const coverByBase = new Map<string, PickedFile>();
  for (const file of source.files) {
    if (/\.lrc$/i.test(file.name)) lrcByKey.set(joinPath(dirName(file.rel), baseName(file.name)).toLowerCase(), file);
    else if (IMAGE_EXTENSIONS.test(file.name)) coverByBase.set(baseName(file.name).toLowerCase(), file);
  }
  const audioFiles = source.files
    .filter((file) => AUDIO_EXTENSIONS.test(file.name) && !covered.has(file.rel))
    .sort((a, b) => a.rel.localeCompare(b.rel, 'es', { numeric: true, sensitivity: 'base' }));
  for (const audio of audioFiles) {
    const cleanName = withoutExportNumber(audio.name);
    const known = byFileName.get(audio.name.toLowerCase()) ?? byFileName.get(cleanName.toLowerCase());
    if (known) {
      plan.existing.set(audio.rel, known.id);
      continue;
    }
    if (taken.has(cleanName.toLowerCase())) continue;
    taken.add(cleanName.toLowerCase());
    const guess = guessFromFileName(cleanName);
    plan.entries.push({
      song: {
        id: crypto.randomUUID(),
        title: guess.title,
        artist: guess.artist || 'Desconocido',
        album: '',
        picture: '',
        fileName: cleanName,
      },
      audio,
      ext: extensionOf(audio.name),
      lyrics: null,
      lrc: lrcByKey.get(joinPath(dirName(audio.rel), baseName(audio.name)).toLowerCase()),
      cover: coverByBase.get(baseName(audio.name).toLowerCase()),
      readTags: true,
    });
    plan.bytes += Math.max(0, audio.size);
  }
  return plan;
}

// ------------------------------------------------------------
// Importación
// ------------------------------------------------------------

export interface ImportOutcome {
  imported: number;
  failed: string[];
  lyrics: number;
  cancelled: boolean;
}

/**
 * Copia cada canción nueva dentro de Frame. Entran por tandas (`onBatch`)
 * para que aparezcan en la biblioteca sobre la marcha: si la app se cierra a
 * mitad, lo importado hasta ahí se queda y al repetir solo entra lo que falta.
 */
export async function storeImportedSongs(
  plan: MusicImportPlan,
  onProgress: (done: number, total: number, title: string) => void,
  onBatch: (songs: Song[]) => Promise<void>,
  shouldStop: () => boolean
): Promise<ImportOutcome> {
  const failed: string[] = [];
  let imported = 0;
  let lyricsCount = 0;
  let cancelled = false;
  let batch: Song[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const ready = batch;
    batch = [];
    await onBatch(ready);
  };

  for (let i = 0; i < plan.entries.length; i++) {
    if (shouldStop()) {
      cancelled = true;
      break;
    }
    const entry = plan.entries[i];
    const song: Song = { ...entry.song };
    onProgress(i, plan.entries.length, song.title);
    try {
      const file = new File([await readBytes(entry.audio)], song.fileName, {
        type: AUDIO_MIME[entry.ext] ?? 'audio/mpeg',
      });
      let lyrics = entry.lyrics;
      if (entry.readTags) {
        const tags = await readAudioTags(file).catch(() => null);
        if (tags) {
          song.title = tags.title || song.title;
          song.artist = tags.artist || song.artist;
          song.album = tags.album || song.album;
          if (!song.picture && tags.picture) song.picture = tags.picture;
          if (!lyrics && tags.lyrics) lyrics = lyricsFromText(tags.lyrics);
        }
      }
      if (entry.lrc) {
        const fromLrc = lyricsFromText(await readText(entry.lrc).catch(() => ''));
        if (fromLrc && (!lyrics || (fromLrc.synced.length > 0 && lyrics.synced.length === 0))) lyrics = fromLrc;
      }
      if (!song.picture && entry.cover) song.picture = await coverDataUrl(entry.cover).catch(() => '');

      // Primero el audio: una canción en la lista sin archivo detrás es una
      // que aparece y no suena.
      await addSongFileToDB(song.id, file);
      batch.push(song);
      imported++;
      if (lyrics) {
        await importLyrics(song.id, lyrics).catch(() => undefined);
        lyricsCount++;
      }
      if (batch.length >= 15) await flush();
    } catch (error) {
      console.error('No se pudo importar', song.title, error);
      failed.push(song.title);
    }
  }
  await flush();
  onProgress(plan.entries.length, plan.entries.length, '');
  return { imported, failed, lyrics: lyricsCount, cancelled };
}

export function formatBytes(value: number): string {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
  if (value >= 1024 ** 2) return `${Math.round(value / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}
