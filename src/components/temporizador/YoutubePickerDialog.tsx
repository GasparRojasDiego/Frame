import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Clock3, LoaderCircle, Plus, Video } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import GoogleEmbed from '@/components/integrations/GoogleEmbed';
import { formatVideoDuration, readYoutubeVideo, youtubeIdFromUrl, type YoutubeVideoInfo } from '@/lib/study-videos';
import type { StudyVideo } from '@/types';
import EchoWord from '@/components/shared/EchoWord';
import { errorText, tr } from '@/lib/i18n';

// ============================================================
// Buscar un vídeo de estudio sin salir de Enfoque.
//
// Antes había que ir hasta la interfaz YouTube, encontrar el vídeo, pulsar
// «Añadir a Enfoque» y volver: tres saltos para una acción. Ahora el YouTube
// REAL —con tu sesión, tu historial y tus filtros— se abre aquí mismo, en una
// ventana emergente sobre el propio recuadro.
//
// El webview de YouTube es nativo y se dibuja SIEMPRE encima del HTML, así
// que la ficha del vídeo no puede pintarse sobre él: mientras se muestra, el
// webview se aparta (`paused`) y vuelve al cerrarla.
//
// Se guarda la FICHA del vídeo; se ve siempre con el reproductor de YouTube.
// ============================================================

const cleanError = (e: unknown): string =>
  errorText(String(e).replace(/^(Error:\s*|Invoke error:\s*)/i, '')).slice(0, 180);

export default function YoutubePickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (video: StudyVideo) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<YoutubeVideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useRef(0);

  useEffect(() => {
    if (!open) {
      request.current += 1;
      setInfo(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const inspect = async () => {
    const ticket = ++request.current;
    const current = () => ticket === request.current;
    setLoading(true);
    setInfo(null);
    setError(null);
    try {
      const url = await invoke<string>('youtube_embed_current_url');
      const id = youtubeIdFromUrl(url);
      if (!id) {
        if (current()) setError(tr('Abre primero el vídeo que quieres guardar: esta página no es un vídeo.'));
        return;
      }
      const video = await readYoutubeVideo(id);
      if (current()) setInfo(video);
    } catch (e) {
      if (current()) setError(cleanError(e) || tr('No se pudo leer el vídeo.'));
    } finally {
      if (current()) setLoading(false);
    }
  };

  const pick = () => {
    if (!info) return;
    onPick({
      id: info.id,
      title: info.title,
      uploader: info.uploader,
      duration: Math.round(info.duration || 0),
      addedAt: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  const sheetOpen = loading || Boolean(info) || Boolean(error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[86vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="relative flex shrink-0 items-center justify-between gap-3 overflow-hidden px-4 py-2.5">
          <EchoWord word={tr('Buscar')} />
          <DialogTitle className="relative flex items-center gap-2 text-sm font-bold text-primary">
            <Video className="h-4 w-4" />
            {tr('Buscar un vídeo de estudio')}
          </DialogTitle>
          <Button
            size="sm"
            className="relative mr-8"
            onClick={() => void inspect()}
            disabled={sheetOpen}
            title={tr('Guardar el vídeo que estás viendo')}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {tr('Añadir')}
          </Button>
        </div>
        <div aria-hidden className="mx-4 h-px shrink-0 bg-border" />

        <div className="relative min-h-0 flex-1">
          <GoogleEmbed kind="youtube" heightClass="absolute inset-0" allowInModal paused={sheetOpen} />

          {/* Ficha del vídeo: tapa el webview mientras se decide. */}
          {sheetOpen && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95 p-6 backdrop-blur">
              <div className="w-full max-w-md space-y-4">
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    {tr('Leyendo el vídeo…')}
                  </div>
                )}

                {error && !loading && (
                  <>
                    <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      {error}
                    </p>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setError(null)}>
                      <ArrowLeft className="mr-1.5 h-4 w-4" />
                      {tr('Volver a YouTube')}
                    </Button>
                  </>
                )}

                {info && !loading && (
                  <>
                    <div className="rounded-lg border border-border/70 bg-card/60 p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-foreground">{info.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{info.uploader}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        {info.duration > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatVideoDuration(info.duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Button size="sm" onClick={pick}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        {tr('Guardar')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setInfo(null)}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        {tr('Seguir buscando')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
