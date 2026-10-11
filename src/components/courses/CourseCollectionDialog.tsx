import { useMemo, useState } from 'react';
import { Check, Layers, Minus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Course } from '@/types';

// ============================================================
// Mover UNA asignatura de colección.
//
// Hasta ahora la pertenencia a una colección solo se decidía al crearla: una
// asignatura creada después se quedaba fuera para siempre y había que rehacer
// la colección entera. Aquí se cambia en dos clics, y también se puede sacar.
//
// Una asignatura pertenece como mucho a UNA colección, igual que en el resto
// de la interfaz: por eso la lista se comporta como una elección única.
// ============================================================

export default function CourseCollectionDialog({
  course,
  open,
  onOpenChange,
}: {
  course: Course;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { spaces, updateSpace } = useCourse();
  const { toast } = useToast();

  const currentSpaceId = useMemo(
    () => spaces.find((s) => s.courseIds.includes(course.id))?.id ?? null,
    [spaces, course.id]
  );
  const [selected, setSelected] = useState<string | null>(currentSpaceId);

  // Al reabrir, la selección vuelve a reflejar la realidad guardada.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setSelected(currentSpaceId);
  }

  const save = () => {
    if (selected === currentSpaceId) {
      onOpenChange(false);
      return;
    }
    // Fuera de la colección anterior…
    if (currentSpaceId) {
      const from = spaces.find((s) => s.id === currentSpaceId);
      if (from) {
        updateSpace(from.id, { courseIds: from.courseIds.filter((id) => id !== course.id) });
      }
    }
    // …y dentro de la nueva, si eligió alguna.
    if (selected) {
      const to = spaces.find((s) => s.id === selected);
      if (to && !to.courseIds.includes(course.id)) {
        updateSpace(to.id, { courseIds: [...to.courseIds, course.id] });
      }
      toast({
        title: 'Asignatura movida',
        description: `"${course.name}" ahora está en ${spaces.find((s) => s.id === selected)?.name}.`,
      });
    } else {
      toast({
        title: 'Asignatura suelta',
        description: `"${course.name}" ya no pertenece a ninguna colección.`,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-lg font-bold text-primary">
            <Layers className="h-5 w-5" />
            Colección de {course.name}
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            Una asignatura pertenece como mucho a una colección.
          </DialogDescription>
        </DialogHeader>

        {spaces.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Todavía no hay colecciones. Créala desde «Añadir» y podrás traer aquí esta asignatura.
          </p>
        ) : (
          <ScrollArea className="max-h-[300px] pr-2">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors',
                  selected === null
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent hover:bg-accent'
                )}
              >
                <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 text-sm text-foreground">Sin colección</span>
                {selected === null && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>

              {spaces.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => setSelected(space.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors',
                    selected === space.id
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent hover:bg-accent'
                  )}
                >
                  <Layers className="h-4 w-4 shrink-0 text-primary/70" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{space.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {space.courseIds.length}
                  </span>
                  {selected === space.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={spaces.length === 0}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
