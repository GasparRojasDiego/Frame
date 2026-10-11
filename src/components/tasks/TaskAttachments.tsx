import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Download,
  ExternalLink,
  FileText,
  FileWarning,
  Link2,
  LoaderCircle,
  Music2,
  Paperclip,
  Plus,
  RefreshCcw,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { isTauri } from '@tauri-apps/api/core';
import type { TaskAttachment } from '@/types';
import {
  deleteAttachment,
  pickAndStoreFile,
  readAttachment,
  supportsLiveFiles,
} from '@/lib/file-handles';

// ============================================================
// Adjuntos de una tarea: enlaces y documentos.
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
    const { openUrl } = await import('@tauri-apps/plugin-opener');
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
        <DialogHeader className="shrink-0 border-b px-5 py-3">
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
// Lista + acciones
// ------------------------------------------------------------
export default function TaskAttachments({
  attachments,
  onChange,
  variant = 'panel',
}: {
  attachments: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
  /** 'panel' = bloque con título y lista (editor de tarea).
   *  'toolbar' = solo dos botones de icono, para la barra de la tarjeta de
   *  creación; allí la lista se pinta aparte con <AttachmentChips>. */
  variant?: 'panel' | 'toolbar';
}) {
  const { toast } = useToast();
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlLabel, setUrlLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<TaskAttachment | null>(null);

  const addUrl = () => {
    const url = normalizeUrl(urlValue);
    if (!url) return;
    onChange([
      ...attachments,
      {
        id: crypto.randomUUID(),
        kind: 'url',
        label: urlLabel.trim() || url.replace(/^https?:\/\//i, ''),
        url,
        addedAt: new Date().toISOString(),
      },
    ]);
    setUrlValue('');
    setUrlLabel('');
    setUrlOpen(false);
  };

  const addFile = async () => {
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const picked = await pickAndStoreFile(id);
      if (!picked) return;
      onChange([
        ...attachments,
        {
          id,
          kind: 'file',
          label: picked.fileName,
          mime: picked.mime,
          live: picked.live,
          addedAt: new Date().toISOString(),
        },
      ]);
      if (!picked.live) {
        toast({
          title: 'Adjuntado como copia',
          description:
            'Este entorno no permite enlazar el archivo del disco, así que se guardó una copia: los cambios que hagas después no se reflejarán.',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (attachment: TaskAttachment) => {
    if (attachment.kind === 'file') await deleteAttachment(attachment.id);
    onChange(attachments.filter((a) => a.id !== attachment.id));
  };

  const urlCount = attachments.filter((a) => a.kind === 'url').length;
  const fileCount = attachments.filter((a) => a.kind === 'file').length;

  if (variant === 'toolbar') {
    return (
      <>
        <Popover open={urlOpen} onOpenChange={setUrlOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              title={urlCount > 0 ? `${urlCount} enlace(s) adjunto(s)` : 'Adjuntar un enlace'}
              className={cn('h-10 w-10 transition-colors', urlCount > 0 && 'border-primary bg-primary/15 text-primary')}
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="start">
            <Label className="text-xs">Dirección</Label>
            <Input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              placeholder="classroom.google.com/…"
              className="h-8 text-xs"
              autoFocus
            />
            <Label className="text-xs">Nombre (opcional)</Label>
            <Input
              value={urlLabel}
              onChange={(e) => setUrlLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              placeholder="Ej: rúbrica del profesor"
              className="h-8 text-xs"
            />
            <Button size="sm" className="w-full" onClick={addUrl} disabled={!urlValue.trim()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Añadir enlace
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Puedes añadir tantos como quieras: el recuadro se queda abierto.
            </p>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="icon"
          onClick={() => void addFile()}
          disabled={busy}
          title={
            fileCount > 0
              ? `${fileCount} documento(s) adjunto(s)`
              : supportsLiveFiles()
                ? 'Adjuntar un documento: queda enlazado y Frame verá tus cambios'
                : 'Adjuntar una copia del documento'
          }
          className={cn('h-10 w-10 transition-colors', fileCount > 0 && 'border-primary bg-primary/15 text-primary')}
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5 text-primary" />
          Adjuntos
        </span>

        <Popover open={urlOpen} onOpenChange={setUrlOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]">
              <Link2 className="mr-1 h-3.5 w-3.5" />
              Enlace
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="start">
            <Label className="text-xs">Dirección</Label>
            <Input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              placeholder="classroom.google.com/…"
              className="h-8 text-xs"
              autoFocus
            />
            <Label className="text-xs">Nombre (opcional)</Label>
            <Input
              value={urlLabel}
              onChange={(e) => setUrlLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              placeholder="Ej: rúbrica del profesor"
              className="h-8 text-xs"
            />
            <Button size="sm" className="w-full" onClick={addUrl} disabled={!urlValue.trim()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Añadir enlace
            </Button>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => void addFile()}
          disabled={busy}
          title={
            supportsLiveFiles()
              ? 'El documento queda enlazado: si lo editas y lo guardas, Frame verá la versión nueva'
              : 'Se guardará una copia del documento'
          }
        >
          {busy ? (
            <LoaderCircle className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="mr-1 h-3.5 w-3.5" />
          )}
          Documento
        </Button>
      </div>

      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((attachment) => {
            const Icon = attachmentIcon(attachment);
            return (
              <li
                key={attachment.id}
                className="group/att flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-2 py-1.5"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <button
                  type="button"
                  onClick={() =>
                    attachment.kind === 'url'
                      ? void openExternal(attachment.url!)
                      : setViewing(attachment)
                  }
                  className="min-w-0 flex-1 truncate text-left text-[11px] text-foreground hover:text-primary hover:underline"
                  title={attachment.kind === 'url' ? attachment.url : 'Abrir el documento'}
                >
                  {attachment.label}
                </button>
                {attachment.kind === 'file' && attachment.live === false && (
                  <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                    copia
                  </span>
                )}
                {attachment.kind === 'url' && (
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                )}
                <button
                  type="button"
                  onClick={() => void remove(attachment)}
                  title="Quitar el adjunto (no borra nada de tu disco)"
                  className={cn(
                    'shrink-0 rounded p-0.5 text-muted-foreground transition-opacity hover:text-destructive',
                    'opacity-0 group-hover/att:opacity-100 focus-visible:opacity-100'
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />
    </div>
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
