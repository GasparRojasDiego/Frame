import type { Song } from '@/types';
import { songKey } from '@/lib/song-keys';

// ============================================================
// El corazón de las canciones entre dispositivos (1.6.9).
//
// Hasta la 1.6.8 el favorito vivía solo en la ficha de la canción, dentro de
// la base de música del equipo, y la música no viaja: marcar el corazón en la
// laptop nunca llegaba a la tablet (Diego, 13-oct-2026).
//
// Ahora la lista de favoritos es una colección que viaja (`songFavorites`):
// una ficha por canción, identificada por su CLAVE (título y artista, como en
// las playlists, song-keys.ts), así que vale en todos los dispositivos aunque
// cada uno tenga su propia copia de la canción. Quitar el corazón borra la
// ficha y la lápida lleva el borrado a los demás.
//
//   · La lista manda: cada dispositivo pone sus canciones al día con ella al
//     cargar la música y cada vez que llega algo de otro dispositivo.
//   · La primera vez que un dispositivo usa esta versión suma a la lista sus
//     favoritos de antes (una sola vez: después, un corazón quitado en otro
//     equipo no vuelve a aparecer desde aquí).
//   · Una canción favorita que aquí no está se queda en la lista y aparece con
//     su corazón en cuanto se importa.
// ============================================================

export interface FavoriteEntry {
  /** Clave de la canción (song-keys.ts). */
  id: string;
}

const listKey = (uid: string) => `songFavorites_${uid}`;
/** Este dispositivo ya sumó sus favoritos de antes (no viaja). */
const seededKey = (uid: string) => `songFavoritesSeeded_${uid}`;

export function readFavoriteKeys(uid: string): Set<string> {
  try {
    const list = JSON.parse(localStorage.getItem(listKey(uid)) ?? '[]') as unknown;
    if (!Array.isArray(list)) return new Set();
    return new Set(list.map((entry) => (entry as FavoriteEntry)?.id).filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function writeFavoriteKeys(uid: string, keys: Set<string>): void {
  try {
    localStorage.setItem(listKey(uid), JSON.stringify([...keys].sort().map((id): FavoriteEntry => ({ id }))));
  } catch {
    /* sin espacio: el corazón vale en este dispositivo */
  }
}

/** Marca o quita el corazón de una canción en la lista que viaja. */
export function setSongFavorite(uid: string, song: Pick<Song, 'title' | 'artist' | 'fileName'>, favorite: boolean): void {
  const keys = readFavoriteKeys(uid);
  const key = songKey(song);
  if (keys.has(key) === favorite) return;
  if (favorite) keys.add(key);
  else keys.delete(key);
  writeFavoriteKeys(uid, keys);
}

/**
 * Las canciones cuyo corazón no coincide con la lista, ya corregidas. La
 * primera vez en este dispositivo, antes suma a la lista sus favoritos.
 */
export function favoritesToApply(uid: string, songs: Song[]): Song[] {
  const keys = readFavoriteKeys(uid);
  if (localStorage.getItem(seededKey(uid)) !== '1') {
    let added = false;
    for (const song of songs) {
      if (!song.isFavorite) continue;
      const key = songKey(song);
      if (!keys.has(key)) {
        keys.add(key);
        added = true;
      }
    }
    if (added) writeFavoriteKeys(uid, keys);
    try {
      localStorage.setItem(seededKey(uid), '1');
    } catch {
      /* se volverá a sumar: es idempotente */
    }
  }
  const changed: Song[] = [];
  for (const song of songs) {
    const favorite = keys.has(songKey(song));
    if (Boolean(song.isFavorite) !== favorite) changed.push({ ...song, isFavorite: favorite });
  }
  return changed;
}
