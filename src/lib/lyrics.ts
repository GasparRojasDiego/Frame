import { deleteImage, getImage, saveImage } from '@/lib/music-db';
import { searchLyrics, type LyricsSource } from '@/lib/lyrics-sources';
import type { Song } from '@/types';

// ============================================================
// Letras de las canciones: guardado, lectura y ajuste fino.
//
// Cada canción puede traer la suya al importarla (etiqueta USLT del MP3 o un
// .lrc con el mismo nombre, ver music-import.ts). Si no trae ninguna, al abrir
// «Reproduciendo» Frame la reconoce en internet (LRCLIB, YouTube Music,
// NetEase y Kugou, ver lyrics-sources.ts; vuelve en la 1.6.4) y la guarda en
// el equipo: después se ve sin conexión. Lo que no se encontró se vuelve a
// intentar pasadas dos semanas.
// ============================================================

export interface LyricLine {
  /** Segundos desde el inicio. */
  time: number;
  text: string;
}

export interface SongLyrics {
  synced: LyricLine[];
  /** Letra sin tiempos, cuando es lo único que hay. */
  plain: string;
  /** No hay letra (instrumental o no encontrada). */
  missing: boolean;
  instrumental?: boolean;
  /** Ajuste fino del usuario, en segundos: positivo = la letra va más tarde. */
  offset?: number;
  /** De dónde salió, si se reconoció en internet. */
  source?: LyricsSource;
  /** Cuándo se buscó en internet por última vez (epoch ms). */
  checkedAt?: number;
}

const lyricsKey = (songId: string) => `lyrics_${songId}`;

/** Créditos que muchos LRC meten como si fueran versos («Letra: …»). */
const CREDIT =
  /^\s*(作词|作詞|作曲|编曲|編曲|词|詞|曲|制作人|製作人|监制|監製|混音|母带|和声|和聲|吉他|贝斯|鼓|录音|錄音|出品|发行|發行|op|sp|lyricist|composer|arranger|producer|lyrics by|music by|written by|letra|m[uú]sica|compositor)\s*[:：]/i;

/** Texto LRC («[01:23.45] verso») → líneas ordenadas por tiempo. */
export function parseLrc(lrc: string): LyricLine[] {
  const offsetTag = lrc.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
  const offset = offsetTag ? Number(offsetTag[1]) / 1000 : 0;
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if (stamps.length === 0) continue;
    const text = raw
      .replace(/\[[^\]]*\]/g, '')
      .replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '')
      .trim();
    if (CREDIT.test(text)) continue;
    for (const stamp of stamps) {
      const fraction = stamp[3] ? Number(`0.${stamp[3]}`) : 0;
      const time = Number(stamp[1]) * 60 + Number(stamp[2]) + fraction - offset;
      lines.push({ time: Math.max(0, time), text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

/** Letra a partir del texto de un archivo: con tiempos si es LRC. */
export function lyricsFromText(text: string | undefined): SongLyrics | null {
  if (!text?.trim()) return null;
  const synced = parseLrc(text);
  if (synced.length > 0) return { synced, plain: '', missing: false, offset: 0 };
  return { synced: [], plain: text.trim(), missing: false, offset: 0 };
}

/** Letra guardada de una canción, o null si no tiene. */
export async function storedLyrics(songId: string): Promise<SongLyrics | null> {
  const raw = await getImage(lyricsKey(songId)).catch(() => null);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SongLyrics>;
    return {
      synced: Array.isArray(value.synced) ? value.synced : [],
      plain: typeof value.plain === 'string' ? value.plain : '',
      missing: Boolean(value.missing),
      instrumental: value.instrumental === true,
      offset: typeof value.offset === 'number' ? value.offset : 0,
      source: value.source,
      checkedAt: typeof value.checkedAt === 'number' ? value.checkedAt : 0,
    };
  } catch {
    return null;
  }
}

const save = (songId: string, value: SongLyrics) =>
  saveImage(lyricsKey(songId), JSON.stringify({ v: 3, ...value })).catch(() => undefined);

/** Guarda la letra que trajo una canción importada. */
export const importLyrics = (songId: string, lyrics: SongLyrics): Promise<void> =>
  save(songId, { ...lyrics, offset: lyrics.offset ?? 0 });

/** Ajuste fino de los tiempos de una canción (se guarda con su letra). */
export async function setLyricsOffset(songId: string, offset: number): Promise<void> {
  const stored = await storedLyrics(songId);
  if (!stored) return;
  await save(songId, { ...stored, offset: Math.round(offset * 10) / 10 });
}

const RETRY_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const inFlight = new Map<string, Promise<SongLyrics | null>>();

/**
 * La letra de una canción: la guardada o, si no hay, la que se reconozca en
 * internet (y se guarda). Una letra con tiempos nunca se cambia por una peor.
 * Nunca lanza: la letra es un extra.
 */
export function findLyrics(song: Song, durationSec: number): Promise<SongLyrics | null> {
  const pending = inFlight.get(song.id);
  if (pending) return pending;
  const task = (async (): Promise<SongLyrics | null> => {
    const stored = await storedLyrics(song.id);
    if (stored && !stored.missing && (stored.synced.length > 0 || stored.instrumental)) return stored;
    if (stored?.checkedAt && Date.now() - stored.checkedAt < RETRY_AFTER_MS) return stored;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return stored;
    try {
      const { found, reached } = await searchLyrics({
        title: song.title?.trim() || song.fileName || '',
        artist: song.artist ?? '',
        album: song.album,
        duration: durationSec > 0 ? durationSec : 0,
      });
      // Ningún servicio respondió: es la red, no la canción. No se guarda nada.
      if (!reached) return stored;
      if (!found || (found.synced.length === 0 && !found.plain && !found.instrumental)) {
        const kept: SongLyrics = stored?.plain
          ? { ...stored, checkedAt: Date.now() }
          : { synced: [], plain: '', missing: true, offset: 0, checkedAt: Date.now() };
        await save(song.id, kept);
        return kept;
      }
      // Ya había una letra sin tiempos y la de internet tampoco trae: se queda la propia.
      if (stored?.plain && found.synced.length === 0) {
        const kept = { ...stored, checkedAt: Date.now() };
        await save(song.id, kept);
        return kept;
      }
      const result: SongLyrics = {
        synced: found.synced,
        plain: found.plain,
        missing: false,
        instrumental: found.instrumental === true,
        source: found.source,
        offset: 0,
        checkedAt: Date.now(),
      };
      await save(song.id, result);
      return result;
    } catch {
      return stored;
    }
  })().finally(() => {
    if (inFlight.get(song.id) === task) inFlight.delete(song.id);
  });
  inFlight.set(song.id, task);
  return task;
}

/** Canción eliminada: su letra guardada se va con ella. */
export const forgetLyrics = (songId: string): Promise<void> => deleteImage(lyricsKey(songId)).catch(() => undefined);

/** Índice de la línea que suena en `seconds` (-1 antes de la primera). */
export function activeLineIndex(lines: LyricLine[], seconds: number): number {
  let low = 0;
  let high = lines.length - 1;
  let answer = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= seconds + 0.15) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return answer;
}
