import { useMemo } from 'react';
import { Check, Music, Play, Plus, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCourse } from '@/context/CourseContext';
import { songTitle } from '@/lib/music-search';
import { cn } from '@/lib/utils';
import type { Song } from '@/types';

// ============================================================
// Selector de canciones en rejilla de dos columnas.
//
// Vive aparte porque lo usan DOS sitios que antes divergían: crear una
// playlist (sidebar) y añadir canciones a una ya creada. La segunda mostraba
// una lista de casillas con el nombre del archivo; ahora ambas comparten esta
// pieza, con portada, escucha previa y "+".
//
// La portada es el botón de escucha: sirve para reconocer la canción antes de
// decidir, que es justo lo que un nombre de archivo no permite.
// ============================================================

interface SongPickerGridProps {
  /** Ids ya incluidos: se muestran marcados y no se pueden volver a añadir. */
  selectedIds: string[];
  onAdd: (songId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  /** Motivo por el que aún no se puede añadir (p. ej. falta el nombre). */
  disabledReason?: string;
  heightClass?: string;
}

const songLabel = (song: Song) => songTitle(song);

export default function SongPickerGrid({
  selectedIds,
  onAdd,
  search,
  onSearchChange,
  disabledReason,
  heightClass = 'h-[320px]',
}: SongPickerGridProps) {
  const { songs, playSong, currentSong } = useCourse();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return songs ?? [];
    // Se busca por lo que el usuario VE (título y artista) además de por el
    // nombre del archivo, que puede no decir nada.
    return (songs ?? []).filter((song) =>
      [songLabel(song), song.artist, song.album, song.fileName]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query))
    );
  }, [songs, search]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Título o artista…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-9 border-primary/60 bg-card"
      />

      {disabledReason && (
        <p className="rounded-md border border-dashed border-border/70 px-3 py-2 text-center text-[11px] text-muted-foreground">
          {disabledReason}
        </p>
      )}

      <ScrollArea className={cn('w-full rounded-md border', heightClass)}>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
            {filtered.map((song) => {
              const added = selectedIds.includes(song.id);
              const isSounding = currentSong?.id === song.id;
              // La escucha previa encola la BIBLIOTECA entera, no los
              // resultados del filtro: buscar no debe encerrar la
              // reproducción en las coincidencias.
              return (
                <div
                  key={song.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border p-2 transition-colors',
                    added ? 'border-primary/60 bg-primary/5' : 'border-border/60 bg-card'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => playSong(song, { context: 'Música', queue: songs ?? [] })}
                    title="Escuchar para reconocerla"
                    className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-accent"
                  >
                    {song.picture ? (
                      <img src={song.picture} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <Music className="h-5 w-5 text-primary" />
                      </span>
                    )}
                    <span
                      className={cn(
                        'absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity',
                        isSounding ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      )}
                    >
                      {isSounding ? (
                        <Volume2 className="h-4 w-4 text-white" />
                      ) : (
                        <Play className="h-4 w-4 fill-white text-white" />
                      )}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {songLabel(song)}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {song.artist || 'Artista desconocido'}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="icon"
                    variant={added ? 'default' : 'outline'}
                    className="h-8 w-8 shrink-0"
                    disabled={added || Boolean(disabledReason)}
                    title={added ? 'Ya está en la playlist' : 'Añadir a la playlist'}
                    onClick={() => onAdd(song.id)}
                  >
                    {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {(songs ?? []).length > 0
              ? 'No se encontraron canciones.'
              : 'No hay canciones en tu biblioteca.'}
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
