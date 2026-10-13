import FullCalendarView from '@/components/calendar/FullCalendarView';

// ============================================================
// Interfaz "Calendario": el calendario propio de Frame, local y sin
// conexión. Google Calendar dejó de integrarse en 1.6.3: Frame no lee ni
// escribe en ninguna cuenta para el calendario.
// ============================================================
export default function CalendarioPage() {
  return (
    // 1.6.8 (Diego): la fila del mes baja un poco (24 px desde la cabecera) y
    // deja el mismo aire hasta la cuadrícula (gap-6 en FullCalendarView).
    <div className="flex h-full min-h-0 flex-col pb-4 pt-6">
      <FullCalendarView className="min-h-0 flex-1 px-4 md:px-8" />
    </div>
  );
}
