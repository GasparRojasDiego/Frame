import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Layers, ListChecks, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStoredImage } from '@/hooks/use-stored-image';
import { useCourse } from '@/context/CourseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import WaveBackdrop from '@/components/courses/WaveBackdrop';
import { PickCard, groupImageKeys, useSubjectGroups } from '@/components/courses/SubjectPicker';
import type { Course, Task } from '@/types';

// ============================================================
// La tarjeta con la que se marca una asignatura al cerrar o al corregir una
// sesión de estudio. Vive aparte porque la usan dos diálogos, y dos copias
// de la misma tarjeta acabarían separándose al primer retoque.
//
// Es la tarjeta de la interfaz Asignaturas: portada de extremo a extremo
// arriba, línea divisoria y el nombre centrado en azul debajo. La marca de
// selección va SOBRE la portada para no descolocar el nombre del centro.
//
// Al final del archivo, `SessionSubjectPicker`: el recorrido completo del
// cierre de sesión (colecciones → asignaturas → sus tareas).
// ============================================================

/** Portada de la asignatura; si no tiene, las olas animadas de siempre. */
export function SubjectCover({ courseId, className }: { courseId: string; className?: string }) {
  const [image] = useStoredImage(`courseImage_${courseId}`);

  return (
    <span className={cn('relative block overflow-hidden bg-accent', className)}>
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <WaveBackdrop />
      )}
    </span>
  );
}

export function SubjectCard({
  course,
  selected,
  /** Tareas avanzables. Con 0 la flecha no se dibuja: la tarjeta queda limpia,
   *  que es como la usa el diálogo de corregir una sesión. */
  pendingTasks = 0,
  expanded = false,
  onToggle,
  onToggleTasks,
}: {
  course: Course;
  selected: boolean;
  pendingTasks?: number;
  expanded?: boolean;
  onToggle: () => void;
  onToggleTasks?: () => void;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border transition-all',
        selected
          ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]'
          : 'border-border/70 hover:border-primary/40'
      )}
    >
      <button type="button" onClick={onToggle} aria-pressed={selected} className="block w-full text-left">
        {/* Portada de extremo a extremo (u olas si la asignatura no tiene). */}
        <span className="relative block h-20">
          <SubjectCover courseId={course.id} className="h-full w-full" />
          <span
            className={cn(
              'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border backdrop-blur transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 bg-background/70 text-transparent'
            )}
          >
            <Check className="h-3 w-3" />
          </span>
        </span>

        {/* Nombre centrado, como en las tarjetas de Asignaturas. */}
        <span
          className={cn(
            'block border-t border-border/60 px-7 py-2 transition-colors',
            selected ? 'bg-primary/10' : 'bg-card'
          )}
        >
          <span className="block truncate text-center text-xs font-bold text-primary">
            {course.name}
          </span>
          {pendingTasks > 0 && (
            <span className="block text-center text-[10px] text-muted-foreground">
              {pendingTasks === 1 ? '1 tarea avanzable' : `${pendingTasks} tareas avanzables`}
            </span>
          )}
        </span>
      </button>

      {/* La flecha despliega y repliega las tareas de ESTA asignatura. */}
      {pendingTasks > 0 && onToggleTasks && (
        <button
          type="button"
          onClick={onToggleTasks}
          aria-expanded={expanded}
          title={expanded ? 'Ocultar sus tareas' : 'Ver sus tareas'}
          className={cn(
            'absolute bottom-1.5 right-1 rounded-md p-1 transition-colors',
            expanded ? 'text-primary' : 'text-muted-foreground hover:text-primary'
          )}
        >
          <ChevronRight
            className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-90')}
          />
        </button>
      )}
    </div>
  );
}

export const formatEstimate = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

/**
 * Tarjeta de una tarea que se puede marcar: nombre, tiempo estimado (si lo
 * tiene) y su avance. La marca es la misma bolita que la de las asignaturas:
 * tarjetas, nunca casillas.
 */
export function TaskPickCard({
  task,
  selected,
  onToggle,
}: {
  task: Task;
  selected: boolean;
  onToggle: () => void;
}) {
  const estimate = task.estimatedMinutes ?? 0;
  const progress = Math.max(0, Math.min(100, task.progress || 0));
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'relative flex w-full flex-col gap-0.5 rounded-lg border py-2 pl-8 pr-2.5 text-left transition-all',
        selected
          ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]'
          : 'border-border/70 bg-card hover:border-primary/40'
      )}
    >
      <span
        className={cn(
          'absolute left-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full border transition-colors',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-transparent'
        )}
      >
        <Check className="h-2.5 w-2.5" />
      </span>
      <span className="block truncate text-[11px] font-semibold text-foreground">{task.name}</span>
      <span className="block text-[10px] text-muted-foreground">
        {estimate > 0 ? `estimada ${formatEstimate(estimate)} · ` : ''}
        {progress}%
      </span>
      <span className="mt-0.5 block h-0.5 w-full overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </span>
    </button>
  );
}

// ============================================================
// Qué se estudió en la sesión: colecciones → asignaturas → sus tareas.
//
// Primero las tarjetas de colección (la cabeza va de «esto es de ciencias» a
// «esto es de física»); al abrir una, sus asignaturas, que se marcan y
// desmarcan. Al marcar una asignatura aparecen debajo sus tareas avanzables
// para señalar cuáles se avanzaron. Escribir en el buscador se salta los
// pasos y enseña las asignaturas que coinciden.
//
// Solo se ofrecen las tareas pendientes CON tiempo estimado: el avance de la
// sesión se reparte en proporción a esa estimación, y una tarea sin ella no
// avanzaría (solo restaría su parte a las demás).
//
// Con una sola colección (o ninguna creada) el primer paso sobra y se entra
// directamente en las asignaturas.
// ============================================================
export function SessionSubjectPicker({
  subjectIds,
  taskIds,
  onChange,
  title = '¿Qué estudiaste?',
  className,
}: {
  subjectIds: string[];
  taskIds: string[];
  onChange: (next: { subjectIds: string[]; taskIds: string[] }) => void;
  title?: string;
  className?: string;
}) {
  const { courses, tasks } = useCourse();
  const groups = useSubjectGroups();
  const [search, setSearch] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const single = groups.length === 1 ? groups[0] : null;
  const current = single ?? groups.find((group) => group.id === openGroup) ?? null;
  const hasCourses = (courses?.length ?? 0) > 0;

  const needle = search.trim().toLowerCase();
  const searchResults = useMemo(
    () => (needle === '' ? [] : (courses ?? []).filter((course) => course.name.toLowerCase().includes(needle))),
    [courses, needle]
  );

  /** Tareas pendientes con tiempo estimado, por asignatura. */
  const advanceable = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      if ((task.estimatedMinutes ?? 0) <= 0 || (task.progress || 0) >= 100) continue;
      const list = map.get(task.courseId);
      if (list) list.push(task);
      else map.set(task.courseId, [task]);
    }
    return map;
  }, [tasks]);

  const chosen = new Set(subjectIds);
  const chosenTasks = new Set(taskIds);

  const toggleSubject = (courseId: string) => {
    if (!chosen.has(courseId)) {
      onChange({ subjectIds: [...subjectIds, courseId], taskIds });
      return;
    }
    // Al desmarcar una asignatura se desmarcan también sus tareas.
    onChange({
      subjectIds: subjectIds.filter((id) => id !== courseId),
      taskIds: taskIds.filter((id) => {
        const task = (tasks ?? []).find((t) => t.id === id);
        return task ? task.courseId !== courseId : false;
      }),
    });
  };

  /** Marcar una tarea implica haber estudiado su asignatura: se marca sola. */
  const toggleTask = (task: Task) => {
    if (chosenTasks.has(task.id)) {
      onChange({ subjectIds, taskIds: taskIds.filter((id) => id !== task.id) });
      return;
    }
    onChange({
      subjectIds: chosen.has(task.courseId) ? subjectIds : [...subjectIds, task.courseId],
      taskIds: [...taskIds, task.id],
    });
  };

  // Lo que se ve: resultados de búsqueda, las asignaturas de la colección
  // abierta o (si es null) las colecciones.
  const visibleCourses: Course[] | null = needle !== '' ? searchResults : current ? current.courses : null;
  const withTasks = (visibleCourses ?? []).filter(
    (course) => chosen.has(course.id) && (advanceable.get(course.id)?.length ?? 0) > 0
  );
  const showBack = needle === '' && current !== null && single === null;
  const grid = 'grid grid-cols-2 items-start gap-2 sm:grid-cols-3';

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          {showBack && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => setOpenGroup(null)}
              title="Volver a las colecciones"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <span className="truncate">{showBack && current ? current.name : title}</span>
          {subjectIds.length > 0 && (
            <span className="shrink-0 text-xs font-normal text-primary">
              · {subjectIds.length} {subjectIds.length === 1 ? 'marcada' : 'marcadas'}
            </span>
          )}
        </p>
        {hasCourses && (
          <div className="relative w-full sm:w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 border-primary/60 bg-card pl-8 text-xs"
            />
          </div>
        )}
      </div>

      {!hasCourses ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          No has creado ninguna asignatura.
        </p>
      ) : visibleCourses === null ? (
        /* --- Paso 1: las colecciones --- */
        <div className={grid}>
          {groups.map((group) => {
            const marked = group.courses.filter((course) => chosen.has(course.id)).length;
            return (
              <div key={group.id} className="relative">
                <PickCard
                  title={group.name}
                  imageKeys={groupImageKeys(group)}
                  subtitle={
                    marked > 0
                      ? `${marked} de ${group.courses.length} marcadas`
                      : `${group.courses.length} ${group.courses.length === 1 ? 'asignatura' : 'asignaturas'}`
                  }
                  onSelect={() => setOpenGroup(group.id)}
                />
                <span className="pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-background/70 backdrop-blur">
                  <Layers className={cn('h-3 w-3', marked > 0 ? 'text-primary' : 'text-muted-foreground')} />
                </span>
              </div>
            );
          })}
        </div>
      ) : visibleCourses.length === 0 ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          Ninguna asignatura coincide con la búsqueda.
        </p>
      ) : (
        <>
          {/* --- Paso 2: las asignaturas --- */}
          <div className={grid}>
            {visibleCourses.map((course) => {
              const pending = advanceable.get(course.id)?.length ?? 0;
              return (
                <PickCard
                  key={course.id}
                  title={course.name}
                  imageKeys={[`courseImage_${course.id}`]}
                  subtitle={pending > 0 ? `${pending} ${pending === 1 ? 'tarea' : 'tareas'}` : undefined}
                  selected={chosen.has(course.id)}
                  onSelect={() => toggleSubject(course.id)}
                />
              );
            })}
          </div>

          {/* --- Paso 3: las tareas de cada asignatura marcada --- */}
          {withTasks.map((course) => (
            <div
              key={course.id}
              className="space-y-1.5 duration-200 animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none"
            >
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">Tareas de {course.name}</span>
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {(advanceable.get(course.id) ?? []).map((task) => (
                  <TaskPickCard
                    key={task.id}
                    task={task}
                    selected={chosenTasks.has(task.id)}
                    onToggle={() => toggleTask(task)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
