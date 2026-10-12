import FullCalendarView from '@/components/calendar/FullCalendarView';

// ============================================================
// Interfaz "Calendario": el calendario propio de Frame, local y sin
// conexión. Google Calendar dejó de integrarse en 1.6.3: Frame no lee ni
// escribe en ninguna cuenta para el calendario.
// ============================================================
export default function CalendarioPage() {
  return (
    <div className="flex h-full min-h-0 flex-col py-4">
      <FullCalendarView className="min-h-0 flex-1 px-4 md:px-8" />
    </div>
  );
}
