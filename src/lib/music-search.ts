// ============================================================
// Búsqueda en la biblioteca de música.
//
// Una sola regla para los dos buscadores (Música y cada playlist), porque un
// mismo texto tiene que encontrar lo mismo en los dos sitios.
//
// Busca por NOMBRE y por ARTISTA, ignora acentos y mayúsculas, y trata lo
// escrito como una lista de palabras sueltas: "bad billie" encuentra
// "Bad Guy" de Billie Eilish sin que importe el orden.
// ============================================================

import type { Song } from '@/types';

/** Sin acentos y en minúsculas: escribir "cafe" tiene que encontrar "Café". */
export const foldText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** El nombre que se le enseña al usuario: el archivo sin su extensión. */
export const songTitle = (song: Song): string => song.fileName.replace(/\.(mp3|m4a|aac|ogg|opus|flac|wav|webm|weba)$/i, '');

/** ¿Esta canción responde a lo escrito? Todas las palabras deben aparecer,
 *  en el nombre o en el artista, en cualquier orden. */
export function songMatches(song: Song, query: string): boolean {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${foldText(songTitle(song))} ${foldText(song.artist ?? '')}`;
  return terms.every((term) => haystack.includes(term));
}
