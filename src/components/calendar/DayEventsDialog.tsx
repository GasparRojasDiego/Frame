import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarPlus, LayoutGrid, Pencil, Tag, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LocalCalendarEvent } from '@/types';
import {
  EVENT_KIND_META,
  eventDisplay,
  eventTextClass,
  isEventInactive,
  normalizeKind,
} from '@/lib/calendar-events';

// ============================================================
// Gestión de los eventos de UN día. Se abre al pulsar una casilla con el
// modo edición encendido: lista todo lo que hay ese día y ofrece crear,
// editar y borrar. Deliberadamente NO se puede abrir sin modo edición, para
// que un clic distraído en el calendario no borre nada.
// ============================================================

export default function DayEventsDialog({
  day,
  events,
  onClose,
  onCreate,
  onEdit,
  onDelete,
}: {
  day: Date | null;
  events: LocalCalendarEvent[];
  onClose: () => void;
  onCreate: () => void;
  onEdit: (event: LocalCalendarEvent) => void;
  onDelete: (id: string) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<LocalCalendarEvent | null>(null);

  return (
    <>
      <Dialog open={!!day} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold capitalize text-primary">
              {day && format(day, "EEEE d 'de' MMMM", { locale: es })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No hay eventos este día.
              </p>
            ) : (
              events.map((event) => {
                const meta = EVENT_KIND_META[normalizeKind(event.kind)];
                const isCell = eventDisplay(event) === 'casilla';
                const inactive = isEventInactive(event);
                return (
                  <div
                    key={event.id}
                    className={cn(
                      'flex items-start justify-between gap-2 rounded-lg p-3',
                      inactive && 'opacity-60'
                    )}
                    style={{ backgroundColor: event.color }}
                  >
                    <div className="min-w-0">
                      <p className={cn('truncate text-sm font-bold', eventTextClass(event.color))}>
                        {meta.glyph} {event.title}
                      </p>
                      <p
                        className={cn(
                          'flex flex-wrap items-center gap-x-2 text-[10px] opacity-80',
                          eventTextClass(event.color)
                        )}
                      >
                        <span>{meta.label}</span>
                        <span className="inline-flex items-center gap-1">
                          {isCell ? <LayoutGrid className="h-2.5 w-2.5" /> : <Tag className="h-2.5 w-2.5" />}
                          {isCell ? 'Casilla' : 'Actividad'}
                        </span>
                        {event.endDate && event.endDate !== event.date && (
                          <span>
                            hasta el {format(new Date(`${event.endDate}T00:00:00`), 'd MMM', { locale: es })}
                          </span>
                        )}
                        {inactive && <span>· pasado</span>}
                      </p>
                      {event.description && (
                        <p className={cn('mt-1 text-xs opacity-90', eventTextClass(event.color))}>
                          {event.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn('h-7 w-7 hover:bg-black/10', eventTextClass(event.color))}
                        onClick={() => onEdit(event)}
                        title="Editar este evento"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn('h-7 w-7 hover:bg-black/10', eventTextClass(event.color))}
                        onClick={() => setPendingDelete(event)}
                        title="Eliminar este evento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}

            <Button variant="outline" className="w-full border-dashed" onClick={onCreate}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Añadir un evento a este día
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará "{pendingDelete?.title}" del calendario
              {pendingDelete?.endDate && pendingDelete.endDate !== pendingDelete.date
                ? ', incluidos todos los días del rango'
                : ''}
              . Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
