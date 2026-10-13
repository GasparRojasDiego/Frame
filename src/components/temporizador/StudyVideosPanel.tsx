import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Trash2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import YoutubePickerDialog from '@/components/temporizador/YoutubePickerDialog';
import {
  STUDY_VIDEO_SLOT_ATTR,
  playStudyVideo,
  stopStudyVideo,
  useStudyVideoPlayer,
} from '@/lib/study-video-player';
import { useToast } from '@/hooks/use-toast';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import {
  addStudyVideo,
  cachedVideoThumbnail,
  formatVideoDuration,
  MAX_STUDY_VIDEOS,
  STUDY_VIDEOS_EVENT,
  readStudyVideos,
  videoThumbnail,
  writeStudyVideos,
} from '@/lib/study-videos';
import type { StudyVideo } from '@/types';
import { CLOUD_APPLIED_EVENT } from '@/lib/supabase/sync';
import { tr } from '@/lib/i18n';

// ============================================================
// Vídeos de estudio: el recuadro grande que sustituye a «Tiempo de estudio» y
// «Métricas de hoy» al pulsar las flechas de Enfoque.
//
// La lista se presenta como en YouTube —rejilla de miniaturas con el título
// debajo—, porque un vídeo se reconoce por su fotograma mucho antes que por
// su nombre, y en filas de extremo a extremo cabían tres y sobraba aire.
//
// Buscar vídeos nuevos ocurre AQUÍ, en una ventana con el YouTube real
// incrustado: antes había que viajar a la interfaz YouTube y volver.
// ============================================================

// ------------------------------------------------------------
// Miniatura con reserva: sin internet YouTube no sirve la imagen.
// ------------------------------------------------------------
function Thumbnail({ id, className }: { id: string; className?: string }) {
  // 1) la guardada en el equipo o bajada por el núcleo nativo;
  // 2) si eso falla, la dirección directa de YouTube;
  // 3) si también falla, un icono.
  const [src, setSrc] = useState<string | null>(null);
  const [stage, setStage] = useState<'loading' | 'cached' | 'direct' | 'failed'>('loading');

  useEffect(() => {
    let alive = true;
    setStage('loading');
    void cachedVideoThumbnail(id).then((dataUrl) => {
      if (!alive) return;
      if (dataUrl) {
        setSrc(dataUrl);
        setStage('cached');
      } else {
        setSrc(videoThumbnail(id));
        setStage('direct');
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-md bg-secondary', className)}>
      {stage === 'failed' || !src ? (
        <div className="flex h-full w-full items-center justify-center">
          <Video className="h-4 w-4 text-muted-foreground" />
        </div>
      ) : (
        <img
          src={src}
          alt=""
          onError={() => setStage('failed')}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Vista del vídeo en curso. El reproductor de verdad NO vive aquí sino en el
// layout (`StudyVideoHost`): esta vista solo reserva su hueco, y por eso el
// vídeo sobrevive a los cambios de interfaz.
//
// PROPORCIÓN: manda el ANCHO. El vídeo ocupa todo el ancho del recuadro a 16:9
// y el alto que sobre, arriba y abajo, se deja vacío. Solo si el recuadro fuera
// tan ancho que un 16:9 no cupiera de alto, se limita por la altura.
// ------------------------------------------------------------
function PlayerView({ video, onBack }: { video: StudyVideo; onBack: () => void }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const fit = () => {
      const width = Math.floor(Math.min(area.clientWidth, (area.clientHeight * 16) / 9));
      setSize({ width, height: Math.floor((width * 9) / 16) });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
          onClick={onBack}
          title={tr('Cerrar el vídeo y volver a la lista')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={video.title}>
          {video.title}
        </p>
      </div>

      <div ref={areaRef} className="flex min-h-0 flex-1 items-center justify-center">
        <div
          {...{ [STUDY_VIDEO_SLOT_ATTR]: '' }}
          className="rounded-md bg-black"
          style={size ? { width: size.width, height: size.height } : undefined}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// El panel
// ------------------------------------------------------------
export default function StudyVideosPanel({
  /** El botón «Añadir vídeo» vive en la cabecera de la tarjeta. */
  pickerOpen = false,
  onPickerOpenChange,
}: {
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
} = {}) {
  const { userProfile } = useCourse();
  const { toast } = useToast();
  const uid = userProfile?.id ?? null;

  const [videos, setVideos] = useState<StudyVideo[]>([]);
  // El vídeo en curso vive fuera de esta pantalla: al volver de otra interfaz
  // sigue ahí, en su minuto.
  const { video: playing } = useStudyVideoPlayer();

  useEffect(() => {
    setVideos(readStudyVideos(uid));
    // La lista también cambia desde otras pantallas y, desde la 1.6.8, desde
    // otros dispositivos de la cuenta: hay que enterarse.
    const refresh = () => setVideos(readStudyVideos(uid));
    window.addEventListener(STUDY_VIDEOS_EVENT, refresh);
    window.addEventListener(CLOUD_APPLIED_EVENT, refresh);
    return () => {
      window.removeEventListener(STUDY_VIDEOS_EVENT, refresh);
      window.removeEventListener(CLOUD_APPLIED_EVENT, refresh);
    };
  }, [uid]);

  const persist = useCallback(
    (next: StudyVideo[]) => {
      setVideos(next);
      writeStudyVideos(uid, next);
    },
    [uid]
  );

  /** Alta desde la ventana de YouTube incrustada. */
  const handlePick = useCallback(
    (video: StudyVideo) => {
      const result = addStudyVideo(uid, video);
      setVideos(readStudyVideos(uid));

      if (result === 'duplicate') {
        toast({ title: tr('Ya lo tenías'), description: tr('Ese vídeo ya está en tus vídeos de estudio.') });
        return;
      }
      if (result === 'full') {
        toast({
          variant: 'destructive',
          title: tr('Lista llena'),
          description: tr('Caben {MAX_STUDY_VIDEOS} vídeos. Quita alguno antes de añadir otro.', { MAX_STUDY_VIDEOS }),
        });
        return;
      }

      toast({ title: tr('Vídeo guardado'), description: video.title });
    },
    [uid, toast]
  );

  const remove = useCallback(
    (video: StudyVideo) => {
      // Quitado mientras sonaba: el reproductor se cierra con él.
      if (playing?.id === video.id) stopStudyVideo();
      persist(videos.filter((v) => v.id !== video.id));
    },
    [persist, videos, playing?.id]
  );

  const picker = (
    <YoutubePickerDialog
      open={pickerOpen}
      onOpenChange={(next) => onPickerOpenChange?.(next)}
      onPick={handlePick}
    />
  );

  // Con un vídeo elegido, el recuadro ENTERO pasa a ser el reproductor.
  if (playing) {
    return (
      <>
        <PlayerView video={playing} onBack={stopStudyVideo} />
        {picker}
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {videos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <Video className="h-7 w-7 text-muted-foreground/60" />
          <p className="px-4 text-xs text-muted-foreground">
            {tr('Guarda aquí los vídeos que usas para estudiar. Pulsa «Añadir vídeo» y busca en YouTube sin salir de esta pantalla.')}
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          {/* Rejilla al estilo YouTube: miniatura arriba, título debajo. */}
          {/* Dos por fila, siempre: cada vídeo ocupa la mitad del ancho y su
              miniatura se ve lo bastante grande para reconocerlo. */}
          {/* `pr-4`: la columna derecha no toca la barra de desplazamiento (1.6.6). */}
          <ul className="grid grid-cols-2 gap-3 pr-4">
            {videos.map((video) => {
              return (
                <li key={video.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => playStudyVideo(video)}
                    className="block w-full text-left"
                    title={video.title}
                  >
                    <span className="relative block">
                      <Thumbnail id={video.id} className="aspect-video w-full" />
                      <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play className="h-5 w-5 fill-white text-white" />
                      </span>

                      {video.duration > 0 && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[9px] font-semibold tabular-nums text-white">
                          {formatVideoDuration(video.duration)}
                        </span>
                      )}
                    </span>

                    <span className="mt-1 block">
                      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
                        {video.title}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {video.uploader}
                      </span>
                    </span>
                  </button>

                  {/* Acciones: aparecen sobre la miniatura al pasar el ratón. */}
                  <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded bg-black/70 text-white hover:bg-destructive hover:text-white"
                      onClick={() => remove(video)}
                      title={tr('Quitar de la lista')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

      {picker}
    </div>
  );
}
