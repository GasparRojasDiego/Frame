import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WEEK_ORDER, WEEKDAY_INITIAL, describeSchedule, hasSchedule } from '@/lib/habit-schedule';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

/**
 * Selector compacto de los días de un hábito, para corregirlos desde la
 * tabla en modo edición. Sin días marcados (o con los siete) es «cada día».
 */
export default function ScheduleMenu({
  value,
  onChange,
}: {
  value: number[] | undefined;
  onChange: (days: number[] | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>(value ?? []);

  useEffect(() => {
    if (open) setDraft(hasSchedule({ days: value }) ? [...(value as number[])] : []);
  }, [open, value]);

  const toggle = (day: number) =>
    setDraft((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const apply = () => {
    onChange(draft.length > 0 && draft.length < 7 ? [...draft].sort() : undefined);
    setOpen(false);
  };

  const label = describeSchedule({ days: value });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={tr('Frecuencia: {label}', { label })}
          className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-border/70 px-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          {hasSchedule({ days: value }) ? `${value!.length} ${value!.length === 1 ? tr('día') : tr('días')}` : tr('Cada día')}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        <p className="text-xs font-semibold text-foreground">{tr('¿Qué días toca?')}</p>
        <div className="flex justify-between gap-1">
          {WEEK_ORDER.map((day) => {
            const on = draft.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggle(day)}
                aria-pressed={on}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/70 text-muted-foreground hover:border-primary/60 hover:text-foreground'
                )}
              >
                {WEEKDAY_INITIAL[day]}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {draft.length === 0 || draft.length === 7 ? tr('Cada día') : describeSchedule({ days: draft })}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setOpen(false)}>
            {tr('Cancelar')}
          </Button>
          <Button type="button" size="sm" className="h-7" onClick={apply}>
            {tr('Guardar')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
