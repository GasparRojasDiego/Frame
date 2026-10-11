// Logotipo oficial de Google Calendar: el SVG original provisto por el
// usuario, empaquetado como asset nativo en public/icons/. Se usa <img>
// (y no SVG inline) porque el archivo define máscaras/gradientes con ids
// que colisionarían al montarse dos veces (sidebar + cabecera).
export function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <img
      src="/icons/google-calendar.svg"
      alt=""
      aria-hidden
      draggable={false}
      className={className}
    />
  );
}

// Ícono del sidebar para la interfaz Calendario.
export function CalendarNavIcon({ className }: { className?: string }) {
  return <GoogleCalendarLogo className={className} />;
}
