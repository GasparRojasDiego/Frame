import { deleteImage, getImage, saveImage } from '@/lib/music-db';

// ============================================================
// Letras de las canciones: lectura, guardado y ajuste fino.
//
// 1.6.7 (Diego): Frame ya no busca ni descarga letras. Muestra la que el
// usuario trae con su canción: sus etiquetas (USLT o SYLT del MP3, LYRICS de
// FLAC y Ogg, ©lyr del M4A), un .lrc o un .txt con el mismo nombre al
// importar, o el archivo que añada después desde «Reproduciendo».
//
// Lo que versiones anteriores ya descargaron (letras con `source`) es del
// usuario y se conserva tal cual. Las marcas de «no encontrada» de aquella
// búsqueda no son letras: se leen como «sin letra», sin borrar nada.
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
  /** Solo en índices de exportaciones antiguas: «no hay letra». */
  missing: boolean;
  instrumental?: boolean;
  /** Ajuste fino del usuario, en segundos: positivo = la letra va más tarde. */
  offset?: number;
  /** De dónde la descargaron versiones anteriores (hasta la 1.6.6); se conserva. */
  source?: string;
}

const lyricsKey = (songId: string) => `lyrics_${songId}`;

/** Créditos que muchos LRC meten como si fueran versos («Letra: …»). */
const CREDIT =
  /^\s*(作词|作詞|作曲|编曲|編曲|词|詞|曲|制作人|製作人|监制|監製|混音|母带|和声|和聲|吉他|贝斯|鼓|录音|錄音|出品|发行|發行|op|sp|lyricist|composer|arranger|producer|lyrics by|music by|written by|letra|m[uú]sica|compositor)\s*[:：]/i;

/** Etiquetas de cabecera del formato LRC («[ar:Artista]», «[length:3:20]»…). */
const LRC_TAG_LINE = /^\s*\[(ar|ti|al|au|by|re|ve|tool|offset|length|la|#)\s*:[^\]]*\]\s*$/i;

/** Texto LRC («[01:23.45] verso») → líneas ordenadas por tiempo. */
export function parseLrc(lrc: string): LyricLine[] {
  const offsetTag = lrc.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
  const offset = offsetTag ? Number(offsetTag[1]) / 1000 : 0;
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n|\r/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if (stamps.length === 0) continue;
    const text = raw
      .replace(/\[[^\]]*\]/g, '')
      // LRC «mejorado»: tiempos palabra por palabra (<01:23.45>) que no se leen.
      .replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '')
      .replace(/\s+/g, ' ')
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

/** Letra sin tiempos, ordenada: sin cabeceras LRC ni más de una línea en blanco seguida. */
function tidyPlain(text: string): string {
  return text
    .split(/\r?\n|\r/)
    .filter((line) => !LRC_TAG_LINE.test(line))
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Letra a partir del texto de un archivo: con tiempos si es LRC. */
export function lyricsFromText(text: string | undefined): SongLyrics | null {
  if (!text?.trim()) return null;
  const synced = parseLrc(text);
  if (synced.length > 0) return { synced, plain: '', missing: false, offset: 0 };
  const plain = tidyPlain(text);
  return plain ? { synced: [], plain, missing: false, offset: 0 } : null;
}

/** Letra sincronizada que ya viene en líneas (SYLT del MP3). */
export function lyricsFromLines(lines: LyricLine[] | undefined): SongLyrics | null {
  const clean = (lines ?? [])
    .filter((line) => Number.isFinite(line.time) && line.time >= 0)
    .map((line) => ({ time: line.time, text: line.text.replace(/\s+/g, ' ').trim() }))
    .filter((line) => !CREDIT.test(line.text))
    .sort((a, b) => a.time - b.time);
  return clean.length > 0 ? { synced: clean, plain: '', missing: false, offset: 0 } : null;
}

/** La mejor de dos letras: con tiempos gana a sin tiempos; si empatan, la primera. */
export function betterLyrics(a: SongLyrics | null, b: SongLyrics | null): SongLyrics | null {
  if (!a) return b;
  if (!b) return a;
  if (b.synced.length > 0 && a.synced.length === 0) return b;
  return a;
}

/** Letra guardada de una canción, o null si no tiene. */
export async function storedLyrics(songId: string): Promise<SongLyrics | null> {
  const raw = await getImage(lyricsKey(songId)).catch(() => null);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SongLyrics>;
    // Marca de «no encontrada» de la antigua búsqueda en internet: sin letra.
    if (value.missing) return null;
    const synced = Array.isArray(value.synced) ? value.synced : [];
    const plain = typeof value.plain === 'string' ? value.plain : '';
    if (synced.length === 0 && !plain.trim() && value.instrumental !== true) return null;
    return {
      synced,
      plain,
      missing: false,
      instrumental: value.instrumental === true,
      offset: typeof value.offset === 'number' ? value.offset : 0,
      ...(typeof value.source === 'string' ? { source: value.source } : {}),
    };
  } catch {
    return null;
  }
}

const save = (songId: string, value: SongLyrics) =>
  saveImage(lyricsKey(songId), JSON.stringify({ v: 4, ...value })).catch(() => undefined);

/**
 * Guarda la letra que trajo una canción (al importarla o después). Solo los
 * campos de la letra; un índice antiguo puede traer `source` y se conserva.
 */
export const importLyrics = (songId: string, lyrics: SongLyrics): Promise<void> =>
  save(songId, {
    synced: Array.isArray(lyrics.synced) ? lyrics.synced : [],
    plain: typeof lyrics.plain === 'string' ? lyrics.plain : '',
    missing: false,
    instrumental: lyrics.instrumental === true,
    offset: typeof lyrics.offset === 'number' ? lyrics.offset : 0,
    ...(typeof lyrics.source === 'string' ? { source: lyrics.source } : {}),
  });

/** Ajuste fino de los tiempos de una canción (se guarda con su letra). */
export async function setLyricsOffset(songId: string, offset: number): Promise<void> {
  const stored = await storedLyrics(songId);
  if (!stored) return;
  await save(songId, { ...stored, offset: Math.round(offset * 10) / 10 });
}

/** Canción eliminada (o letra quitada): su letra guardada se va con ella. */
export const forgetLyrics = (songId: string): Promise<void> => deleteImage(lyricsKey(songId)).catch(() => undefined);

/**
 * Lee un archivo de letra (.lrc o .txt) elegido por el usuario. Respeta la
 * marca de orden de bytes (UTF-8 o UTF-16) y, si el texto no es UTF-8 válido,
 * lo lee como Windows-1252: así los acentos de los .lrc antiguos no salen rotos.
 */
export function decodeTextFile(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

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
