import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Pencil,
  Trash2,
  Check,
  X,
  LoaderCircle,
  SquarePen,
  StickyNote,
  Clock,
  Link2,
  FileText,
  FileSpreadsheet,
  FileImage,
  Download,
  CheckCircle2,
  ListChecks,
  Timer as TimerIcon,
  ArrowLeft,
  Archive,
} from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { Course, Note, NoteKind, Task } from '@/types';
import { cn } from '@/lib/utils';
import { formatMinutes, sessionSeconds } from '@/lib/duration';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CompletedTaskCard, minutesByTask } from '@/components/tasks/CompletedTasksView';
import TaskComposer, { type TaskDraft } from '@/components/tasks/TaskComposer';
import { useCourse } from '@/context/CourseContext';
import { getImage } from '@/lib/music-db';
import { useStoredImage } from '@/hooks/use-stored-image';
import WaveBackdrop from '@/components/courses/WaveBackdrop';
import NameDriftBackdrop from '@/components/courses/NameDriftBackdrop';
import RecordingsSection from '@/components/recordings/RecordingsSection';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import RichNoteView from '@/components/temporizador/RichNoteView';
import { richNoteToLine } from '@/lib/rich-note';
import { ExternalLink } from 'lucide-react';
import { EchoHeader } from '@/components/shared/EchoWord';


function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileIconFor(mime?: string, fileName?: string) {
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase();
  if (mime?.startsWith('image/') || ['png', 'jpg', 'jpeg'].includes(ext ?? '')) return FileImage;
  if (['xls', 'xlsx'].includes(ext ?? '')) return FileSpreadsheet;
  return FileText;
}

function NoteFileAttachment({ note }: { note: Note }) {
  const { toast } = useToast();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isViewerOpen, setViewerOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getImage(`noteFile_${note.id}`).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [note.id]);

  const isImage = note.fileMime?.startsWith('image/');
  const isPdf =
    note.fileMime === 'application/pdf' || (note.fileName ?? '').toLowerCase().endsWith('.pdf');
  const canPreviewInApp = isImage || isPdf;
  const Icon = fileIconFor(note.fileMime, note.fileName);

  // Los data: URL no siempre se pueden navegar en el webview; un blob: URL sí.
  const openViewer = () => {
    if (!dataUrl) return;
    if (isPdf) {
      try {
        const base64 = dataUrl.split(',')[1] ?? '';
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        /* si falla, el iframe intentará con el dataUrl directo */
      }
    }
    setViewerOpen(true);
  };

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Word/Excel (y cualquier tipo) abren con la app del sistema desde Frame,
  // sin volver a descargar: el backend guarda una copia temporal y la abre.
  const handleOpenWithSystem = async () => {
    if (!dataUrl) return;
    if (isTauri()) {
      try {
        await invoke('open_note_file', {
          fileName: note.fileName || 'archivo',
          dataBase64: dataUrl.split(',')[1] ?? '',
        });
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Abrir archivo', description: String(e) });
      }
    } else {
      window.open(dataUrl, '_blank');
    }
  };

  const handleOpen = () => {
    if (canPreviewInApp) openViewer();
    else void handleOpenWithSystem();
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = note.fileName || 'archivo';
    a.click();
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-md border border-border/60 bg-secondary/40 px-3 py-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={!dataUrl}
          className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
          title={canPreviewInApp ? 'Ver dentro de la app' : 'Abrir con la aplicación del sistema'}
        >
          {isImage && dataUrl ? (
            <img src={dataUrl} alt={note.fileName} className="h-10 w-10 shrink-0 rounded object-cover" />
          ) : (
            <Icon className="h-6 w-6 shrink-0 text-primary" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground transition-colors hover:text-primary">
              {note.fileName || 'Archivo'}
            </p>
            {note.content && <p className="truncate text-[11px] text-muted-foreground">{note.content}</p>}
          </div>
        </button>
        {isTauri() && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => void handleOpenWithSystem()}
            disabled={!dataUrl}
            title="Abrir con la aplicación del sistema"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={handleDownload}
          disabled={!dataUrl}
          title="Guardar una copia"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Visor integrado: imágenes y PDF se ven sin salir de Frame */}
      <Dialog open={isViewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl">
          <EchoHeader word="Archivo">
            <DialogHeader>
              <DialogTitle className="truncate pr-8 text-base text-primary">
                {note.fileName || 'Archivo'}
              </DialogTitle>
            </DialogHeader>
          </EchoHeader>
          {isImage && dataUrl && (
            <img
              src={dataUrl}
              alt={note.fileName}
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={blobUrl ?? dataUrl ?? undefined}
              title={note.fileName || 'PDF'}
              className="h-[75vh] w-full rounded-md border border-border bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// To fix the hook order error, we extract the note item into its own component.
// This ensures that `useSortable` is always called at the top level of this component.
interface SortableNoteCardProps {
  note: Note;
  isCurrentlyEditing: boolean;
  editingContent: string;
  onContentChange: (value: string) => void;
  onStartEdit: (note: Note) => void;
  onSave: (noteId: string) => void;
  onCancel: () => void;
  onDelete: (noteId: string) => void;
}

const SortableNoteCard = ({
  note,
  isCurrentlyEditing,
  editingContent,
  onContentChange,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: SortableNoteCardProps) => {
  const kind: NoteKind = note.kind ?? 'text';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    disabled: isCurrentlyEditing,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDeleteTriggered = useRef(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && isCurrentlyEditing) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editingContent, isCurrentlyEditing]);

  const formattedDate = useMemo(() => {
    if (!note.createdAt) return null;
    try {
        const date = parseISO(note.createdAt);
        const formatted = format(date, "eeee, d 'de' MMMM 'del' yyyy", { locale: es });
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
        console.error("Invalid date format for note:", e);
        return null;
    }
  }, [note.createdAt]);

  const wordCount = (isCurrentlyEditing ? editingContent : note.content || '').trim().split(/\s+/).filter(Boolean).length;
  const isJustifiable = wordCount >= 5;

  const handleBlur = () => {
    if (isDeleteTriggered.current) {
        isDeleteTriggered.current = false;
        return;
    }
    onSave(note.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  // La cabecera con la fecha es también el asidero de arrastre, por eso va
  // siempre visible (antes dependía del interruptor del ojo, ya retirado).
  const canDrag = !isCurrentlyEditing;
  const showTrash = isCurrentlyEditing || kind !== 'text';
  const showSeparator = !!formattedDate;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={cn("bg-secondary/50 group", isDragging && "shadow-lg opacity-75")}>
        <CardContent className="p-3">
          <div className="space-y-2">
              <div className={cn(
                "flex items-center",
                isCurrentlyEditing ? "min-h-[28px]" : ""
              )}>
                  <div className="w-7 shrink-0" />
                  <div
                    {...(canDrag ? { ...listeners, ...attributes } : {})}
                    className={cn(
                        "flex-grow",
                        canDrag && "cursor-grab active:cursor-grabbing",
                        isCurrentlyEditing ? "py-1" : ""
                    )}
                  >
                      {formattedDate && (
                          <p className="text-primary font-bold text-xs text-center">{formattedDate}</p>
                      )}
                  </div>
                  <div className="shrink-0 w-7">
                    {showTrash && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500/80"
                            onMouseDown={() => {
                              isDeleteTriggered.current = true;
                            }}
                          >
                              <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esto eliminará permanentemente esta nota. Esta acción se puede deshacer durante un breve período de tiempo.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(note.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
              </div>
              {formattedDate && <Separator/>}

              {kind === 'text' ? (
                isCurrentlyEditing ? (
                  <Textarea
                      ref={textareaRef}
                      value={editingContent}
                      onBlur={handleBlur}
                      onKeyDown={handleKeyDown}
                      onChange={(e) => {
                          onContentChange(e.target.value);
                          const textarea = e.target;
                          textarea.style.height = 'auto';
                          textarea.style.height = `${textarea.scrollHeight}px`;
                      }}
                      className={cn(
                          "text-xs text-muted-foreground bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none overflow-hidden whitespace-pre-wrap px-0",
                          isJustifiable && "text-justify",
                          showSeparator ? "pt-2" : "pt-0"
                      )}
                      autoFocus
                      rows={1}
                  />
                ) : (
                  <div
                      onClick={() => onStartEdit(note)}
                      className={cn(
                          "text-xs text-muted-foreground whitespace-pre-wrap cursor-text min-h-[20px]",
                          isJustifiable && "text-justify",
                          showSeparator ? "pt-2" : "pt-0"
                      )}
                  >
                      {note.content ? <RichNoteView text={note.content} /> : <span className="italic text-muted-foreground/50">Haz clic para añadir contenido...</span>}
                  </div>
                )
              ) : kind === 'url' ? (
                <a
                  href={note.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary transition-colors hover:bg-primary/10"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{note.content || note.url}</span>
                </a>
              ) : (
                <NoteFileAttachment note={note} />
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


type NotePatch = Partial<Pick<Note, 'content' | 'url' | 'fileName'>>;

const resourceIconFor = (kind: NoteKind) =>
  kind === 'url' ? Link2 : kind === 'file' ? FileText : StickyNote;

const resourceTitleFor = (note: Note) => {
  const kind: NoteKind = note.kind ?? 'text';
  if (kind === 'file') return note.fileName || 'Archivo';
  if (kind === 'url') return note.content || note.url || 'Enlace';
  return note.content || 'Recurso sin contenido';
};

interface ManageResourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  onUpdate: (noteId: string, updates: NotePatch) => void;
  /** Envía el recurso a Archivados (con unos segundos para deshacer). */
  onDelete: (noteId: string) => void;
}

/**
 * Gestor de recursos de la asignatura: edición en línea del contenido, el
 * enlace o el nombre del archivo, y borrado con confirmación.
 */
const ManageResourcesDialog = ({
  open,
  onOpenChange,
  notes,
  onUpdate,
  onDelete,
}: ManageResourcesDialogProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NotePatch>({});
  // Una única confirmación controlada por estado: un AlertDialog por fila
  // desmontaría su propio disparador al borrar y el diálogo padre perdería
  // el foco (y se cerraría solo).
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft({});
  }, []);

  useEffect(() => {
    if (!open) {
      cancelEdit();
      setPendingDelete(null);
    }
  }, [open, cancelEdit]);

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setDraft({
      content: note.content ?? '',
      url: note.url ?? '',
      fileName: note.fileName ?? '',
    });
  };

  const saveEdit = (note: Note) => {
    const kind: NoteKind = note.kind ?? 'text';
    const patch: NotePatch = { content: (draft.content ?? '').trim() };
    // Enlace y nombre de archivo son obligatorios: si se vacían, se conserva
    // el valor anterior para no dejar el recurso inservible.
    if (kind === 'url') patch.url = (draft.url ?? '').trim() || note.url;
    if (kind === 'file') patch.fileName = (draft.fileName ?? '').trim() || note.fileName;
    onUpdate(note.id, patch);
    cancelEdit();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <EchoHeader word="Recursos">
            <DialogHeader>
              <DialogTitle className="text-base text-primary">Editar recursos</DialogTitle>
              <DialogDescription className="text-xs">
                Modifica el contenido, el enlace o la descripción de cada recurso, o elimínalo.
              </DialogDescription>
            </DialogHeader>
          </EchoHeader>

          {notes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Esta asignatura ya no tiene recursos.
            </p>
          ) : (
            <div className="-mr-1 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {notes.map((note) => {
                const kind: NoteKind = note.kind ?? 'text';
                const Icon = resourceIconFor(kind);
                const isEditing = editingId === note.id;
                return (
                  <div
                    key={note.id}
                    className="rounded-md border border-border/60 bg-secondary/30 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            {kind === 'url' && (
                              <Input
                                value={draft.url ?? ''}
                                placeholder="https://..."
                                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                                className="h-8 text-xs"
                                autoFocus
                              />
                            )}
                            {kind === 'file' && (
                              <Input
                                value={draft.fileName ?? ''}
                                placeholder="Nombre del archivo"
                                onChange={(e) => setDraft((d) => ({ ...d, fileName: e.target.value }))}
                                className="h-8 text-xs"
                                autoFocus
                              />
                            )}
                            {kind === 'text' ? (
                              <Textarea
                                value={draft.content ?? ''}
                                rows={3}
                                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                                className="resize-none text-xs"
                                autoFocus
                              />
                            ) : (
                              <Input
                                value={draft.content ?? ''}
                                placeholder="Descripción (opcional)"
                                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                                className="h-8 text-xs"
                              />
                            )}
                          </div>
                        ) : (
                          <>
                            <p className="truncate text-xs font-medium text-foreground">
                              {resourceTitleFor(note)}
                            </p>
                            {kind === 'url' && note.url && (
                              <p className="truncate text-[11px] text-muted-foreground">{note.url}</p>
                            )}
                            {kind === 'file' && note.content && (
                              <p className="truncate text-[11px] text-muted-foreground">{note.content}</p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-green-500"
                              onClick={() => saveEdit(note)}
                              title="Guardar cambios"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={cancelEdit}
                              title="Cancelar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => startEdit(note)}
                              title="Editar recurso"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500/80 hover:text-red-500"
                              onClick={() => setPendingDelete(note)}
                              title="Eliminar recurso"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este recurso?</AlertDialogTitle>
            <AlertDialogDescription>
              «{pendingDelete ? resourceTitleFor(pendingDelete) : ''}» pasará a los Archivados de la
              asignatura. Podrás deshacerlo durante unos segundos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
                cancelEdit();
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};


export default function CourseDetailsClient({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** Colección desde la que se abrió la asignatura, si la hubo. La lleva la
   *  URL (?from=<id>) porque la vista de colección es estado local de la
   *  cuadrícula y sin este dato el retroceso caería siempre en la raíz. */
  const fromSpaceId = searchParams.get('from');
  const backLabel = fromSpaceId ? 'Volver a la colección' : 'Volver a Asignaturas';
  const handleBack = () =>
    router.push(fromSpaceId ? `/knowledge?space=${fromSpaceId}` : '/knowledge');
  const highlightTaskId = searchParams.get('highlightTaskId');

  const {
    courses,
    tasks: allTasks,
    notes: allNotes,
    getNotesForCourse,
    updateCourse,
    deleteCourse,
    archivedTasks,
    archivedNotes,
    addTask,
    updateTasksOrder,
    addNote,
    updateNote,
    deleteNote,
    updateNotesOrder,
    userProfile,
    studySessions,
    completedTasksByCourse,
  } = useCourse();

  const [course, setCourse] = useState<Course | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Imagen de portada (la misma de la tarjeta en Asignaturas): se muestra
  // como banner de extremo a extremo en la cabecera del panel.
  // Se relee sola: también cuando la imagen llega de otro dispositivo.
  const [coverImage] = useStoredImage(id ? `courseImage_${id}` : null);

  // Sección activa bajo el botón dual: tareas pendientes O recursos (1.6.6:
  // «Recursos» sustituye a «Clases»; las clases del horario se retiraron).
  const [activeSection, setActiveSection] = useState<'tasks' | 'resources'>('tasks');
  /** Los recursos, ordenados por tipo: anotaciones, enlaces y archivos. */
  const resourceGroups = useMemo(
    () =>
      (
        [
          ['text', 'Anotaciones'],
          ['url', 'Enlaces'],
          ['file', 'Archivos'],
        ] as const
      )
        .map(([kind, label]) => ({ kind, label, items: notes.filter((note) => (note.kind ?? 'text') === kind) }))
        .filter((group) => group.items.length > 0),
    [notes]
  );
  // Vista de Archivados (tareas culminadas + recursos eliminados).
  const [showArchived, setShowArchived] = useState(false);


  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const foundCourse = courses.find(c => c.id === id);
    if (foundCourse) {
      setCourse(foundCourse);
      const courseTasks = allTasks.filter(t => t.courseId === id).sort((a,b) => (a.order || 0) - (b.order || 0));
      setTasks(courseTasks);
      const courseNotes = getNotesForCourse(id).sort((a,b) => (a.order || 0) - (b.order || 0));
      setNotes(courseNotes);
    }
    setIsLoading(false);
  }, [id, courses, getNotesForCourse, allTasks]);


  const [isEditing, setIsEditing] = useState(false);
  const [editedCourseName, setEditedCourseName] = useState('');
  const [editedTeacherName, setEditedTeacherName] = useState('');

  const [newNoteKind, setNewNoteKind] = useState<NoteKind>('text');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteUrl, setNewNoteUrl] = useState('');
  const [newNoteFile, setNewNoteFile] = useState<File | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  // Gestor de recursos: editar contenido/enlace/nombre y eliminar.
  const [isManageNotesOpen, setManageNotesOpen] = useState(false);

  const isNewNoteJustifiable = newNoteContent.trim().split(/\s+/).filter(Boolean).length >= 5;

  const newNoteTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const textarea = newNoteTextareaRef.current;
    if (textarea && newNoteKind === 'text') {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [newNoteContent, newNoteKind]);

  useEffect(() => {
    if (course && !isEditing) {
      setEditedCourseName(course.name);
      setEditedTeacherName(course.teacherName || '');
    }
  }, [course, isEditing]);

  useEffect(() => {
    if (highlightTaskId && tasks.length > 0) {
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`task-card-${highlightTaskId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [highlightTaskId, tasks]);

  const handleEditCourse = () => {
    if (course) {
      setEditedCourseName(course.name);
      setEditedTeacherName(course.teacherName || '');
      setIsEditing(true);
    }
  };

  const handleCancelEditCourse = () => {
    setIsEditing(false);
    if(course) {
      setEditedCourseName(course.name);
      setEditedTeacherName(course.teacherName || '');
    }
  };

  const handleSaveCourse = () => {
    if (editedCourseName.trim() && course) {
      updateCourse(course.id, { name: editedCourseName, teacherName: editedTeacherName || undefined });
      setIsEditing(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (course) {
      deleteCourse(course.id);
      router.push('/knowledge');
    }
  };

  const handleAddTask = (draft: TaskDraft) => {
    if (!userProfile || !course) return;
    addTask({
      ...draft,
      progress: 0,
      order: -Date.now(),
      courseId: id,
      courseName: course.name,
      uid: userProfile.id,
    });
  };

  const resetNoteForm = () => {
    setNewNoteKind('text');
    setNewNoteContent('');
    setNewNoteUrl('');
    setNewNoteFile(null);
  };

  const canSaveNote =
    newNoteKind === 'text' ? newNoteContent.trim().length > 0 :
    newNoteKind === 'url' ? newNoteUrl.trim().length > 0 :
    !!newNoteFile;

  // "Limpiar" solo tiene sentido si hay algo escrito en CUALQUIER pestaña,
  // no solo en la activa (p. ej. una URL tecleada y luego cambiar a Texto).
  const hasNoteDraft =
    newNoteContent.trim().length > 0 || newNoteUrl.trim().length > 0 || !!newNoteFile;

  const handleAddNote = async () => {
    if (!canSaveNote || isSavingNote) return;
    setIsSavingNote(true);
    try {
      if (newNoteKind === 'text') {
        addNote(id, newNoteContent.trim());
      } else if (newNoteKind === 'url') {
        addNote(id, newNoteContent.trim(), { kind: 'url', url: newNoteUrl.trim() });
      } else if (newNoteFile) {
        const dataUrl = await fileToDataUrl(newNoteFile);
        addNote(id, newNoteContent.trim(), {
          kind: 'file',
          fileName: newNoteFile.name,
          fileMime: newNoteFile.type,
          fileDataUrl: dataUrl,
        });
      }
      resetNoteForm();
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleCancelAddNote = () => {
    resetNoteForm();
  };

  const startEditingNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  const handleSaveNote = (noteId: string) => {
    // Check if content has changed to avoid unnecessary writes
    const noteToSave = notes.find(n => n.id === noteId);
    if (noteToSave && editingNoteContent.trim() === noteToSave.content.trim()) {
      cancelEditingNote(); // Still exit edit mode
      return;
    }
    // Allow saving an empty note
    updateNote(noteId, editingNoteContent.trim());
    cancelEditingNote();
  };

  const handleDeleteNote = (noteId: string) => {
    deleteNote(noteId);
    cancelEditingNote(); // Exit edit mode after deleting
  };

  // Guardado parcial desde el gestor de recursos (contenido, enlace, nombre).
  const handleUpdateNoteFields = (noteId: string, updates: NotePatch) => {
    updateNote(noteId, updates);
  };

  const handleTaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
        const oldIndex = tasks.findIndex((t) => t.id === active.id);
        const newIndex = tasks.findIndex((t) => t.id === over.id);
        const reorderedCourseTasks = arrayMove(tasks, oldIndex, newIndex);

        // Update local state for immediate UI feedback
        setTasks(reorderedCourseTasks);

        // Create new global list and call context update
        // This is destructive to global order but consistent with the Tareas page.
        const otherCoursesTasks = allTasks
          .filter(t => t.courseId !== id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const newGlobalOrder = [...otherCoursesTasks, ...reorderedCourseTasks];
        updateTasksOrder(newGlobalOrder);
    }
  };

  const handleNoteDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
        const oldIndex = notes.findIndex((n) => n.id === active.id);
        const newIndex = notes.findIndex((n) => n.id === over.id);
        const reorderedCourseNotes = arrayMove(notes, oldIndex, newIndex);

        setNotes(reorderedCourseNotes);

        const otherCourseNotes = allNotes
          .filter(n => n.courseId !== id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const newGlobalNoteOrder = [...otherCourseNotes, ...reorderedCourseNotes];
        updateNotesOrder(newGlobalNoteOrder);
    }
  };

  const courseSessions = useMemo(() => {
    if (!course) return [];
    return (studySessions ?? []).filter((s) => {
      if (s.subjectIds && s.subjectIds.length > 0) return s.subjectIds.includes(course.id);
      return s.subjects?.includes(course.name) ?? false;
    });
  }, [studySessions, course]);

  // Se acumula en segundos exactos: `duration` son minutos con decimales y
  // redondear cada sesión por separado arrastraría error (y daría "0h 60m").
  const studyLabel = useMemo(
    () => formatMinutes(courseSessions.reduce((acc, s) => acc + sessionSeconds(s), 0) / 60),
    [courseSessions]
  );
  const completedCount = course ? (completedTasksByCourse[course.id] || 0) : 0;

  // Archivados de ESTA asignatura, del más reciente al más antiguo.
  const courseArchivedTasks = useMemo(
    () =>
      archivedTasks
        .filter((t) => t.courseId === id)
        .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)),
    [archivedTasks, id]
  );
  const courseArchivedNotes = useMemo(
    () =>
      archivedNotes
        .filter((n) => n.courseId === id)
        .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)),
    [archivedNotes, id]
  );


  /** Minutos imputados a cada tarea, con la misma regla de reparto que usa
   *  el resto de la app (una sesión se divide entre las tareas que declaró). */
  const studiedByTask = useMemo(() => minutesByTask(studySessions ?? []), [studySessions]);

  const archiveSummary = useMemo(() => {
    let minutes = 0;
    let onTime = 0;
    let withDeadline = 0;
    for (const t of courseArchivedTasks) {
      minutes += studiedByTask.get(t.id) ?? 0;
      if (!t.dueDate) continue;
      withDeadline += 1;
      try {
        if (
          format(parseISO(t.archivedAt), 'yyyy-MM-dd') <=
          format(parseISO(t.dueDate), 'yyyy-MM-dd')
        ) {
          onTime += 1;
        }
      } catch {
        /* fecha corrupta: no puntúa */
      }
    }
    return { total: courseArchivedTasks.length, minutes, onTime, withDeadline };
  }, [courseArchivedTasks, studiedByTask]);

  /** Tareas culminadas agrupadas por mes, del más reciente al más antiguo. */
  const archiveByMonth = useMemo(() => {
    const map = new Map<string, { key: string; label: string; tasks: typeof courseArchivedTasks }>();
    for (const task of courseArchivedTasks) {
      let key: string;
      let label: string;
      try {
        const date = parseISO(task.archivedAt);
        key = format(date, 'yyyy-MM');
        const monthLabel = format(date, "MMMM 'de' yyyy", { locale: es });
        label = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      } catch {
        continue;
      }
      const group = map.get(key);
      if (group) group.tasks.push(task);
      else map.set(key, { key, label, tasks: [task] });
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [courseArchivedTasks]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-16">
        <p className="text-lg text-muted-foreground">Asignatura no encontrada. Puede que haya sido eliminada.</p>
        <Button onClick={() => router.push('/cursos')} className="mt-4">Volver a Asignaturas</Button>
      </div>
    );
  }

  // Botones de la franja izquierda: azul «fantasma» (borde del azul de la app,
  // interior apenas teñido).
  const ghostBtn =
    'h-9 w-9 rounded-full border border-primary bg-primary/10 text-primary transition-colors hover:bg-primary/20 hover:text-primary';

  // La portada se cambia desde la tarjeta de la asignatura (en Asignaturas o
  // dentro de su colección): tenerlo también aquí duplicaba la misma acción.
  // Los CUATRO botones van en una sola columna, a la misma distancia unos de
  // otros y centrados en la altura de la franja.
  const courseActions = (
    <div className="flex flex-col items-center gap-3">
      {/* Retroceso: vuelve a la colección de la que se entró, o a Asignaturas. */}
      <Button size="icon" variant="ghost" className={ghostBtn} title={backLabel} onClick={handleBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={ghostBtn} title="Editar asignatura" onClick={handleEditCourse}>
        <Pencil className="h-4 w-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(ghostBtn, 'hover:border-red-500 hover:bg-red-500/10 hover:text-red-500')}
            title="Eliminar asignatura"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta asignatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{course.name}» con sus tareas y recursos. Puedes deshacerlo unos segundos con Ctrl+Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCourse} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button
        size="icon"
        variant="ghost"
        className={cn(ghostBtn, showArchived && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground')}
        title="Archivados: tareas culminadas y recursos eliminados"
        onClick={() => setShowArchived((p) => !p)}
      >
        <Archive className="h-4 w-4" />
      </Button>
    </div>
  );

  // Los cuatro datos, apilados y separados por tres líneas finas.
  const bannerStats = (
    <div className="flex w-full flex-col divide-y divide-border/70">
      {[
        { icon: CheckCircle2, label: 'Tareas culminadas', value: completedCount },
        { icon: ListChecks, label: 'Tareas pendientes', value: tasks.length },
        { icon: Clock, label: 'Tiempo de estudio', value: studyLabel },
        { icon: TimerIcon, label: 'Sesiones de estudio', value: courseSessions.length },
      ].map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex flex-1 items-center gap-3 py-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-foreground">{value}</p>
            <p className="truncate text-[10px] text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 md:p-8">
      {/* CABECERA de extremo a extremo, en tres bloques de la MISMA altura:
          franja de acciones · portada · franja de datos. Las franjas llevan el
          color de las tarjetas (casi blanco en claro) y estrechan la portada,
          que así no se deforma por exceso de ancho. Sobre la portada, un
          degradado nace a la derecha con el color de la franja y se disuelve
          hacia la izquierda: imagen y datos quedan fundidos. */}
      <div className="relative -mx-6 -mt-6 flex h-52 items-stretch overflow-hidden border-b border-border/60 md:-mx-8 md:-mt-8 md:h-60">
        <aside className="z-10 flex w-[68px] shrink-0 items-center justify-center border-r border-border/60 bg-card md:w-20">
          {courseActions}
        </aside>

        <div className="relative min-w-0 flex-1 overflow-hidden">
          {coverImage ? (
            <img src={coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <WaveBackdrop />
          )}
          <div className="absolute inset-y-0 right-0 w-3/5 bg-gradient-to-l from-card via-card/70 to-transparent" />
        </div>

        <aside className="z-10 flex w-[200px] shrink-0 items-stretch bg-card px-5 py-3 md:w-[236px] md:px-6">
          {bannerStats}
        </aside>
      </div>

      {/* Nombre de la asignatura: centrado, en blanco, con olas detrás.
          A sangre: los márgenes negativos cancelan EXACTAMENTE el padding del
          contenedor (p-6 md:p-8) para que las olas vayan del sidebar al borde
          derecho. Si cambia ese padding, hay que cambiar estos negativos. */}
      <div className="relative -mx-6 mt-6 overflow-hidden py-7 md:-mx-8">
        <NameDriftBackdrop name={course.name} />
        <div className="relative z-10 flex flex-col items-center gap-1 px-6 text-center md:px-8">
          {isEditing ? (
            <div className="flex w-full max-w-md flex-col items-center gap-2">
              <Input
                value={editedCourseName}
                onChange={(e) => setEditedCourseName(e.target.value)}
                className="h-10 text-center text-xl font-bold"
                placeholder="Nombre de la asignatura"
              />
              <Input
                value={editedTeacherName}
                onChange={(e) => setEditedTeacherName(e.target.value)}
                placeholder="Nombre del profesor"
                className="h-9 text-center text-sm text-muted-foreground"
              />
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={handleSaveCourse}><Check className="h-5 w-5 text-green-500"/></Button>
                <Button size="icon" variant="ghost" onClick={handleCancelEditCourse}><X className="h-5 w-5 text-red-500"/></Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-foreground font-headline">{course.name}</h1>
              {course.teacherName && (
                <p className="text-sm text-muted-foreground">{course.teacherName}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Gestión de recursos: editar contenido/enlace/nombre o eliminar */}
      <ManageResourcesDialog
        open={isManageNotesOpen}
        onOpenChange={setManageNotesOpen}
        notes={notes}
        onUpdate={handleUpdateNoteFields}
        onDelete={handleDeleteNote}
      />

      {showArchived ? (
        /* ===== ARCHIVADOS: tareas culminadas y recursos eliminados (sin
           desarchivar). El botón de basura purga TODO el archivo de la
           asignatura tras una confirmación con cuenta regresiva. ===== */
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Archive className="h-5 w-5 text-primary" /> Archivados
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Registro permanente de esta asignatura. No se puede vaciar: es la
              base de los informes de rendimiento.
            </p>
          </div>

          {/* Resumen: las mismas cifras que pide un informe. */}
          {courseArchivedTasks.length > 0 && (
            <Card className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] text-muted-foreground">Tareas culminadas</p>
                <p className="font-headline text-2xl font-bold tabular-nums text-primary">
                  {archiveSummary.total}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Tiempo dedicado</p>
                <p className="font-headline text-2xl font-bold tabular-nums text-foreground">
                  {archiveSummary.minutes > 0 ? formatMinutes(Math.round(archiveSummary.minutes)) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Entregadas a tiempo</p>
                <p className="font-headline text-2xl font-bold tabular-nums text-foreground">
                  {archiveSummary.withDeadline > 0
                    ? `${archiveSummary.onTime}/${archiveSummary.withDeadline}`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Recursos archivados</p>
                <p className="font-headline text-2xl font-bold tabular-nums text-foreground">
                  {courseArchivedNotes.length}
                </p>
              </div>
            </Card>
          )}

          {courseArchivedTasks.length === 0 && courseArchivedNotes.length === 0 ? (
            <Card className="flex h-28 items-center justify-center border-dashed">
              <p className="text-sm text-muted-foreground">
                Aún no hay tareas culminadas ni recursos archivados.
              </p>
            </Card>
          ) : (
            <>
              {/* Tareas culminadas, agrupadas por mes y con la misma tarjeta
                  pulida que la interfaz Tareas: mismo lenguaje en los dos sitios. */}
              {archiveByMonth.map(({ key, label, tasks: monthTasks }) => (
                <div key={key} className="space-y-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h4 className="text-xs font-bold text-foreground">
                      {label}
                    </h4>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {monthTasks.length} {monthTasks.length === 1 ? 'tarea' : 'tareas'}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {monthTasks.map((t) => (
                      <CompletedTaskCard
                        key={t.id}
                        task={t}
                        studiedMinutes={studiedByTask.get(t.id) ?? 0}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {courseArchivedNotes.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h4 className="text-xs font-bold text-foreground">
                      Recursos archivados
                    </h4>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {courseArchivedNotes.length}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {courseArchivedNotes.map((n) => (
                      <Card
                        key={n.id}
                        className="relative overflow-hidden border-border/70 bg-card/70 p-3.5 shadow-sm"
                      >
                        <span className="absolute inset-y-0 left-0 w-[3px] bg-muted-foreground/40" />
                        <div className="flex items-start gap-2 pl-1.5">
                          {n.kind === 'url' ? (
                            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          ) : n.kind === 'file' ? (
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {n.kind === 'file' ? n.fileName ?? 'Archivo' : n.kind === 'url' ? n.url : richNoteToLine(n.content ?? '')}
                            </p>
                            {n.kind !== 'text' && n.content && (
                              <p className="truncate text-xs text-muted-foreground">{n.content}</p>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 border-t border-border/60 pl-1.5 pt-2 text-[10px] text-muted-foreground/90">
                          Archivado el{' '}
                          {format(parseISO(n.archivedAt), "d 'de' MMMM yyyy, h:mm a", { locale: es })}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
      <>
      {/* Fila de creación: nueva tarea (izquierda, ~70%) + nuevo recurso (derecha, ~30%) */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-10">
        <TaskComposer className="lg:col-span-7" onCreate={handleAddTask} />

        {/* Tarjeta de nuevo RECURSO (antes "Nota"): siempre visible a la derecha */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-3">
            <CardTitle className="text-base">Nuevo recurso</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => setManageNotesOpen(true)}
              disabled={notes.length === 0}
              title="Editar o eliminar recursos"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-3">
            <div className="flex gap-1.5">
              {(['text', 'url', 'file'] as NoteKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNewNoteKind(k)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                    newNoteKind === k
                      ? 'bg-primary/20 text-primary'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {k === 'text' ? 'Texto' : k === 'url' ? 'URL' : 'Archivo'}
                </button>
              ))}
            </div>

            {newNoteKind === 'text' && (
              <Textarea
                ref={newNoteTextareaRef}
                value={newNoteContent}
                onChange={(e) => {
                  setNewNoteContent(e.target.value);
                  const textarea = e.target;
                  textarea.style.height = 'auto';
                  textarea.style.height = `${textarea.scrollHeight}px`;
                }}
                placeholder="Escribe un recurso rápido..."
                className={cn(
                  'resize-none overflow-hidden rounded-md border-0 bg-secondary/40 p-2 focus-visible:ring-0 focus-visible:ring-offset-0',
                  isNewNoteJustifiable && 'text-justify'
                )}
                rows={2}
              />
            )}

            {newNoteKind === 'url' && (
              <div className="space-y-2">
                <Input
                  placeholder="https://..."
                  value={newNoteUrl}
                  onChange={(e) => setNewNoteUrl(e.target.value)}
                  className="h-9 text-xs"
                />
                <Input
                  placeholder="Descripción (opcional)"
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}

            {newNoteKind === 'file' && (
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={(e) => setNewNoteFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
                />
                {newNoteFile && (
                  <p className="text-[11px] text-muted-foreground">Seleccionado: {newNoteFile.name}</p>
                )}
                <Input
                  placeholder="Descripción (opcional)"
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              {hasNoteDraft && (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCancelAddNote}
                  title="Limpiar"
                  className="h-8 w-8 border-red-500/80 bg-red-500/10 text-red-500/80 hover:bg-red-500/20 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" onClick={handleAddNote} disabled={!canSaveNote || isSavingNote} className="text-xs">
                {isSavingNote ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fina línea divisoria (con aire en los extremos) + botón DUAL centrado:
          Tareas ⇄ Recursos, siempre uno activo. */}
      <div className="relative mb-20 mt-24">
        <div className="mx-14 h-px bg-border/70" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Un rectángulo de esquinas rectas. El modo activo va relleno; el
              otro, en estilo fantasma: borde primario y fondo apenas teñido. */}
          <div className="flex overflow-hidden rounded-none border border-primary bg-card shadow-md">
            {(
              [
                ['tasks', 'Tareas'],
                ['resources', 'Recursos'],
              ] as const
            ).map(([value, label], index) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveSection(value)}
                aria-pressed={activeSection === value}
                className={cn(
                  'rounded-none px-9 py-2 text-xs font-semibold transition-colors',
                  index > 0 && 'border-l border-primary',
                  activeSection === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {activeSection === 'resources' ? (
        <div className="space-y-10">
          {/* Cada tipo de recurso en su bloque, con una línea fina y su nombre
              al centro; dentro de cada bloque se reordenan arrastrando. */}
          {resourceGroups.map(({ kind, label, items }) => (
            <div key={kind} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <h3 className="text-[11px] font-semibold text-muted-foreground">
                  {label} · {items.length}
                </h3>
                <span className="h-px flex-1 bg-border" />
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleNoteDragEnd}
                modifiers={[restrictToParentElement]}
              >
                <SortableContext items={items} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {items.map((note) => (
                      <SortableNoteCard
                        key={note.id}
                        note={note}
                        isCurrentlyEditing={editingNoteId === note.id}
                        editingContent={editingNoteContent}
                        onContentChange={setEditingNoteContent}
                        onStartEdit={startEditingNote}
                        onSave={handleSaveNote}
                        onCancel={cancelEditingNote}
                        onDelete={handleDeleteNote}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ))}

          {resourceGroups.length === 0 && (
            <Card className="flex h-24 items-center justify-center border-dashed">
              <p className="text-sm text-muted-foreground">
                Aún no hay recursos en esta asignatura. Guárdalos con «Nuevo recurso», arriba a la derecha.
              </p>
            </Card>
          )}

          {/* Grabaciones de voz asignadas a esta asignatura */}
          <RecordingsSection variant="course" courseId={course.id} />
        </div>
      ) : (
        /* Solo las tareas PENDIENTES: las culminadas viven en Archivados */
        <div className="space-y-4">
          {tasks && tasks.length > 0 ? (
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleTaskDragEnd}
                modifiers={[restrictToParentElement]}
            >
                <SortableContext items={tasks} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {tasks.map((task) => (
                      <TaskCard key={task.id} task={task} isHighlighted={task.id === highlightTaskId} />
                    ))}
                    </div>
                </SortableContext>
            </DndContext>
          ) : (
              <Card className="flex items-center justify-center h-24 border-dashed">
                  <p className="text-sm text-muted-foreground">No hay tareas pendientes en esta asignatura.</p>
              </Card>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}
