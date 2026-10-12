import { useEffect, useMemo, useState } from 'react';
import { Gauge, NotebookPen, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import NoteEditor from '@/components/temporizador/NoteEditor';
import { TaskPickCard } from '@/components/temporizador/SubjectPickCard';
import SubjectPicker from '@/components/courses/SubjectPicker';
import EchoWord from '@/components/shared/EchoWord';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import { formatHMS } from '@/lib/duration';
import { isRichNoteEmpty } from '@/lib/rich-note';
import { cn } from '@/lib/utils';

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
//
// La asignatura se elige con las mismas tarjetas que el «Crear» de la barra
// superior (colecciones → asignaturas); al elegirla aparecen sus tareas
// pendientes, también en tarjetas.
// ============================================================

const DEFAULT_FOCUS = 14;

/** «Enfoque (opcional)»: un botón pequeño que despliega la barra 1-20. */
function FocusPicker({ value, onChange }: { value: number | null; onChange: (next: number | null) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            // 30 px: el mismo alto que la barra de formato que tiene al lado.
            'flex h-[30px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors',
            value !== null
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/60 hover:text-primary'
          )}
        >
          <Gauge className="h-3.5 w-3.5" />
          {value !== null ? (
            <>
              Enfoque <span className="tabular-nums">{value}/20</span>
            </>
          ) : (
            'Enfoque (opcional)'
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 space-y-3 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Enfoque en este tramo</span>
          <span className="text-sm font-bold tabular-nums text-primary">{value ?? '–'}/20</span>
        </div>
        <Slider
          value={[value ?? DEFAULT_FOCUS]}
          onValueChange={(next) => onChange(next[0])}
          min={1}
          max={20}
          step={1}
        />
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="h-3 w-3" />
            Quitar
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

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
  const [courseId, setCourseId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setText('');
      setCourseId(null);
      setTaskId(null);
      setFocus(null);
    }
  }, [open]);

  // Las tareas se acotan a la asignatura elegida y a las pendientes: una lista
  // de todas sería ilegible y casi siempre se anota sobre lo que se estudia.
  const availableTasks = useMemo(
    () =>
      courseId === null
        ? []
        : (tasks ?? []).filter((t) => t.courseId === courseId && (t.progress || 0) < 100),
    [tasks, courseId]
  );

  const empty = isRichNoteEmpty(text);
  const minute = formatHMS(Math.max(0, Math.round(elapsedSec)));

  const save = () => {
    if (empty) return;
    const course = courses.find((c) => c.id === courseId);
    const task = availableTasks.find((t) => t.id === taskId);
    addSessionNote({
      text: text.trim(),
      elapsedSec: Math.max(0, Math.round(elapsedSec)),
      courseId: course?.id,
      courseName: course?.name,
      taskId: task?.id,
      taskName: task?.name,
      focus: focus ?? undefined,
    });
    toast({
      title: 'Avance anotado',
      description: `Queda registrado en el minuto ${minute} de la sesión.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="relative shrink-0 space-y-1 overflow-hidden px-6 pb-4 pt-6">
          {/* «AVANCE», repetido y a la deriva detrás del título. */}
          <EchoWord word="Avance" />
          <DialogTitle className="relative flex items-center justify-center gap-2 text-lg font-bold text-primary">
            <NotebookPen className="h-5 w-5" />
            Anotar avance
          </DialogTitle>
          <DialogDescription className="relative text-center text-xs">
            Minuto {minute} de la sesión
          </DialogDescription>
        </DialogHeader>

        <div aria-hidden className="mx-6 h-px shrink-0 bg-border" />

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {/* Se escribe directamente; el enfoque, arriba a la derecha. */}
          <NoteEditor
            id="session-note-text"
            ariaLabel="Avance de la sesión"
            value={text}
            onChange={setText}
            onSubmit={save}
            placeholder="Ej: terminé los ejercicios 1 al 8 de derivadas"
            rows={5}
            autoFocus
            toolbarEnd={<FocusPicker value={focus} onChange={setFocus} />}
          />

          <SubjectPicker
            value={courseId}
            onChange={(next) => {
              setCourseId(next);
              setTaskId(null);
            }}
            allowNone
            noneHint="Queda solo en la sesión"
          />

          {availableTasks.length > 0 && (
            <div className="space-y-2 duration-200 animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none">
              <p className="text-sm font-semibold text-foreground">
                ¿De qué tarea?
                {taskId && (
                  <span className="ml-2 text-xs font-normal text-primary">
                    · {availableTasks.find((t) => t.id === taskId)?.name}
                  </span>
                )}
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {availableTasks.map((task) => (
                  <TaskPickCard
                    key={task.id}
                    task={task}
                    selected={taskId === task.id}
                    onToggle={() => setTaskId((prev) => (prev === task.id ? null : task.id))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div aria-hidden className="mx-6 h-px shrink-0 bg-border" />
        <div className="flex shrink-0 justify-end gap-2 px-6 py-3">
          <Button variant="fantasmaRojo" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={empty}>
            Anotar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
