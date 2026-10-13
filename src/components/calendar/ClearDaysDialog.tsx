import { useEffect, useState } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EchoHeader } from '@/components/shared/EchoWord';
import { kindLabelOf } from '@/lib/calendar-events';
import { cn } from '@/lib/utils';
import type { LocalCalendarEvent } from '@/types';
import { daysOf, eventEnd, rangeLabel, shortDayLabel, type DayRange } from './calendar-model';
import { tr } from '@/lib/i18n';

// ============================================================
// Vaciar varios días con varias actividades (1.6.7, Diego): un recuadro
// centrado con la lista para marcar cuáles se eliminan. Con UNA marcada, el
// lápiz la abre para editarla. Un evento que sigue fuera de los días elegidos
// no se pierde: solo se le quitan estos días.
// ============================================================

export interface ClearDaysRequest {
  range: DayRange;
  events: LocalCalendarEvent[];
  /** Días del rango con color propio. */
  colorDays: number;
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

export default function ClearDaysDialog({
  request,
  onClose,
  onDelete,
  onEdit,
}: {
  request: ClearDaysRequest | null;
  onClose: () => void;
  /** Eventos marcados y si también se quitan los colores. */
  onDelete: (eventIds: Set<string>, colors: boolean) => void;
  onEdit: (event: LocalCalendarEvent) => void;
}) {
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [colors, setColors] = useState(false);

  // Cada apertura empieza sin nada marcado: borrar es una decisión.
  useEffect(() => {
    setMarked(new Set());
    setColors(false);
  }, [request]);

  const events = request?.events ?? [];
  const toggle = (id: string) =>
    setMarked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allMarked = events.length > 0 && events.every((event) => marked.has(event.id));
  const single = marked.size === 1 ? events.find((event) => marked.has(event.id)) ?? null : null;
  const anything = marked.size > 0 || colors;

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <EchoHeader word={tr('Eliminar')}>
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-primary">{tr('¿Qué quieres eliminar?')}</DialogTitle>
            <DialogDescription className="text-center text-xs">
              {request ? (request.range.start === request.range.end ? shortDayLabel(request.range.start) : tr('{length} días · {rangeLabel}', { length: daysOf(request.range).length, rangeLabel: rangeLabel(request.range) })) : ''}
            </DialogDescription>
          </DialogHeader>
        </EchoHeader>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setMarked(allMarked ? new Set() : new Set(events.map((event) => event.id)))}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            {allMarked ? tr('Desmarcar todas') : tr('Marcar todas')}
          </button>
          <ul className="max-h-72 space-y-1 overflow-y-auto pr-1" role="group" aria-label={tr('Actividades')}>
            {events.map((event) => {
              const end = eventEnd(event);
              const outside = request ? event.date < request.range.start || end > request.range.end : false;
              const checked = marked.has(event.id);
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(event.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                      checked ? 'border-primary bg-primary/10' : 'border-border/70 bg-card hover:border-primary/50'
                    )}
                  >
                    <CheckBox checked={checked} />
                    <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ background: event.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{event.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {[
                          kindLabelOf(event),
                          end !== event.date ? rangeLabel({ start: event.date, end }) : shortDayLabel(event.date),
                          event.time ?? '',
                          outside ? tr('solo se quitan estos días') : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {request && request.colorDays > 0 && (
              <li>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={colors}
                  onClick={() => setColors((current) => !current)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-sm transition-colors',
                    colors ? 'border-primary bg-primary/10' : 'border-border/70 bg-card hover:border-primary/50'
                  )}
                >
                  <CheckBox checked={colors} />
                  <span className="font-semibold text-foreground">
                    {tr('Color de')}{' '}{request.colorDays} {request.colorDays === 1 ? tr('casilla') : tr('casillas')}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <Button
            type="button"
            variant="fantasma"
            size="icon"
            disabled={!single || colors}
            onClick={() => single && onEdit(single)}
            title={single ? tr('Editar «{title}»', { title: single.title }) : tr('Marca una sola actividad para editarla')}
            aria-label={tr('Editar la actividad marcada')}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="gris" onClick={onClose}>
              {tr('Cancelar')}
            </Button>
            <Button type="button" variant="destructive" disabled={!anything} onClick={() => onDelete(marked, colors)}>
              <Trash2 />
              {tr('Eliminar')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
