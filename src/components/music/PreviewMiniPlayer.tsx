import { Music, Pause, Play } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useCourse } from '@/context/CourseContext';
import { formatClock, playbackClock, usePlaybackPosition } from '@/lib/playback-clock';
import { cn } from '@/lib/utils';

// Escucha previa al armar una playlist: la portada de lo que suena, una barra
// para adelantar o retroceder y el botón de pausa, sin salir del diálogo.
export default function PreviewMiniPlayer({ className }: { className?: string }) {
  const { currentSong, isPlaying, togglePlay } = useCourse();
  const { progress, duration } = usePlaybackPosition();
  if (!currentSong) return null;

  const title = currentSong.title?.trim() || currentSong.fileName.replace(/\.(mp3|m4a|aac|ogg|opus|flac|wav|webm|weba)$/i, '');

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5 rounded-lg border border-border/70 bg-secondary/40 p-1.5 pr-3', className)}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent">
        {currentSong.picture ? (
          <img src={currentSong.picture} alt="" className="h-full w-full object-cover" />
        ) : (
          <Music className="h-4 w-4 text-primary" />
        )}
      </span>
      <button
        type="button"
        onClick={togglePlay}
        title={isPlaying ? 'Pausar' : 'Reproducir'}
        aria-label={isPlaying ? 'Pausar la escucha previa' : 'Reanudar la escucha previa'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/85"
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current pl-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold leading-tight text-foreground" title={title}>
          {title}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">{formatClock(progress)}</span>
          <Slider
            value={[Math.min(progress, duration || 0)]}
            max={duration || 0}
            step={1}
            onValueChange={(value) => playbackClock.seek(value[0])}
            aria-label="Adelantar o retroceder"
            className="flex-1"
          />
          <span className="w-8 shrink-0 text-[9px] tabular-nums text-muted-foreground">{formatClock(duration)}</span>
        </div>
      </div>
    </div>
  );
}
