// ============================================================
// Etiquetas de los archivos de audio del usuario.
//
// Al importar canciones propias, lo único que se sabe de ellas es lo que
// traigan dentro. Esto reconoce el formato por su CONTENIDO —la extensión
// puede mentir— y lee título, artista, artista del álbum, álbum, pista, año,
// carátula, letra (también la sincronizada) y duración:
//   · MP3 y AAC: ID3v2.2, 2.3 y 2.4 (desincronización, cabecera extendida,
//     marcos con longitud de datos, tamaños mal escritos), APEv2 e ID3v1.
//   · FLAC: STREAMINFO, comentarios Vorbis y bloque PICTURE.
//   · Ogg Vorbis y Opus: comentarios (y su carátula METADATA_BLOCK_PICTURE)
//     y duración por la última página.
//   · M4A: átomos de iTunes, duración (mvhd) y códec (stsd), aunque `moov`
//     vaya al final del archivo.
//   · WAV: LIST/INFO, etiqueta ID3 interna y duración por el bloque de datos.
//   · WebM: título, etiquetas, códec y duración (EBML).
// También reconoce lo que Frame no reproduce (WMA, AIFF, APE, WavPack, ALAC,
// AC-3…) para avisar en vez de importar una canción muda.
//
// Lee solo los trozos que necesita (una carátula de 5 MB no obliga a leer el
// audio entero) y nunca lanza: un archivo raro queda con su nombre.
// Sin dependencias: se prueba con `node scripts/probar-musica.ts`.
// ============================================================

export interface AudioTags {
  /** Formato reconocido por el contenido. */
  container?: 'mp3' | 'aac' | 'flac' | 'ogg' | 'mp4' | 'wav' | 'webm';
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  track?: number;
  year?: string;
  /** Carátula como data URI, lista para <img src>. */
  picture?: string;
  /** Letra en texto (puede venir en formato LRC, con tiempos). */
  lyrics?: string;
  /** Letra sincronizada que ya viene en líneas (SYLT). */
  syncedLyrics?: { time: number; text: string }[];
  /** Duración en segundos según el propio archivo. */
  duration?: number;
  /** Lo que lleva dentro no se reproduce en Frame («WMA», «ALAC (Apple Lossless)»…). */
  unsupported?: string;
}

type Bytes = Uint8Array;

/** Tope de una carátula incrustada. */
const MAX_PICTURE = 12 * 1024 * 1024;
/** Tope de un bloque de etiquetas (con carátulas dentro). */
const MAX_TAG = 32 * 1024 * 1024;

// ------------------------------------------------------------
// Lectura y bytes
// ------------------------------------------------------------

async function read(blob: Blob, start: number, end: number): Promise<Bytes> {
  const from = Math.max(0, Math.min(start, blob.size));
  const to = Math.max(from, Math.min(end, blob.size));
  return new Uint8Array(await blob.slice(from, to).arrayBuffer());
}

function ascii(b: Bytes, at: number, length: number): string {
  let out = '';
  for (let i = at; i < at + length && i < b.length; i++) out += String.fromCharCode(b[i]);
  return out;
}

const u16be = (b: Bytes, at: number) => ((b[at] << 8) | b[at + 1]) >>> 0;
const u24be = (b: Bytes, at: number) => ((b[at] << 16) | (b[at + 1] << 8) | b[at + 2]) >>> 0;
const u32be = (b: Bytes, at: number) => b[at] * 0x1000000 + ((b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]);
const u64be = (b: Bytes, at: number) => u32be(b, at) * 0x100000000 + u32be(b, at + 4);
const u32le = (b: Bytes, at: number) => b[at] + (b[at + 1] << 8) + (b[at + 2] << 16) + b[at + 3] * 0x1000000;
const u64le = (b: Bytes, at: number) => u32le(b, at) + u32le(b, at + 4) * 0x100000000;
const synchsafe = (b: Bytes, at: number) =>
  ((b[at] & 0x7f) << 21) | ((b[at + 1] & 0x7f) << 14) | ((b[at + 2] & 0x7f) << 7) | (b[at + 3] & 0x7f);

function concat(parts: Bytes[]): Bytes {
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// ------------------------------------------------------------
// Texto
// ------------------------------------------------------------

const decoders = new Map<string, TextDecoder>();
function decoder(label: string): TextDecoder {
  let found = decoders.get(label);
  if (!found) {
    found = new TextDecoder(label);
    decoders.set(label, found);
  }
  return found;
}

const utf8 = (bytes: Bytes) => decoder('utf-8').decode(bytes);

/** UTF-8 si lo es; si no, Windows-1252 (lo habitual en etiquetas antiguas en español). */
export function decodeLoose(bytes: Bytes): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decoder('windows-1252').decode(bytes);
  }
}

/** UTF-16 según su marca de orden de bytes (TextDecoder no la usa para elegir). */
function decodeUtf16(bytes: Bytes, bigEndian: boolean): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return decoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return decoder('utf-16be').decode(bytes.subarray(2));
  return decoder(bigEndian ? 'utf-16be' : 'utf-16le').decode(bytes);
}

/** Texto de un marco ID3 según su byte de codificación. */
function id3Text(bytes: Bytes, encoding: number): string {
  if (encoding === 1) return decodeUtf16(bytes, false);
  if (encoding === 2) return decodeUtf16(bytes, true);
  if (encoding === 3) return utf8(bytes);
  // Oficialmente ISO-8859-1, pero muchos programas escriben ahí UTF-8.
  return decodeLoose(bytes);
}

/** Posición del terminador (0, o 00 alineado en UTF-16) desde `from`; -1 si no hay. */
function terminator(b: Bytes, from: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i;
    return -1;
  }
  for (let i = from; i < b.length; i++) if (b[i] === 0) return i;
  return -1;
}
const terminatorSize = (encoding: number) => (encoding === 1 || encoding === 2 ? 2 : 1);

const tidy = (text: string) => text.replace(/^﻿/, '').replace(/\0+$/g, '').replace(/\s+/g, ' ').trim();

const looksTimed = (text: string) => /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/.test(text);

// ------------------------------------------------------------
// Imágenes
// ------------------------------------------------------------

function imageType(b: Bytes): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
  if (ascii(b, 0, 3) === 'GIF') return 'image/gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  return null;
}

/**
 * Bytes de una imagen → data URI. El tipo sale del contenido, no de lo que
 * diga la etiqueta (que a veces miente o es un enlace «-->»).
 */
export function imageDataUrl(bytes: Bytes): string | undefined {
  if (bytes.length < 100 || bytes.length > MAX_PICTURE) return undefined;
  const mime = imageType(bytes);
  if (!mime) return undefined;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}

function base64Bytes(text: string): Bytes | null {
  try {
    const binary = atob(text.replace(/\s+/g, ''));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Recolector: el primer valor bueno de cada campo gana
// ------------------------------------------------------------

class Collector {
  tags: AudioTags = {};
  /** 0 portada delantera · 1 «otra» · 2 cualquier otra imagen. */
  private pictureRank = 99;

  text(key: 'title' | 'artist' | 'albumArtist' | 'album' | 'year', value: string | undefined): void {
    const text = tidy(value ?? '');
    if (text && !this.tags[key]) this.tags[key] = text;
  }

  track(value: string | undefined): void {
    const number = parseInt(String(value ?? '').trim(), 10);
    if (!this.tags.track && Number.isFinite(number) && number > 0 && number < 10000) this.tags.track = number;
  }

  picture(bytes: Bytes, type: number): void {
    const rank = type === 3 ? 0 : type === 0 ? 1 : 2;
    if (rank >= this.pictureRank) return;
    const url = imageDataUrl(bytes);
    if (!url) return;
    this.tags.picture = url;
    this.pictureRank = rank;
  }

  /** Una letra con tiempos gana a una sin ellos. */
  lyrics(value: string | undefined): void {
    const text = (value ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\0+$/g, '').trim();
    if (!text) return;
    if (!this.tags.lyrics || (looksTimed(text) && !looksTimed(this.tags.lyrics))) this.tags.lyrics = text;
  }

  duration(seconds: number): void {
    if (!this.tags.duration && Number.isFinite(seconds) && seconds > 0.5 && seconds < 48 * 3600) this.tags.duration = seconds;
  }
}

// ------------------------------------------------------------
// ID3v2 (2.2, 2.3, 2.4)
// ------------------------------------------------------------

/** Deshace la desincronización: cada FF 00 vuelve a ser FF. */
function unsync(b: Bytes): Bytes {
  let count = 0;
  for (let i = 0; i + 1 < b.length; i++) if (b[i] === 0xff && b[i + 1] === 0) count++;
  if (count === 0) return b;
  const out = new Uint8Array(b.length - count);
  let j = 0;
  for (let i = 0; i < b.length; i++) {
    out[j++] = b[i];
    if (b[i] === 0xff && b[i + 1] === 0) i++;
  }
  return out;
}

/** Nombres de la 2.2 (tres letras) → los de la 2.3. */
const ID3_V22: Record<string, string> = {
  TT2: 'TIT2',
  TP1: 'TPE1',
  TP2: 'TPE2',
  TAL: 'TALB',
  TRK: 'TRCK',
  TYE: 'TYER',
  TLE: 'TLEN',
  TXX: 'TXXX',
  ULT: 'USLT',
  SLT: 'SYLT',
  PIC: 'APIC',
};

/** ¿Empieza aquí otro marco, o el relleno, o el final? */
function frameBoundary(b: Bytes, at: number): boolean {
  if (at === b.length) return true;
  if (at + 4 > b.length) return false;
  if (b[at] === 0) return true;
  return /^[A-Z0-9]{4}$/.test(ascii(b, at, 4));
}

function parseId3v2(c: Collector, tag: Bytes): void {
  if (tag.length < 10 || ascii(tag, 0, 3) !== 'ID3') return;
  const major = tag[3];
  const flags = tag[5];
  if (major < 2 || major > 4) return;
  if (major === 2 && flags & 0x40) return; // 2.2 comprimida: no tiene estándar
  let body = tag.subarray(10, Math.min(tag.length, 10 + synchsafe(tag, 6)));
  if (flags & 0x80 && major <= 3) body = unsync(body);
  let p = 0;
  if (major >= 3 && flags & 0x40) {
    p = major === 3 ? 4 + u32be(body, 0) : synchsafe(body, 0);
    if (p >= body.length) return;
  }
  const idLength = major === 2 ? 3 : 4;
  const headerLength = major === 2 ? 6 : 10;

  while (p + headerLength <= body.length) {
    const rawId = ascii(body, p, idLength);
    if (!/^[A-Z0-9]+$/.test(rawId) || rawId.length !== idLength) break; // relleno
    let size = major === 2 ? u24be(body, p + 3) : major === 4 ? synchsafe(body, p + 4) : u32be(body, p + 4);
    // Hay programas que escriben la 2.4 con tamaños de la 2.3: si el sincroseguro
    // no cae en otro marco y el normal sí, vale el normal.
    if (major === 4) {
      const plain = u32be(body, p + 4);
      if (plain !== size && !frameBoundary(body, p + 10 + size) && frameBoundary(body, p + 10 + plain)) size = plain;
    }
    const start = p + headerLength;
    const end = start + size;
    if (size <= 0 || end > body.length) break;
    let frame = body.subarray(start, end);
    let skip = false;
    if (major === 3) {
      const format = body[p + 9];
      if (format & 0xc0) skip = true; // comprimido o cifrado
      else if (format & 0x20) frame = frame.subarray(1); // identificador de grupo
    } else if (major === 4) {
      const format = body[p + 9];
      if (format & 0x0c) skip = true; // comprimido o cifrado
      else {
        if (format & 0x40) frame = frame.subarray(1);
        if (format & 0x01) frame = frame.subarray(4); // longitud de los datos
        if (format & 0x02 || flags & 0x80) frame = unsync(frame);
      }
    }
    if (!skip) id3Frame(c, major === 2 ? (ID3_V22[rawId] ?? rawId) : rawId, frame, major);
    p = end;
  }
}

function id3Frame(c: Collector, id: string, f: Bytes, major: number): void {
  if (f.length < 2) return;
  const encoding = f[0];

  if (id === 'TXXX') {
    const end = terminator(f, 1, encoding);
    if (end < 0) return;
    const description = tidy(id3Text(f.subarray(1, end), encoding)).toUpperCase();
    const value = id3Text(f.subarray(end + terminatorSize(encoding)), encoding);
    if (/^(?:UN)?SYNCED ?LYRICS$|^LYRICS$/.test(description)) c.lyrics(value);
    else if (/^ALBUM ?ARTIST$/.test(description)) c.text('albumArtist', value);
    return;
  }

  if (id[0] === 'T') {
    // La 2.4 admite varios valores separados por 0.
    const values = id3Text(f.subarray(1), encoding).split('\0').map(tidy).filter(Boolean);
    if (values.length === 0) return;
    if (id === 'TIT2') c.text('title', values[0]);
    else if (id === 'TPE1') c.text('artist', [...new Set(values)].join(', '));
    else if (id === 'TPE2') c.text('albumArtist', values[0]);
    else if (id === 'TALB') c.text('album', values[0]);
    else if (id === 'TRCK') c.track(values[0]);
    else if (id === 'TYER' || id === 'TDRC' || id === 'TORY' || id === 'TDOR') c.text('year', values[0].slice(0, 4));
    else if (id === 'TLEN') c.duration(Number(values[0]) / 1000);
    return;
  }

  if (id === 'USLT') {
    // Codificación · idioma (3) · descriptor terminado · letra.
    const end = terminator(f, 4, encoding);
    if (end >= 0) c.lyrics(id3Text(f.subarray(end + terminatorSize(encoding)), encoding));
    return;
  }

  if (id === 'SYLT') {
    syncedLyricsFrame(c, f);
    return;
  }

  if (id === 'APIC') {
    // 2.3/2.4: codificación · tipo MIME terminado · tipo de imagen · descripción · imagen.
    // 2.2: codificación · formato de 3 letras · tipo de imagen · descripción · imagen.
    let p: number;
    if (major === 2) p = 4;
    else {
      const mimeEnd = f.indexOf(0, 1);
      if (mimeEnd < 0) return;
      p = mimeEnd + 1;
    }
    const type = f[p];
    const end = terminator(f, p + 1, encoding);
    if (end >= 0) c.picture(f.subarray(end + terminatorSize(encoding)), type);
  }
}

/** SYLT: letra con tiempos en milisegundos (las de fotogramas MPEG no se leen). */
function syncedLyricsFrame(c: Collector, f: Bytes): void {
  if (f.length < 8 || c.tags.syncedLyrics) return;
  const encoding = f[0];
  if (f[4] !== 2) return; // formato del tiempo: 2 = milisegundos
  let p = terminator(f, 6, encoding);
  if (p < 0) return;
  p += terminatorSize(encoding);
  const entries: { time: number; text: string }[] = [];
  while (p < f.length) {
    const end = terminator(f, p, encoding);
    if (end < 0) break;
    const at = end + terminatorSize(encoding);
    if (at + 4 > f.length) break;
    entries.push({ time: u32be(f, at) / 1000, text: id3Text(f.subarray(p, end), encoding).replace(/^﻿/, '') });
    p = at + 4;
  }
  if (entries.length === 0) return;
  // Karaoke (sílabas) o líneas: si alguna entrada empieza con salto de línea,
  // las demás son trozos de la línea en curso.
  const syllables = entries.some((entry, index) => index > 0 && /^[\r\n]/.test(entry.text));
  const lines: { time: number; text: string }[] = [];
  for (const entry of entries) {
    const text = entry.text.replace(/[\r\n]+/g, ' ');
    if (!syllables || lines.length === 0 || /^[\r\n]/.test(entry.text)) lines.push({ time: entry.time, text: text.trim() });
    else lines[lines.length - 1].text = (lines[lines.length - 1].text + text).replace(/\s+/g, ' ').trim();
  }
  c.tags.syncedLyrics = lines;
}

// ------------------------------------------------------------
// Final del archivo: APEv2 e ID3v1
// ------------------------------------------------------------

async function readTail(c: Collector, blob: Blob): Promise<void> {
  if (blob.size < 128) return;
  const tail = await read(blob, blob.size - 128, blob.size);
  const hasId3v1 = ascii(tail, 0, 3) === 'TAG';
  await readApe(c, blob, blob.size - (hasId3v1 ? 128 : 0));
  if (hasId3v1) id3v1(c, tail);
}

async function readApe(c: Collector, blob: Blob, end: number): Promise<void> {
  if (end < 32) return;
  const footer = await read(blob, end - 32, end);
  if (ascii(footer, 0, 8) !== 'APETAGEX') return;
  const size = u32le(footer, 12); // elementos + pie, sin la cabecera
  const count = u32le(footer, 16);
  if (size < 32 || size > MAX_TAG || size > end) return;
  const items = await read(blob, end - size, end - 32);
  const artists: string[] = [];
  let p = 0;
  for (let i = 0; i < count && p + 8 < items.length; i++) {
    const length = u32le(items, p);
    const flags = u32le(items, p + 4);
    p += 8;
    const keyEnd = items.indexOf(0, p);
    if (keyEnd < 0) break;
    const key = ascii(items, p, keyEnd - p).toUpperCase();
    p = keyEnd + 1;
    if (p + length > items.length) break;
    const value = items.subarray(p, p + length);
    p += length;
    if (((flags >> 1) & 3) === 1) {
      // Binario: «Cover Art (Front)» = nombre de archivo terminado en 0 + imagen.
      if (key.startsWith('COVER ART')) {
        const nul = value.indexOf(0);
        if (nul >= 0) c.picture(value.subarray(nul + 1), key.includes('FRONT') ? 3 : 0);
      }
      continue;
    }
    const text = utf8(value);
    if (key === 'TITLE') c.text('title', text.split('\0')[0]);
    else if (key === 'ARTIST') artists.push(...text.split('\0'));
    else if (key === 'ALBUM ARTIST' || key === 'ALBUMARTIST') c.text('albumArtist', text);
    else if (key === 'ALBUM') c.text('album', text);
    else if (key === 'YEAR') c.text('year', text.slice(0, 4));
    else if (key === 'TRACK') c.track(text);
    else if (key === 'LYRICS' || key === 'UNSYNCED LYRICS' || key === 'UNSYNCEDLYRICS') c.lyrics(text);
  }
  const clean = [...new Set(artists.map(tidy).filter(Boolean))];
  if (clean.length > 0) c.text('artist', clean.join(', '));
}

function id3v1(c: Collector, tail: Bytes): void {
  const field = (start: number, length: number) => {
    let end = start;
    while (end < start + length && tail[end] !== 0) end++;
    return decodeLoose(tail.subarray(start, end));
  };
  c.text('title', field(3, 30));
  c.text('artist', field(33, 30));
  c.text('album', field(63, 30));
  c.text('year', field(93, 4));
  if (tail[125] === 0 && tail[126] !== 0) c.track(String(tail[126]));
}

// ------------------------------------------------------------
// Comentarios Vorbis (FLAC, Ogg) y bloque PICTURE
// ------------------------------------------------------------

function vorbisComments(c: Collector, b: Bytes, at: number): void {
  if (at + 8 > b.length) return;
  let p = at + 4 + u32le(b, at); // fabricante
  if (p + 4 > b.length) return;
  const count = u32le(b, p);
  p += 4;
  const artists: string[] = [];
  for (let i = 0; i < count && p + 4 <= b.length; i++) {
    const length = u32le(b, p);
    p += 4;
    if (p + length > b.length) break;
    const entry = b.subarray(p, p + length);
    p += length;
    const eq = entry.indexOf(0x3d); // «=»
    if (eq <= 0) continue;
    const key = ascii(entry, 0, eq).toUpperCase();
    const raw = entry.subarray(eq + 1);
    if (key === 'METADATA_BLOCK_PICTURE') {
      const picture = base64Bytes(utf8(raw));
      if (picture) flacPicture(c, picture);
      continue;
    }
    if (key === 'COVERART') {
      const picture = base64Bytes(utf8(raw));
      if (picture) c.picture(picture, 3);
      continue;
    }
    const value = utf8(raw);
    switch (key) {
      case 'TITLE':
        c.text('title', value);
        break;
      case 'ARTIST':
        artists.push(value);
        break;
      case 'ALBUMARTIST':
      case 'ALBUM ARTIST':
      case 'ALBUM_ARTIST':
        c.text('albumArtist', value);
        break;
      case 'ALBUM':
        c.text('album', value);
        break;
      case 'DATE':
      case 'YEAR':
      case 'ORIGINALDATE':
        c.text('year', value.slice(0, 4));
        break;
      case 'TRACKNUMBER':
      case 'TRACK':
        c.track(value);
        break;
      case 'LYRICS':
      case 'UNSYNCEDLYRICS':
      case 'UNSYNCED LYRICS':
      case 'SYNCEDLYRICS':
      case 'SYNCED LYRICS':
        c.lyrics(value);
        break;
    }
  }
  const clean = [...new Set(artists.map(tidy).filter(Boolean))];
  if (clean.length > 0) c.text('artist', clean.join(', '));
}

/** Bloque PICTURE de FLAC (también va en base64 dentro de los comentarios de Ogg). */
function flacPicture(c: Collector, b: Bytes): void {
  if (b.length < 32) return;
  const type = u32be(b, 0);
  let p = 4;
  p += 4 + u32be(b, p); // tipo MIME
  if (p + 4 > b.length) return;
  p += 4 + u32be(b, p); // descripción
  p += 16; // ancho, alto, profundidad, colores
  if (p + 4 > b.length) return;
  const length = u32be(b, p);
  p += 4;
  if (p + length > b.length) return;
  c.picture(b.subarray(p, p + length), type);
}

// ------------------------------------------------------------
// FLAC
// ------------------------------------------------------------

async function readFlac(c: Collector, blob: Blob, at: number): Promise<void> {
  let p = at + 4;
  for (let guard = 0; guard < 128 && p + 4 <= blob.size; guard++) {
    const header = await read(blob, p, p + 4);
    const last = (header[0] & 0x80) !== 0;
    const type = header[0] & 0x7f;
    const length = u24be(header, 1);
    const start = p + 4;
    p = start + length;
    if (type === 0 && length >= 18) {
      const info = await read(blob, start, start + 18);
      const sampleRate = (info[10] << 12) | (info[11] << 4) | (info[12] >> 4);
      const samples = (info[13] & 0x0f) * 0x100000000 + u32be(info, 14);
      if (sampleRate > 0 && samples > 0) c.duration(samples / sampleRate);
    } else if (type === 4 && length <= MAX_TAG) {
      vorbisComments(c, await read(blob, start, start + length), 0);
    } else if (type === 6 && length <= MAX_PICTURE + 4096) {
      flacPicture(c, await read(blob, start, start + length));
    }
    if (last) break;
  }
}

// ------------------------------------------------------------
// Ogg (Vorbis y Opus)
// ------------------------------------------------------------

/** Paquetes del primer flujo lógico, hasta `want`. */
function oggPackets(b: Bytes, want: number): { packets: Bytes[]; serial: number } {
  const packets: Bytes[] = [];
  let pending: Bytes[] = [];
  let serial = -1;
  let p = 0;
  while (p + 27 <= b.length && packets.length < want) {
    if (ascii(b, p, 4) !== 'OggS') break;
    const pageSerial = u32le(b, p + 14);
    const segments = b[p + 26];
    const dataStart = p + 27 + segments;
    if (dataStart > b.length) break;
    let total = 0;
    for (let i = 0; i < segments; i++) total += b[p + 27 + i];
    if (dataStart + total > b.length) break; // página a medias
    if (serial === -1) serial = pageSerial;
    if (pageSerial === serial) {
      let q = dataStart;
      for (let i = 0; i < segments && packets.length < want; i++) {
        const lace = b[p + 27 + i];
        pending.push(b.subarray(q, q + lace));
        q += lace;
        if (lace < 255) {
          packets.push(concat(pending));
          pending = [];
        }
      }
    }
    p = dataStart + total;
  }
  return { packets, serial };
}

async function readOgg(c: Collector, blob: Blob): Promise<void> {
  // La cabecera de comentarios puede llevar una carátula grande: se lee más si hace falta.
  let limit = 256 * 1024;
  let found = oggPackets(await read(blob, 0, limit), 2);
  while (found.packets.length < 2 && limit < blob.size && limit < MAX_TAG) {
    limit *= 4;
    found = oggPackets(await read(blob, 0, limit), 2);
  }
  const [ident, comments] = found.packets;
  if (!ident) return;
  let rate = 0;
  let preSkip = 0;
  if (ident[0] === 1 && ascii(ident, 1, 6) === 'vorbis') {
    rate = u32le(ident, 12);
    if (comments?.[0] === 3 && ascii(comments, 1, 6) === 'vorbis') vorbisComments(c, comments, 7);
  } else if (ascii(ident, 0, 8) === 'OpusHead') {
    rate = 48000;
    preSkip = ident[10] | (ident[11] << 8);
    if (comments && ascii(comments, 0, 8) === 'OpusTags') vorbisComments(c, comments, 8);
  }
  if (rate <= 0 || found.serial < 0) return;
  // Duración: la posición de la última página de este flujo.
  const tailSize = Math.min(blob.size, 128 * 1024);
  const tail = await read(blob, blob.size - tailSize, blob.size);
  for (let i = tail.length - 27; i >= 0; i--) {
    if (tail[i] === 0x4f && tail[i + 1] === 0x67 && tail[i + 2] === 0x67 && tail[i + 3] === 0x53 && u32le(tail, i + 14) === found.serial) {
      const granule = u64le(tail, i + 6);
      if (granule > preSkip && granule < 2 ** 52) c.duration((granule - preSkip) / rate);
      break;
    }
  }
}

// ------------------------------------------------------------
// MP4 / M4A
// ------------------------------------------------------------

interface Atom {
  type: string;
  start: number;
  end: number;
}

function* atoms(b: Bytes, start: number, end: number): Generator<Atom> {
  let p = start;
  while (p + 8 <= end) {
    let size = u32be(b, p);
    const type = ascii(b, p + 4, 4);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) return;
      size = u64be(b, p + 8);
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header || p + size > end) return;
    yield { type, start: p + header, end: p + size };
    p += size;
  }
}

function child(b: Bytes, parent: { start: number; end: number }, type: string): Atom | null {
  for (const atom of atoms(b, parent.start, parent.end)) if (atom.type === type) return atom;
  return null;
}

/** Códecs que el motor de Frame (WebView2) sí reproduce dentro de un MP4. */
const MP4_PLAYABLE = new Set(['mp4a', 'Opus', 'fLaC', '.mp3', 'mp3 ']);
const MP4_CODEC_NAMES: Record<string, string> = {
  alac: 'ALAC (Apple Lossless)',
  'ac-3': 'AC-3 (Dolby Digital)',
  'ec-3': 'E-AC-3 (Dolby Digital Plus)',
  'ac-4': 'AC-4 (Dolby)',
  dtsc: 'DTS',
  dtsh: 'DTS',
  dtsl: 'DTS',
  samr: 'AMR',
  sawb: 'AMR',
};

async function readMp4(c: Collector, blob: Blob): Promise<void> {
  // `moov` puede ir tras los datos de audio: se saltan los átomos de primer
  // nivel leyendo solo su cabecera.
  let p = 0;
  for (let guard = 0; guard < 256 && p + 8 <= blob.size; guard++) {
    const header = await read(blob, p, p + 16);
    let size = u32be(header, 0);
    const type = ascii(header, 4, 4);
    let headerSize = 8;
    if (size === 1) {
      size = u64be(header, 8);
      headerSize = 16;
    } else if (size === 0) {
      size = blob.size - p;
    }
    if (size < headerSize) return;
    if (type === 'moov') {
      if (size > 64 * 1024 * 1024) return;
      const moov = await read(blob, p + headerSize, p + size);
      mp4Moov(c, moov);
      return;
    }
    p += size;
  }
}

function mp4Moov(c: Collector, moov: Bytes): void {
  const codecs: string[] = [];
  for (const atom of atoms(moov, 0, moov.length)) {
    if (atom.type === 'mvhd') {
      const version = moov[atom.start];
      const timescale = version === 1 ? u32be(moov, atom.start + 20) : u32be(moov, atom.start + 12);
      const duration = version === 1 ? u64be(moov, atom.start + 24) : u32be(moov, atom.start + 16);
      if (timescale > 0) c.duration(duration / timescale);
    } else if (atom.type === 'trak') {
      const codec = mp4AudioCodec(moov, atom);
      if (codec) codecs.push(codec);
    } else if (atom.type === 'udta') {
      const meta = child(moov, atom, 'meta');
      if (meta) mp4Meta(c, moov, meta);
    } else if (atom.type === 'meta') {
      mp4Meta(c, moov, atom);
    }
  }
  if (codecs.length > 0 && !codecs.some((codec) => MP4_PLAYABLE.has(codec))) {
    c.tags.unsupported = MP4_CODEC_NAMES[codecs[0]] ?? codecs[0].trim().toUpperCase();
  }
}

/** Códec de una pista de sonido (trak → mdia → minf → stbl → stsd). */
function mp4AudioCodec(b: Bytes, trak: Atom): string | null {
  const mdia = child(b, trak, 'mdia');
  if (!mdia) return null;
  const hdlr = child(b, mdia, 'hdlr');
  if (hdlr && ascii(b, hdlr.start + 8, 4) !== 'soun') return null;
  const minf = child(b, mdia, 'minf');
  const stbl = minf && child(b, minf, 'stbl');
  const stsd = stbl && child(b, stbl, 'stsd');
  if (!stsd || stsd.start + 16 > stsd.end) return null;
  return ascii(b, stsd.start + 12, 4);
}

function mp4Meta(c: Collector, b: Bytes, meta: Atom): void {
  // En ISO `meta` lleva 4 bytes de versión antes de sus hijos; en algunos QuickTime, no.
  const start = ascii(b, meta.start + 4, 4) === 'hdlr' ? meta.start : meta.start + 4;
  const ilst = child(b, { start, end: meta.end }, 'ilst');
  if (!ilst) return;
  for (const item of atoms(b, ilst.start, ilst.end)) {
    const data = child(b, item, 'data');
    if (!data || data.start + 8 > data.end) continue;
    const kind = u24be(b, data.start + 1);
    const value = b.subarray(data.start + 8, data.end);
    if (item.type === 'covr') {
      c.picture(value, 3);
      continue;
    }
    if (item.type === 'trkn') {
      if (value.length >= 4) c.track(String(u16be(value, 2)));
      continue;
    }
    const text = kind === 2 ? decoder('utf-16be').decode(value) : utf8(value);
    switch (item.type) {
      case '©nam':
        c.text('title', text);
        break;
      case '©ART':
        c.text('artist', text);
        break;
      case 'aART':
        c.text('albumArtist', text);
        break;
      case '©alb':
        c.text('album', text);
        break;
      case '©day':
        c.text('year', text.slice(0, 4));
        break;
      case '©lyr':
        c.lyrics(text);
        break;
    }
  }
}

// ------------------------------------------------------------
// WAV
// ------------------------------------------------------------

async function readWav(c: Collector, blob: Blob): Promise<void> {
  let p = 12;
  let byteRate = 0;
  let dataSize = 0;
  for (let guard = 0; guard < 256 && p + 8 <= blob.size; guard++) {
    const header = await read(blob, p, p + 8);
    const id = ascii(header, 0, 4);
    const size = u32le(header, 4);
    const start = p + 8;
    if (id === 'fmt ') {
      const fmt = await read(blob, start, start + Math.min(size, 40));
      byteRate = u32le(fmt, 8);
    } else if (id === 'data') {
      dataSize = Math.min(size, blob.size - start);
    } else if (id === 'LIST' && size <= 1024 * 1024) {
      const list = await read(blob, start, start + size);
      if (ascii(list, 0, 4) === 'INFO') riffInfo(c, list);
    } else if ((id === 'id3 ' || id === 'ID3 ') && size <= MAX_TAG) {
      parseId3v2(c, await read(blob, start, start + size));
    }
    p = start + size + (size & 1);
  }
  if (byteRate > 0 && dataSize > 0) c.duration(dataSize / byteRate);
}

function riffInfo(c: Collector, list: Bytes): void {
  let p = 4;
  while (p + 8 <= list.length) {
    const id = ascii(list, p, 4);
    const size = u32le(list, p + 4);
    const start = p + 8;
    if (start + size > list.length) break;
    let end = start + size;
    while (end > start && list[end - 1] === 0) end--;
    const text = decodeLoose(list.subarray(start, end));
    if (id === 'INAM') c.text('title', text);
    else if (id === 'IART') c.text('artist', text);
    else if (id === 'IPRD') c.text('album', text);
    else if (id === 'ICRD') c.text('year', text.slice(0, 4));
    else if (id === 'ITRK' || id === 'IPRT') c.track(text);
    p = start + size + (size & 1);
  }
}

// ------------------------------------------------------------
// WebM (EBML)
// ------------------------------------------------------------

const EBML = {
  segment: 0x18538067,
  info: 0x1549a966,
  timecodeScale: 0x2ad7b1,
  duration: 0x4489,
  title: 0x7ba9,
  tracks: 0x1654ae6b,
  trackEntry: 0xae,
  codecId: 0x86,
  tags: 0x1254c367,
  tag: 0x7373,
  simpleTag: 0x67c8,
  tagName: 0x45a3,
  tagString: 0x4487,
  cluster: 0x1f43b675,
};

/** Códecs de WebM que Frame no reproduce. */
const WEBM_UNSUPPORTED: Record<string, string> = {
  A_AC3: 'AC-3 (Dolby Digital)',
  A_EAC3: 'E-AC-3 (Dolby Digital Plus)',
  A_DTS: 'DTS',
  A_TRUEHD: 'Dolby TrueHD',
  A_ALAC: 'ALAC (Apple Lossless)',
  A_WAVPACK4: 'WavPack',
  A_TTA1: 'TTA',
};

function ebmlId(b: Bytes, p: number): { id: number; length: number } | null {
  const first = b[p];
  if (!first) return null;
  let length = 1;
  let mask = 0x80;
  while (length <= 4 && !(first & mask)) {
    mask >>= 1;
    length++;
  }
  if (length > 4 || p + length > b.length) return null;
  let id = 0;
  for (let i = 0; i < length; i++) id = id * 256 + b[p + i];
  return { id, length };
}

function ebmlSize(b: Bytes, p: number): { value: number; length: number } | null {
  const first = b[p];
  if (first === undefined || first === 0) return null;
  let length = 1;
  let mask = 0x80;
  while (!(first & mask)) {
    mask >>= 1;
    length++;
  }
  if (p + length > b.length) return null;
  let value = first & (mask - 1);
  let unknown = value === mask - 1;
  for (let i = 1; i < length; i++) {
    value = value * 256 + b[p + i];
    if (b[p + i] !== 0xff) unknown = false;
  }
  return { value: unknown ? -1 : value, length };
}

async function readWebm(c: Collector, blob: Blob): Promise<void> {
  const b = await read(blob, 0, Math.min(blob.size, 4 * 1024 * 1024));
  let scale = 1_000_000;
  let duration = 0;
  const codecs: string[] = [];
  const pairs: [string, string][] = [];

  const visit = (start: number, end: number, depth: number): boolean => {
    let p = start;
    while (p < end && p < b.length) {
      const id = ebmlId(b, p);
      if (!id) return false;
      const size = ebmlSize(b, p + id.length);
      if (!size) return false;
      const dataStart = p + id.length + size.length;
      const dataEnd = size.value < 0 ? end : Math.min(dataStart + size.value, end, b.length);
      switch (id.id) {
        case EBML.cluster:
          return false; // empieza el audio: ya no hay cabeceras que leer
        case EBML.segment:
        case EBML.info:
        case EBML.tracks:
        case EBML.trackEntry:
        case EBML.tags:
        case EBML.tag:
          if (depth < 6 && !visit(dataStart, dataEnd, depth + 1)) return false;
          break;
        case EBML.simpleTag: {
          let name = '';
          let value = '';
          let q = dataStart;
          while (q < dataEnd) {
            const inner = ebmlId(b, q);
            const innerSize = inner && ebmlSize(b, q + inner.length);
            if (!inner || !innerSize || innerSize.value < 0) break;
            const from = q + inner.length + innerSize.length;
            const to = Math.min(from + innerSize.value, dataEnd);
            if (inner.id === EBML.tagName) name = utf8(b.subarray(from, to)).toUpperCase();
            else if (inner.id === EBML.tagString) value = utf8(b.subarray(from, to));
            q = to;
          }
          if (name) pairs.push([name, value]);
          break;
        }
        case EBML.timecodeScale: {
          let value = 0;
          for (let i = dataStart; i < dataEnd; i++) value = value * 256 + b[i];
          if (value > 0) scale = value;
          break;
        }
        case EBML.duration: {
          const view = new DataView(b.buffer, b.byteOffset + dataStart, dataEnd - dataStart);
          duration = dataEnd - dataStart === 8 ? view.getFloat64(0) : dataEnd - dataStart === 4 ? view.getFloat32(0) : 0;
          break;
        }
        case EBML.title:
          c.text('title', utf8(b.subarray(dataStart, dataEnd)));
          break;
        case EBML.codecId:
          codecs.push(ascii(b, dataStart, dataEnd - dataStart).replace(/\0+$/, ''));
          break;
      }
      if (size.value < 0) return false;
      p = dataEnd;
    }
    return true;
  };

  // Cabecera EBML y luego el segmento.
  const header = ebmlId(b, 0);
  const headerSize = header && ebmlSize(b, header.length);
  if (!header || !headerSize || headerSize.value < 0) return;
  visit(header.length + headerSize.length + headerSize.value, b.length, 0);

  for (const [name, value] of pairs) {
    if (name === 'TITLE') c.text('title', value);
    else if (name === 'ARTIST' || name === 'PERFORMER') c.text('artist', value);
    else if (name === 'ALBUM_ARTIST') c.text('albumArtist', value);
    else if (name === 'ALBUM') c.text('album', value);
    else if (name === 'DATE_RELEASED' || name === 'DATE') c.text('year', value.slice(0, 4));
    else if (name === 'LYRICS') c.lyrics(value);
  }
  if (duration > 0) c.duration((duration * scale) / 1e9);
  const unsupported = codecs.map((codec) => WEBM_UNSUPPORTED[codec.toUpperCase()]).find(Boolean);
  if (unsupported && !codecs.some((codec) => /^A_(OPUS|VORBIS|AAC|MPEG|FLAC|PCM)/i.test(codec))) c.tags.unsupported = unsupported;
}

// ------------------------------------------------------------
// Formatos que Frame no reproduce, reconocidos por su firma
// ------------------------------------------------------------

function unsupportedSignature(b: Bytes): string | null {
  if (b[0] === 0x30 && b[1] === 0x26 && b[2] === 0xb2 && b[3] === 0x75) return 'WMA';
  if (ascii(b, 0, 4) === 'FORM' && /^AIF[FC]$/.test(ascii(b, 8, 4))) return 'AIFF';
  if (ascii(b, 0, 4) === 'MAC ') return 'APE (Monkey’s Audio)';
  if (ascii(b, 0, 4) === 'wvpk') return 'WavPack';
  if (ascii(b, 0, 4) === 'TTA1') return 'TTA';
  if (ascii(b, 0, 4) === 'DSD ' || ascii(b, 0, 4) === 'FRM8') return 'DSD';
  if (ascii(b, 0, 5) === '#!AMR') return 'AMR';
  if (ascii(b, 0, 4) === 'MThd') return 'MIDI';
  if (ascii(b, 0, 4) === 'MPCK' || ascii(b, 0, 3) === 'MP+') return 'Musepack';
  if (b[0] === 0x0b && b[1] === 0x77) return 'AC-3 (Dolby Digital)';
  return null;
}

const isAdts = (b: Bytes, at: number) => b[at] === 0xff && (b[at + 1] & 0xf6) === 0xf0;

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------

export async function readAudioTags(file: Blob): Promise<AudioTags> {
  const c = new Collector();
  try {
    const head = await read(file, 0, 64 * 1024);
    let at = 0;
    // Una o varias etiquetas ID3v2 al principio (hay archivos con dos).
    for (let guard = 0; guard < 3 && at + 10 <= file.size; guard++) {
      const probe = at === 0 ? head.subarray(0, 10) : await read(file, at, at + 10);
      if (ascii(probe, 0, 3) !== 'ID3') break;
      const size = 10 + synchsafe(probe, 6) + (probe[5] & 0x10 ? 10 : 0);
      if (size > MAX_TAG) break;
      parseId3v2(c, at === 0 && size <= head.length ? head.subarray(0, size) : await read(file, at, at + size));
      at += size;
    }
    // Tras la etiqueta puede haber relleno de ceros antes del audio.
    let magicAt = at;
    let magic = at === 0 ? head.subarray(0, 64) : await read(file, at, at + 4096);
    if (at > 0) {
      let skip = 0;
      while (skip < magic.length && magic[skip] === 0) skip++;
      magic = magic.subarray(skip);
      magicAt += skip;
    }

    if (ascii(magic, 0, 4) === 'fLaC') {
      c.tags.container = 'flac';
      await readFlac(c, file, magicAt);
    } else if (at === 0 && ascii(magic, 0, 4) === 'OggS') {
      c.tags.container = 'ogg';
      await readOgg(c, file);
    } else if (at === 0 && ascii(magic, 4, 4) === 'ftyp') {
      c.tags.container = 'mp4';
      await readMp4(c, file);
    } else if (at === 0 && ascii(magic, 0, 4) === 'RIFF' && ascii(magic, 8, 4) === 'WAVE') {
      c.tags.container = 'wav';
      await readWav(c, file);
    } else if (at === 0 && u32be(magic, 0) === 0x1a45dfa3) {
      c.tags.container = 'webm';
      await readWebm(c, file);
    } else {
      const unsupported = unsupportedSignature(magic);
      if (unsupported) {
        c.tags.unsupported = unsupported;
        return c.tags;
      }
      c.tags.container = isAdts(magic, 0) ? 'aac' : 'mp3';
      await readTail(c, file);
    }
  } catch {
    /* un archivo ilegible no impide importarlo: quedará con su nombre */
  }
  return c.tags;
}
