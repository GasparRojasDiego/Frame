import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SubjectMultiPicker } from '@/components/courses/SubjectPicker';
import EchoWord from '@/components/shared/EchoWord';
import { cn } from '@/lib/utils';
import { MAX_COMPETENCY_COURSES, MIN_COMPETENCY_COURSES } from '@/lib/competency';

// ============================================================
// Elegir las asignaturas del radar.
//
// Las tarjetas de asignatura de siempre, todas a la vista y agrupadas por
// colección (una línea fina con su nombre al centro; 1.6.6), o con búsqueda
// directa, marcando varias. El tope de vértices se hace
// cumplir aquí: la tarjeta que pasaría del máximo no se marca y el contador
// lo avisa en rojo un momento.
// ============================================================

interface CompetencyCoursesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSave: (ids: string[]) => void;
}

/** Cuánto dura en rojo el aviso de «máximo» tras intentar pasarse. */
const OVER_MAX_FLASH_MS = 1800;

export default function CompetencyCoursesDialog({
  open,
  onOpenChange,
  selectedIds,
  onSave,
}: CompetencyCoursesDialogProps) {
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [overMax, setOverMax] = useState(false);
  const flashTimer = useRef<number | null>(null);

  // El borrador se re-sincroniza cada vez que se abre el diálogo, de modo que
  // "Cancelar" siempre descarta los cambios sin tocar la selección real.
  useEffect(() => {
    if (open) {
      setDraft(selectedIds);
      setOverMax(false);
    }
  }, [open, selectedIds]);

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    []
  );

  const handleChange = (ids: string[]) => {
    // Quitar siempre se puede; añadir, solo hasta el máximo de vértices.
    if (ids.length > MAX_COMPETENCY_COURSES && ids.length > draft.length) {
      setOverMax(true);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setOverMax(false), OVER_MAX_FLASH_MS);
      return;
    }
    setOverMax(false);
    setDraft(ids);
  };

  const missing = draft.length > 0 ? Math.max(0, MIN_COMPETENCY_COURSES - draft.length) : 0;
  // Se permite guardar 0 (retirar la matriz) o un número válido de vértices.
  const canSave =
    draft.length === 0 ||
    (draft.length >= MIN_COMPETENCY_COURSES && draft.length <= MAX_COMPETENCY_COURSES);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="relative shrink-0 overflow-hidden px-6 pb-4 pt-6">
          {/* «ELEGIR», repetido y a la deriva detrás del título. */}
          <EchoWord word="Elegir" />
          <DialogTitle className="relative text-center text-lg font-bold text-primary">
            Elegir asignaturas
          </DialogTitle>
          <DialogDescription className="relative text-center text-xs">
            Entre {MIN_COMPETENCY_COURSES} y {MAX_COMPETENCY_COURSES} para el radar
          </DialogDescription>
        </DialogHeader>

        <div className="mx-6 h-px shrink-0 bg-border" />

        {/* Alto fijo: el recuadro no salta al pasar de colecciones a asignaturas. */}
        <div className="h-[min(24rem,58vh)] overflow-y-auto px-6 py-4">
          <SubjectMultiPicker
            values={draft}
            onChange={handleChange}
            title="Asignaturas"
            max={MAX_COMPETENCY_COURSES}
            searchClassName="sm:w-56"
            grouped
          />
        </div>

        <div className="mx-6 h-px shrink-0 bg-border" />

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 py-3">
          <p
            className={cn(
              'text-[11px] font-semibold tabular-nums transition-colors motion-reduce:transition-none',
              overMax || missing > 0
                ? 'text-destructive'
                : draft.length >= MIN_COMPETENCY_COURSES
                  ? 'text-primary'
                  : 'text-muted-foreground'
            )}
            aria-live="polite"
          >
            {draft.length}/{MAX_COMPETENCY_COURSES}
            <span className="font-normal">
              {overMax
                ? ` · máximo ${MAX_COMPETENCY_COURSES}`
                : missing > 0
                  ? ` · ${missing === 1 ? 'falta 1' : `faltan ${missing}`}`
                  : draft.length === 0
                    ? ' · sin radar'
                    : ''}
            </span>
          </p>
          <div className="flex gap-2">
            <Button variant="gris" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={!canSave} onClick={() => onSave(draft)}>
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
