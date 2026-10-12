import { format, parseISO } from 'date-fns';
import { Gauge, NotebookPen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatHMS } from '@/lib/duration';
import RichNoteView from '@/components/temporizador/RichNoteView';
import { cn } from '@/lib/utils';
import type { SessionNote } from '@/types';

// ============================================================
// Los avances de una sesión, en orden.
//
// Cada línea lleva DOS tiempos porque responden a preguntas distintas: la
// hora del reloj ("a las 19:42") sirve de registro; el minuto de sesión
// ("0:35:00") dice en qué momento del esfuerzo pasó.
//
// Se usa igual con la sesión en curso (con papelera) que con una ya guardada
// (solo lectura, dentro del calendario de Enfoque).
//
// La papelera está SIEMPRE a la vista, no al pasar el ratón: una anotación
// cuyo botón de quitar hay que descubrir es una anotación atascada.
// ============================================================

const safeTime = (iso: string): string => {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return '';
  }
};

export default function SessionNotesList({
  notes,
  onDelete,
  className,
}: {
  notes: SessionNote[];
  onDelete?: (id: string) => void;
  className?: string;
}) {
  if (notes.length === 0) return null;

  return (
    <ul className={cn('space-y-1.5', className)}>
      {notes.map((note) => (
        <li
          key={note.id}
          className="group flex items-start gap-2.5 rounded-md border-l-2 border-primary/50 bg-secondary/40 py-1.5 pl-2.5 pr-1.5"
        >
          <div className="shrink-0 pt-0.5 text-right">
            <p className="font-mono text-[10px] font-bold tabular-nums text-primary">
              {formatHMS(note.elapsedSec)}
            </p>
            <p className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
              {safeTime(note.at)}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <RichNoteView text={note.text} className="text-[11px] leading-snug text-foreground" />
            {(note.courseName || note.taskName || note.focus) && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                {note.courseName && <span className="text-primary/80">{note.courseName}</span>}
                {note.taskName && <span className="truncate">· {note.taskName}</span>}
                {note.focus !== undefined && (
                  <span className="flex items-center gap-0.5">
                    <Gauge className="h-3 w-3" />
                    {note.focus}/20
                  </span>
                )}
              </p>
            )}
          </div>

          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-muted-foreground/60 transition-colors hover:text-destructive"
              onClick={() => onDelete(note.id)}
              title="Quitar esta anotación"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Cabecera reutilizable para las listas de avances. */
export function SessionNotesHeading({ count }: { count: number }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
      <NotebookPen className="h-3.5 w-3.5 text-primary" />
      Avances anotados
      <span className="font-normal text-muted-foreground/70">({count})</span>
    </p>
  );
}
