import { useState, useEffect, useMemo } from 'react';
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
import { Check, Layers, NotebookPen, Search, Trash2 } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import SessionNotesList, { SessionNotesHeading } from '@/components/temporizador/SessionNotesList';
import { cn } from '@/lib/utils';
import { formatHMS } from '@/lib/duration';
import { SubjectCard } from '@/components/temporizador/SubjectPickCard';
import { Input } from '../ui/input';
import type { Course, Task } from '@/types';

// ============================================================
// Cierre de una sesión de estudio.
//
// Las asignaturas se eligen con la MISMA tarjeta que la interfaz Asignaturas:
// portada de extremo a extremo arriba y el nombre centrado debajo. La flecha
// de cada tarjeta despliega sus tareas JUSTO DEBAJO, sin ocultar el resto;
// volver a pulsarla las repliega.
//
// Un solo carril de scroll: cabecera y pie quedan fijos, así "Registrar"
// siempre está a la vista por larga que sea la lista.
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

const formatEstimate = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

/** Tarjeta de una tarea avanzable, desplegada bajo su asignatura. */
function TaskPick({
  task,
  selected,
  onToggle,
}: {
  task: Task;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-2 rounded-lg border p-2 text-left transition-all',
        selected ? 'border-primary bg-primary/10' : 'border-border/70 bg-card hover:border-primary/40'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-foreground">{task.name}</span>
        <span className="block text-[10px] text-muted-foreground">
          estimada {formatEstimate(task.estimatedMinutes!)} · {task.progress || 0}%
        </span>
        <span className="mt-1 block h-0.5 w-full overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, task.progress || 0)}%` }}
          />
        </span>
      </span>
    </button>
  );
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
  const { courses, spaces, selectionMode, tasks, sessionNotes } = useCourse();
  const [courseSearch, setCourseSearch] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /** Anotación libre de lo que se hizo: hace el registro mucho más útil
   *  cuando, meses después, hay que justificar en qué se fue el tiempo. */
  const [notes, setNotes] = useState('');
  /** Asignaturas con sus tareas desplegadas debajo de la tarjeta. */
  const [expandedCourseIds, setExpandedCourseIds] = useState<string[]>([]);

  useEffect(() => {
    // Reset form when it's re-opened
    if (isOpen) {
      setPerception(0);
      setSelectedSubjectIds([]);
      setSelectedTaskIds([]);
      setCourseSearch('');
      setConfirmDiscard(false);
      setExpandedCourseIds([]);
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

  const handleToggleSubject = (courseId: string) => {
    setSelectedSubjectIds(prev => {
      const checked = !prev.includes(courseId);
      // Al desmarcar una asignatura se desmarcan también sus tareas.
      if (!checked) {
        setSelectedTaskIds(tPrev =>
          tPrev.filter(tid => {
            const task = tasks.find(t => t.id === tid);
            return task ? task.courseId !== courseId : false;
          })
        );
      }
      return checked ? [...prev, courseId] : prev.filter(id => id !== courseId);
    });
  }

  /** Marcar una tarea implica haber estudiado su asignatura: se selecciona
   *  sola, porque una tarea avanzada sin asignatura no se puede registrar. */
  const handleToggleTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const checked = !prev.includes(taskId);
      if (checked) {
        const courseId = tasks.find(t => t.id === taskId)?.courseId;
        if (courseId) {
          setSelectedSubjectIds(sPrev => (sPrev.includes(courseId) ? sPrev : [...sPrev, courseId]));
        }
      }
      return checked ? [...prev, taskId] : prev.filter(id => id !== taskId);
    });
  };

  const toggleExpanded = (courseId: string) =>
    setExpandedCourseIds(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );

  /** Tareas pendientes CON tiempo estimado por asignatura: son las únicas que
   *  pueden avanzar (el % se calcula con esa métrica). */
  const advanceableByCourse = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const t of tasks ?? []) {
      if ((t.estimatedMinutes ?? 0) <= 0 || (t.progress || 0) >= 100) continue;
      const list = map.get(t.courseId);
      if (list) list.push(t);
      else map.set(t.courseId, [t]);
    }
    return map;
  }, [tasks]);

  /** Grupos visibles: colecciones con asignaturas + las independientes. Las
   *  asignaturas ya marcadas nunca se ocultan al filtrar. */
  const groups = useMemo(() => {
    const search = courseSearch.trim().toLowerCase();
    const matches = (name: string, id: string) =>
      !search || name.toLowerCase().includes(search) || selectedSubjectIds.includes(id);

    const inSpaces = new Set(spaces.flatMap(s => s.courseIds));
    const out: { id: string; name: string; courses: Course[] }[] = [];

    for (const space of spaces) {
      const list = space.courseIds
        .map(id => courses.find(c => c.id === id))
        .filter((c): c is Course => !!c)
        .filter(c => matches(c.name, c.id));
      if (list.length > 0) out.push({ id: space.id, name: space.name, courses: list });
    }

    const loose = courses.filter(c => !inSpaces.has(c.id)).filter(c => matches(c.name, c.id));
    if (loose.length > 0) out.push({ id: '__loose__', name: 'Asignaturas independientes', courses: loose });

    return out;
  }, [courseSearch, courses, spaces, selectedSubjectIds]);

  const hasAnyCourses = courses && courses.length > 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl [&>button]:text-foreground [&>button]:h-5 [&>button]:w-5"
          hideCloseButton={trigger === 'auto'}
          onInteractOutside={(e) => {
            if (trigger === 'auto') e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (trigger === 'auto') e.preventDefault();
          }}
        >
          {/* ---------- Cabecera fija ---------- */}
          <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-5">
            <DialogTitle className="text-center text-lg font-bold tracking-wider text-primary">
              Sesión terminada
            </DialogTitle>

            <div
              className={cn(
                'grid items-center gap-4 pt-2',
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

            {/* Lo anotado DURANTE la sesión, a la vista antes de resumir: es
                justo lo que uno no recuerda al parar el reloj. */}
            {sessionNotes.length > 0 && (
              <div className="space-y-1.5 pt-3 text-left">
                <SessionNotesHeading count={sessionNotes.length} />
                <div className="max-h-28 overflow-y-auto pr-1">
                  <SessionNotesList notes={sessionNotes} />
                </div>
              </div>
            )}

            {/* Anotación de la sesión: qué se hizo realmente. Va en la
                cabecera, antes de elegir asignaturas, porque es lo que se
                tiene fresco nada más parar el reloj. */}
            <div className="space-y-1 pt-3 text-left">
              <Label htmlFor="session-notes" className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <NotebookPen className="h-3.5 w-3.5 text-primary" />
                ¿Qué hiciste?
                <span className="normal-case tracking-normal text-muted-foreground/70">(opcional)</span>
              </Label>
              {/* Texto continuo o lista de avances, en el mismo campo. */}
              <NoteEditor
                id="session-notes"
                value={notes}
                onChange={setNotes}
                placeholder="Resolví los ejercicios 12 al 20; me atasqué en la derivada de la cadena…"
                rows={3}
                dense
                hint="Lista: un avance por línea"
              />
            </div>
          </DialogHeader>

          {/* ---------- Cuerpo: ÚNICO carril de scroll ---------- */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-semibold text-foreground">
                  ¿Qué estudiaste?
                  {selectedSubjectIds.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-primary">
                      {selectedSubjectIds.length}{' '}
                      {selectedSubjectIds.length === 1 ? 'seleccionada' : 'seleccionadas'}
                    </span>
                  )}
                </Label>
                <div className="relative w-full sm:w-48">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar…"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="h-8 border-primary/60 bg-card pl-8 text-xs"
                  />
                </div>
              </div>

              {!hasAnyCourses ? (
                <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No has creado ninguna asignatura.
                </p>
              ) : groups.length === 0 ? (
                <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Ninguna asignatura coincide con la búsqueda.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {group.name}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>

                    {/* `items-start`: cada asignatura es una celda propia, así
                        al desplegar sus tareas crece solo esa columna y no se
                        estira la de al lado. */}
                    <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2">
                      {group.courses.map((course) => {
                        const courseTasks = advanceableByCourse.get(course.id) ?? [];
                        const expanded = expandedCourseIds.includes(course.id);
                        return (
                          <div key={course.id} className="space-y-2">
                            <SubjectCard
                              course={course}
                              selected={selectedSubjectIds.includes(course.id)}
                              pendingTasks={courseTasks.length}
                              expanded={expanded}
                              onToggle={() => handleToggleSubject(course.id)}
                              onToggleTasks={() => toggleExpanded(course.id)}
                            />

                            {/* Las tareas caen JUSTO DEBAJO de su asignatura. */}
                            {expanded && courseTasks.length > 0 && (
                              <div className="space-y-1.5 duration-200 animate-in fade-in slide-in-from-top-2">
                                {courseTasks.map((task) => (
                                  <TaskPick
                                    key={task.id}
                                    task={task}
                                    selected={selectedTaskIds.includes(task.id)}
                                    onToggle={() => handleToggleTask(task.id)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ---------- Pie fijo ---------- */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-card/60 px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              onClick={() => setConfirmDiscard(true)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
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
