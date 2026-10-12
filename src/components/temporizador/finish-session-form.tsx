import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import NoteEditor from '@/components/temporizador/NoteEditor';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { NotebookPen, Trash2 } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import SessionNotesList, { SessionNotesHeading } from '@/components/temporizador/SessionNotesList';
import { SessionSubjectPicker } from '@/components/temporizador/SubjectPickCard';
import EchoWord from '@/components/shared/EchoWord';
import { cn } from '@/lib/utils';
import { formatHMS } from '@/lib/duration';

// ============================================================
// Cierre de una sesión de estudio.
//
// Arriba, con el eco de «SESIÓN» detrás del título: el tiempo, el enfoque, lo
// anotado durante la sesión y qué se hizo. Debajo, qué se estudió, con el
// mismo recorrido de tarjetas que el resto de la app: colecciones →
// asignaturas → sus tareas (ver `SessionSubjectPicker`).
//
// Un solo carril de scroll: cabecera y pie quedan fijos, así "Registrar"
// siempre está a la vista por larga que sea la lista. Las divisorias dejan
// aire a los lados, no van de borde a borde.
// ============================================================

interface FinishSessionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    perception: number;
    subjects: string[];
    subjectIds: string[];
    taskIds: string[];
    notes: string;
  }) => void;
  /** Descarta la sesión sin registrarla (botón encendido sin querer, olvido…). */
  onDiscard: () => void;
  /** Duración exacta de la sesión en SEGUNDOS. */
  studiedSeconds: number;
  trigger: 'manual' | 'auto';
}

export default function FinishSessionForm({
  isOpen,
  onClose,
  onSubmit,
  onDiscard,
  studiedSeconds,
  trigger
}: FinishSessionFormProps) {
  /** 0 = todavía sin marcar. Es lo que bloquea el registro: obliga a
   *  pararse un segundo a valorar la sesión en vez de aceptar un número
   *  puesto por la app que nadie mira. */
  const [perception, setPerception] = useState(0);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const { courses, selectionMode, sessionNotes } = useCourse();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /** Anotación libre de lo que se hizo: hace el registro mucho más útil
   *  cuando, meses después, hay que justificar en qué se fue el tiempo. */
  const [notes, setNotes] = useState('');

  useEffect(() => {
    // Reset form when it's re-opened (el selector de asignaturas vuelve solo
    // a las colecciones: el contenido del recuadro se desmonta al cerrarse).
    if (isOpen) {
      setPerception(0);
      setSelectedSubjectIds([]);
      setSelectedTaskIds([]);
      setConfirmDiscard(false);
      setNotes('');
    }
  }, [isOpen]);

  /** Lo que falta para poder registrar. En modo «tiempo» no existe el ratio
   *  de enfoque, así que ahí no bloquea nada. */
  const needsFocus = selectionMode === 'rendimiento' && perception === 0;
  // Sin ninguna asignatura creada no hay nada que marcar: la sesión se registra
  // sin asignatura en lugar de obligar a descartarla.
  const needsSubject = (courses?.length ?? 0) > 0 && selectedSubjectIds.length === 0;

  const handleSubmit = () => {
    if (needsSubject || needsFocus) return;
    const selectedCourses = courses.filter(c => selectedSubjectIds.includes(c.id));
    onSubmit({
      perception,
      subjects: selectedCourses.map(c => c.name),
      subjectIds: selectedSubjectIds,
      taskIds: selectedTaskIds,
      notes: notes.trim(),
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl [&>button]:text-foreground [&>button]:h-5 [&>button]:w-5"
          hideCloseButton={trigger === 'auto'}
          onInteractOutside={(e) => {
            if (trigger === 'auto') e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (trigger === 'auto') e.preventDefault();
          }}
        >
          {/* ---------- Cabecera fija ---------- */}
          <DialogHeader className="shrink-0 space-y-0 text-left sm:text-left">
            {/* Título y datos de la sesión, con «SESIÓN» a la deriva detrás. */}
            <div className="relative overflow-hidden px-6 pb-3 pt-5">
              <EchoWord word="Sesión" />
              <DialogTitle className="relative text-center text-lg font-bold tracking-wider text-primary">
                Sesión terminada
              </DialogTitle>

              <div
                className={cn(
                  'relative grid items-center gap-4 pt-2',
                  selectionMode === 'rendimiento' ? 'sm:grid-cols-2' : 'grid-cols-1'
                )}
              >
                <div className="space-y-0.5 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Tiempo estudiado
                  </p>
                  <p className="font-headline text-2xl font-bold tabular-nums text-primary">
                    {formatHMS(studiedSeconds)}
                  </p>
                </div>

                {selectionMode === 'rendimiento' && (
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="perception" className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Nivel de enfoque
                      </Label>
                      <span
                        className={cn(
                          'w-8 rounded-md text-center text-xs font-semibold tabular-nums transition-colors',
                          needsFocus
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-primary/20 text-primary'
                        )}
                      >
                        {perception}
                      </span>
                    </div>
                    <Slider
                      id="perception"
                      min={0}
                      max={20}
                      step={1}
                      value={[perception]}
                      onValueChange={(value) => setPerception(value[0])}
                      className="mt-2"
                    />
                    {/* El recordatorio: una línea que aparece solo mientras el
                        enfoque siga en 0 y desaparece en cuanto se mueve. */}
                    <p
                      className={cn(
                        'mt-1.5 text-[10px] leading-tight transition-colors',
                        needsFocus ? 'text-amber-600 dark:text-amber-400' : 'text-transparent'
                      )}
                    >
                      Mueve la barra: sin enfoque no se puede registrar.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 px-6 pb-4">
              {/* Lo anotado DURANTE la sesión, a la vista antes de resumir: es
                  justo lo que uno no recuerda al parar el reloj. */}
              {sessionNotes.length > 0 && (
                <div className="space-y-1.5">
                  <SessionNotesHeading count={sessionNotes.length} />
                  <div className="max-h-28 overflow-y-auto pr-1">
                    <SessionNotesList notes={sessionNotes} />
                  </div>
                </div>
              )}

              {/* Anotación de la sesión: qué se hizo realmente. Va en la
                  cabecera, antes de elegir asignaturas, porque es lo que se
                  tiene fresco nada más parar el reloj. */}
              <div className="space-y-1">
                <Label
                  htmlFor="session-notes"
                  onClick={() => document.getElementById('session-notes')?.focus()}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  <NotebookPen className="h-3.5 w-3.5 text-primary" />
                  ¿Qué hiciste?
                  <span className="normal-case tracking-normal text-muted-foreground/70">(opcional)</span>
                </Label>
                {/* Texto con formato y listas, como un Word en pequeño. */}
                <NoteEditor
                  id="session-notes"
                  value={notes}
                  onChange={setNotes}
                  placeholder="Resolví los ejercicios 12 al 20; me atasqué en la derivada de la cadena…"
                  rows={3}
                  dense
                />
              </div>
            </div>
          </DialogHeader>

          {/* Divisoria con aire a ambos lados. */}
          <div aria-hidden className="mx-6 h-px shrink-0 bg-border" />

          {/* ---------- Cuerpo: ÚNICO carril de scroll ---------- */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <SessionSubjectPicker
              subjectIds={selectedSubjectIds}
              taskIds={selectedTaskIds}
              onChange={({ subjectIds, taskIds }) => {
                setSelectedSubjectIds(subjectIds);
                setSelectedTaskIds(taskIds);
              }}
            />
          </div>

          {/* ---------- Pie fijo ---------- */}
          <div aria-hidden className="mx-6 h-px shrink-0 bg-border" />
          <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-3">
            <Button
              type="button"
              variant="fantasmaRojo"
              size="sm"
              className="text-xs"
              onClick={() => setConfirmDiscard(true)}
            >
              <Trash2 className="h-4 w-4" />
              Descartar
            </Button>

            {/* Lo que falta, dicho en el pie y no en un aviso emergente: el
                botón deshabilitado sin explicación es de las cosas que más
                desconciertan. */}
            <div className="flex items-center gap-3">
              {(needsFocus || needsSubject) && (
                <span className="text-right text-[10px] leading-tight text-amber-600 dark:text-amber-400">
                  {needsFocus && needsSubject
                    ? 'Falta el enfoque y la asignatura'
                    : needsFocus
                      ? 'Falta marcar tu enfoque'
                      : 'Falta marcar la asignatura'}
                </span>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={needsSubject || needsFocus}
                className="min-w-[9rem]"
                title={
                  needsFocus
                    ? 'Marca tu nivel de enfoque (1-20) para registrar la sesión'
                    : needsSubject
                      ? 'Marca al menos una asignatura para registrar la sesión'
                      : undefined
                }
              >
                Registrar sesión
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Salida para el despiste: temporizador encendido sin querer, olvido
          con el cronómetro corriendo… El tiempo se tira, no se registra. */}
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Se tirarán los {formatHMS(studiedSeconds)} de esta sesión: no contarán en tu tiempo de
              estudio, no afectarán a tu calificación del día y no harán avanzar ninguna tarea.
              Úsalo si el cronómetro se quedó corriendo o lo encendiste sin querer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                setConfirmDiscard(false);
                onDiscard();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
