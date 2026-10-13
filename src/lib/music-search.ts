// ============================================================
// Búsqueda en la biblioteca de música.
//
// Una sola regla para los dos buscadores (Música y cada playlist), porque un
// mismo texto tiene que encontrar lo mismo en los dos sitios.
//
// Busca por TÍTULO, por ARTISTA y por NOMBRE DE ARCHIVO, ignora acentos y
// mayúsculas, y trata lo escrito como una lista de palabras sueltas: "bad
// billie" encuentra "Bad Guy" de Billie Eilish sin que importe el orden.
// ============================================================

import { isJunkTag } from '@/lib/song-names';
import type { Song } from '@/types';

/** Sin acentos y en minúsculas: escribir "cafe" tiene que encontrar "Café". */
const foldText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** El nombre del archivo sin su extensión. */
const songFileLabel = (song: Song): string =>
  song.fileName.replace(/\.(mp3|m4a|aac|ogg|oga|opus|flac|wav|webm|weba)$/i, '');

/**
 * El nombre que se le enseña al usuario: su título (desde la 1.6.7, que lo
 * distingue del artista) o, si no tiene uno que sirva («Track 01»…), el
 * nombre del archivo sin su extensión.
 */
export const songTitle = (song: Song): string =>
  (!isJunkTag(song.title) ? song.title.trim() : '') || songFileLabel(song);

/** ¿Esta canción responde a lo escrito? Todas las palabras deben aparecer,
 *  en el título, en el artista o en el nombre del archivo, en cualquier orden. */
export function songMatches(song: Song, query: string): boolean {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${foldText(songTitle(song))} ${foldText(song.artist ?? '')} ${foldText(songFileLabel(song))}`;
  return terms.every((term) => haystack.includes(term));
}
