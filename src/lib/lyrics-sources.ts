import { invoke, isTauri } from '@tauri-apps/api/core';
import { APP_VERSION } from '@/lib/version';

// ============================================================
// Fuentes de letras sincronizadas.
//
// Cuatro servicios, en orden de fiabilidad:
//   1. LRCLIB (lrclib.net): base abierta de letras con tiempos.
//   2. YouTube Music: las letras con tiempos que licencia la plataforma.
//   3. NetEase Cloud Music y 4. Kugou: catálogos enormes de LRC.
//
// Ninguno es infalible: devuelven remixes, versiones «karaoke», la versión
// para televisión o la canción de otro artista con el mismo nombre. Por eso
// TODA candidata pasa el mismo control antes de aceptarse: título, artista y
// duración. Con más de ±4 s de diferencia los tiempos ya no casan con el
// audio del usuario, y una letra desfasada es peor que una sin tiempos.
// ============================================================

export interface LyricLine {
  /** Segundos desde el inicio. */
  time: number;
  text: string;
}

export type LyricsSource = 'lrclib' | 'youtube' | 'netease' | 'kugou';

export const SOURCE_LABEL: Record<LyricsSource, string> = {
  lrclib: 'LRCLIB',
  youtube: 'YouTube Music',
  netease: 'NetEase Cloud Music',
  kugou: 'Kugou',
};

export interface LyricsQuery {
  title: string;
  artist: string;
  album?: string;
  /** Segundos del audio que tiene el usuario; 0 si no se sabe. */
  duration: number;
  /** Vídeo de YouTube del que salió la canción, si se conoce. */
  videoId?: string;
}

export interface FoundLyrics {
  source: LyricsSource;
  synced: LyricLine[];
  plain: string;
  instrumental?: boolean;
}

/** Diferencia máxima de duración para dar por buenos los tiempos. */
const TOLERANCE = 4;

// ---------- Red ----------

interface HttpOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
}

/** Una búsqueda: sabe si algún servicio llegó a responder (con o sin letra). */
interface SearchContext {
  reached: boolean;
}

async function http(url: string, options: HttpOptions = {}): Promise<string> {
  const method = options.method ?? 'GET';
  if (isTauri()) {
    return invoke<string>('lyrics_request', {
      method,
      url,
      headers: options.headers ?? null,
      body: options.body ?? null,
    });
  }
  const response = await fetch(url, { method, headers: options.headers, body: options.body });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function json<T>(ctx: SearchContext, url: string, options?: HttpOptions): Promise<T | null> {
  try {
    const text = await http(url, options);
    ctx.reached = true;
    return JSON.parse(text) as T;
  } catch (error) {
    // Un «404» también es una respuesta: el servicio está, la letra no.
    if (/HTTP \d{3}/.test(String(error))) ctx.reached = true;
    return null;
  }
}

/** Recorre una respuesta JSON y junta todos los valores de una clave. */
function findAll(node: unknown, key: string, out: any[] = [], depth = 0): any[] {
  if (!node || typeof node !== 'object' || depth > 40) return out;
  if (Array.isArray(node)) {
    for (const item of node) findAll(item, key, out, depth + 1);
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === key) out.push(v);
    findAll(v, key, out, depth + 1);
  }
  return out;
}

const runsText = (node: any): string =>
  Array.isArray(node?.runs) ? node.runs.map((run: any) => run?.text ?? '').join('') : '';

/** «3:32» → 212. */
function parseClock(value: string): number {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return 0;
  return match[3]
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : Number(match[1]) * 60 + Number(match[2]);
}

function decodeBase64(value: string): string {
  try {
    const binary = atob(value);
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return '';
  }
}

// ---------- Texto ----------

/** Minúsculas, sin tildes ni signos: para comparar, nunca para mostrar. */
export function fold(value: string): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/['’`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Lo que adorna un título sin ser parte de él. */
const ADORNMENT =
  /\b(feat|ft|featuring|with|remaster(?:ed|izad[oa])?|version|versi[oó]n|live|en vivo|en directo|directo|edit|radio|mono|stereo|deluxe|bonus|official|oficial|video|v[ií]deo|videoclip|audio|lyrics?|letra|visuali[sz]er|hd|hq|4k|explicit|clean|from|ost|soundtrack|banda sonora|mv)\b/i;

/** Título legible sin adornos: «Hips Don't Lie (feat. Wyclef Jean)» → «Hips Don't Lie». */
export function cleanTitle(value: string): string {
  let result = (value ?? '').replace(/\.mp3$/i, '').trim();
  result = result.replace(/\s*[([{【［][^)\]}】］]*[)\]}】］]/g, (part) => (ADORNMENT.test(part) ? ' ' : part));
  result = result.replace(/\s+[-–—|]\s+[^-–—|]+$/, (part) => (ADORNMENT.test(part) ? '' : part));
  result = result.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i, '');
  return result.replace(/\s+/g, ' ').trim() || (value ?? '').trim();
}

const coreTitle = (value: string) => fold(cleanTitle(value));

const UNKNOWN_ARTIST = /^(artista desconocido|unknown artist|desconocido|various artists|varios artistas)$/i;

/** Nombre del canal de YouTube → artista: «ShakiraVEVO» → «Shakira». */
function tidyArtist(value: string): string {
  let result = (value ?? '').replace(/\s*-\s*topic$/i, '').trim();
  if (/vevo$/i.test(result)) result = result.replace(/vevo$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return UNKNOWN_ARTIST.test(result) ? '' : result;
}

/** «Bad Bunny, Chencho Corleone» → ['bad bunny', 'chencho corleone']. */
function artistNames(value: string): string[] {
  const tidy = tidyArtist(value);
  if (!tidy) return [];
  return tidy
    .split(/\s*(?:,|;|\/|&|\+|•|\s(?:feat\.?|ft\.?|featuring|with|con|x|y|and)\s)\s*/i)
    .map(fold)
    .filter(Boolean);
}

/** Primer artista, tal cual se escribe (para las búsquedas). */
export function firstArtist(value: string): string {
  const tidy = tidyArtist(value);
  return tidy.split(/\s*(?:,|;|\/|&|\s(?:feat\.?|ft\.?|featuring|x)\s)\s*/i)[0]?.trim() ?? '';
}

/** Versiones que solo valen si son justo la que se busca. */
const SUSPECT = /\b(karaoke|instrumental|cover|tribute|tributo|originally performed|in the style of|8d|sped up|slowed|nightcore|reverb|lofi|lo fi|tv size|tv version)\b/;

export function titleMatches(ours: string, theirs: string): boolean {
  const foldedOurs = fold(ours);
  const foldedTheirs = fold(theirs);
  if (SUSPECT.test(foldedTheirs) && !SUSPECT.test(foldedOurs)) return false;
  if (/\bremix\b/.test(foldedTheirs) !== /\bremix\b/.test(foldedOurs)) return false;

  const a = coreTitle(ours);
  const b = coreTitle(theirs);
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.includes(short) && short.length / long.length >= 0.5) return true;
  const tokensA = new Set(a.split(' '));
  const tokensB = new Set(b.split(' '));
  let shared = 0;
  for (const token of tokensA) if (tokensB.has(token)) shared += 1;
  return shared / Math.max(tokensA.size, tokensB.size) >= 0.7;
}

export function artistMatches(ours: string, theirs: string): boolean {
  const mine = artistNames(ours);
  if (mine.length === 0) return true; // sin artista: deciden el título y la duración
  const other = artistNames(theirs);
  if (other.length === 0) return false;
  const flat = (value: string) => value.replace(/\s+/g, '');
  const within = (a: string, b: string) => {
    const tokens = a.split(' ');
    const pool = new Set(b.split(' '));
    return tokens.length >= 2 && tokens.every((token) => pool.has(token));
  };
  return mine.some((a) =>
    other.some((b) => {
      const x = flat(a);
      const y = flat(b);
      return x === y || (x.length >= 3 && y.includes(x)) || (y.length >= 3 && x.includes(y)) || within(a, b) || within(b, a);
    })
  );
}

const durationOk = (ours: number, theirs: number) => !(ours > 0 && theirs > 0) || Math.abs(ours - theirs) <= TOLERANCE;

// ---------- LRC ----------

/** Créditos que algunos catálogos meten como si fueran versos. */
const CREDIT =
  /^\s*(作词|作詞|作曲|编曲|編曲|词|詞|曲|制作人|製作人|监制|監製|混音|母带|和声|和聲|吉他|贝斯|鼓|录音|錄音|出品|发行|發行|op|sp|lyricist|composer|arranger|producer|lyrics by|music by|written by|letra|m[uú]sica|compositor)\s*[:：]/i;
const PURE_MUSIC = /纯音乐|純音樂|请欣赏|請欣賞|没有填词/;

/** «[01:23.45] texto» → líneas con su segundo. Admite varias marcas por línea y [offset:]. */
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

/** Fuera la línea «Artista - Título» con que abren muchos LRC, y huecos repetidos. */
function tidyLines(lines: LyricLine[], q: LyricsQuery): LyricLine[] {
  const title = coreTitle(q.title);
  const names = artistNames(q.artist);
  const result: LyricLine[] = [];
  lines.forEach((line, index) => {
    const folded = fold(line.text);
    if (index < 4 && line.time < 25 && folded && title && folded.includes(title)) {
      if (folded === title || names.some((name) => folded.includes(name))) return;
    }
    const text = line.text === '♪' ? '' : line.text;
    const previous = result[result.length - 1];
    if (!text && previous && !previous.text) return;
    result.push({ time: Math.round(line.time * 100) / 100, text });
  });
  while (result.length && !result[result.length - 1].text) result.pop();
  return result;
}

/** ¿Sirve como letra sincronizada para este audio? */
function usable(lines: LyricLine[], q: LyricsQuery): LyricLine[] | null {
  const tidy = tidyLines(lines, q);
  const verses = tidy.filter((line) => line.text);
  if (verses.length < 4) return null;
  if (q.duration > 0 && verses[verses.length - 1].time > q.duration + 10) return null;
  return tidy;
}

const lrcToPlain = (lrc: string) =>
  lrc
    .split(/\r?\n/)
    .map((line) => line.replace(/\[[^\]]*\]/g, '').trim())
    .filter((line) => line && !CREDIT.test(line))
    .join('\n')
    .trim();

// ---------- 1. LRCLIB ----------

interface LrclibRow {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const LRCLIB_HEADERS = { 'User-Agent': `Frame ${APP_VERSION} (https://gasparrojasdiego.github.io/frame-app/)` };

function fromLrclib(row: LrclibRow | null, q: LyricsQuery): FoundLyrics | null {
  if (!row) return null;
  if (row.instrumental) return { source: 'lrclib', synced: [], plain: '', instrumental: true };
  const synced = row.syncedLyrics ? usable(parseLrc(row.syncedLyrics), q) : null;
  const plain = (row.plainLyrics ?? '').trim();
  if (synced) return { source: 'lrclib', synced, plain };
  return plain ? { source: 'lrclib', synced: [], plain } : null;
}

const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

async function lrclib(q: LyricsQuery, ctx: SearchContext): Promise<FoundLyrics | null> {
  const titles = unique([cleanTitle(q.title), q.title]);
  const artists = unique([firstArtist(q.artist), tidyArtist(q.artist)]);
  let plainOnly: FoundLyrics | null = null;

  // a) Coincidencia exacta: título + artista + duración (LRCLIB tolera ±2 s).
  if (q.duration > 0 && artists.length) {
    for (const artist of artists) {
      for (const title of titles) {
        const params = new URLSearchParams({ track_name: title, artist_name: artist, duration: String(Math.round(q.duration)) });
        const found = fromLrclib(await json<LrclibRow>(ctx, `https://lrclib.net/api/get?${params}`, { headers: LRCLIB_HEADERS }), q);
        if (found?.synced.length || found?.instrumental) return found;
        plainOnly ??= found;
      }
    }
  }

  // b) Búsqueda: de las candidatas que pasan el control, la de duración más parecida.
  const searches = [
    new URLSearchParams({ track_name: titles[0], ...(artists[0] ? { artist_name: artists[0] } : {}) }),
    new URLSearchParams({ q: `${titles[0]} ${artists[0] ?? ''}`.trim() }),
  ];
  for (const params of searches) {
    const rows = (await json<LrclibRow[]>(ctx, `https://lrclib.net/api/search?${params}`, { headers: LRCLIB_HEADERS })) ?? [];
    const candidates = (Array.isArray(rows) ? rows : [])
      .filter(
        (row) =>
          titleMatches(q.title, row.trackName ?? '') &&
          artistMatches(q.artist, row.artistName ?? '') &&
          durationOk(q.duration, row.duration ?? 0)
      )
      .sort((a, b) => {
        const syncedFirst = Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics));
        if (syncedFirst !== 0 || q.duration <= 0) return syncedFirst;
        return Math.abs((a.duration ?? 0) - q.duration) - Math.abs((b.duration ?? 0) - q.duration);
      });
    for (const row of candidates) {
      const found = fromLrclib(row, q);
      if (found?.synced.length) return found;
      plainOnly ??= found?.instrumental ? null : found;
    }
  }
  return plainOnly;
}

// ---------- 2. YouTube Music ----------

const YTM = 'https://music.youtube.com/youtubei/v1';
const WEB_REMIX = { clientName: 'WEB_REMIX', clientVersion: '1.20250915.03.00', hl: 'es', gl: 'PE' };
const ANDROID_MUSIC = { clientName: 'ANDROID_MUSIC', clientVersion: '7.21.50', androidSdkVersion: 30, hl: 'es', gl: 'PE' };
/** Filtro «Canciones» de la búsqueda: la pista de audio, no el videoclip. */
const SONGS_FILTER = 'EgWKAQIIAWoKEAoQCRADEAQQBRAJ';

const ytm = <T>(ctx: SearchContext, endpoint: string, client: typeof WEB_REMIX | typeof ANDROID_MUSIC, body: object) =>
  json<T>(ctx, `${YTM}/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://music.youtube.com',
      ...(client === ANDROID_MUSIC
        ? { 'User-Agent': 'com.google.android.apps.youtube.music/7.21.50 (Linux; U; Android 11) gzip' }
        : {}),
    },
    body: JSON.stringify({ context: { client }, ...body }),
  });

/** La letra de una pista: con tiempos (cliente Android) o, si no, el texto. */
async function ytmLyrics(ctx: SearchContext, videoId: string, q: LyricsQuery, timed: boolean): Promise<FoundLyrics | null> {
  const next = await ytm<any>(ctx, 'next', WEB_REMIX, { videoId, isAudioOnly: true });
  const tab = findAll(next, 'tabRenderer').find((t) => t?.endpoint?.browseEndpoint?.browseId?.startsWith('MPLYt'));
  const browseId: string | undefined = tab?.endpoint?.browseEndpoint?.browseId;
  if (!browseId) return null;

  if (timed) {
    const data = await ytm<any>(ctx, 'browse', ANDROID_MUSIC, { browseId });
    const rows = findAll(data, 'timedLyricsData')[0];
    if (Array.isArray(rows) && rows.length) {
      const lines = rows.map((row: any) => ({
        time: Number(row?.cueRange?.startTimeMilliseconds ?? 0) / 1000,
        text: String(row?.lyricLine ?? '').trim(),
      }));
      const synced = usable(lines, q);
      if (synced) return { source: 'youtube', synced, plain: lines.map((line) => line.text).filter((t) => t && t !== '♪').join('\n') };
    }
  }
  const data = await ytm<any>(ctx, 'browse', WEB_REMIX, { browseId });
  const plain = runsText(findAll(data, 'musicDescriptionShelfRenderer')[0]?.description).trim();
  return plain ? { source: 'youtube', synced: [], plain } : null;
}

async function youtubeMusic(q: LyricsQuery, ctx: SearchContext): Promise<FoundLyrics | null> {
  const query = `${cleanTitle(q.title)} ${firstArtist(q.artist)}`.trim();
  const search = await ytm<any>(ctx, 'search', WEB_REMIX, { query, params: SONGS_FILTER });
  const items = findAll(search, 'musicResponsiveListItemRenderer').slice(0, 6);
  let plainOnly: FoundLyrics | null = null;

  for (const item of items) {
    const columns = findAll(item, 'musicResponsiveListItemFlexColumnRenderer');
    const title = runsText(columns[0]?.text);
    const segments = columns
      .slice(1)
      .map((column: any) => runsText(column?.text))
      .join(' • ')
      .split('•')
      .map((segment: string) => segment.trim())
      .filter(Boolean);
    const length = segments.map(parseClock).find((seconds: number) => seconds > 0) ?? 0;
    const videoId: string | undefined = item?.playlistItemData?.videoId ?? findAll(item, 'videoId')[0];
    if (!videoId || !titleMatches(q.title, title)) continue;
    if (!segments.some((segment: string) => artistMatches(q.artist, segment))) continue;
    const aligned = durationOk(q.duration, length);
    const found = await ytmLyrics(ctx, videoId, q, aligned);
    if (found?.synced.length) return found;
    plainOnly ??= found;
    if (plainOnly) break;
  }

  // Sin resultado en la búsqueda: el vídeo del que salió la canción. Sus
  // tiempos solo valen si es la pista de audio (con un videoclip, la
  // introducción desplazaría toda la letra).
  if (!plainOnly && q.videoId) {
    const next = await ytm<any>(ctx, 'next', WEB_REMIX, { videoId: q.videoId, isAudioOnly: true });
    const types = findAll(next, 'musicVideoType');
    const isTrack = types[0] === 'MUSIC_VIDEO_TYPE_ATV';
    const found = await ytmLyrics(ctx, q.videoId, q, isTrack);
    if (found?.synced.length) return found;
    plainOnly = found;
  }
  return plainOnly;
}

// ---------- 3. NetEase Cloud Music ----------

interface NeteaseSong {
  id: number;
  name: string;
  artists?: { name: string }[];
  duration?: number;
}

const NETEASE_HEADERS = { Referer: 'https://music.163.com/' };

async function netease(q: LyricsQuery, ctx: SearchContext): Promise<FoundLyrics | null> {
  const params = new URLSearchParams({ s: `${cleanTitle(q.title)} ${firstArtist(q.artist)}`.trim(), type: '1', offset: '0', limit: '10' });
  const data = await json<{ result?: { songs?: NeteaseSong[] } }>(ctx, `https://music.163.com/api/search/get?${params}`, {
    headers: NETEASE_HEADERS,
  });
  const candidates = (data?.result?.songs ?? [])
    .map((song) => ({ ...song, seconds: (song.duration ?? 0) / 1000 }))
    .filter(
      (song) =>
        titleMatches(q.title, song.name) &&
        artistMatches(q.artist, (song.artists ?? []).map((artist) => artist.name).join(', ')) &&
        durationOk(q.duration, song.seconds)
    )
    .sort((a, b) => (q.duration > 0 ? Math.abs(a.seconds - q.duration) - Math.abs(b.seconds - q.duration) : 0))
    .slice(0, 3);

  let plainOnly: FoundLyrics | null = null;
  for (const song of candidates) {
    const lyric = await json<{ lrc?: { lyric?: string } }>(ctx, `https://music.163.com/api/song/lyric?id=${song.id}&lv=1&kv=1&tv=-1`, {
      headers: NETEASE_HEADERS,
    });
    const text = lyric?.lrc?.lyric ?? '';
    if (PURE_MUSIC.test(text)) return { source: 'netease', synced: [], plain: '', instrumental: true };
    const synced = usable(parseLrc(text), q);
    if (synced) return { source: 'netease', synced, plain: lrcToPlain(text) };
    const plain = lrcToPlain(text);
    if (plain && !plainOnly) plainOnly = { source: 'netease', synced: [], plain };
  }
  return plainOnly;
}

// ---------- 4. Kugou ----------

interface KugouCandidate {
  id: string;
  accesskey: string;
  song?: string;
  singer?: string;
  duration?: number;
}

async function kugou(q: LyricsQuery, ctx: SearchContext): Promise<FoundLyrics | null> {
  const params = new URLSearchParams({
    ver: '1',
    man: 'yes',
    client: 'pc',
    keyword: `${firstArtist(q.artist)} - ${cleanTitle(q.title)}`.replace(/^ - /, ''),
    duration: String(Math.round(Math.max(0, q.duration) * 1000)),
    hash: '',
  });
  const data = await json<{ candidates?: KugouCandidate[] }>(ctx, `https://lyrics.kugou.com/search?${params}`);
  const candidates = (data?.candidates ?? [])
    .filter(
      (c) =>
        titleMatches(q.title, c.song ?? '') &&
        artistMatches(q.artist, c.singer ?? '') &&
        durationOk(q.duration, (c.duration ?? 0) / 1000)
    )
    .slice(0, 3);

  for (const candidate of candidates) {
    const download = new URLSearchParams({
      ver: '1',
      client: 'pc',
      id: candidate.id,
      accesskey: candidate.accesskey,
      fmt: 'lrc',
      charset: 'utf8',
    });
    const file = await json<{ content?: string }>(ctx, `https://lyrics.kugou.com/download?${download}`);
    const lrc = decodeBase64(file?.content ?? '').replace(/^﻿/, '');
    if (PURE_MUSIC.test(lrc)) return { source: 'kugou', synced: [], plain: '', instrumental: true };
    const synced = usable(parseLrc(lrc), q);
    if (synced) return { source: 'kugou', synced, plain: lrcToPlain(lrc) };
  }
  return null;
}

// ---------- La cadena ----------

const PROVIDERS: { source: LyricsSource; find: (q: LyricsQuery, ctx: SearchContext) => Promise<FoundLyrics | null> }[] = [
  { source: 'lrclib', find: lrclib },
  { source: 'youtube', find: youtubeMusic },
  { source: 'netease', find: netease },
  { source: 'kugou', find: kugou },
];

export interface LyricsSearchResult {
  found: FoundLyrics | null;
  /** Algún servicio respondió. Si ninguno lo hizo, no hubo red: no es un «no hay letra». */
  reached: boolean;
}

/**
 * Recorre las fuentes hasta dar con una letra SINCRONIZADA que pase el
 * control. Si ninguna la tiene, se queda con la primera letra sin tiempos.
 * `skip` permite pedir «otra versión» saltándose la fuente que falló.
 */
export async function searchLyrics(q: LyricsQuery, skip: LyricsSource[] = []): Promise<LyricsSearchResult> {
  const ctx: SearchContext = { reached: false };
  let plainOnly: FoundLyrics | null = null;
  for (const provider of PROVIDERS) {
    if (skip.includes(provider.source)) continue;
    const found = await provider.find(q, ctx).catch(() => null);
    if (!found) continue;
    if (found.synced.length > 0 || found.instrumental) return { found, reached: true };
    if (!plainOnly && found.plain) plainOnly = found;
  }
  return { found: plainOnly, reached: ctx.reached };
}
