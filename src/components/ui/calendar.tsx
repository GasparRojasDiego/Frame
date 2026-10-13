import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { intlLocale } from '@/lib/i18n';

interface CalendarProps {
  selected?: Date
  onSelect: (date: Date) => void
}

function CustomCalendar({ selected, onSelect }: CalendarProps) {
  // Initialize to the selected date's month, or the current month if no date is selected.
  const [currentDate, setCurrentDate] = React.useState(selected || new Date());
  const today = new Date();

  // This effect ensures that when the calendar is opened for a new item (no selected date),
  // it always shows the current month, rather than a previously viewed month.
  React.useEffect(() => {
    if (!selected) {
      setCurrentDate(new Date());
    } else {
      setCurrentDate(selected);
    }
  }, [selected]);


  // Iniciales de lunes a domingo en el idioma de la interfaz (el 1-ene-2024 fue lunes).
  const weekday = new Intl.DateTimeFormat(intlLocale(), { weekday: 'short' });
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const name = weekday.format(new Date(2024, 0, 1 + i));
    return name.charAt(0).toUpperCase() + name.charAt(1);
  });

  const changeMonth = (amount: number) => {
    setCurrentDate(prev => {
      // Siempre desde el día 1: setMonth sobre un día 29-31 se salta los meses cortos.
      return new Date(prev.getFullYear(), prev.getMonth() + amount, 1);
    });
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const blanks = Array(adjustedFirstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleDayClick = (day: number) => {
    const newSelectedDate = new Date(year, month, day);
    onSelect(newSelectedDate);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  return (
    <div className="p-3 w-auto">
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="h-7 w-7 text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium text-center">
          {new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' }).format(currentDate)}
        </div>
        <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="h-7 w-7 text-foreground">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center justify-items-start">
        {daysOfWeek.map(day => (
          <div key={day} className="text-xs text-muted-foreground font-semibold w-8 h-8 flex items-center justify-center">{day}</div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1 justify-items-start">
        {blanks.map((_, i) => <div key={`blank-${i}`} className="w-8 h-8" />)}
        {days.map(day => {
          const dayDate = new Date(year, month, day);
          const isSelected = selected && isSameDay(dayDate, selected);
          const isToday = isSameDay(dayDate, today);

          return (
            <div
              key={day}
              onClick={() => handleDayClick(day)}
              className={cn(
                "w-8 h-8 flex items-center justify-center text-sm rounded-md cursor-pointer hover:bg-accent",
                isSelected && "border border-primary bg-primary/20 text-primary font-bold",
                isToday && "bg-primary text-primary-foreground rounded-full"
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { CustomCalendar as Calendar };

