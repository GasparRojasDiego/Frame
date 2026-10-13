import { invoke } from '@tauri-apps/api/core';
import { probeAudio } from '@/lib/audio-probe';
import { readAudioTags, type AudioTags } from '@/lib/audio-tags';
import { shrinkCover } from '@/lib/cover-shrink';
import {
  betterLyrics,
  decodeTextFile,
  importLyrics,
  lyricsFromLines,
  lyricsFromText,
  type SongLyrics,
} from '@/lib/lyrics';
import { addSongFileToDB } from '@/lib/music-db';
import { foldName, resolveSongName } from '@/lib/song-names';
import type { Song } from '@/types';
import { decimalText, tr } from '@/lib/i18n';
import { UNKNOWN_ARTIST } from '@/lib/enum-labels';

// ============================================================
// «Importar» (Música): canciones o carpetas que el usuario ya tiene.
//
// 1.6.7 (Diego): Frame no descarga nada —ni canciones, ni portadas, ni
// letras—; reproduce, y muy bien, los archivos del usuario. Por eso aquí se
// pone todo el cuidado:
//   · Formatos: MP3, M4A, AAC, OGG, Opus, FLAC, WAV y WebM, reconocidos por
//     su contenido (audio-tags.ts). Lo que no puede sonar en Frame (WMA,
//     AIFF, ALAC…, o un archivo dañado) no entra y se dice por qué.
//   · Nombres: etiquetas limpias o, si faltan o son basura, el nombre del
//     archivo leído con cabeza (song-names.ts), ayudado por los artistas que
//     ya hay en la biblioteca.
//   · Portada: la incrustada; si no, una imagen con el mismo nombre que la
//     canción; si no, la de su carpeta («cover», «folder», «front»…).
//   · Letra: un .lrc con el mismo nombre, la sincronizada de las etiquetas,
//     la de texto de las etiquetas o un .txt con el mismo nombre; con tiempos
//     gana a sin tiempos. Los textos se leen en UTF-8, UTF-16 o Windows-1252.
//   · Duración real de cada canción (para los totales de las playlists).
//   · Sin duplicados: ni por nombre de archivo ni por ser la misma canción
//     (título, artista y duración) con otro nombre.
//
// Una carpeta creada por «Exportar música» de versiones anteriores de Frame
// trae su índice (frame-musica.json): de él salen el orden, los nombres, las
// favoritas, las letras y las playlists.
//
// Cada audio se COPIA dentro de Frame: la biblioteca sigue funcionando
// aunque después se borre o se mueva la carpeta original.
// ============================================================

interface PickedFile {
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

const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|oga|opus|flac|wav|webm|weba)$/i;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|bmp)$/i;
const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  wav: 'audio/wav',
  webm: 'audio/webm',
  weba: 'audio/webm',
};
/** Audio que el motor de Frame no reproduce, por su extensión. */
const UNSUPPORTED_FORMATS: Record<string, string> = {
  wma: 'WMA',
  aif: 'AIFF',
  aiff: 'AIFF',
  aifc: 'AIFF',
  ape: 'APE',
  wv: 'WavPack',
  tta: 'TTA',
  dsf: 'DSD',
  dff: 'DSD',
  amr: 'AMR',
  ac3: 'AC-3',
  dts: 'DTS',
  mka: 'MKA',
  mid: 'MIDI',
  midi: 'MIDI',
};
/**
 * Imágenes que valen como portada de toda una carpeta, de la más fiable a la
 * menos (las de Windows Media Player incluidas).
 */
const FOLDER_COVERS = [
  /^cover$/i,
  /^folder$/i,
  /^front$/i,
  /^(portada|car[aá]tula)$/i,
  /^album$/i,
  /^albumart(?:_\{.+\}_large|large)?$/i,
  /^albumart(?:_\{.+\}_small|small)$/i,
];
/** El «001 - » con que numeraba sus archivos «Exportar música». */
const EXPORT_NUMBER_PREFIX = /^\s*\d{2,4}\s+-\s+/;
/** Por encima, la canción no se lee entera de una vez y no se importa. */
const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;

const extensionOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
const baseName = (name: string) => name.replace(/\.[a-z0-9]+$/i, '');
const dirName = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const joinPath = (dir: string, path: string) => (dir ? `${dir}/${path}` : path);
const withoutExportNumber = (name: string) => name.replace(EXPORT_NUMBER_PREFIX, '').trim() || name;
const sameFileKey = (file: PickedFile) => joinPath(dirName(file.rel), baseName(file.name)).toLowerCase();

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
  decodeTextFile(new Uint8Array(await readBytes(file, 8 * 1024 * 1024)));

async function imageFileDataUrl(file: PickedFile): Promise<string> {
  if (file.size > 12 * 1024 * 1024) return '';
  const ext = extensionOf(file.name);
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'bmp' ? 'image/bmp' : 'image/jpeg';
  const blob = new Blob([await readBytes(file)], { type: mime });
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
  return dataUrl ? shrinkCover(dataUrl) : '';
}

// ------------------------------------------------------------
// Plan: qué entra, sin tocar todavía la biblioteca
// ------------------------------------------------------------

interface ImportEntry {
  song: Song;
  audio: PickedFile;
  ext: string;
  /** Letra del índice de una exportación. */
  lyrics: SongLyrics | null;
  lrc?: PickedFile;
  txt?: PickedFile;
  /** Imagen con el mismo nombre que la canción. */
  cover?: PickedFile;
  /** Portada de su carpeta. */
  folderCover?: PickedFile;
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
  /** Audios en formatos que Frame no reproduce: se quedan fuera. */
  unsupported: { name: string; format: string }[];
  /** Canciones que traen su letra en un archivo aparte (.lrc o .txt). */
  lyricFiles: number;
}

/** La mejor portada de cada carpeta, por su nombre o por ser la única imagen. */
function folderCovers(files: PickedFile[], audioKeys: Set<string>): Map<string, PickedFile> {
  const best = new Map<string, { file: PickedFile; rank: number }>();
  const loose = new Map<string, PickedFile[]>();
  for (const file of files) {
    if (!IMAGE_EXTENSIONS.test(file.name)) continue;
    const dir = dirName(file.rel);
    const rank = FOLDER_COVERS.findIndex((pattern) => pattern.test(baseName(file.name)));
    if (rank >= 0) {
      const current = best.get(dir);
      if (!current || rank < current.rank) best.set(dir, { file, rank });
    } else if (!audioKeys.has(sameFileKey(file))) {
      // Ni se llama «cover» ni es la portada de una canción concreta.
      loose.set(dir, [...(loose.get(dir) ?? []), file]);
    }
  }
  const result = new Map<string, PickedFile>();
  for (const [dir, { file }] of best) result.set(dir, file);
  // Una carpeta con una sola imagen suelta: casi siempre, la del álbum.
  for (const [dir, images] of loose) if (!result.has(dir) && images.length === 1) result.set(dir, images[0]);
  return result;
}

export async function planMusicImport(source: PickedSource, library: Song[]): Promise<MusicImportPlan> {
  const byRel = new Map(source.files.map((file) => [file.rel, file]));
  const byName = new Map<string, PickedFile>();
  for (const file of source.files) if (!byName.has(file.name)) byName.set(file.name, file);
  const byId = new Map(library.map((song) => [song.id, song]));
  const byFileName = new Map<string, Song>();
  for (const song of library) byFileName.set(song.fileName.toLowerCase(), song);

  const plan: MusicImportPlan = {
    source,
    fromManifest: false,
    entries: [],
    existing: new Map(),
    playlists: [],
    bytes: 0,
    unsupported: [],
    lyricFiles: 0,
  };

  for (const file of source.files) {
    const format = UNSUPPORTED_FORMATS[extensionOf(file.name)];
    if (format) plan.unsupported.push({ name: file.name, format });
  }

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

  // Compañeros de cada audio: .lrc, .txt e imagen con su mismo nombre.
  const lrcByKey = new Map<string, PickedFile>();
  const txtByKey = new Map<string, PickedFile>();
  const coverByKey = new Map<string, PickedFile>();
  const coverByBase = new Map<string, PickedFile>();
  for (const file of source.files) {
    if (/\.lrc$/i.test(file.name)) lrcByKey.set(sameFileKey(file), file);
    else if (/\.txt$/i.test(file.name)) txtByKey.set(sameFileKey(file), file);
    else if (IMAGE_EXTENSIONS.test(file.name)) {
      coverByKey.set(sameFileKey(file), file);
      if (!coverByBase.has(baseName(file.name).toLowerCase())) coverByBase.set(baseName(file.name).toLowerCase(), file);
    }
  }
  const audioKeys = new Set(source.files.filter((file) => AUDIO_EXTENSIONS.test(file.name)).map(sameFileKey));
  const coverOfFolder = folderCovers(source.files, audioKeys);
  const companions = (audio: PickedFile) => {
    const key = sameFileKey(audio);
    return {
      lrc: lrcByKey.get(key),
      txt: txtByKey.get(key),
      cover: coverByKey.get(key) ?? coverByBase.get(baseName(audio.name).toLowerCase()),
      folderCover: coverOfFolder.get(dirName(audio.rel)),
    };
  };

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
      const near = companions(audio);
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
        lrc: near.lrc,
        cover: entry.cover ? byRel.get(joinPath(base, entry.cover)) : near.cover,
        folderCover: near.folderCover,
        readTags: false,
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
  // etiquetas, su letra y su portada.
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
    const near = companions(audio);
    plan.entries.push({
      song: {
        id: crypto.randomUUID(),
        title: baseName(cleanName),
        artist: UNKNOWN_ARTIST,
        album: '',
        picture: '',
        fileName: cleanName,
      },
      audio,
      ext: extensionOf(audio.name),
      lyrics: null,
      ...near,
      readTags: true,
    });
    plan.bytes += Math.max(0, audio.size);
  }
  plan.lyricFiles = plan.entries.filter((entry) => entry.lrc || entry.txt).length;
  return plan;
}

// ------------------------------------------------------------
// Importación
// ------------------------------------------------------------

export interface ImportOutcome {
  imported: number;
  lyrics: number;
  covers: number;
  cancelled: boolean;
  /** Lo que no entró y por qué. */
  skipped: { name: string; reason: string }[];
  /** Se paró antes de tiempo por algo del equipo (p. ej., sin espacio). */
  stoppedFor?: string;
}

/** Clave de «es la misma canción»: título, artista y duración al segundo. */
const sameSongKey = (song: Pick<Song, 'title' | 'artist' | 'duration'>) =>
  song.duration && song.duration > 0
    ? `${foldName(song.title)}|${foldName(song.artist)}|${Math.round(song.duration)}`
    : null;

const isQuotaError = (error: unknown) =>
  error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

/**
 * Copia cada canción nueva dentro de Frame. Entran por tandas (`onBatch`)
 * para que aparezcan en la biblioteca sobre la marcha: si la app se cierra a
 * mitad, lo importado hasta ahí se queda y al repetir solo entra lo que falta.
 */
export async function storeImportedSongs(
  plan: MusicImportPlan,
  library: Song[],
  onProgress: (done: number, total: number, title: string) => void,
  onBatch: (songs: Song[]) => Promise<void>,
  shouldStop: () => boolean
): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { imported: 0, lyrics: 0, covers: 0, cancelled: false, skipped: [] };
  let batch: Song[] = [];
  const flush = async () => {
    if (batch.length === 0) return;
    const ready = batch;
    batch = [];
    await onBatch(ready);
  };

  // Lo que ya se sabe de la biblioteca: artistas (para leer nombres de archivo)
  // y canciones con duración (para no duplicar la misma con otro nombre).
  const knownArtists = new Set(
    library.map((song) => song.artist).filter((artist) => artist && artist !== UNKNOWN_ARTIST).map(foldName)
  );
  const seenSongs = new Set(library.map(sameSongKey).filter((key): key is string => !!key));
  // Varias canciones comparten la portada de su carpeta: se lee una vez.
  const folderCoverCache = new Map<string, Promise<string>>();
  const folderCover = (file: PickedFile) => {
    let pending = folderCoverCache.get(file.path);
    if (!pending) {
      pending = imageFileDataUrl(file).catch(() => '');
      folderCoverCache.set(file.path, pending);
    }
    return pending;
  };

  for (let i = 0; i < plan.entries.length; i++) {
    if (shouldStop()) {
      outcome.cancelled = true;
      break;
    }
    const entry = plan.entries[i];
    const song: Song = { ...entry.song };
    const label = baseName(song.fileName);
    onProgress(i, plan.entries.length, song.title || label);

    if (entry.audio.size === 0) {
      outcome.skipped.push({ name: label, reason: tr('el archivo está vacío') });
      continue;
    }
    if (entry.audio.size > MAX_AUDIO_BYTES) {
      outcome.skipped.push({ name: label, reason: tr('pesa más de 1 GB') });
      continue;
    }

    let file: File;
    try {
      file = new File([await readBytes(entry.audio)], song.fileName, { type: AUDIO_MIME[entry.ext] ?? 'audio/mpeg' });
    } catch {
      outcome.skipped.push({ name: label, reason: tr('ya no está donde estaba o no se pudo abrir') });
      continue;
    }

    const tags: AudioTags = await readAudioTags(file).catch(() => ({}));
    if (tags.unsupported) {
      outcome.skipped.push({ name: label, reason: tr('formato {unsupported}, que Frame no reproduce', { unsupported: tags.unsupported }) });
      continue;
    }
    const probe = await probeAudio(file);
    if (!probe.playable) {
      outcome.skipped.push({ name: label, reason: tr('no suena: archivo dañado o formato no compatible') });
      continue;
    }
    const duration = probe.duration ?? tags.duration;
    if (duration) song.duration = Math.round(duration * 100) / 100;

    if (entry.readTags) {
      const name = resolveSongName({
        fileName: song.fileName,
        tagTitle: tags.title,
        tagArtist: tags.artist,
        tagAlbumArtist: tags.albumArtist,
        knownArtists,
      });
      song.title = name.title;
      song.artist = name.artist ?? UNKNOWN_ARTIST;
      song.album = tags.album ?? song.album;
      if (name.artist) knownArtists.add(foldName(name.artist));
    }

    const key = sameSongKey(song);
    if (key && seenSongs.has(key)) {
      outcome.skipped.push({ name: label, reason: tr('ya está en tu biblioteca con otro nombre de archivo') });
      continue;
    }

    // Portada: la incrustada, la de su mismo nombre o la de su carpeta.
    if (!song.picture && tags.picture) song.picture = await shrinkCover(tags.picture);
    if (!song.picture && entry.cover) song.picture = await imageFileDataUrl(entry.cover).catch(() => '');
    if (!song.picture && entry.folderCover) song.picture = await folderCover(entry.folderCover);

    // Letra: con tiempos gana a sin tiempos; a igualdad, la primera de la lista.
    const fromLrc = entry.lrc ? lyricsFromText(await readText(entry.lrc).catch(() => '')) : null;
    const fromTxt = entry.txt ? lyricsFromText(await readText(entry.txt).catch(() => '')) : null;
    const lyrics = [fromLrc, lyricsFromLines(tags.syncedLyrics), lyricsFromText(tags.lyrics), entry.lyrics, fromTxt].reduce<
      SongLyrics | null
    >((best, next) => betterLyrics(best, next), null);

    try {
      // Primero el audio: una canción en la lista sin archivo detrás es una
      // que aparece y no suena.
      await addSongFileToDB(song.id, file);
    } catch (error) {
      if (isQuotaError(error)) {
        outcome.stoppedFor = tr('el disco del equipo se quedó sin espacio');
        break;
      }
      outcome.skipped.push({ name: label, reason: tr('no se pudo guardar dentro de Frame') });
      continue;
    }
    batch.push(song);
    if (key) seenSongs.add(key);
    outcome.imported++;
    if (song.picture) outcome.covers++;
    if (lyrics) {
      await importLyrics(song.id, lyrics).catch(() => undefined);
      outcome.lyrics++;
    }
    if (batch.length >= 15) await flush();
  }
  await flush();
  onProgress(plan.entries.length, plan.entries.length, '');
  return outcome;
}

export function formatBytes(value: number): string {
  if (value >= 1024 ** 3) return `${decimalText(value / 1024 ** 3)} GB`;
  if (value >= 1024 ** 2) return `${Math.round(value / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}
