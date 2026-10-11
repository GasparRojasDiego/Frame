import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarIcon, LayoutGrid, Tag, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EchoHeader } from '@/components/shared/EchoWord';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LocalCalendarEvent, LocalEventDisplay, LocalEventKind } from '@/types';
import {
  DEFAULT_EVENT_COLOR,
  EVENT_COLOR_ROWS,
  EVENT_KINDS,
  EVENT_KIND_META,
  eventDisplay,
  eventTextClass,
  findCellClash,
  normalizeKind,
} from '@/lib/calendar-events';

// ============================================================
// Alta y edición de un evento del calendario LOCAL.
//
// El mismo formulario sirve para los dos casos: si llega `event`, edita; si
// no, crea. Así no hay dos pantallas que puedan divergir.
//
// Dos decisiones vertebran el formulario:
//   · TIPO — qué clase de evento es (diez opciones, de feriado a recordatorio).
//   · PRESENTACIÓN — casilla (pinta el día entero, máximo uno) o actividad
//     (etiqueta pequeña dentro de la casilla, sin límite).
// ============================================================

const toDate = (iso?: string): Date | undefined => {
  if (!iso) return undefined;
  try {
    return parseISO(iso);
  } catch {
    return undefined;
  }
};

export default function LocalEventDialog({
  open,
  onOpenChange,
  onCreate,
  onUpdate,
  event,
  allEvents,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (event: Omit<LocalCalendarEvent, 'id'>) => void;
  onUpdate?: (id: string, updates: Partial<Omit<LocalCalendarEvent, 'id'>>) => void;
  /** Evento a editar. Ausente = alta. */
  event?: LocalCalendarEvent | null;
  /** Todos los eventos, para avisar de choques entre casillas. */
  allEvents?: LocalCalendarEvent[];
  /** Fecha preseleccionada al crear desde una casilla concreta. */
  defaultDate?: Date;
}) {
  const isEdit = Boolean(event);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<LocalEventKind>('personal');
  const [display, setDisplay] = useState<LocalEventDisplay>('actividad');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [color, setColor] = useState(DEFAULT_EVENT_COLOR);
  const [description, setDescription] = useState('');
  /** La presentación deja de seguir al tipo en cuanto el usuario la toca. */
  const [displayTouched, setDisplayTouched] = useState(false);

  // Cada apertura carga el evento a editar, o deja el formulario limpio.
  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setKind(normalizeKind(event.kind));
      setDisplay(eventDisplay(event));
      setDate(toDate(event.date));
      setEndDate(toDate(event.endDate));
      setColor(event.color || DEFAULT_EVENT_COLOR);
      setDescription(event.description ?? '');
      setDisplayTouched(true);
    } else {
      setTitle('');
      setKind('personal');
      setDisplay(EVENT_KIND_META.personal.defaultDisplay);
      setDate(defaultDate);
      setEndDate(undefined);
      setColor(DEFAULT_EVENT_COLOR);
      setDescription('');
      setDisplayTouched(false);
    }
  }, [open, event, defaultDate]);

  const handleKindChange = (value: string) => {
    const next = normalizeKind(value);
    setKind(next);
    // Mientras el usuario no elija presentación a mano, el tipo la sugiere.
    if (!displayTouched) setDisplay(EVENT_KIND_META[next].defaultDisplay);
  };

  const meta = EVENT_KIND_META[kind];
  const canSave = title.trim().length > 0 && !!date;

  const startStr = date ? format(date, 'yyyy-MM-dd') : '';
  const endStr = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;
  const normalizedEnd = endStr && endStr > startStr ? endStr : undefined;

  // Aviso —no bloqueo— cuando ya hay otra casilla pintada esos días.
  const clash =
    display === 'casilla' && startStr
      ? findCellClash(allEvents, startStr, normalizedEnd, event?.id)
      : null;

  const handleSave = () => {
    if (!canSave || !date) return;
    const payload: Omit<LocalCalendarEvent, 'id'> = {
      title: title.trim(),
      kind,
      display,
      date: startStr,
      // Un rango invertido se normaliza en silencio.
      endDate: normalizedEnd,
      color,
      description: description.trim() || undefined,
    };
    if (isEdit && event && onUpdate) onUpdate(event.id, payload);
    else onCreate(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <EchoHeader word="Evento">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-primary">
              {isEdit ? 'Editar evento' : 'Nuevo evento'}
            </DialogTitle>
          </DialogHeader>
        </EchoHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Aniversario del colegio"
              className="h-9"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={handleKindChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    <span className="mr-1.5">{EVENT_KIND_META[k].glyph}</span>
                    {EVENT_KIND_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">{meta.hint}</p>
          </div>

          {/* ---------- Presentación: casilla o actividad ---------- */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cómo se ve en el calendario</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: 'casilla' as const,
                    icon: LayoutGrid,
                    label: 'Casilla',
                    hint: 'Pinta el día entero',
                  },
                  {
                    value: 'actividad' as const,
                    icon: Tag,
                    label: 'Actividad',
                    hint: 'Etiqueta dentro del día',
                  },
                ]
              ).map(({ value, icon: Icon, label, hint }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setDisplay(value);
                    setDisplayTouched(true);
                  }}
                  aria-pressed={display === value}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-all',
                    display === value
                      ? 'border-primary bg-primary/10'
                      : 'border-border/70 bg-card hover:border-primary/40'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      display === value ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span className="text-xs font-semibold text-foreground">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Solo puede haber una casilla pintada por día; actividades, las que quieras.
            </p>
            {clash && (
              <p className="flex items-start gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-[10px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                El {format(parseISO(clash), "d 'de' MMMM", { locale: es })} ya tiene una casilla
                pintada. Si guardas así, este evento se mostrará como actividad ese día.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-full justify-start text-xs font-normal">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {date ? format(date, 'd MMM yyyy', { locale: es }) : 'Elegir'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar locale={es} selected={date} onSelect={(d) => setDate(d as Date | undefined)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Hasta {meta.suggestsRange ? '' : '(opcional)'}
              </Label>
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start text-xs font-normal">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {endDate ? format(endDate, 'd MMM yyyy', { locale: es }) : 'Un solo día'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar locale={es} selected={endDate} onSelect={(d) => setEndDate(d as Date | undefined)} />
                  </PopoverContent>
                </Popover>
                {endDate && (
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setEndDate(undefined)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ---------- Paleta: tres filas del mismo tono, cada una más
                        transparente. Útil para jerarquizar sin inventar
                        colores nuevos que se pisen entre sí. ---------- */}
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="space-y-1.5">
              {EVENT_COLOR_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className="flex flex-wrap gap-2">
                  {row.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                        // Cuadro claro/oscuro de fondo: sin él, un tono muy
                        // transparente parece un botón vacío.
                        'bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%),linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]',
                        color === c ? 'border-primary scale-110' : 'border-transparent'
                      )}
                      aria-label={`Color ${c}`}
                    >
                      <span
                        className="block h-full w-full rounded-full"
                        style={{ backgroundColor: c }}
                      />
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Vista previa con el color y la presentación elegidos. */}
            <div className="pt-1">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Vista previa
              </p>
              <div
                className={cn(
                  'rounded-md p-1 text-center',
                  display === 'casilla' ? 'h-12 pt-3' : 'w-full'
                )}
                style={{ backgroundColor: color }}
              >
                <p className={cn('truncate text-[10px] font-bold', eventTextClass(color))}>
                  {meta.glyph} {title.trim() || 'Título del evento'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descripción (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles del evento..."
              rows={2}
              className="resize-none text-xs"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button onClick={handleSave} disabled={!canSave} className="w-full">
            {isEdit ? 'Guardar cambios' : 'Crear evento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
