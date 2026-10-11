import { useEffect, useMemo, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import NoteEditor from '@/components/temporizador/NoteEditor';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import { formatHMS } from '@/lib/duration';

// ============================================================
// Anotar un avance SIN cerrar la sesión.
//
// El problema que resuelve: al terminar dos horas de estudio nadie se acuerda
// de lo que hizo en la primera media hora, así que la nota final acaba siendo
// un resumen pobre. Aquí se anota en caliente y queda con su hora.
//
// Asignatura, tarea y enfoque son OPCIONALES a propósito: la fricción mata la
// costumbre. Con escribir una línea y pulsar basta; lo demás está para quien
// quiera dejar el registro completo.
// ============================================================

const NONE = '__ninguna__';

export default function SessionNoteDialog({
  open,
  onOpenChange,
  /** Segundos de sesión transcurridos ahora mismo. */
  elapsedSec,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elapsedSec: number;
}) {
  const { addSessionNote, courses, tasks } = useCourse();
  const { toast } = useToast();

  const [text, setText] = useState('');
  const [courseId, setCourseId] = useState<string>(NONE);
  const [taskId, setTaskId] = useState<string>(NONE);
  const [useFocus, setUseFocus] = useState(false);
  const [focus, setFocus] = useState(14);

  useEffect(() => {
    if (!open) {
      setText('');
      setCourseId(NONE);
      setTaskId(NONE);
      setUseFocus(false);
      setFocus(14);
    }
  }, [open]);

  // Las tareas se acotan a la asignatura elegida: una lista de todas sería
  // ilegible y casi siempre se anota sobre lo que se está estudiando.
  const availableTasks = useMemo(
    () => (courseId === NONE ? [] : (tasks ?? []).filter((t) => t.courseId === courseId)),
    [tasks, courseId]
  );

  const save = () => {
    const clean = text.trim();
    if (!clean) return;
    const course = courses.find((c) => c.id === courseId);
    const task = availableTasks.find((t) => t.id === taskId);
    addSessionNote({
      text: clean,
      elapsedSec: Math.max(0, Math.round(elapsedSec)),
      courseId: course?.id,
      courseName: course?.name,
      taskId: task?.id,
      taskName: task?.name,
      focus: useFocus ? focus : undefined,
    });
    toast({
      title: 'Avance anotado',
      description: `Queda registrado en el minuto ${formatHMS(Math.max(0, Math.round(elapsedSec)))} de la sesión.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-lg font-bold text-primary">
            <NotebookPen className="h-5 w-5" />
            Anotar avance
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            Se guarda con la hora y el minuto de sesión: {formatHMS(Math.max(0, Math.round(elapsedSec)))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="session-note-text" className="text-xs">
              ¿Qué avanzaste?
            </Label>
            <NoteEditor
              id="session-note-text"
              value={text}
              onChange={setText}
              onSubmit={save}
              placeholder="Ej: terminé los ejercicios 1 al 8 de derivadas"
              rows={5}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Asignatura (opcional)</Label>
              <Select
                value={courseId}
                onValueChange={(v) => {
                  setCourseId(v);
                  setTaskId(NONE);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Ninguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ninguna</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Tarea (opcional)</Label>
              <Select value={taskId} onValueChange={setTaskId} disabled={availableTasks.length === 0}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Ninguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ninguna</SelectItem>
                  {availableTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 p-3">
            <button
              type="button"
              onClick={() => setUseFocus((p) => !p)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-[11px] text-muted-foreground">
                Enfoque en este tramo (opcional)
              </span>
              <span className="text-xs font-semibold text-primary">
                {useFocus ? `${focus}/20` : 'añadir'}
              </span>
            </button>
            {useFocus && (
              <Slider
                value={[focus]}
                onValueChange={(v) => setFocus(v[0])}
                min={1}
                max={20}
                step={1}
                className="mt-3"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={!text.trim()}>
            Anotar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
