import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, NotebookPen, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SubjectPicker from '@/components/courses/SubjectPicker';
import EchoWord from '@/components/shared/EchoWord';
import TaskComposer, { type TaskDraft } from '@/components/tasks/TaskComposer';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ============================================================
// Crear desde donde sea.
//
// Una tarea nace cuando el profesor la dicta, no cuando uno está en la
// pantalla de esa asignatura. Hasta ahora había que navegar hasta ella para
// apuntarla, y en ese trayecto se pierden la mitad de las tareas.
//
// Dos bloques a la vista al mismo tiempo, no dos pasos: arriba la asignatura
// —con las mismas tarjetas de portada que el recuadro de cerrar sesión— y
// debajo la tarjeta de creación EXACTA de la interfaz de la asignatura (es el
// mismo componente, `TaskComposer`, no una copia parecida).
//
// La tarea puede quedarse SIN asignatura: entonces aterriza al final de
// Inicio, donde se edita y se coloca con calma. Obligar a decidir la
// asignatura en caliente es justo lo que hace que la tarea no se apunte.
// ============================================================

type Mode = 'menu' | 'task' | 'note';

export default function QuickCreateButton() {
  const { courses, addTask, addNote, userProfile } = useCourse();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (open) return;
    setMode('menu');
    setCourseId(null);
    setNoteText('');
  }, [open]);

  const course = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);

  const saveTask = (draft: TaskDraft) => {
    if (!userProfile) return;
    addTask({
      ...draft,
      progress: 0,
      order: -Date.now(),
      // Sin asignatura, `courseId` va vacío: es la marca que usa Inicio para
      // recogerla en su bandeja de tareas sueltas.
      courseId: course?.id ?? '',
      courseName: course?.name ?? '',
      uid: userProfile.id,
    });
    toast({
      title: 'Tarea creada',
      description: course
        ? `${draft.name} · ${course.name}`
        : `${draft.name} · sin asignatura, la tienes al final de Inicio`,
    });
    setOpen(false);
  };

  const saveNote = () => {
    if (!course || !noteText.trim()) return;
    addNote(course.id, noteText.trim(), { kind: 'text' });
    toast({
      title: 'Anotación guardada',
      description: `Queda en ${course.name}, dentro de su clase de hoy (o de la última).`,
    });
    setOpen(false);
  };

  // Cada opción es su foto entera. Un velo blanco la funde hacia el lado del
  // texto —abajo en «Tarea», arriba en «Anotación»— con un desenfoque que
  // crece a la par, de modo que la letra se lee siempre sobre blanco y la
  // imagen asoma limpia en el otro extremo.
  const choiceCard =
    'group relative flex aspect-[4/5] overflow-hidden rounded-xl border border-border/70 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <>
      {/* Misma estética que los botones del extremo derecho de la barra. */}
      <Button
        size="icon"
        variant="ghost"
        className="h-9 w-9 rounded-md border border-primary bg-primary/10 text-primary hover:bg-primary/20"
        onClick={() => setOpen(true)}
        title="Crear una tarea o una anotación" data-tour="crear-rapido"
      >
        <Plus className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            'flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0',
            mode === 'menu' ? 'sm:max-w-lg' : 'sm:max-w-3xl'
          )}
        >
          <DialogHeader className="relative shrink-0 overflow-hidden border-b px-6 pb-4 pt-6">
            {/* «CREAR», repetido y a la deriva detrás del título. */}
            <EchoWord word="Crear" />
            <DialogTitle className="relative text-center text-lg font-bold text-primary">
              {mode === 'menu' ? 'Crear' : mode === 'task' ? 'Tarea nueva' : 'Anotación nueva'}
            </DialogTitle>
            <DialogDescription className="relative text-center text-xs">
              {mode === 'menu'
                ? 'Sin ir hasta la asignatura.'
                : mode === 'task'
                  ? 'Elige la asignatura arriba y rellena la tarea abajo.'
                  : 'Elige la asignatura arriba y escribe la anotación abajo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {mode === 'menu' ? (
              <div className="grid grid-cols-2 gap-4">
                {/* Tarea: el velo sube desde abajo y el texto va abajo. */}
                <button type="button" className={choiceCard} onClick={() => setMode('task')} data-tour="crear-tarea">
                  <img
                    src="/quick-create/tarea.webp"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-white via-white/85 to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_top,black_45%,transparent)]"
                  />
                  <span className="relative mt-auto flex w-full flex-col gap-1 p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
                      <ClipboardList className="h-5 w-5" />
                    </span>
                    <span className="text-base font-bold text-neutral-900">Tarea</span>
                    <span className="text-[11px] font-medium text-neutral-600">Con fecha y asignatura</span>
                  </span>
                </button>

                {/* Anotación: al revés, el velo baja desde arriba y el texto va arriba. */}
                <button type="button" className={choiceCard} onClick={() => setMode('note')} data-tour="crear-anotacion">
                  <img
                    src="/quick-create/anotacion.webp"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-3/4 bg-gradient-to-b from-white via-white/85 to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
                  />
                  <span className="relative flex w-full flex-col gap-1 p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
                      <NotebookPen className="h-5 w-5" />
                    </span>
                    <span className="text-base font-bold text-neutral-900">Anotación</span>
                    <span className="text-[11px] font-medium text-neutral-600">Texto suelto que recordar</span>
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Bloque 1 — la asignatura */}
                <SubjectPicker
                  value={courseId}
                  onChange={setCourseId}
                  allowNone={mode === 'task'}
                />

                {/* Bloque 2 — la tarjeta de creación, la misma de siempre */}
                {mode === 'task' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        La tarea
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <TaskComposer onCreate={saveTask} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        La anotación
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <Card>
                      <CardContent className="space-y-3 pt-4">
                        <Label htmlFor="quick-note" className="text-xs">
                          Texto
                        </Label>
                        <Textarea
                          id="quick-note" data-tour="anotacion-texto"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Lo que no quieres olvidar de esta asignatura"
                          rows={5}
                          className="resize-none text-sm"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground">
                            {course
                              ? `Se guardará en ${course.name}, en su clase de hoy o en la última.`
                              : 'Elige una asignatura para poder guardarla.'}
                          </p>
                          <Button onClick={saveNote} disabled={!course || !noteText.trim()} data-tour="anotacion-guardar">
                            <NotebookPen className="mr-2 h-4 w-4" />
                            Guardar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>

          {mode !== 'menu' && (
            <div className="shrink-0 border-t px-6 py-3">
              <Button variant="ghost" size="sm" onClick={() => setMode('menu')}>
                Atrás
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
