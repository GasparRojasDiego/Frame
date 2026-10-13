import { Bell, BellOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { WheelColumn } from '@/components/ui/wheel-picker';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';
import { tr } from '@/lib/i18n';
import { dayInitial } from '@/lib/day-names';

// ============================================================
// El recordatorio de UNA tarea. Nace apagado: recordar todo es no recordar
// nada. Al encenderlo se eligen los días de la semana, la hora (con ruedas que
// se giran con la rueda del ratón) y, para lo muy importante, cada cuánto
// vuelve a aparecer ese día hasta que la tarea se complete.
// ============================================================

export interface ReminderConfig {
  enabled: boolean;
  /** "HH:mm" */
  time: string;
  /** 0 = domingo … 6 = sábado. Vacío = todos los días. */
  days: number[];
  /** 0 = una sola vez ese día. */
  repeatMinutes: number;
}

export const DEFAULT_REMINDER: ReminderConfig = { enabled: false, time: '18:00', days: [], repeatMinutes: 0 };

export function reminderFromTask(task: Pick<Task, 'reminderEnabled' | 'reminderTime' | 'reminderDays' | 'reminderRepeatMinutes'>): ReminderConfig {
  return {
    // Solo cuenta un recordatorio configurado de verdad (con hora).
    enabled: task.reminderEnabled === true && !!task.reminderTime,
    time: task.reminderTime || DEFAULT_REMINDER.time,
    days: [...(task.reminderDays ?? [])],
    repeatMinutes: task.reminderRepeatMinutes ?? 0,
  };
}

export function reminderToTask(config: ReminderConfig) {
  return {
    reminderEnabled: config.enabled,
    reminderTime: config.enabled ? config.time : undefined,
    reminderDays: config.enabled && config.days.length > 0 && config.days.length < 7 ? [...config.days].sort() : undefined,
    reminderRepeatMinutes: config.enabled && config.repeatMinutes > 0 ? config.repeatMinutes : undefined,
  };
}

/** Lunes primero, como se lee una semana aquí. */
const WEEK: { day: number; letter: string; short: string }[] = [
  { day: 1, get letter() { return dayInitial(0); }, get short() { return tr('lun'); } },
  { day: 2, get letter() { return dayInitial(1); }, get short() { return tr('mar'); } },
  { day: 3, get letter() { return dayInitial(2); }, get short() { return tr('mié'); } },
  { day: 4, get letter() { return dayInitial(3); }, get short() { return tr('jue'); } },
  { day: 5, get letter() { return dayInitial(4); }, get short() { return tr('vie'); } },
  { day: 6, get letter() { return dayInitial(5); }, get short() { return tr('sáb'); } },
  { day: 0, get letter() { return dayInitial(6); }, get short() { return tr('dom'); } },
];

const REPEATS: { minutes: number; label: string }[] = [
  { minutes: 0, get label() { return tr('Una vez'); } },
  { minutes: 15, get label() { return tr('15 min'); } },
  { minutes: 30, get label() { return tr('30 min'); } },
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
  { minutes: 180, label: '3 h' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const two = (n: number) => String(n).padStart(2, '0');

/** «Lun, mié y vie a las 18:30 · cada 30 min» */
export function describeReminder(config: ReminderConfig): string {
  if (!config.enabled) return tr('Sin recordatorio');
  const chosen = WEEK.filter((d) => config.days.includes(d.day)).map((d) => d.short);
  const daysText =
    chosen.length === 0 || chosen.length === 7
      ? tr('Todos los días')
      : chosen.length === 1
        ? tr('Los {p}', { p: chosen[0] })
        : `${chosen.slice(0, -1).join(', ')} y ${chosen[chosen.length - 1]}`;
  const repeat = REPEATS.find((r) => r.minutes === config.repeatMinutes);
  const repeatText = config.repeatMinutes > 0 ? tr(' · se repite cada {p}', { p: repeat?.label ?? `${config.repeatMinutes} min` }) : '';
  const text = tr('{daysText} a las {time}{repeatText}', { daysText, time: config.time, repeatText });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function ReminderEditor({
  value,
  onChange,
  className,
}: {
  value: ReminderConfig;
  onChange: (next: ReminderConfig) => void;
  className?: string;
}) {
  const [hour, minute] = value.time.split(':').map(Number);
  const safeHour = Number.isFinite(hour) ? hour : 18;
  // La rueda va de 5 en 5: una hora heredada como 18:32 se muestra como 18:30.
  const safeMinute = Number.isFinite(minute) ? Math.min(55, Math.round(minute / 5) * 5) : 0;

  const toggleDay = (day: number) => {
    const days = value.days.includes(day) ? value.days.filter((d) => d !== day) : [...value.days, day];
    onChange({ ...value, days });
  };

  return (
    <div className={cn('w-[252px] space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          {value.enabled ? <Bell className="h-3.5 w-3.5 text-primary" /> : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
          {tr('Recordatorio')}
        </span>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          aria-label={tr('Activar el recordatorio de esta tarea')}
        />
      </div>

      {!value.enabled ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {tr('Apagado. Actívalo solo en las tareas que de verdad no puedes olvidar.')}
        </p>
      ) : (
        <>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground">{tr('Días')}</span>
              <button
                type="button"
                onClick={() => onChange({ ...value, days: [] })}
                className={cn('text-[10px] font-semibold', value.days.length === 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                {tr('Todos los días')}
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {WEEK.map(({ day, letter, short }) => {
                const active = value.days.length === 0 || value.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={value.days.includes(day)}
                    title={short}
                    className={cn(
                      'h-8 rounded-md border text-xs font-bold transition-colors',
                      value.days.includes(day)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : active
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border/70 text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <WheelColumn label={tr('Hora')} values={HOURS} value={safeHour} format={two} onChange={(h) => onChange({ ...value, time: `${two(h)}:${two(safeMinute)}` })} />
            <span className="font-mono text-lg font-bold text-muted-foreground">:</span>
            <WheelColumn label={tr('Minutos')} values={MINUTES} value={safeMinute} format={two} onChange={(m) => onChange({ ...value, time: `${two(safeHour)}:${two(m)}` })} />
            <span className="ml-1 text-[10px] leading-tight text-muted-foreground">
              {tr('Gira la rueda')}
              <br />
              {tr('del ratón')}
            </span>
          </div>

          <div>
            <span className="mb-1.5 block text-[10px] font-semibold text-muted-foreground">
              {tr('Volver a avisar ese día')}
            </span>
            <div className="grid grid-cols-3 gap-1">
              {REPEATS.map((repeat) => (
                <button
                  key={repeat.minutes}
                  type="button"
                  onClick={() => onChange({ ...value, repeatMinutes: repeat.minutes })}
                  aria-pressed={value.repeatMinutes === repeat.minutes}
                  className={cn(
                    'h-7 rounded-md border text-[11px] font-semibold transition-colors',
                    value.repeatMinutes === repeat.minutes
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {repeat.minutes === 0 ? repeat.label : tr('Cada {label}', { label: repeat.label })}
                </button>
              ))}
            </div>
          </div>

          <p className="rounded-md bg-secondary/60 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
            {describeReminder(value)}{tr('. Deja de avisar cuando culmines la tarea.')}
          </p>
        </>
      )}
    </div>
  );
}
