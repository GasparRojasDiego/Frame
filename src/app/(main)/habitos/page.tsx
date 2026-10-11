import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startOfWeek, endOfWeek, format, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import HabitsView from '@/app/(main)/tareas/HabitsView';

// Interfaz propia del Registro de hábitos (antes era una pestaña de Tareas).
// La tabla es semanal; la semana se elige con la flecha de la esquina
// superior derecha, que también mueve los anillos de mañana, tarde y noche.
export default function HabitosPage() {
  const [weekOffset, setWeekOffset] = useState(0);

  const today = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const startMonth = format(weekStart, 'MMMM', { locale: es });
  const endMonth = format(weekEnd, 'MMMM', { locale: es });
  const dateRangeString =
    startMonth === endMonth
      ? `${format(weekStart, 'd')} – ${format(weekEnd, 'd')} de ${startMonth}`
      : `${format(weekStart, 'd')} de ${startMonth} – ${format(weekEnd, 'd')} de ${endMonth}`;

  return (
    <div className="flex h-full flex-col pt-10">
      <div className="relative mb-8 px-6 md:px-8">
        <h1 className="text-center font-headline text-2xl font-bold text-foreground">Registro de hábitos</h1>
        {/* La semana, discreta, en la esquina superior derecha. */}
        <div className="absolute right-6 top-1/2 flex -translate-y-1/2 items-center gap-0.5 md:right-8">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={() => setWeekOffset((p) => p - 1)}
            title="Semana anterior" data-tour="habitos-semana-anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="whitespace-nowrap text-center text-xs font-semibold text-primary">{dateRangeString}</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={() => setWeekOffset((p) => p + 1)}
            disabled={weekOffset >= 0}
            title="Semana siguiente" data-tour="habitos-semana-siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <HabitsView weekOffset={weekOffset} />
    </div>
  );
}
