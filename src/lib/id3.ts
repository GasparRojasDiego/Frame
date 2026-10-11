// ============================================================
// Etiquetas ID3 de un MP3
//
// Al importar canciones propias, lo único que se sabe de ellas es lo que
// traigan dentro: sus etiquetas ID3. Esto las lee —título, artista, álbum,
// carátula y letra— para que la biblioteca no acabe llena de nombres de
// archivo.
//
// Se lee solo ID3v2 (2.3 y 2.4), que es lo que llevan los MP3 de hoy, y como
// último recurso el ID3v1 de 128 bytes del final. Un archivo sin etiquetas no
// es un error: se cae al nombre del archivo.
// ============================================================

export interface AudioTags {
  title?: string;
  artist?: string;
  album?: string;
  /** Carátula como data URI, lista para <img src>. */
  picture?: string;
  /** Letra (USLT). Puede venir en formato LRC, con tiempos. */
  lyrics?: string;
  /** Número de pista (TRCK), p. ej. 7 de «7/120». */
  track?: number;
}

const decode = (bytes: Uint8Array, encoding: number): string => {
  try {
    switch (encoding) {
      case 0:
        return new TextDecoder('iso-8859-1').decode(bytes);
      case 1:
        return new TextDecoder('utf-16').decode(bytes);
      case 2:
        return new TextDecoder('utf-16be').decode(bytes);
      default:
        return new TextDecoder('utf-8').decode(bytes);
    }
  } catch {
    return '';
  }
};

/** Quita los bytes nulos de relleno que dejan algunos codificadores. */
const tidy = (text: string): string => text.replace(/\0+$/g, '').trim();

/** Tamaño «sincroseguro»: siete bits útiles por byte. */
const synchsafe = (view: DataView, offset: number): number =>
  ((view.getUint8(offset) & 0x7f) << 21) |
  ((view.getUint8(offset + 1) & 0x7f) << 14) |
  ((view.getUint8(offset + 2) & 0x7f) << 7) |
  (view.getUint8(offset + 3) & 0x7f);

export async function readAudioTags(file: File): Promise<AudioTags> {
  const tags: AudioTags = {};
  try {
    // La etiqueta ID3v2 va al principio y su cabecera dice cuánto mide: se lee
    // eso y nada más (con tope), aunque traiga una carátula enorme.
    const probe = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    const declared =
      probe.length === 10 && probe[0] === 0x49 && probe[1] === 0x44 && probe[2] === 0x33
        ? ((probe[6] & 0x7f) << 21) | ((probe[7] & 0x7f) << 14) | ((probe[8] & 0x7f) << 7) | (probe[9] & 0x7f)
        : 0;
    const head = new Uint8Array(await file.slice(0, Math.min(10 + declared + 16, 16 * 1024 * 1024)).arrayBuffer());
    if (head.length > 10 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
      const view = new DataView(head.buffer);
      const major = head[3];
      const size = synchsafe(view, 6);
      let offset = 10;
      const end = Math.min(10 + size, head.length);

      while (offset + 10 <= end) {
        const id = String.fromCharCode(head[offset], head[offset + 1], head[offset + 2], head[offset + 3]);
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        // La 2.4 usa tamaños sincroseguros; la 2.3, enteros normales.
        const frameSize = major >= 4 ? synchsafe(view, offset + 4) : view.getUint32(offset + 4);
        if (frameSize <= 0 || offset + 10 + frameSize > head.length) break;
        const body = head.subarray(offset + 10, offset + 10 + frameSize);

        if (id === 'TRCK') {
          const number = parseInt(tidy(decode(body.subarray(1), body[0])), 10);
          if (Number.isFinite(number) && number > 0) tags.track = number;
        } else if (id === 'USLT' && !tags.lyrics) {
          // USLT: codificación · idioma (3) · descriptor terminado en 0 · letra.
          const textEncoding = body[0];
          let p = 4;
          if (textEncoding === 1 || textEncoding === 2) {
            while (p + 1 < body.length && !(body[p] === 0 && body[p + 1] === 0)) p += 2;
            p += 2;
          } else {
            while (p < body.length && body[p] !== 0) p += 1;
            p += 1;
          }
          const text = tidy(decode(body.subarray(p), textEncoding));
          if (text) tags.lyrics = text;
        } else if (id === 'TIT2' || id === 'TPE1' || id === 'TALB') {
          const text = tidy(decode(body.subarray(1), body[0]));
          if (text) {
            if (id === 'TIT2') tags.title = text;
            if (id === 'TPE1') tags.artist = text;
            if (id === 'TALB') tags.album = text;
          }
        } else if (id === 'APIC' && !tags.picture) {
          // APIC: codificación · tipo MIME terminado en 0 · tipo de imagen ·
          // descripción terminada en 0 · bytes de la imagen.
          let p = 1;
          const mimeStart = p;
          while (p < body.length && body[p] !== 0) p += 1;
          const mime = decode(body.subarray(mimeStart, p), 0) || 'image/jpeg';
          p += 1; // fin del MIME
          p += 1; // tipo de imagen
          const textEncoding = body[0];
          if (textEncoding === 1 || textEncoding === 2) {
            while (p + 1 < body.length && !(body[p] === 0 && body[p + 1] === 0)) p += 2;
            p += 2;
          } else {
            while (p < body.length && body[p] !== 0) p += 1;
            p += 1;
          }
          const image = body.subarray(p);
          if (image.length > 100) {
            let binary = '';
            for (let i = 0; i < image.length; i += 8192) {
              binary += String.fromCharCode(...image.subarray(i, i + 8192));
            }
            tags.picture = `data:${mime};base64,${btoa(binary)}`;
          }
        }

        offset += 10 + frameSize;
      }
    }

    // Sin ID3v2: el bloque de 128 bytes del final, de los MP3 antiguos.
    if (!tags.title && file.size > 128) {
      const tail = new Uint8Array(await file.slice(file.size - 128).arrayBuffer());
      if (tail[0] === 0x54 && tail[1] === 0x41 && tail[2] === 0x47) {
        const at = (start: number, length: number) => tidy(decode(tail.subarray(start, start + length), 0));
        tags.title = at(3, 30) || undefined;
        tags.artist = at(33, 30) || undefined;
        tags.album = at(63, 30) || undefined;
      }
    }
  } catch {
    /* un archivo ilegible no debe impedir importarlo: quedará con su nombre */
  }
  return tags;
}

/**
 * Nombre presentable cuando el archivo no trae etiquetas. Convierte
 * «01 - Artista - Canción.mp3» en algo legible y separa el artista si el
 * nombre sigue el patrón habitual «Artista - Título».
 */
export function guessFromFileName(fileName: string): { title: string; artist?: string } {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ').trim();
  const clean = base.replace(/^\s*\d{1,3}\s*[-.]\s*/, '');
  const dash = clean.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) {
    const artist = dash[0].trim();
    const title = dash.slice(1).join(' - ').trim();
    if (artist && title) return { title, artist };
  }
  return { title: clean || fileName };
}
