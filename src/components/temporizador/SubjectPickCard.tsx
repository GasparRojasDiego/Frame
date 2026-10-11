import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStoredImage } from '@/hooks/use-stored-image';
import WaveBackdrop from '@/components/courses/WaveBackdrop';
import type { Course } from '@/types';

// ============================================================
// La tarjeta con la que se marca una asignatura al cerrar o al corregir una
// sesión de estudio. Vive aparte porque la usan dos diálogos, y dos copias
// de la misma tarjeta acabarían separándose al primer retoque.
//
// Es la tarjeta de la interfaz Asignaturas: portada de extremo a extremo
// arriba, línea divisoria y el nombre centrado en azul debajo. La marca de
// selección va SOBRE la portada para no descolocar el nombre del centro.
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
