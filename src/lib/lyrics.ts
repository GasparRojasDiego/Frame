import { deleteImage, getImage, saveImage } from '@/lib/music-db';

// ============================================================
// Letras de las canciones: guardado, lectura y ajuste fino.
//
// Frame no busca letras en internet: cada canción trae la suya al importarla
// (etiqueta USLT del MP3 o un .lrc con el mismo nombre, ver music-import.ts)
// y queda guardada en el equipo, junto a la canción.
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
