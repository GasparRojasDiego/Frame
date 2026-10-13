import { useEffect, useState, type FormEvent } from 'react';
import { CalendarIcon, Check, ChevronDown, FileText, Link2, Paperclip, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { WheelColumn } from '@/components/ui/wheel-picker';
import NoteEditor from '@/components/temporizador/NoteEditor';
import ColorPickerDialog from '@/components/shared/ColorPickerDialog';
import { AttachFileDialog, AttachmentChips, LinkForm } from '@/components/tasks/TaskAttachments';
import { isRichNoteEmpty } from '@/lib/rich-note';
import { cn } from '@/lib/utils';
import type { LocalCalendarEvent, LocalEventKind, TaskAttachment } from '@/types';
import {
  DEFAULT_EVENT_COLOR,
  EVENT_COLOR_ROWS,
  EVENT_FORM_KINDS,
  EVENT_KIND_META,
  kindLabelOf,
  normalizeKind,
} from '@/lib/calendar-events';
import { EVENT_TINT, PAINT_TINT, PanelHeader, SectionLabel, eventInk, tintVar } from './CalendarBits';
import {
  REMIND_OPTIONS,
  eventEnd,
  fromKey,
  orderRange,
  shortDayLabel,
  toKey,
  type DayRange,
} from './calendar-model';
import { tr } from '@/lib/i18n';

// ============================================================
// Alta y edición de un evento del calendario LOCAL (1.6.7, Diego).
//
// Es el contenido del recuadro del calendario (ver DayEventsDialog): desde el
// día se entra aquí y la flecha de arriba a la izquierda vuelve al día.
//
//   · Qué: el título y, debajo, dos desplegables: el tipo (Entrega, Evento,
//     Evaluación, Personal u «Otro…», que escribe el usuario) y los recursos
//     (enlaces y documentos, como los de una tarea).
//   · Cuándo: «Desde» sobre «Hasta» (la mitad del ancho) y, a su derecha,
//     «Todo el día» y «Color» (un cuarto cada uno, a la misma altura). El
//     color abre el selector de color en un recuadro centrado.
//   · Aspecto: cómo se verá. Ya no se pregunta si pinta las casillas: un
//     evento de todo el día las pinta; uno con hora va como etiqueta.
//   · Nota: con formato, como las anotaciones.
// Sin emojis. El título puede quedar vacío: entonces se usa el tipo.
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

/** Botón desplegable con la forma de un campo. */
const dropdownButton =
  'h-10 w-full justify-between gap-2 border-border bg-card px-3 text-sm font-medium text-foreground hover:border-primary/60 hover:bg-card';

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
            aria-label={tr('Dejar un solo día')}
            title={tr('Dejar un solo día')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Desplegable del tipo: los cuatro del catálogo y «Otro…», que se escribe. */
function KindSelect({
  kind,
  customLabel,
  onChange,
}: {
  kind: LocalEventKind;
  customLabel: string;
  onChange: (kind: LocalEventKind, customLabel: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState(customLabel);
  const legacy = !EVENT_FORM_KINDS.includes(kind) && kind !== 'otro';
  const current = kindLabelOf({ kind, kindLabel: customLabel });

  const choose = (next: LocalEventKind) => {
    onChange(next, '');
    setOpen(false);
  };
  const commitCustom = () => {
    const text = draft.trim();
    if (!text) return;
    onChange('otro', text);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setWriting(kind === 'otro');
          setDraft(kind === 'otro' ? customLabel : '');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={dropdownButton} aria-label={tr('Tipo: {current}', { current })}>
          <span className="truncate">{current}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-1.5">
        <div role="listbox" aria-label={tr('Tipo')} className="flex flex-col">
          {[...(legacy ? [kind] : []), ...EVENT_FORM_KINDS].map((option) => {
            const selected = option === kind;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(option)}
                className={cn(
                  'flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-secondary',
                  selected && 'text-primary'
                )}
              >
                {EVENT_KIND_META[option].label}
                {selected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
          <div role="separator" className="mx-1 my-1 h-px bg-border" />
          {writing ? (
            <div className="flex items-center gap-1.5 p-1">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 30))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitCustom();
                  }
                }}
                placeholder={tr('Escribe el tipo')}
                className="h-8 text-sm"
                autoFocus
              />
              <Button type="button" size="icon" className="h-8 w-8 shrink-0" onClick={commitCustom} disabled={!draft.trim()} aria-label={tr('Usar este tipo')}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setWriting(true)}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              {tr('Otro…')}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Desplegable de recursos: un enlace o documentos (estos, en su propio recuadro). */
function ResourcesMenu({
  attachments,
  onChange,
}: {
  attachments: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const count = attachments.length;
  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setLinking(false);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(dropdownButton, count > 0 && 'border-primary bg-primary/10 text-primary hover:bg-primary/10')}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <Paperclip className="h-4 w-4 shrink-0" />
              {count > 0 ? `${count} ${count === 1 ? tr('recurso') : tr('recursos')}` : tr('Recursos')}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-1.5">
          {linking ? (
            <div className="p-1.5">
              <LinkForm
                onAdd={(attachment) => {
                  onChange([...attachments, attachment]);
                  setOpen(false);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setLinking(true)}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
              >
                <Link2 className="h-4 w-4 text-primary" />
                {tr('Enlace…')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setFilesOpen(true);
                }}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
              >
                <FileText className="h-4 w-4 text-primary" />
                {tr('Documento…')}
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <AttachFileDialog open={filesOpen} onOpenChange={setFilesOpen} onAdd={(added) => onChange([...attachments, ...added])} />
    </>
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
  const isReminder = event ? normalizeKind(event.kind) === 'recordatorio' : preset === 'recordatorio';

  const [title, setTitle] = useState(event?.title ?? '');
  const [kind, setKind] = useState<LocalEventKind>(event ? normalizeKind(event.kind) : 'personal');
  const [customKind, setCustomKind] = useState(event?.kindLabel ?? '');
  const [attachments, setAttachments] = useState<TaskAttachment[]>(event?.attachments ?? []);
  const [dates, setDates] = useState<DayRange>(() => (event ? { start: event.date, end: eventEnd(event) } : range));
  const [timed, setTimed] = useState(event ? !!event.time : preset === 'recordatorio');
  const [time, setTime] = useState(event?.time ?? initialTime(range.start, todayKey));
  const [remind, setRemind] = useState<number | undefined>(
    event ? event.remindBefore : preset === 'recordatorio' ? 0 : undefined
  );
  const [color, setColor] = useState(event?.color || DEFAULT_EVENT_COLOR);
  const [pickingColor, setPickingColor] = useState(false);
  const [description, setDescription] = useState(event?.description ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // La confirmación de borrar se arrepiente sola a los pocos segundos.
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3500);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const toggleAllDay = () => {
    const nextTimed = !timed;
    setTimed(nextTimed);
    if (!nextTimed) setRemind(undefined);
    else if (isReminder && remind === undefined) setRemind(0);
  };

  const [hour, minute] = time.split(':').map(Number);
  const safeHour = Number.isFinite(hour) ? hour : 8;
  // La rueda va de 5 en 5: una hora heredada como 18:32 se muestra como 18:30.
  const safeMinute = Number.isFinite(minute) ? Math.min(55, Math.round(minute / 5) * 5) : 0;

  const kindName = kindLabelOf({ kind, kindLabel: customKind });
  const shownTitle = title.trim() || kindName;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const { start, end } = orderRange(dates.start, dates.end);
    onSubmit({
      title: shownTitle,
      kind,
      kindLabel: kind === 'otro' ? customKind.trim() : undefined,
      // Sin preguntar (1.6.7): todo el día pinta la casilla; con hora, etiqueta.
      display: timed ? 'actividad' : 'casilla',
      date: start,
      endDate: end > start ? end : undefined,
      color,
      description: isRichNoteEmpty(description) ? undefined : description,
      time: timed ? `${two(safeHour)}:${two(safeMinute)}` : undefined,
      remindBefore: timed ? remind : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  const single = dates.start === dates.end;
  const box =
    'flex h-full min-h-[7rem] flex-col items-center justify-center gap-2 rounded-lg border px-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <form onSubmit={handleSubmit} noValidate className="contents">
      <PanelHeader
        word={isReminder ? tr('Aviso') : tr('Evento')}
        title={isEdit ? (isReminder ? tr('Editar recordatorio') : tr('Editar evento')) : isReminder ? tr('Nuevo recordatorio') : tr('Nuevo evento')}
        onBack={onBack}
      />

      <div className="space-y-5">
        {/* ---------- Qué ---------- */}
        <div className="space-y-2">
          <label className="sr-only" htmlFor="local-event-title">
            {tr('Título')}
          </label>
          <Input
            id="local-event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isReminder ? tr('¿Qué te recuerdo?') : tr('Título (si lo dejas vacío: {kindName})', { kindName })}
            className="h-11 text-base font-semibold"
            autoFocus
            autoComplete="off"
          />
          <div className="grid grid-cols-2 gap-2">
            <KindSelect
              kind={kind}
              customLabel={customKind}
              onChange={(next, label) => {
                setKind(next);
                setCustomKind(label);
              }}
            />
            <ResourcesMenu attachments={attachments} onChange={setAttachments} />
          </div>
          <AttachmentChips
            attachments={attachments}
            onRemove={(attachment) => setAttachments(attachments.filter((a) => a.id !== attachment.id))}
          />
        </div>

        {/* ---------- Cuándo ---------- */}
        <div className="space-y-3">
          <SectionLabel>{tr('Cuándo')}</SectionLabel>
          <div className="grid grid-cols-4 items-stretch gap-2">
            <div className="col-span-2 space-y-2">
              <DateField
                label={tr('Desde')}
                value={dates.start}
                onChange={(day) => setDates({ start: day, end: dates.end < day ? day : dates.end })}
              />
              <DateField
                label={tr('Hasta')}
                value={dates.end}
                empty={single ? tr('Un solo día') : undefined}
                onChange={(day) => setDates(orderRange(dates.start, day))}
                onClear={single ? undefined : () => setDates({ start: dates.start, end: dates.start })}
              />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!timed}
              onClick={toggleAllDay}
              className={cn(
                box,
                !timed
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-[5px] border',
                  !timed ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'
                )}
              >
                {!timed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span className="text-xs font-semibold leading-tight">{tr('Todo el día')}</span>
            </button>
            <button
              type="button"
              onClick={() => setPickingColor(true)}
              aria-label={tr('Color: {color}', { color })}
              className={cn(box, 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground')}
            >
              {/* La paleta: el círculo cromático con el color elegido al centro. */}
              <span
                aria-hidden
                className="relative h-9 w-9 rounded-full"
                style={{ background: 'conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
              >
                <span
                  className="absolute inset-[7px] rounded-full border-2 border-background"
                  style={{ background: color }}
                />
              </span>
              <span className="text-xs font-semibold leading-tight text-foreground">{tr('Color')}</span>
            </button>
          </div>

          {timed && (
            <div className="space-y-3 duration-200 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
              <div className="flex items-center justify-center gap-2">
                <WheelColumn
                  label={tr('Hora')}
                  values={HOURS}
                  value={safeHour}
                  format={two}
                  onChange={(h) => setTime(`${two(h)}:${two(safeMinute)}`)}
                />
                <span className="font-mono text-lg font-bold text-muted-foreground">:</span>
                <WheelColumn
                  label={tr('Minutos')}
                  values={MINUTES}
                  value={safeMinute}
                  format={two}
                  onChange={(m) => setTime(`${two(safeHour)}:${two(m)}`)}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">{tr('Aviso')}</span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={tr('Aviso')}>
                  <button type="button" aria-pressed={remind === undefined} onClick={() => setRemind(undefined)} className={pill(remind === undefined)}>
                    {tr('Sin aviso')}
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

        {/* ---------- Aspecto: cómo se verá en el calendario ---------- */}
        <div className="space-y-3">
          <SectionLabel>{tr('Aspecto')}</SectionLabel>
          <div className="flex items-center justify-center gap-3" aria-hidden>
            <span
              className={cn('relative h-14 w-16 shrink-0 border border-border bg-background', !timed && PAINT_TINT)}
              style={!timed ? tintVar(color) : undefined}
            >
              <span className="absolute right-1 top-1 text-[10px] font-semibold text-foreground/85">
                {fromKey(dates.start).getDate()}
              </span>
              {timed && (
                <span
                  className={cn('absolute inset-x-1 bottom-1.5 truncate rounded-sm px-1 text-[9px] font-semibold leading-4', EVENT_TINT, eventInk(color))}
                  style={tintVar(color)}
                >
                  {two(safeHour)}:{two(safeMinute)} {shownTitle}
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {timed ? tr('Etiqueta con su hora en el día') : single ? tr('La casilla se pinta') : tr('Las casillas se pintan')}
            </span>
          </div>
        </div>

        {/* ---------- Nota ---------- */}
        <div className="space-y-3">
          <SectionLabel>{tr('Nota')}</SectionLabel>
          <NoteEditor value={description} onChange={setDescription} toolbarSide rows={3} placeholder={tr('Opcional')} ariaLabel={tr('Nota')} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isEdit && onDelete && (
          confirmDelete ? (
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 />
              {tr('Sí, eliminar')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="gris"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
              {tr('Eliminar')}
            </Button>
          )
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="gris" onClick={onCancel}>
            {tr('Cancelar')}
          </Button>
          <Button type="submit">{isEdit ? tr('Guardar') : isReminder ? tr('Crear recordatorio') : tr('Crear evento')}</Button>
        </div>
      </div>

      <ColorPickerDialog
        open={pickingColor}
        onOpenChange={setPickingColor}
        value={color}
        onChange={setColor}
        presets={EVENT_COLOR_ROWS}
        title={tr('Color del evento')}
      />
    </form>
  );
}
