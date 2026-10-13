import { useEffect, useMemo, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowLeft, Layers, NotebookPen, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SubjectPicker from '@/components/courses/SubjectPicker';
import EchoWord from '@/components/shared/EchoWord';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import { deleteLooseNote, useLooseNotes, type LooseNote } from '@/lib/loose-notes';
import RichNoteView from '@/components/temporizador/RichNoteView';
import { richNoteToPlain } from '@/lib/rich-note';
import { cn } from '@/lib/utils';
import { dateLocale, tr } from '@/lib/i18n';

// ============================================================
// Anotaciones sin asignatura (Inicio, junto a las grabaciones sueltas).
//
// Lo que se apuntó con el «+» de la barra sin elegir asignatura. Cada una es
// una tarjeta comprimida a media anchura —sus primeras líneas y la fecha— y
// un clic la abre entera, con lo único que se puede hacer con ella: colocarla
// en su asignatura (pasa a sus recursos) o borrarla.
//
// Sin anotaciones, la sección no existe.
// ============================================================

function whenLabel(iso: string): string {
  try {
    const date = parseISO(iso);
    return isValid(date) ? format(date, tr('d \'de\' MMMM · HH:mm'), { locale: dateLocale() }) : '';
  } catch {
    return '';
  }
}

function LooseNoteDialog({ note, onClose }: { note: LooseNote | null; onClose: () => void }) {
  const { courses, addNote, userProfile } = useCourse();
  const { toast } = useToast();
  /** Paso 2: elegir la asignatura donde colocarla. */
  const [placing, setPlacing] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  /** Borrar pide un segundo clic; el aviso caduca solo. */
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = window.setTimeout(() => setConfirmDelete(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmDelete]);

  const course = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);

  const remove = () => {
    if (!note || !userProfile) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteLooseNote(userProfile.id, note.id);
    toast({ title: tr('Anotación borrada') });
    onClose();
  };

  const place = () => {
    if (!note || !course || !userProfile) return;
    // Pasa a los recursos de la asignatura y deja de estar suelta.
    addNote(course.id, note.content, { kind: 'text' });
    deleteLooseNote(userProfile.id, note.id);
    toast({
      title: tr('Anotación colocada'),
      description: tr('Queda en los recursos de {name}.', { name: course.name }),
    });
    onClose();
  };

  return (
    <Dialog open={Boolean(note)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0',
          placing ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        )}
      >
        {/* `pt-[15px]`: título, flecha de atrás y X de cierre en la misma línea. */}
        <DialogHeader className="relative shrink-0 overflow-hidden px-6 pb-4 pt-[15px]">
          <EchoWord word={tr('Anotación')} />
          <div className="relative flex items-center justify-center">
            {/* Atrás: flecha en la esquina superior izquierda, a la altura del título. */}
            {placing && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setPlacing(false);
                  setCourseId(null);
                }}
                title={tr('Volver a la anotación')}
                aria-label={tr('Volver a la anotación')}
                // `-left-4`: el icono queda a 16 px del borde, simétrico a la X.
                className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-center text-lg font-bold text-primary">
              {placing ? tr('Colocar en una asignatura') : tr('Anotación')}
            </DialogTitle>
          </div>
          <DialogDescription className="relative text-center text-xs">
            {note ? whenLabel(note.createdAt) : ''}
          </DialogDescription>
        </DialogHeader>
        {/* Divisorias con margen a ambos lados, no de borde a borde. */}
        <div aria-hidden className="mx-6 h-px shrink-0 bg-border" />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {placing ? (
            <SubjectPicker value={courseId} onChange={setCourseId} />
          ) : (
            <RichNoteView text={note?.content ?? ''} className="break-words text-sm leading-relaxed text-foreground" />
          )}
        </div>

        <div aria-hidden className="mx-6 h-px shrink-0 bg-border" />
        <div className="flex shrink-0 items-center justify-between gap-2 px-6 py-3">
          {placing ? (
            <>
              <span />
              <Button
                size="sm"
                onClick={place}
                disabled={!course}
                className={cn(!course && 'border border-primary bg-primary/20 text-primary')}
              >
                <Layers className="mr-2 h-4 w-4" />
                {tr('Colocar')}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant={confirmDelete ? 'destructive' : 'gris'} onClick={remove}>
                <Trash2 className="mr-2 h-4 w-4" />
                {confirmDelete ? tr('Pulsa otra vez para borrar') : tr('Borrar')}
              </Button>
              <Button size="sm" variant="fantasma" onClick={() => setPlacing(true)}>
                <Layers className="mr-2 h-4 w-4" />
                {tr('Colocar en una asignatura')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LooseNotesSection() {
  const { userProfile } = useCourse();
  const stored = useLooseNotes(userProfile?.id);
  // La más reciente primero. Lo guardado no basta: al sincronizar, lo que llega
  // de otro equipo se añade al final de la lista local (sync-merge.ts).
  const notes = useMemo(
    () => [...stored].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    [stored]
  );
  const [openId, setOpenId] = useState<string | null>(null);

  if (notes.length === 0) return null;

  // Si la abierta desaparece (borrada en otro equipo), el recuadro se cierra solo.
  const open = notes.find((note) => note.id === openId) ?? null;

  return (
    <div className="pt-4">
      {/* Mismo título que «Grabaciones», su vecina en Inicio. */}
      <h1 className="pb-4 pt-8 text-center font-headline text-2xl font-bold text-primary">{tr('Anotaciones')}</h1>

      <div className="grid grid-cols-2 gap-4">
        {notes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => setOpenId(note.id)}
            title={tr('Ver la anotación completa')}
            className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
              <NotebookPen className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{whenLabel(note.createdAt)}</span>
            </span>
            {/* Comprimida: las primeras líneas; el resto, al abrirla. */}
            <span className="line-clamp-3 whitespace-pre-line break-words text-sm text-foreground">
              {richNoteToPlain(note.content)}
            </span>
          </button>
        ))}
      </div>

      <LooseNoteDialog key={open?.id ?? 'none'} note={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
