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
        const formats = [...new Set(next.unsupported.map((file) => file.format))].join(', ');
        toast({
          title: next.existing.size > 0 ? 'Ya tienes esas canciones' : 'No hay canciones que Frame pueda reproducir',
          description:
            next.existing.size > 0
              ? 'Todo lo elegido ya estaba en tu biblioteca.'
              : next.unsupported.length > 0
                ? `Lo elegido está en ${formats}, que Frame no reproduce. Frame importa MP3, M4A, AAC, OGG, Opus, FLAC, WAV y WebM.`
                : 'Frame importa MP3, M4A, AAC, OGG, Opus, FLAC, WAV y WebM.',
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
      songs,
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
      {/* No modal: abrir el menú no bloquea el resto de la pantalla. */}
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
              <span className="text-[11px] text-muted-foreground">Con sus letras y portadas, si las tienes</span>
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
              {plan.lyricFiles > 0 && (
                <p className="text-muted-foreground">
                  {plan.lyricFiles === 1 ? '1 trae' : `${plan.lyricFiles} traen`} su letra en un archivo aparte.
                </p>
              )}
              {plan.playlists.length > 0 && (
                <p className="text-muted-foreground">
                  También {plan.playlists.length === 1 ? 'su playlist' : `sus ${plan.playlists.length} playlists`}.
                </p>
              )}
              {plan.unsupported.length > 0 && (
                <p className="text-muted-foreground">
                  {plan.unsupported.length} {plan.unsupported.length === 1 ? 'archivo queda' : 'archivos quedan'} fuera: están en{' '}
                  {[...new Set(plan.unsupported.map((file) => file.format))].join(', ')}, que Frame no reproduce.
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
                {outcome.cancelled && ' (cancelaste el resto)'}
              </p>
              {outcome.imported > 0 && (
                <p className="text-xs text-muted-foreground">
                  {outcome.covers} con portada · {outcome.lyrics} con letra
                </p>
              )}
              {outcome.stoppedFor && (
                <p className="text-xs text-destructive">Se detuvo porque {outcome.stoppedFor}.</p>
              )}
              {outcome.skipped.length > 0 && (
                <div className="space-y-0.5 pt-1 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    {outcome.skipped.length === 1 ? 'Una no entró:' : `${outcome.skipped.length} no entraron:`}
                  </p>
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto">
                    {outcome.skipped.slice(0, 50).map((item, index) => (
                      <li key={`${item.name}-${index}`} className="truncate" title={`${item.name}: ${item.reason}`}>
                        «{item.name}»: {item.reason}
                      </li>
                    ))}
                  </ul>
                  {outcome.skipped.length > 50 && <p>y {outcome.skipped.length - 50} más.</p>}
                </div>
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
