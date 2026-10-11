import { useEffect, useMemo, useRef, useState } from 'react';
import Image from '@/lib/image';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Music, Heart, Trash2, Shuffle, LoaderCircle } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import MusicImportButton from '@/components/music/MusicImportButton';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Song } from '@/types';

import { songMatches } from '@/lib/music-search';
import { songCardId, useSongHighlight } from '@/hooks/use-song-highlight';

/**
 * Dónde se quedó el usuario: carpeta y desplazamiento (solo sin filtros).
 * Vive en MEMORIA a propósito: al volver a Música durante la misma sesión se
 * retoma ahí, pero cada vez que Frame se abre de nuevo la biblioteca empieza
 * arriba de la primera carpeta de 100.
 */
let lastPlace: { page: number; scroll: number } | null = null;

// Biblioteca central de música: única vista del módulo. Las canciones entran
// con «Importar» (archivos o carpetas del propio equipo, ver music-import.ts),
// con sus etiquetas, portada y letra.
/**
 * Canciones por carpeta. Una biblioteca de 900 canciones en una sola lista es
 * una pared: nadie llega a la 700 haciendo scroll. Cada 100 se abre una
 * carpeta nueva, y se pasa de una a otra con las flechas junto al contador.
 * Además, pintar 100 tarjetas en vez de 900 es lo que mantiene fluido el
 * scroll y la búsqueda con bibliotecas grandes.
 */
const PAGE_SIZE = 100;

export default function MusicLibrary() {
  const { songs, areSongsLoading, playSong, deleteSong } = useCourse();

  const rootRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  /** Carpeta visible (0 = la primera). En la misma sesión, donde se dejó. */
  const [page, setPage] = useState(() => lastPlace?.page ?? 0);

  /** La COLA de reproducción: la biblioteca (o las favoritas), SIN filtrar por
   *  la búsqueda. El buscador sirve para encontrar una canción, no para
   *  redefinir qué suena después: antes, al acabar una coincidencia, seguía
   *  otra coincidencia y la reproducción se quedaba encerrada en la búsqueda. */
  const queueSongs = useMemo(
    () => (showOnlyFavorites ? songs.filter(song => song.isFavorite) : songs),
    [songs, showOnlyFavorites]
  );

  /** Lo que se MUESTRA: la cola, acotada por el término de búsqueda.
   *  Busca por nombre Y por artista (ver src/lib/music-search.ts). */
  const filteredSongs = useMemo(
    () => queueSongs.filter(song => songMatches(song, searchQuery)),
    [queueSongs, searchQuery]
  );

  const pageCount = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
  // Si la lista se acorta (búsqueda, borrado) la carpeta actual puede dejar
  // de existir: se recorta en vez de mostrar una carpeta vacía.
  const safePage = Math.min(page, pageCount - 1);
  const pageSongs = useMemo(
    () => filteredSongs.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [filteredSongs, safePage]
  );
  const pageFirst = filteredSongs.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const pageLast = Math.min(filteredSongs.length, (safePage + 1) * PAGE_SIZE);

  // Buscar o filtrar reinicia a la primera carpeta: lo encontrado va al
  // principio, no en la carpeta donde uno estaba. (No al montar: entonces
  // manda la carpeta recordada.)
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    setPage(0);
  }, [searchQuery, showOnlyFavorites]);

  // «Ir a lo que suena» desde el reproductor: a la carpeta de esa canción.
  const highlightId = useSongHighlight(!areSongsLoading && songs.length > 0);
  useEffect(() => {
    if (!highlightId) return;
    let index = filteredSongs.findIndex((s) => s.id === highlightId);
    if (index < 0 && (searchQuery || showOnlyFavorites)) {
      // Estaba oculta por un filtro: se quita para poder mostrarla.
      setSearchQuery('');
      if (!songs.find((s) => s.id === highlightId)?.isFavorite) setShowOnlyFavorites(false);
      index = songs.findIndex((s) => s.id === highlightId);
    }
    if (index >= 0) setPage(Math.floor(index / PAGE_SIZE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  // Se recuerda la carpeta y la posición exacta (p. ej. «carpeta 4 de 5, al
  // final») para volver ahí si se vuelve a Música en esta misma sesión.
  const placeRestored = useRef(false);
  useEffect(() => {
    if (areSongsLoading || songs.length === 0) return;
    const scroller = rootRef.current?.closest('.overflow-y-auto') as HTMLElement | null;
    if (!scroller) return;
    if (!placeRestored.current) {
      placeRestored.current = true;
      const place = lastPlace;
      if (place && !highlightId) requestAnimationFrame(() => (scroller.scrollTop = place.scroll));
    }
    let frame = 0;
    const save = () => {
      if (searchQuery || showOnlyFavorites) return;
      lastPlace = { page: safePage, scroll: Math.round(scroller.scrollTop) };
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(save);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areSongsLoading, songs.length > 0, safePage, searchQuery, showOnlyFavorites]);

  const goToPage = (next: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    if (clamped === safePage) return;
    setPage(clamped);
    // La carpeta nueva empieza arriba: seguir a media altura de la anterior
    // desorienta.
    rootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const playbackContext = showOnlyFavorites ? 'Favoritos' : 'Música';

  const handleRandomPlay = () => {
    if (queueSongs.length === 0) return;
    const randomSong = queueSongs[Math.floor(Math.random() * queueSongs.length)];
    playSong(randomSong, { context: playbackContext, queue: queueSongs });
  };

  const hasSongs = songs.length > 0;
  const showInitialEmptyState = !areSongsLoading && !hasSongs;
  const showNoResultsState =
    !areSongsLoading && hasSongs && filteredSongs.length === 0 && (!!searchQuery || showOnlyFavorites);

  if (areSongsLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center p-8">
        <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="p-6 pt-4 md:p-8 md:pt-4">
      {/* Una sola fila flexible: buscador · contador con flechas · botones.
          El contador va EN el flujo, no en posición absoluta: así nunca se
          mete debajo de los botones al estrecharse la ventana. */}
      <div className="mt-2 mb-8 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2">
          <Label htmlFor="music-search" className="text-sm font-semibold text-foreground shrink-0">
            Buscador
          </Label>
          <div className="min-w-0 flex-1">
            <Input
              id="music-search"
              data-tour="musica-buscar"
              placeholder="canciones o artistas..."
              className="w-full bg-card border-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
              <span>
                <span className="font-bold text-foreground/80">{filteredSongs.length}</span> canciones
              </span>
              {/* Las flechas cambian de carpeta (100 canciones cada una). Con
                  una sola carpeta no hay nada que cambiar y no se dibujan. */}
              {pageCount > 1 && (
                <span className="ml-1 flex items-center gap-0.5" title={`Carpeta ${safePage + 1} de ${pageCount} · canciones ${pageFirst}–${pageLast}`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary disabled:opacity-30"
                    onClick={() => goToPage(safePage - 1)}
                    disabled={safePage === 0}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-foreground/80">
                    {safePage + 1}<span className="text-muted-foreground/70"> / {pageCount}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary disabled:opacity-30"
                    onClick={() => goToPage(safePage + 1)}
                    disabled={safePage >= pageCount - 1}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </span>
              )}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-md border border-primary bg-primary/20"
            onClick={handleRandomPlay}
            disabled={filteredSongs.length === 0}
            title="Reproducir una canción al azar" data-tour="musica-azar"
          >
            <Shuffle className="h-5 w-5 text-primary" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowOnlyFavorites(prev => !prev)}
            data-tour="musica-favoritas"
            className="rounded-md border border-primary bg-primary/20"
            title={showOnlyFavorites ? 'Ver toda la biblioteca' : 'Ver sólo favoritas'}
          >
            <Heart className={cn('h-5 w-5 text-primary', showOnlyFavorites && 'fill-primary')} />
          </Button>

          <MusicImportButton />
        </div>
      </div>

      {showInitialEmptyState ? (
        <Card className="border-dashed mt-8 flex flex-col items-center justify-center text-center p-12 gap-4">
          <div className="p-4 rounded-full bg-primary/20">
            <Music className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">Tu biblioteca de música está vacía</h3>
            <p className="text-sm text-muted-foreground">
              Trae tus canciones desde tu equipo: sueltas o una carpeta entera, con sus portadas y letras.
            </p>
          </div>
          <MusicImportButton variant="empty" />
        </Card>
      ) : showNoResultsState ? (
        <Card className="border-dashed mt-8 flex flex-col items-center justify-center text-center p-12 gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">No se encontraron resultados</h3>
            <p className="text-sm text-muted-foreground">
              Prueba con otro término de búsqueda o revisa tus favoritas.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pageSongs.map(song => (
            <Card
              key={song.id}
              id={songCardId(song.id)}
              className={cn(
                'bg-accent/40 hover:bg-accent/80 transition-colors cursor-pointer group relative',
                song.id === highlightId && 'animate-pulse-border'
              )}
              onClick={() => playSong(song, { context: playbackContext, queue: queueSongs })}
              data-tour="cancion"
            >
              <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSongToDelete(song);
                  }}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 rounded-md bg-accent flex items-center justify-center">
                  {song.picture ? (
                    <Image
                      src={song.picture}
                      alt={song.fileName.replace(/\.(mp3|m4a|aac|ogg|opus|flac|wav|webm|weba)$/i, '')}
                      fill
                      style={{ objectFit: 'cover' }}
                      className="rounded-md"
                    />
                  ) : (
                    <Music className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex flex-col truncate min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {song.fileName.replace(/\.(mp3|m4a|aac|ogg|opus|flac|wav|webm|weba)$/i, '')}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pageCount > 1 && !showInitialEmptyState && !showNoResultsState && (
        // Abajo, solo las flechas: la página exacta ya se lee arriba, junto
        // al buscador.
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage === 0}
            aria-label="Página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= pageCount - 1}
            aria-label="Página siguiente"
            title="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={!!songToDelete} onOpenChange={(isOpen) => !isOpen && setSongToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la canción
              "{songToDelete?.fileName.replace(/\.(mp3|m4a|aac|ogg|opus|flac|wav|webm|weba)$/i, '')}" de tu biblioteca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (songToDelete) {
                  deleteSong(songToDelete.id);
                  setSongToDelete(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
