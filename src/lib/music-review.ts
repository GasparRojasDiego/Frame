import { probeAudio } from '@/lib/audio-probe';
import { readAudioTags } from '@/lib/audio-tags';
import { shrinkCover } from '@/lib/cover-shrink';
import { betterLyrics, importLyrics, lyricsFromLines, lyricsFromText, storedLyrics } from '@/lib/lyrics';
import { getSongFileFromDB } from '@/lib/music-db';
import { UNKNOWN_ARTIST } from '@/lib/music-import';
import { foldName, isJunkTag, resolveSongName } from '@/lib/song-names';
import type { Song } from '@/types';

// ============================================================
// Repaso de una canción que ya estaba en la biblioteca (1.6.7).
//
// Hasta la 1.6.6 solo se leían las etiquetas de los MP3 y no se guardaba la
// duración. Una vez por canción, en segundo plano, se lee su archivo (el que
// Frame guarda dentro) y se completa SOLO lo que falta: la duración, la
// portada si no tenía, el título si era basura («Track 01»), el artista si
// era «Desconocido» y la letra si no tenía ninguna. Nada que el usuario haya
// puesto se cambia.
// ============================================================

export async function reviewStoredSong(song: Song, knownArtists: ReadonlySet<string>): Promise<Partial<Song>> {
  const file = await getSongFileFromDB(song.id).catch(() => undefined);
  // Sin archivo no hay nada que medir: 0 = «no se pudo», para no volver a intentarlo.
  if (!file) return { duration: 0 };

  // readAudioTags nunca lanza: un archivo raro devuelve etiquetas vacías.
  const [probe, tags] = await Promise.all([probeAudio(file), readAudioTags(file)]);
  const updates: Partial<Song> = {};
  const duration = probe.duration ?? tags.duration;
  updates.duration = duration ? Math.round(duration * 100) / 100 : 0;

  if (!song.picture && tags.picture) updates.picture = await shrinkCover(tags.picture);

  const missingArtist = !song.artist?.trim() || song.artist === UNKNOWN_ARTIST;
  const junkTitle = isJunkTag(song.title);
  if (missingArtist || junkTitle) {
    const name = resolveSongName({
      fileName: song.fileName,
      tagTitle: tags.title,
      tagArtist: tags.artist,
      tagAlbumArtist: tags.albumArtist,
      knownArtists,
    });
    if (junkTitle && name.title) updates.title = name.title;
    const title = updates.title ?? song.title;
    if (missingArtist && name.artist && foldName(name.artist) !== foldName(title)) updates.artist = name.artist;
  }

  if (!(await storedLyrics(song.id))) {
    const lyrics = betterLyrics(lyricsFromLines(tags.syncedLyrics), lyricsFromText(tags.lyrics));
    if (lyrics) await importLyrics(song.id, lyrics);
  }
  return updates;
}
