import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Heart,
  LoaderCircle,
  MicVocal,
  Minus,
  Music,
  Pause,
  Play,
  Plus,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useCourse } from '@/context/CourseContext';
import { activeLineIndex, findLyrics, setLyricsOffset, type SongLyrics } from '@/lib/lyrics';
import { formatClock, playbackClock, usePlaybackPosition } from '@/lib/playback-clock';
import { cn } from '@/lib/utils';

// ============================================================
// «Reproduciendo»: la canción a pantalla completa DENTRO de Frame.
//
// A la izquierda, la canción: título, portada grande centrada, artista y, más
// pequeños, la línea de reproducción y los controles. A la derecha, la letra
// sincronizada: la línea que suena va resaltada y centrada, y tocar cualquier
// línea salta a ese punto. El fondo es la propia portada, desenfocada.
//
// La letra es la que trajo la canción al importarla (sus etiquetas o un .lrc
// con el mismo nombre): Frame no busca letras en internet.
//
// No tiene <audio> propio: el sonido sigue viviendo en la barra inferior; aquí
// solo se lee su avance (playback-clock) y se le dan órdenes.
// ============================================================

function LyricsPanel({ lyrics, loading }: { lyrics: SongLyrics | null; loading: boolean }) {
  const { progress } = usePlaybackPosition();
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lines = lyrics?.synced ?? [];
  const offset = lyrics?.offset ?? 0;
  const active = useMemo(() => activeLineIndex(lines, progress - offset), [lines, progress, offset]);

  // La línea activa se mantiene centrada. Se desplaza el PANEL, no la página.
  useEffect(() => {
    const container = containerRef.current;
    const line = lineRefs.current[active];
    if (!container || !line) return;
    container.scrollTo({
      top: line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2,
      behavior: 'smooth',
    });
  }, [active]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-white/70">
        <LoaderCircle className="h-6 w-6 animate-spin" />
        <p className="text-sm">Cargando la letra…</p>
      </div>
    );
  }

  if (!lyrics || lyrics.missing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white/70">
        <MicVocal className="h-8 w-8" />
        <p className="text-base font-semibold text-white">
          {lyrics?.instrumental ? 'Canción instrumental' : 'Sin letra para esta canción'}
        </p>
        {!lyrics?.instrumental && (
          <p className="max-w-xs text-xs leading-relaxed">
            Frame muestra la letra que trae el archivo: en sus etiquetas o en un .lrc con el mismo nombre, junto a la
            canción, al importarla.
          </p>
        )}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="hide-scrollbar h-full overflow-y-auto px-2 py-6">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Letra sin sincronizar</p>
        <p className="whitespace-pre-wrap text-lg font-semibold leading-relaxed text-white/85">{lyrics.plain}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="hide-scrollbar relative h-full overflow-y-auto scroll-smooth [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)]"
    >
      <div className="py-[28vh]">
        {lines.map((line, index) => (
          <button
            key={`${line.time}-${index}`}
            ref={(el) => {
              lineRefs.current[index] = el;
            }}
            type="button"
            onClick={() => playbackClock.seek(Math.max(0, line.time + offset))}
            title={`Saltar a ${formatClock(Math.max(0, line.time + offset))}`}
            className={cn(
              'block w-full rounded-lg px-3 py-2 text-left font-headline text-2xl font-bold leading-snug transition-all duration-300 lg:text-3xl',
              index === active
                ? 'scale-[1.02] text-white'
                : index < active
                  ? 'text-white/30 hover:text-white/60'
                  : 'text-white/45 hover:text-white/70'
            )}
          >
            {line.text || '♪'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pie de la letra sincronizada: ajuste fino de sus tiempos. */
function LyricsFooter({ offset, onOffset }: { offset: number; onOffset: (delta: number) => void }) {
  return (
    <div className="mt-3 flex items-center justify-end text-[11px] text-white/55">
      <div className="flex items-center rounded-full border border-white/15" title="Ajusta si la letra va adelantada o atrasada">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-white/75 hover:bg-white/15 hover:text-white" onClick={() => onOffset(-0.5)} title="Letra 0,5 s antes">
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[3.25rem] text-center tabular-nums text-white/80">
          {offset === 0 ? 'A tiempo' : `${offset > 0 ? '+' : '−'}${Math.abs(offset).toFixed(1).replace('.', ',')} s`}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-white/75 hover:bg-white/15 hover:text-white" onClick={() => onOffset(0.5)} title="Letra 0,5 s después">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function NowPlayingView({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    isShuffle,
    toggleShuffle,
    repeatMode,
    setRepeatMode,
    toggleSongFavorite,
  } = useCourse();
  const { progress, duration } = usePlaybackPosition();
  const [lyrics, setLyrics] = useState<SongLyrics | null>(null);
  const [loading, setLoading] = useState(false);

  const songId = currentSong?.id ?? null;

  // La letra se lee al abrir y al cambiar de canción; si no la hay guardada,
  // se reconoce en internet (findLyrics) y queda guardada.
  const songRef = useRef(currentSong);
  songRef.current = currentSong;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  useEffect(() => {
    const song = songRef.current;
    if (!open || !songId || !song) return;
    let alive = true;
    setLyrics(null);
    setLoading(true);
    void findLyrics(song, durationRef.current)
      .then((result) => alive && setLyrics(result))
      .catch(() => alive && setLyrics(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, songId]);

  const changeOffset = (delta: number) => {
    if (!currentSong || !lyrics) return;
    const next = Math.max(-30, Math.min(30, Math.round(((lyrics.offset ?? 0) + delta) * 10) / 10));
    setLyrics({ ...lyrics, offset: next });
    void setLyricsOffset(currentSong.id, next);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !currentSong) return null;

  const title = currentSong.title?.trim() || currentSong.fileName.replace(/\.(mp3|m4a|aac|ogg|opus|flac|wav|webm|weba)$/i, '');
  const artist = currentSong.artist?.trim() || 'Artista desconocido';
  const control = 'h-10 w-10 rounded-full text-white/80 hover:bg-white/15 hover:text-white';

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-neutral-950 text-white animate-in fade-in-0 duration-300" role="dialog" aria-label="Reproduciendo">
      {/* Fondo: la portada, muy desenfocada, y un velo para que el texto se lea. */}
      {currentSong.picture && (
        <img src={currentSong.picture} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-3xl" />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/55 to-black/80" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        title="Cerrar (Esc)"
        className="absolute right-5 top-5 z-10 h-10 w-10 rounded-full text-white/80 hover:bg-white/15 hover:text-white"
      >
        <ChevronDown className="h-6 w-6" />
      </Button>

      <div className="relative grid h-full grid-cols-1 gap-8 px-8 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:px-16">
        {/* ---- La canción ---- */}
        <div className="flex min-h-0 flex-col items-center justify-center text-center">
          <h2 className="w-full max-w-md truncate font-headline text-2xl font-bold lg:text-3xl" title={title}>
            {title}
          </h2>

          <div className="my-6 aspect-square w-full max-w-[min(22rem,42vh)] overflow-hidden rounded-2xl bg-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/15">
            {currentSong.picture ? (
              <img src={currentSong.picture} alt={title} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Music className="h-20 w-20 text-white/60" />
              </span>
            )}
          </div>

          <p className="w-full max-w-md truncate text-base font-semibold text-white/75" title={artist}>
            {artist}
          </p>

          <div className="mt-6 w-full max-w-sm space-y-3">
            <div>
              <Slider
                value={[Math.min(progress, duration || 0)]}
                max={duration || 0}
                step={1}
                onValueChange={(value) => playbackClock.seek(value[0])}
                aria-label="Posición de la canción"
                className="[&_[role=slider]]:border-white [&_[role=slider]]:bg-white [&>span:first-child]:bg-white/25 [&>span:first-child>span]:bg-white"
              />
              <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-white/60">
                <span>{formatClock(progress)}</span>
                <span>{formatClock(duration)}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleShuffle} title="Aleatorio" className={cn(control, 'h-9 w-9', isShuffle && 'bg-white/20 text-white')}>
                <Shuffle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={playPrevious} title="Anterior" className={control}>
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                title={isPlaying ? 'Pausar' : 'Reproducir'}
                className="h-14 w-14 rounded-full bg-white text-neutral-900 hover:bg-white/90 hover:text-neutral-900"
              >
                {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current pl-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={playNext} title="Siguiente" className={control}>
                <SkipForward className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title={repeatMode.mode === 'off' ? 'Repetir esta canción' : 'Dejar de repetir'}
                onClick={() => setRepeatMode(repeatMode.mode === 'off' ? { mode: 'infinite' } : { mode: 'off' })}
                className={cn(control, 'h-9 w-9', repeatMode.mode !== 'off' && 'bg-white/20 text-white')}
              >
                <Repeat className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title={currentSong.isFavorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
                onClick={() => void toggleSongFavorite(currentSong.id)}
                className={cn(control, 'h-9 w-9')}
              >
                <Heart className={cn('h-4 w-4', currentSong.isFavorite && 'fill-white text-white')} />
              </Button>
            </div>
          </div>
        </div>

        {/* ---- La letra: ~68 % del alto, centrada ---- */}
        <div className="hidden min-h-0 flex-col justify-center lg:flex">
          <div className="h-[68%] w-full">
            <LyricsPanel lyrics={lyrics} loading={loading} />
          </div>
          {!loading && lyrics && lyrics.synced.length > 0 && (
            <LyricsFooter offset={lyrics.offset ?? 0} onOffset={changeOffset} />
          )}
        </div>
      </div>
    </div>
  );
}
