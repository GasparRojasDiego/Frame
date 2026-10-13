import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Download,
  FileText,
  FileWarning,
  Link2,
  LoaderCircle,
  Music2,
  Plus,
  RefreshCcw,
  Upload,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { TaskAttachment } from '@/types';
import {
  pickAndStoreFiles,
  readAttachment,
  storeDroppedFiles,
  type StoredPick,
} from '@/lib/file-handles';
import EchoWord, { EchoHeader } from '@/components/shared/EchoWord';

// ============================================================
// Adjuntos de una tarea: documentos y enlaces.
//
// Desde la 1.6.5 los documentos entran por el recuadro «Adjuntar archivo»:
// una zona que se pulsa (abre el explorador) o sobre la que se sueltan uno o
// varios archivos arrastrados.
//
// Los documentos quedan ENLAZADOS al archivo del disco, no copiados: al
// abrirlos, Frame lee lo que hay ahora mismo, así que el avance que el
// usuario guarde en su Word o su PDF se ve aquí sin volver a adjuntar nada.
// Los audios entran por la misma puerta —son archivos— y el visor los
// reproduce; por eso no hace falta un tipo de adjunto aparte para ellos.
// ============================================================

const isImage = (mime: string) => mime.startsWith('image/');
const isAudio = (mime: string) => mime.startsWith('audio/');
const isPdf = (mime: string) => mime === 'application/pdf';
const isText = (mime: string, name: string) =>
  mime.startsWith('text/') ||
  mime === 'application/json' ||
  /\.(txt|md|csv|json|log)$/i.test(name);

const prettySize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const attachmentIcon = (attachment: TaskAttachment) => {
  if (attachment.kind === 'url') return Link2;
  if (attachment.mime && isAudio(attachment.mime)) return Music2;
  return FileText;
};

async function openExternal(url: string) {
  if (isTauri()) {
    await openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Normaliza lo que escriba el usuario: "clase.com" → "https://clase.com". */
const normalizeUrl = (raw: string): string => {
  const value = raw.trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

// ------------------------------------------------------------
// Visor del documento
// ------------------------------------------------------------
function AttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: TaskAttachment | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const load = async (id: string) => {
    setState('loading');
    setText(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setObjectUrl(null);

    const resolved = await readAttachment(id);
    if (!resolved) {
      setState('missing');
      return;
    }
    setFile(resolved.file);

    const mime = resolved.file.type;
    if (isText(mime, resolved.file.name)) {
      // Solo la cabecera: un log de 40 MB no debe tumbar la ventana.
      setText(await resolved.file.slice(0, 200_000).text());
    } else if (isPdf(mime) || isImage(mime) || isAudio(mime)) {
      const url = URL.createObjectURL(resolved.file);
      objectUrlRef.current = url;
      setObjectUrl(url);
    }
    setState('ready');
  };

  useEffect(() => {
    if (attachment?.kind === 'file') void load(attachment.id);
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment?.id]);

  const handleDownloadCopy = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const mime = file?.type ?? '';

  return (
    <Dialog open={!!attachment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-5 py-3 relative overflow-hidden">
          <EchoWord word="Adjunto" />
          <DialogTitle className="truncate pr-8 text-left text-base font-semibold text-foreground">
            {attachment?.label}
          </DialogTitle>
          {file && (
            <p className="text-left text-[11px] text-muted-foreground">
              {prettySize(file.size)} · Última modificación:{' '}
              {format(new Date(file.lastModified), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
              {attachment?.live === false && ' · copia congelada'}
            </p>
          )}
        </DialogHeader>
        <div aria-hidden className="mx-5 h-px shrink-0 bg-border" />

        <div className="min-h-0 flex-1 overflow-auto bg-secondary/20">
          {state === 'loading' && (
            <div className="flex h-64 items-center justify-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {state === 'missing' && (
            <div className="flex h-64 flex-col items-center justify-center gap-2 px-8 text-center">
              <FileWarning className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">No se pudo abrir el archivo</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Puede que lo hayas movido, renombrado o borrado, o que Frame haya perdido el permiso
                de lectura. Vuelve a adjuntarlo para restablecer el enlace.
              </p>
            </div>
          )}

          {state === 'ready' && (
            <>
              {isPdf(mime) && objectUrl && (
                <iframe src={objectUrl} title={attachment?.label} className="h-[65vh] w-full" />
              )}
              {isImage(mime) && objectUrl && (
                <div className="flex justify-center p-4">
                  <img src={objectUrl} alt={attachment?.label} className="max-h-[65vh] rounded-md" />
                </div>
              )}
              {isAudio(mime) && objectUrl && (
                <div className="flex flex-col items-center gap-4 p-10">
                  <Music2 className="h-10 w-10 text-primary" />
                  <audio controls src={objectUrl} className="w-full max-w-md" />
                </div>
              )}
              {text !== null && (
                <pre className="whitespace-pre-wrap break-words p-5 font-mono text-xs text-foreground">
                  {text}
                </pre>
              )}
              {/* Word, Excel, PowerPoint… no se pueden dibujar aquí, pero lo
                  útil sí se ve: que el archivo cambió y cuándo. */}
              {!isPdf(mime) && !isImage(mime) && !isAudio(mime) && text === null && (
                <div className="flex h-64 flex-col items-center justify-center gap-3 px-8 text-center">
                  <FileText className="h-9 w-9 text-primary/70" />
                  <p className="text-sm font-semibold text-foreground">
                    Este tipo de documento se abre con su programa
                  </p>
                  <p className="max-w-md text-xs text-muted-foreground">
                    Frame no dibuja documentos de Word, Excel o PowerPoint dentro de la ventana,
                    pero sí lee el archivo real: la fecha de arriba es la de tu última vez que lo
                    guardaste, así que el avance queda a la vista.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => attachment && void load(attachment.id)}
            disabled={state === 'loading'}
          >
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            Releer del disco
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadCopy} disabled={!file}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Guardar una copia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// «Adjuntar archivo»: recuadro con una zona para pulsar (abre el explorador)
// o soltar uno o varios archivos arrastrados (1.6.5).
// ------------------------------------------------------------
export function AttachFileDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (added: TaskAttachment[]) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const finish = (picks: StoredPick[]) => {
    if (picks.length === 0) return;
    const now = new Date().toISOString();
    onAdd(
      picks.map(({ id, picked }) => ({
        id,
        kind: 'file' as const,
        label: picked.fileName,
        mime: picked.mime,
        live: picked.live,
        addedAt: now,
      }))
    );
    if (picks.some(({ picked }) => !picked.live)) {
      toast({
        title: 'Adjuntado como copia',
        description: 'Los cambios que hagas después en ese archivo no se verán aquí.',
      });
    }
    onOpenChange(false);
  };

  const pick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      finish(await pickAndStoreFiles());
    } finally {
      setBusy(false);
    }
  };

  const hasFiles = (event: React.DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          depth.current = 0;
          setDragging(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <EchoHeader word="Adjuntar">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-primary">Adjuntar archivo</DialogTitle>
            <DialogDescription className="sr-only">
              Pulsa la zona para elegir archivos o arrástralos y suéltalos sobre ella.
            </DialogDescription>
          </DialogHeader>
        </EchoHeader>
        <button
          type="button"
          onClick={() => void pick()}
          disabled={busy}
          onDragEnter={(event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            depth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={() => {
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0) setDragging(false);
          }}
          onDrop={(event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            depth.current = 0;
            setDragging(false);
            const pending = storeDroppedFiles(event.dataTransfer);
            setBusy(true);
            void pending.then(finish).finally(() => setBusy(false));
          }}
          className={cn(
            'flex h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 text-center transition-colors',
            dragging
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/60 hover:text-foreground'
          )}
        >
          {busy ? <LoaderCircle className="h-7 w-7 animate-spin text-primary" /> : <Upload className="h-7 w-7" />}
          <span className="text-sm font-semibold text-foreground">
            {dragging ? 'Suelta los archivos aquí' : 'Haz clic para elegir archivos'}
          </span>
          <span className="text-xs">o arrástralos y suéltalos aquí</span>
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** Contenido del recuadro de enlace (dirección y nombre opcional). También lo usan los recursos de un evento. */
export function LinkForm({ onAdd }: { onAdd: (attachment: TaskAttachment) => void }) {
  const [urlValue, setUrlValue] = useState('');
  const [urlLabel, setUrlLabel] = useState('');
  const add = () => {
    const url = normalizeUrl(urlValue);
    if (!url) return;
    onAdd({
      id: crypto.randomUUID(),
      kind: 'url',
      label: urlLabel.trim() || url.replace(/^https?:\/\//i, ''),
      url,
      addedAt: new Date().toISOString(),
    });
    setUrlValue('');
    setUrlLabel('');
  };
  return (
    <div className="space-y-2">
      <Label className="text-xs">Dirección</Label>
      <Input
        value={urlValue}
        onChange={(e) => setUrlValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder="classroom.google.com/…"
        className="h-8 text-xs"
        autoFocus
      />
      <Label className="text-xs">Nombre (opcional)</Label>
      <Input
        value={urlLabel}
        onChange={(e) => setUrlLabel(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder="Ej: rúbrica del profesor"
        className="h-8 text-xs"
      />
      <Button size="sm" className="w-full" onClick={add} disabled={!urlValue.trim()}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Añadir enlace
      </Button>
    </div>
  );
}

// ------------------------------------------------------------
// Los dos botones: Documentos y Enlaces (en ese orden)
// ------------------------------------------------------------
export default function TaskAttachments({
  attachments,
  onChange,
  variant = 'toolbar',
  chipClassName,
}: {
  attachments: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
  /** 'toolbar' = botones de icono de la tarjeta de creación.
   *  'chips' = fichas con texto para la fila de datos de una tarea en edición
   *  (con `chipClassName` para que se vean como sus vecinas). */
  variant?: 'toolbar' | 'chips';
  chipClassName?: string;
}) {
  const [fileOpen, setFileOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const fileCount = attachments.filter((a) => a.kind === 'file').length;
  const urlCount = attachments.filter((a) => a.kind === 'url').length;

  const addFiles = (added: TaskAttachment[]) => onChange([...attachments, ...added]);
  const addLink = (attachment: TaskAttachment) => onChange([...attachments, attachment]);

  const fileTitle = fileCount > 0 ? `${fileCount} documento(s) adjunto(s)` : 'Adjuntar documentos';
  const linkTitle = urlCount > 0 ? `${urlCount} enlace(s) adjunto(s)` : 'Adjuntar un enlace';

  return (
    <>
      {variant === 'toolbar' ? (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setFileOpen(true)}
          title={fileTitle}
          className={cn('h-10 w-10 transition-colors', fileCount > 0 && 'border-primary bg-primary/15 text-primary')}
        >
          <FileText className="h-4 w-4" />
        </Button>
      ) : (
        <button type="button" onClick={() => setFileOpen(true)} title={fileTitle} className={cn(chipClassName, 'gap-1')}>
          <FileText className="h-3.5 w-3.5" />
          {fileCount > 0 ? `${fileCount} doc.` : 'Documento'}
        </button>
      )}

      <Popover open={urlOpen} onOpenChange={setUrlOpen}>
        <PopoverTrigger asChild>
          {variant === 'toolbar' ? (
            <Button
              variant="outline"
              size="icon"
              title={linkTitle}
              className={cn('h-10 w-10 transition-colors', urlCount > 0 && 'border-primary bg-primary/15 text-primary')}
            >
              <Link2 className="h-4 w-4" />
            </Button>
          ) : (
            <button type="button" title={linkTitle} className={cn(chipClassName, 'gap-1')}>
              <Link2 className="h-3.5 w-3.5" />
              {urlCount > 0 ? `${urlCount} enlace${urlCount === 1 ? '' : 's'}` : 'Enlace'}
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <LinkForm onAdd={addLink} />
        </PopoverContent>
      </Popover>

      <AttachFileDialog open={fileOpen} onOpenChange={setFileOpen} onAdd={addFiles} />
    </>
  );
}

/**
 * Adjuntos en la tarjeta CERRADA: fichas pequeñas y pulsables. Los enlaces
 * abren el navegador; los documentos, el visor.
 */
export function AttachmentChips({
  attachments,
  onRemove,
}: {
  attachments: TaskAttachment[];
  /** Si se pasa, cada ficha muestra una "x" para quitarla (tarjeta de creación). */
  onRemove?: (attachment: TaskAttachment) => void;
}) {
  const [viewing, setViewing] = useState<TaskAttachment | null>(null);
  if (attachments.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {attachments.map((attachment) => {
          const Icon = attachmentIcon(attachment);
          return (
            <span
              key={attachment.id}
              className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-border/70 bg-secondary/40 pl-2 pr-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/50"
            >
              <button
                type="button"
                onClick={() =>
                  attachment.kind === 'url'
                    ? void openExternal(attachment.url!)
                    : setViewing(attachment)
                }
                title={attachment.kind === 'url' ? attachment.url : 'Abrir el documento'}
                className="inline-flex min-w-0 items-center gap-1 py-0.5 hover:text-primary"
              >
                <Icon className="h-3 w-3 shrink-0 text-primary/80" />
                <span className="truncate">{attachment.label}</span>
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(attachment)}
                  title="Quitar el adjunto"
                  className="shrink-0 rounded-full p-0.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
