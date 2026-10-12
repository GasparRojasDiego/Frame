import { useRef, useState } from 'react';
import { FileAudio, FolderOpen, FolderInput, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { EchoHeader } from '@/components/shared/EchoWord';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import {
  formatBytes,
  pickMusic,
  planMusicImport,
  releasePickedMusic,
  storeImportedSongs,
  type ImportOutcome,
  type MusicImportPlan,
} from '@/lib/music-import';

// ============================================================
// Botón «Importar» de Música: abre el explorador de archivos para traer
// canciones sueltas o una carpeta entera (ver lib/music-import.ts).
// ============================================================

type Stage = 'idle' | 'reading' | 'confirm' | 'importing' | 'done';

export default function MusicImportButton({ variant = 'button' }: { variant?: 'button' | 'empty' }) {
  const { songs, addSongs, mergePlaylistSongs } = useCourse();
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('idle');
  const [plan, setPlan] = useState<MusicImportPlan | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, title: '' });
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const stopRef = useRef(false);

  const finish = () => {
    void releasePickedMusic();
    setStage('idle');
    setPlan(null);
    setOutcome(null);
  };

  const choose = async (folder: boolean) => {
    try {
      const source = await pickMusic(folder);
      if (!source) return;
      setStage('reading');
      const next = await planMusicImport(source, songs);
      if (next.entries.length === 0) {
        void releasePickedMusic();
        setStage('idle');
        toast({
          title: next.existing.size > 0 ? 'Ya tienes esas canciones' : 'No hay canciones ahí',
          description:
            next.existing.size > 0
              ? 'Todo lo elegido ya estaba en tu biblioteca.'
              : 'Frame importa MP3, M4A, AAC, OGG, OPUS, FLAC, WAV y WEBM.',
        });
        return;
      }
      setPlan(next);
      setStage('confirm');
    } catch (error) {
      void releasePickedMusic();
      setStage('idle');
      toast({ variant: 'destructive', title: 'No se pudo abrir', description: String(error).slice(0, 160) });
    }
  };

  const run = async () => {
    if (!plan) return;
    stopRef.current = false;
    setStage('importing');
    setProgress({ done: 0, total: plan.entries.length, title: '' });
    const result = await storeImportedSongs(
      plan,
      (done, total, title) => setProgress({ done, total, title }),
      (batch) => addSongs(batch),
      () => stopRef.current
    );
    for (const playlist of plan.playlists) mergePlaylistSongs(playlist.name, playlist.songIds);
    setOutcome(result);
    setStage('done');
  };

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <>
      {/* No modal: así el recorrido «Descubrir» ve el clic en «Importar» y
          puede iluminar el menú ya abierto. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {variant === 'empty' ? (
            <Button className="mt-2" data-tour="musica-importar">
              <FolderInput className="mr-2 h-4 w-4" />
              Importar música
            </Button>
          ) : (
            <Button title="Importar canciones o una carpeta de tu equipo" data-tour="musica-importar">
              <FolderInput className="h-4 w-4" />
              Importar
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60" data-tour="importar-menu">
          <DropdownMenuItem onSelect={() => void choose(false)} data-tour="importar-canciones">
            <FileAudio className="mr-2 h-4 w-4 text-primary" />
            <span className="flex flex-col">
              Canciones…
              <span className="text-[11px] text-muted-foreground">MP3 sueltos (u otros), con sus .lrc</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void choose(true)} data-tour="importar-carpeta">
            <FolderOpen className="mr-2 h-4 w-4 text-primary" />
            <span className="flex flex-col">
              Una carpeta…
              <span className="text-[11px] text-muted-foreground">Con todas sus subcarpetas</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={stage !== 'idle'} onOpenChange={(open) => !open && stage !== 'importing' && stage !== 'reading' && finish()}>
        <DialogContent className="sm:max-w-md">
          <EchoHeader word="Importar">
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-bold text-primary">Importar música</DialogTitle>
              <DialogDescription className="text-center">
                {stage === 'reading' && 'Leyendo lo que elegiste…'}
                {stage === 'confirm' && plan && `Desde «${plan.source.name}».`}
                {stage === 'importing' && 'Copiando tus canciones dentro de Frame…'}
                {stage === 'done' && 'Listo.'}
              </DialogDescription>
            </DialogHeader>
          </EchoHeader>

          {stage === 'reading' && (
            <div className="flex justify-center py-6">
              <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {stage === 'confirm' && plan && (
            <div className="space-y-2 py-2 text-sm">
              <p>
                <span className="font-bold text-foreground">{plan.entries.length}</span>{' '}
                {plan.entries.length === 1 ? 'canción nueva' : 'canciones nuevas'} · {formatBytes(plan.bytes)}
              </p>
              {plan.existing.size > 0 && (
                <p className="text-muted-foreground">
                  {plan.existing.size} ya {plan.existing.size === 1 ? 'estaba' : 'estaban'} en tu biblioteca: no se duplican.
                </p>
              )}
              {plan.playlists.length > 0 && (
                <p className="text-muted-foreground">
                  También {plan.playlists.length === 1 ? 'su playlist' : `sus ${plan.playlists.length} playlists`}.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Se copian dentro de Frame: después puedes mover o borrar los archivos originales.
              </p>
            </div>
          )}

          {stage === 'importing' && (
            <div className="space-y-2 py-2">
              <Progress value={percent} />
              <p className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span className="truncate">{progress.title}</span>
                <span className="shrink-0 tabular-nums">
                  {progress.done} / {progress.total}
                </span>
              </p>
            </div>
          )}

          {stage === 'done' && outcome && (
            <div className="space-y-1.5 py-2 text-sm">
              <p>
                <span className="font-bold text-foreground">{outcome.imported}</span>{' '}
                {outcome.imported === 1 ? 'canción importada' : 'canciones importadas'}
                {outcome.lyrics > 0 && ` · ${outcome.lyrics} con letra`}
                {outcome.cancelled && ' (cancelaste el resto)'}
              </p>
              {outcome.failed.length > 0 && (
                <p className="text-xs text-destructive">
                  No se pudieron leer: {outcome.failed.slice(0, 4).join(', ')}
                  {outcome.failed.length > 4 && ` y ${outcome.failed.length - 4} más`}.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            {stage === 'confirm' && (
              <>
                <Button variant="gris" onClick={finish}>
                  Cancelar
                </Button>
                <Button onClick={() => void run()}>Importar</Button>
              </>
            )}
            {stage === 'importing' && (
              <Button variant="gris" onClick={() => (stopRef.current = true)}>
                Detener
              </Button>
            )}
            {stage === 'done' && <Button onClick={finish}>Cerrar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
