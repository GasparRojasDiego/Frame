import { useEffect, useState, type FormEvent } from 'react';
import { CalendarIcon, Clock, PaintBucket, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { WheelColumn } from '@/components/ui/wheel-picker';
import { cn } from '@/lib/utils';
import type { LocalCalendarEvent, LocalEventKind } from '@/types';
import {
  DEFAULT_EVENT_COLOR,
  EVENT_KINDS,
  EVENT_KIND_META,
  eventDisplay,
  normalizeKind,
} from '@/lib/calendar-events';
import { EVENT_TINT, PanelHeader, SectionLabel, Swatch } from './CalendarBits';
import {
  PAINT_COLORS,
  REMIND_OPTIONS,
  eventEnd,
  fromKey,
  orderRange,
  shortDayLabel,
  toKey,
  type DayRange,
} from './calendar-model';

// ============================================================
// Alta y edición de un evento del calendario LOCAL.
//
// Es el contenido del recuadro del calendario (ver DayEventsDialog), no un
// recuadro aparte: desde el día se entra aquí y la flecha de arriba a la
// izquierda vuelve al día, sin un recuadro encima de otro.
//
// Cuatro bloques, de lo que más se toca a lo que menos:
//   · el título y el tipo (pastillas: un clic y listo);
//   · cuándo: días, hora y aviso (un recordatorio es un evento con hora y aviso);
//   · aspecto: el color y si pinta las casillas;
//   · una nota opcional.
// El título puede quedar vacío: entonces se usa el nombre del tipo
// («Vacaciones», «Recordatorio»…), que es justo lo que uno escribiría.
// ============================================================

export type EventPreset = 'evento' | 'recordatorio';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const two = (n: number) => String(n).padStart(2, '0');

/** Hora inicial: la próxima hora en punto si es para hoy, si no las 8:00. */
function initialTime(day: string, todayKey: string): string {
  if (day === todayKey) {
    const next = new Date().getHours() + 1;
    if (next <= 23) return `${two(next)}:00`;
  }
  return '08:00';
}

const pill = (active: boolean) =>
  cn(
    'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
      : 'border-border/80 bg-card text-foreground/80 hover:border-primary/60 hover:text-foreground'
  );

/** Campo de fecha con su calendario desplegable (se cierra al elegir). */
function DateField({
  label,
  value,
  empty,
  onChange,
  onClear,
}: {
  label: string;
  value: string;
  /** Texto en lugar de la fecha (p. ej. «Un solo día»). */
  empty?: string;
  onChange: (day: string) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('h-9 w-full justify-start px-3 text-xs font-medium', empty && 'text-muted-foreground')}
            >
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              {empty ?? `${shortDayLabel(value)} ${fromKey(value).getFullYear()}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              selected={fromKey(value)}
              onSelect={(date) => {
                onChange(toKey(date));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {onClear && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 text-muted-foreground"
            onClick={onClear}
            aria-label="Dejar un solo día"
            title="Dejar un solo día"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LocalEventForm({
  event,
  range,
  preset = 'evento',
  todayKey,
  onBack,
  onCancel,
  onSubmit,
  onDelete,
}: {
  /** Evento a editar. Ausente = alta. */
  event?: LocalCalendarEvent | null;
  /** Días con los que nace el formulario (el día pulsado o la selección). */
  range: DayRange;
  preset?: EventPreset;
  todayKey: string;
  /** Flecha de «Atrás» (vuelve al día del que se vino). */
  onBack?: () => void;
  onCancel: () => void;
  onSubmit: (payload: Omit<LocalCalendarEvent, 'id'>) => void;
  onDelete?: () => void;
}) {
  const isEdit = Boolean(event);
  const firstKind: LocalEventKind = event
    ? normalizeKind(event.kind)
    : preset === 'recordatorio'
      ? 'recordatorio'
      : 'personal';

  const [title, setTitle] = useState(event?.title ?? '');
  const [kind, setKind] = useState<LocalEventKind>(firstKind);
  const [dates, setDates] = useState<DayRange>(() =>
    event ? { start: event.date, end: eventEnd(event) } : range
  );
  const [timed, setTimed] = useState(event ? !!event.time : preset === 'recordatorio');
  const [time, setTime] = useState(event?.time ?? initialTime(range.start, todayKey));
  const [remind, setRemind] = useState<number | undefined>(
    event ? event.remindBefore : preset === 'recordatorio' ? 0 : undefined
  );
  const [color, setColor] = useState(event?.color || DEFAULT_EVENT_COLOR);
  const [paint, setPaint] = useState(
    event ? eventDisplay(event) === 'casilla' : EVENT_KIND_META[firstKind].defaultDisplay === 'casilla'
  );
  /** «Pintar las casillas» deja de seguir al tipo en cuanto se toca a mano. */
  const [paintTouched, setPaintTouched] = useState(isEdit);
  const [description, setDescription] = useState(event?.description ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // La confirmación de borrar se arrepiente sola a los pocos segundos.
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3500);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const meta = EVENT_KIND_META[kind];
  const isReminder = kind === 'recordatorio';

  const pickKind = (next: LocalEventKind) => {
    setKind(next);
    if (!paintTouched) setPaint(EVENT_KIND_META[next].defaultDisplay === 'casilla');
    // Un recordatorio sin hora no avisa: se le pone hora y aviso de entrada.
    if (next === 'recordatorio' && !timed) {
      setTimed(true);
      if (remind === undefined) setRemind(0);
    }
  };

  const toggleTimed = (on: boolean) => {
    setTimed(on);
    if (!on) setRemind(undefined);
    else if (isReminder && remind === undefined) setRemind(0);
  };

  const [hour, minute] = time.split(':').map(Number);
  const safeHour = Number.isFinite(hour) ? hour : 8;
  // La rueda va de 5 en 5: una hora heredada como 18:32 se muestra como 18:30.
  const safeMinute = Number.isFinite(minute) ? Math.min(55, Math.round(minute / 5) * 5) : 0;

  const baseColors = PAINT_COLORS.map((c) => c.hex);
  // Un color antiguo (las filas translúcidas) se conserva como una muestra más.
  const colors = baseColors.includes(color)
    ? PAINT_COLORS
    : [...PAINT_COLORS, { hex: color, name: 'actual' }];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const { start, end } = orderRange(dates.start, dates.end);
    onSubmit({
      title: title.trim() || meta.label,
      kind,
      display: paint ? 'casilla' : 'actividad',
      date: start,
      endDate: end > start ? end : undefined,
      color,
      description: description.trim() || undefined,
      time: timed ? `${two(safeHour)}:${two(safeMinute)}` : undefined,
      remindBefore: timed ? remind : undefined,
    });
  };

  const single = dates.start === dates.end;

  return (
    <form onSubmit={handleSubmit} className="contents">
      <PanelHeader
        word={isReminder ? 'Aviso' : 'Evento'}
        title={isEdit ? (isReminder ? 'Editar recordatorio' : 'Editar evento') : isReminder ? 'Nuevo recordatorio' : 'Nuevo evento'}
        onBack={onBack}
      />

      <div className="space-y-5">
        {/* ---------- Qué ---------- */}
        <div className="space-y-3">
          <label className="sr-only" htmlFor="local-event-title">
            Título
          </label>
          <Input
            id="local-event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isReminder ? '¿Qué te recuerdo?' : kind === 'personal' ? 'Título del evento' : meta.label}
            className="h-11 text-base font-semibold"
            autoFocus
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo">
            {EVENT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => pickKind(k)}
                className={pill(kind === k)}
              >
                <span aria-hidden className="text-[11px]">
                  {EVENT_KIND_META[k].glyph}
                </span>
                {EVENT_KIND_META[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- Cuándo ---------- */}
        <div className="space-y-3">
          <SectionLabel>Cuándo</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <DateField
              label="Desde"
              value={dates.start}
              onChange={(day) => setDates({ start: day, end: dates.end < day ? day : dates.end })}
            />
            <DateField
              label="Hasta"
              value={dates.end}
              empty={single ? 'Un solo día' : undefined}
              onChange={(day) => setDates(orderRange(dates.start, day))}
              onClear={single ? undefined : () => setDates({ start: dates.start, end: dates.start })}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/60 px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {timed ? 'A una hora' : 'Todo el día'}
            </span>
            <Switch checked={timed} onCheckedChange={toggleTimed} aria-label="Ponerle hora" />
          </div>

          {timed && (
            <div className="space-y-3 duration-200 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
              <div className="flex items-center justify-center gap-2">
                <WheelColumn
                  label="Hora"
                  values={HOURS}
                  value={safeHour}
                  format={two}
                  onChange={(h) => setTime(`${two(h)}:${two(safeMinute)}`)}
                />
                <span className="font-mono text-lg font-bold text-muted-foreground">:</span>
                <WheelColumn
                  label="Minutos"
                  values={MINUTES}
                  value={safeMinute}
                  format={two}
                  onChange={(m) => setTime(`${two(safeHour)}:${two(m)}`)}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">Aviso</span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Aviso">
                  <button
                    type="button"
                    aria-pressed={remind === undefined}
                    onClick={() => setRemind(undefined)}
                    className={pill(remind === undefined)}
                  >
                    Sin aviso
                  </button>
                  {REMIND_OPTIONS.map((option) => (
                    <button
                      key={option.minutes}
                      type="button"
                      aria-pressed={remind === option.minutes}
                      onClick={() => setRemind(option.minutes)}
                      className={pill(remind === option.minutes)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---------- Aspecto ---------- */}
        <div className="space-y-3">
          <SectionLabel>Aspecto</SectionLabel>
          <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Color">
            {colors.map(({ hex, name }) => (
              <Swatch
                key={hex}
                color={hex}
                name={name}
                tint={EVENT_TINT}
                active={color === hex}
                onClick={() => setColor(hex)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/60 px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <PaintBucket className="h-3.5 w-3.5 text-primary" />
              Pintar las casillas
            </span>
            <Switch
              checked={paint}
              onCheckedChange={(on) => {
                setPaint(on);
                setPaintTouched(true);
              }}
              aria-label="Pintar las casillas de estos días con el color del evento"
            />
          </div>
        </div>

        {/* ---------- Nota ---------- */}
        <div className="space-y-2">
          <SectionLabel>Nota</SectionLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
            rows={2}
            className="resize-none text-xs"
            aria-label="Nota"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isEdit && onDelete && (
          confirmDelete ? (
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 />
              Sí, eliminar
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
              Eliminar
            </Button>
          )
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="fantasmaRojo" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {isEdit ? 'Guardar' : isReminder ? 'Crear recordatorio' : 'Crear evento'}
          </Button>
        </div>
      </div>
    </form>
  );
}
