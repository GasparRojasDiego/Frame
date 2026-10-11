import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Course } from '@/types';
import { MAX_COMPETENCY_COURSES, MIN_COMPETENCY_COURSES } from '@/lib/competency';

interface CompetencyCoursesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  pendingByCourse: Map<string, number>;
  selectedIds: string[];
  onSave: (ids: string[]) => void;
}

export default function CompetencyCoursesDialog({
  open,
  onOpenChange,
  courses,
  pendingByCourse,
  selectedIds,
  onSave,
}: CompetencyCoursesDialogProps) {
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [search, setSearch] = useState('');

  // El borrador se re-sincroniza cada vez que se abre el diálogo, de modo que
  // "Cancelar" siempre descarta los cambios sin tocar la selección real.
  useEffect(() => {
    if (open) {
      setDraft(selectedIds);
      setSearch('');
    }
  }, [open, selectedIds]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? courses.filter((c) => c.name.toLowerCase().includes(query)) : courses;
  }, [courses, search]);

  const atMax = draft.length >= MAX_COMPETENCY_COURSES;
  // Se permite guardar 0 (retirar la matriz) o un número válido de vértices.
  const canSave =
    draft.length === 0 ||
    (draft.length >= MIN_COMPETENCY_COURSES && draft.length <= MAX_COMPETENCY_COURSES);

  const handleToggle = (courseId: string, checked: boolean) => {
    setDraft((prev) => (checked ? [...prev, courseId] : prev.filter((id) => id !== courseId)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-primary font-bold text-center">
            Asignaturas de la matriz
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            Elige entre {MIN_COMPETENCY_COURSES} y {MAX_COMPETENCY_COURSES} asignaturas. El nivel de
            cada vértice se calcula solo, a partir de sus tareas pendientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Buscar asignaturas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-card"
          />

          <ScrollArea className="h-64 w-full rounded-md border">
            <div className="p-4 space-y-3">
              {filtered.length > 0 ? (
                filtered.map((course, index) => {
                  const checked = draft.includes(course.id);
                  const pending = pendingByCourse.get(course.id) ?? 0;
                  return (
                    <React.Fragment key={course.id}>
                      <div
                        className={cn(
                          'flex items-center gap-3',
                          !checked && atMax && 'opacity-45'
                        )}
                      >
                        <Checkbox
                          id={`competency-${course.id}`}
                          checked={checked}
                          disabled={!checked && atMax}
                          onCheckedChange={(value) => handleToggle(course.id, !!value)}
                        />
                        <Label
                          htmlFor={`competency-${course.id}`}
                          className="flex-grow text-sm font-medium leading-none truncate cursor-pointer"
                        >
                          {course.name}
                        </Label>
                        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                          {pending === 0 ? 'al día' : `${pending} pend.`}
                        </span>
                      </div>
                      {index < filtered.length - 1 && <Separator className="my-2" />}
                    </React.Fragment>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {courses.length === 0
                    ? 'Todavía no has creado ninguna asignatura.'
                    : 'No hay asignaturas que coincidan.'}
                </p>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span
              className={cn(
                'font-semibold tabular-nums',
                atMax ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {draft.length}/{MAX_COMPETENCY_COURSES} seleccionadas
            </span>
            {draft.length > 0 && draft.length < MIN_COMPETENCY_COURSES && (
              <span className="text-destructive text-right">
                Se necesitan al menos {MIN_COMPETENCY_COURSES}.
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={() => onSave(draft)}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
