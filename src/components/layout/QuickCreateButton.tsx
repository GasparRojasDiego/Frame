import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, NotebookPen, Plus } from 'lucide-react';
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
import TaskComposer, { type TaskDraft } from '@/components/tasks/TaskComposer';
import NoteEditor from '@/components/temporizador/NoteEditor';
import { isRichNoteEmpty } from '@/lib/rich-note';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import { addLooseNote } from '@/lib/loose-notes';
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
// La tarea y la anotación pueden quedarse SIN asignatura: la tarea aterriza
// al final de Inicio, donde se edita y se coloca con calma; la anotación,
// como tarjeta en Inicio (src/lib/loose-notes.ts). Obligar a decidir la
// asignatura en caliente es justo lo que hace que no se apunte.
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

  /** Volver al recuadro anterior: la elección de asignatura no se arrastra. */
  const goBack = () => {
    setMode('menu');
    setCourseId(null);
  };

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
    if (isRichNoteEmpty(noteText)) return;
    const text = noteText.trim();
    if (course) {
      addNote(course.id, text, { kind: 'text' });
      toast({
        title: 'Anotación guardada',
        description: `Queda en los recursos de ${course.name}.`,
      });
    } else {
      // Sin asignatura: tarjeta en Inicio hasta que se coloque o se borre.
      if (!userProfile || !addLooseNote(userProfile.id, text)) {
        toast({
          variant: 'destructive',
          title: 'No se pudo guardar',
          description: 'El almacenamiento del equipo está lleno o no responde.',
        });
        return;
      }
      toast({
        title: 'Anotación guardada',
        description: 'Sin asignatura: la tienes en Inicio.',
      });
    }
    setOpen(false);
  };

  // Cada opción es su foto entera. Un velo del color del fondo (arena en claro,
  // grafito en oscuro) la funde hacia el lado del texto —abajo en «Tarea»,
  // arriba en «Anotación»— con un desenfoque que crece a la par: la letra, en
  // el color de texto del tema, se lee siempre sobre el velo y la imagen asoma
  // limpia en el otro extremo.
  //
  // Sin borde: el gris del borde se veía justo en el extremo del velo. La
  // tarjeta se define con la sombra, y el contorno azul solo aparece al pasar
  // el ratón (capa `choiceRing`, por encima de la foto).
  const choiceCard =
    'group relative flex aspect-[4/5] rounded-xl text-left shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0';
  // Foto y velo van dentro de UNA capa recortada con el mismo radio. El
  // `clip-path` hace dos cosas que `overflow-hidden` no garantiza en WebView2:
  // recorta también el desenfoque (que asomaba con esquinas rectas y grises)
  // y lo convierte en raíz del desenfoque, así el velo solo mezcla la foto y
  // no el fondo del recuadro que hay alrededor de la tarjeta.
  const choiceMedia =
    'pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] [clip-path:inset(0_round_0.75rem)]';
  const choicePhoto =
    'absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100';
  const choiceRing =
    'pointer-events-none absolute inset-0 rounded-[inherit] ring-inset ring-primary/60 transition-shadow group-hover:ring-2';
  const choiceIcon =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md';

  const title = mode === 'menu' ? 'Crear' : mode === 'task' ? 'Tarea nueva' : 'Anotación nueva';

  return (
    <>
      {/* Fantasma como el resto de la barra; sólido mientras su recuadro está abierto. */}
      <Button
        size="icon"
        variant={open ? 'default' : 'fantasma'}
        className="h-9 w-9 rounded-md border border-primary"
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
          {/* `pt-[15px]`: el título queda centrado a 24 px del borde, la misma
              línea que la X de cierre (top-4 + 8) y que la flecha de atrás. */}
          <DialogHeader className="relative shrink-0 overflow-hidden px-6 pb-4 pt-[15px]">
            {/* «CREAR», repetido y a la deriva detrás del título. */}
            <EchoWord word="Crear" />
            <div className="relative flex items-center justify-center">
              {/* Atrás: flecha en la esquina superior izquierda, a la altura
                  del título (sustituye a la barra inferior con «Atrás»). */}
              {mode !== 'menu' && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={goBack}
                  title="Volver a Crear"
                  aria-label="Volver a Crear"
                  data-tour="crear-atras"
                  // `-left-4`: el icono queda a 16 px del borde, simétrico a la X.
                  className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <DialogTitle className="text-center text-lg font-bold text-primary">{title}</DialogTitle>
            </div>
            {/* Fuera del menú, la descripción solo existe para el lector de pantalla. */}
            <DialogDescription className={cn('text-center text-xs', mode === 'menu' ? 'relative' : 'sr-only')}>
              {mode === 'menu'
                ? 'Sin ir hasta la asignatura.'
                : mode === 'task'
                  ? 'Elige la asignatura y rellena la tarea.'
                  : 'Elige la asignatura (o ninguna) y escribe la anotación.'}
            </DialogDescription>
          </DialogHeader>
          {/* Divisoria con margen a ambos lados, no de borde a borde. */}
          <div aria-hidden className="mx-6 h-px shrink-0 bg-border" />

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {mode === 'menu' ? (
              <div className="grid grid-cols-2 gap-4">
                {/* Tarea: el velo sube desde abajo y el texto va abajo. */}
                <button type="button" className={choiceCard} onClick={() => setMode('task')} data-tour="crear-tarea">
                  <span aria-hidden className={choiceMedia}>
                    <img src="/quick-create/tarea.webp" alt="" className={choicePhoto} />
                    <span className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-background via-background/85 to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_top,black_45%,transparent)]" />
                  </span>
                  {/* El texto, a la derecha del icono y centrado con él. */}
                  <span className="relative mt-auto flex w-full items-center gap-3 p-4">
                    <span className={choiceIcon}>
                      <ClipboardList className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold leading-tight text-foreground">Tarea</span>
                      <span className="block text-[11px] font-medium leading-tight text-muted-foreground">
                        Con fecha y asignatura
                      </span>
                    </span>
                  </span>
                  <span aria-hidden className={choiceRing} />
                </button>

                {/* Anotación: al revés, el velo baja desde arriba y el texto va arriba. */}
                <button type="button" className={choiceCard} onClick={() => setMode('note')} data-tour="crear-anotacion">
                  <span aria-hidden className={choiceMedia}>
                    <img src="/quick-create/anotacion.webp" alt="" className={choicePhoto} />
                    <span className="absolute inset-x-0 top-0 h-3/4 bg-gradient-to-b from-background via-background/85 to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]" />
                  </span>
                  <span className="relative flex w-full items-center gap-3 self-start p-4">
                    <span className={choiceIcon}>
                      <NotebookPen className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold leading-tight text-foreground">Anotación</span>
                      <span className="block text-[11px] font-medium leading-tight text-muted-foreground">
                        Texto suelto que recordar
                      </span>
                    </span>
                  </span>
                  <span aria-hidden className={choiceRing} />
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Bloque 1 — la asignatura (o ninguna: va a Inicio) */}
                <SubjectPicker value={courseId} onChange={setCourseId} allowNone />

                {/* Bloque 2 — la tarjeta de creación */}
                {mode === 'task' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        La tarea
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <TaskComposer onCreate={saveTask} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        La anotación
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    {/* Los botones de formato (como en Word), apilados a la
                        izquierda; a su derecha y separado, el recuadro. */}
                    <NoteEditor
                      id="quick-note"
                      value={noteText}
                      onChange={setNoteText}
                      onSubmit={saveNote}
                      placeholder="Lo que no quieres olvidar"
                      ariaLabel="La anotación"
                      rows={5}
                      autoFocus
                      toolbarSide
                    />
                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={saveNote}
                        disabled={isRichNoteEmpty(noteText)}
                        data-tour="anotacion-guardar"
                        title={course ? `Guardar en ${course.name}` : 'Guardar en Inicio, sin asignatura'}
                        className={cn(isRichNoteEmpty(noteText) && 'border border-primary bg-primary/20 text-primary')}
                      >
                        <NotebookPen className="mr-2 h-4 w-4" />
                        Guardar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
