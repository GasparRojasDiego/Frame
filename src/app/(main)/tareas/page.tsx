import { useState, useEffect } from 'react';
import { useTodayKey } from '@/hooks/use-today';
import { useSearchParams, useRouter, usePathname } from '@/lib/navigation';
import { LayoutList, LoaderCircle, Archive, Clock } from 'lucide-react';
import { formatHoursMinutes } from '@/lib/duration';
import type { Task } from '@/types';
import { TaskCard } from '@/components/tasks/TaskCard';
import CompletedTasksView from '@/components/tasks/CompletedTasksView';
import TaskFilters, {
  EMPTY_FILTERS,
  applyTaskFilters,
  countActiveFilters,
  type TaskFilterState,
} from '@/components/tasks/TaskFilters';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { dndAccessibility } from '@/lib/dnd-a11y';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import { parseISO } from 'date-fns';
import { tr } from '@/lib/i18n';

function AllTasksView({
  highlightTaskId,
  filters,
  onClearFilters,
}: {
  highlightTaskId: string | null;
  filters: TaskFilterState;
  onClearFilters: () => void;
}) {
  const { tasks, updateTasksOrder } = useCourse();
  const [tasksState, setTasksState] = useState<Task[]>([]);
  const filtersActive = countActiveFilters(filters) > 0;

  useEffect(() => {
    if (tasks) {
        let sortedTasks = [...tasks];

        if (filters.byProximity) {
            // «Por proximidad» (filtro de Entrega): la fecha más cercana primero; sin fecha, al final.
            sortedTasks.sort((a, b) => {
                if (!a.dueDate && !b.dueDate) return (a.order ?? 0) - (b.order ?? 0);
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
            });
        } else {
            // Siempre tu orden: el que creas arrastrando las tarjetas.
            sortedTasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }
        setTasksState(sortedTasks);
    }
  }, [tasks, filters.byProximity]);

  useEffect(() => {
    if (highlightTaskId) {
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`task-card-${highlightTaskId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }, 0); 

      return () => clearTimeout(timeoutId);
    }
  }, [highlightTaskId, tasksState]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (filters.byProximity) return;
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasksState.findIndex((item) => item.id === active.id);
      const newIndex = tasksState.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(tasksState, oldIndex, newIndex);
      
      setTasksState(newItems);
      updateTasksOrder(newItems);
    }
  };

  if (!tasks) {
    return (
      <div className="flex justify-center items-center h-40">
        <LoaderCircle className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tasksState || tasksState.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center">
        {tr('No tienes tareas pendientes. Crea una con el botón «+» de la barra superior o desde cualquier asignatura.')}
      </p>
    );
  }

  const visibleTasks = filtersActive ? applyTaskFilters(tasksState, filters) : tasksState;

  if (visibleTasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">{tr('Ninguna tarea cumple los filtros elegidos.')}</p>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          {tr('Quitar filtros')}
        </Button>
      </div>
    );
  }

  // Con filtros a la vista solo hay una parte de la lista: reordenarla a mano
  // descolocaría las que no se ven.
  const isDragDisabled = filtersActive;

  const TaskListContent = (
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
        {visibleTasks.map((task) => (
          <TaskCard key={task.id} task={task} showCourseName={true} isHighlighted={task.id === highlightTaskId} isDragDisabled={isDragDisabled}/>
        ))}
      </div>
  );

  return isDragDisabled ? TaskListContent : (
    <DndContext accessibility={dndAccessibility()}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToParentElement]}
    >
      <SortableContext items={visibleTasks} strategy={rectSortingStrategy}>
        {TaskListContent}
      </SortableContext>
    </DndContext>
  );
}


export default function TasksPage() {
  // Repinta la lista al cambiar de fecha: «vence hoy» pasa a «venció ayer» solo.
  useTodayKey();
    const { tasks } = useCourse();
    const [showArchived, setShowArchived] = useState(false);
    const [filters, setFilters] = useState<TaskFilterState>(EMPTY_FILTERS);
    const activeFilters = countActiveFilters(filters);
    // Lo que se ve en la galería (con los filtros puestos, solo lo que pasa):
    // cuántas tareas son y cuánto suma su tiempo estimado (1.6.7, Diego).
    const shownTasks = activeFilters > 0 ? applyTaskFilters(tasks ?? [], filters) : (tasks ?? []);
    const shownCount = shownTasks.length;
    const estimatedMinutes = shownTasks.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
    const withoutEstimate = shownTasks.filter((task) => !task.estimatedMinutes).length;
    const [isLoading, setIsLoading] = useState(true);

    // Add router and pathname for URL manipulation
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const highlightTaskId = searchParams.get('highlightTaskId');

    useEffect(() => {
        if (tasks !== null) {
            setIsLoading(false);
        }
    }, [tasks]);

    useEffect(() => {
        if (highlightTaskId) {
            // La tarea resaltada siempre está pendiente: se fuerza la galería.
            setShowArchived(false);
            // After the animation finishes (1.5s * 3 iterations = 4.5s),
            // remove the query parameter from the URL to prevent re-triggering.
            const animationDuration = 4500;
            const timer = setTimeout(() => {
                // Using router.replace to change the URL without adding a new entry to the browser's history stack.
                router.replace(pathname, { scroll: false });
            }, animationDuration);

            // Cleanup the timer if the component unmounts or the effect re-runs
            return () => clearTimeout(timer);
        }
    }, [highlightTaskId, pathname, router]);

    return (
    <div className="flex flex-col h-full pt-10">
        <div className="grid grid-cols-3 items-start px-6 md:px-8 mb-8">
            <div className="flex justify-start items-center gap-2.5 h-9">
              {!showArchived && (
                <>
                  <TaskFilters value={filters} onChange={setFilters} />
                  {tasks && (
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
                      <span className="truncate">
                        <span className="font-semibold text-foreground">{shownCount}</span>{' '}
                        {shownCount === 1 ? tr('tarea') : tr('tareas')}
                        {activeFilters > 0 && tr(' de {length}', { length: tasks.length })}
                      </span>
                      <span aria-hidden className="text-border">·</span>
                      <span
                        className="flex shrink-0 items-center gap-1"
                        title={
                          withoutEstimate > 0
                            ? tr('Tiempo estimado en total. {withoutEstimate} {p} tiempo estimado.', { withoutEstimate, p: withoutEstimate === 1 ? tr('tarea no tiene') : tr('tareas no tienen') })
                            : tr('Tiempo estimado en total')
                        }
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-semibold text-foreground">{formatHoursMinutes(estimatedMinutes)}</span>
                      </span>
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground font-headline">
                  {showArchived ? tr('Tareas archivadas') : tr('Galería de tareas')}
              </h1>
            </div>
            <div className="flex items-center gap-2 justify-end">
                {/* El informe de pendientes se genera en barra superior → Centro de informes. */}
                <Button
                    variant={!showArchived ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setShowArchived(false)}
                    title={tr('Galería de tareas')}
                    className={cn(
                        'h-9 w-9',
                        showArchived && "border-primary bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary"
                    )}
                >
                    <LayoutList className="h-5 w-5" />
                </Button>
                {/* Archivados: volver a ver las tareas ya culminadas */}
                <Button
                    variant={showArchived ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setShowArchived((p) => !p)}
                    title={tr('Archivadas: culminadas e incompletas')}
                    className={cn(
                        'h-9 w-9',
                        !showArchived && "border-primary bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary"
                    )}
                >
                    <Archive className="h-5 w-5" />
                </Button>
            </div>
        </div>

        {isLoading ? (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="w-8 h-8 animate-spin text-primary" />
            </div>
        ) : (
            <div className="px-6 md:px-8">
                {showArchived ? (
                  <CompletedTasksView />
                ) : (
                  <AllTasksView
                    highlightTaskId={highlightTaskId}
                    filters={filters}
                    onClearFilters={() => setFilters(EMPTY_FILTERS)}
                  />
                )}
            </div>
        )}
    </div>
  );
}
