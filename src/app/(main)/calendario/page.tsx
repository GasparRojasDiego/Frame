import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTodayKey } from '@/hooks/use-today';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  LoaderCircle,
  MapPin,
  ExternalLink,
  Link2,
  WifiOff,
  Pencil,
  Plus,
} from 'lucide-react';
import LocalEventDialog from '@/components/calendar/LocalEventDialog';
import DayEventsDialog from '@/components/calendar/DayEventsDialog';
import { getEventsForDay } from '@/lib/calendar-events';
import type { LocalCalendarEvent } from '@/types';
import { CalendarDays } from 'lucide-react';
import FullCalendarView from '@/components/calendar/FullCalendarView';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCourse } from '@/context/CourseContext';
import { isGoogleConfigured, hasScopes, connectIntegration, integrationAccount } from '@/lib/google/auth';
import { listCalendarEvents, cacheGet, type CalendarEvent } from '@/lib/google/api';
import { isTauri } from '@tauri-apps/api/core';
import GoogleEmbed, { useOnline } from '@/components/integrations/GoogleEmbed';

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function openExternal(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank');
  }
}

// ============================================================
// Interfaz "Calendario":
// - Con internet (app de escritorio): Google Calendar REAL incrustado como
//   un recuadro del layout, mientras la API sigue registrando los eventos
//   en la caché local en segundo plano.
// - Sin internet: versión manual con la estética del calendario de Enfoque,
//   mostrando los últimos eventos sincronizados + tareas locales.
// ============================================================
export default function CalendarioPage() {
  const {
    tasks, localEvents, addLocalEvent, updateLocalEvent, deleteLocalEvent,
  } = useCourse();
  const { toast } = useToast();
  const online = useOnline();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [connected, setConnected] = useState(() => hasScopes('calendar'));
  const [account, setAccount] = useState(() => integrationAccount('calendar'));
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  // Calendario LOCAL (el que vivía en Enfoque): respaldo sin internet.
  const [showLocal, setShowLocal] = useState(false);
  const [isEventDialogOpen, setEventDialogOpen] = useState(false);
  // Modo edición del calendario local: mientras está encendido, pulsar una
  // casilla abre la gestión de los eventos de ese día.
  const [editMode, setEditMode] = useState(false);
  const [editingDay, setEditingDay] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<LocalCalendarEvent | null>(null);

  const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const showEmbed = online && isTauri();

  const loadEvents = useCallback(
    async (date: Date, useNetwork: boolean) => {
      const first = new Date(date.getFullYear(), date.getMonth(), 1);
      const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      const key = `gcal_${dayKey(first).slice(0, 7)}`;

      // Siempre pintar la caché primero (offline-first)…
      const cached = cacheGet<CalendarEvent[]>(key);
      if (cached) setEvents(cached.value);
      else setEvents([]);

      // …y refrescar de la red si hay conexión.
      if (!useNetwork || !navigator.onLine) return;
      setIsLoading(true);
      try {
        setEvents(await listCalendarEvents(first.toISOString(), last.toISOString()));
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Google Calendar', description: String(e.message ?? e) });
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  // Registro continuo: siempre que haya conexión y cuenta vinculada, los
  // eventos del mes visible se guardan en caché (aunque se esté mostrando
  // el calendario incrustado): son el respaldo del modo sin conexión.
  useEffect(() => {
    if (connected) void loadEvents(currentDate, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, monthKey, online]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const identity = await connectIntegration('calendar', { selectAccount: true });
      setConnected(true);
      setAccount(identity);
      toast({ title: 'Google Calendar vinculado', description: identity.email });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Google Calendar', description: String(e.message ?? e) });
    } finally {
      setIsConnecting(false);
    }
  };

  // --- Estructura del mes (modo manual) ---
  const { weeks } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // Lunes = 0
    const lead = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = lead - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, daysInPrev - i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const next = cells.length - (lead + daysInMonth) + 1;
      cells.push({ date: new Date(year, month + 1, next), inMonth: false });
    }
    const weeks: { date: Date; inMonth: boolean }[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { weeks };
  }, [currentDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const start = new Date(ev.start);
      const key = ev.allDay ? ev.start.slice(0, 10) : dayKey(start);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = dayKey(new Date(task.dueDate));
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const changeMonth = (delta: number) =>
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  useTodayKey(); // el círculo de «hoy» avanza solo a medianoche
  const todayKey = dayKey(new Date());
  const selectedEvents = selectedDay ? eventsByDay.get(dayKey(selectedDay)) ?? [] : [];
  const selectedTasks = selectedDay ? tasksByDay.get(dayKey(selectedDay)) ?? [] : [];

  // Barra de vinculación al PIE del recuadro (misma ubicación que en Gmail):
  // estado de la cuenta + Sincronizar + Vincular/Cambiar de cuenta.
  const accountBar = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2">
      <p className="text-[11px] text-muted-foreground">
        {connected && account
          ? `Cuenta vinculada: ${account.email}`
          : 'Vincula una cuenta de Google para sincronizar y guardar tus eventos sin conexión.'}
      </p>
      <div className="flex items-center gap-1">
        {connected && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => void loadEvents(currentDate, true)}
            disabled={isLoading || !online}
          >
            {isLoading ? (
              <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Sincronizar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => void handleConnect()}
          data-tour="cal-google"
          disabled={isConnecting || !isGoogleConfigured || !online}
        >
          {isConnecting ? (
            <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {connected ? 'Cambiar de cuenta' : 'Vincular cuenta'}
        </Button>
      </div>
    </div>
  );

  return (
    // Sin título ni logo: el recuadro de Google ya se identifica solo. Queda
    // una fila mínima a la derecha con "Local" (y "Evento" en modo local).
    //
    // La barra de botones va FIJA arriba (`shrink-0`) y el contenido lleva su
    // propio scroll: antes, con `justify-center`, un calendario de seis filas
    // desbordaba por arriba y el botón de crear evento quedaba fuera del área
    // desplazable, imposible de alcanzar.
    <div className="flex h-full min-h-0 flex-col gap-3 py-4">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 px-4 md:px-8">
        {!online && (
          <span className="mr-auto flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <WifiOff className="h-3 w-3" /> Sin conexión · últimos datos sincronizados
          </span>
        )}
        {/* La vinculación de cuenta vive ahora al pie del recuadro (como Gmail). */}
        <div className="flex items-center gap-2">
          {showLocal && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                onClick={() => {
                  setEditingEvent(null);
                  setEventDialogOpen(true);
                }}
                title="Crear un evento local (feriado, evaluación, entrega, personal…)" data-tour="cal-crear"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Evento
              </Button>
              <Button
                size="sm"
                variant={editMode ? 'default' : 'outline'}
                className={cn(
                  'text-xs',
                  !editMode &&
                    'border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'
                )}
                onClick={() => setEditMode((p) => !p)}
                title="Editar eventos: al pulsar un día se abren sus eventos" data-tour="cal-editar"
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Editar
              </Button>
            </>
          )}
          <Button
            variant={showLocal ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'text-xs',
              !showLocal &&
                'border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'
            )}
            onClick={() => setShowLocal((p) => !p)}
            title="Calendario local de la app: funciona sin internet" data-tour="cal-local"
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Local
          </Button>
        </div>
      </div>

      {!connected && !isGoogleConfigured && (
        <p className="text-xs text-muted-foreground">
          Configura VITE_GOOGLE_CLIENT_ID en el archivo .env para habilitar la conexión con Google Calendar.
        </p>
      )}

      {showLocal ? (
        // Calendario LOCAL de Frame (antes en Enfoque): rendimiento diario,
        // sesiones de estudio y tareas, 100% offline. Con scroll propio para
        // que los meses de seis filas no empujen la barra de botones.
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FullCalendarView
            tasks={tasks}
            localEvents={localEvents}
            editMode={editMode}
            onOpenDay={setEditingDay}
          />
        </div>
      ) : showEmbed ? (
        // Google Calendar REAL, integrado como un recuadro del layout, con la
        // vinculación de cuenta en su parte inferior.
        // A sangre: el recuadro toca ambos bordes de la interfaz.
        <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border-x-0">
          <GoogleEmbed kind="calendar" heightClass="min-h-0 flex-1" />
          {accountBar}
        </Card>
      ) : (
        // Versión manual (estética idéntica al calendario de Enfoque):
        // últimos eventos sincronizados de Google + tareas locales.
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 md:px-8">
          <div className="flex flex-row items-center justify-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold text-primary font-headline uppercase tracking-wider text-center">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Card className="bg-transparent border-0 shadow-none">
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-t-2 border-l-2 border-border">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-bold text-muted-foreground p-2 border-r-2 border-b-2 border-border bg-card/80"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 border-l-2 border-border">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7">
                    {week.map(({ date, inMonth }) => {
                      const key = dayKey(date);
                      const dayEvents = eventsByDay.get(key) ?? [];
                      const dayTasks = tasksByDay.get(key) ?? [];
                      const isToday = key === todayKey;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedDay(date)}
                          className={cn(
                            'border-r-2 border-b-2 border-border p-1 flex flex-col gap-1 bg-background min-h-24 text-left transition-colors hover:bg-secondary/30',
                            !inMonth && 'text-muted-foreground/60'
                          )}
                        >
                          <div
                            className={cn(
                              'self-end text-xs font-semibold',
                              isToday &&
                                'flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground'
                            )}
                          >
                            {date.getDate()}
                          </div>
                          <div className="flex flex-col gap-1 overflow-y-auto">
                            {dayEvents.map((ev) => (
                              <div key={ev.id} className="bg-secondary rounded-md p-1 w-full">
                                <p className="text-primary text-[10px] font-bold text-center truncate">
                                  {ev.summary}
                                </p>
                                {!ev.allDay && (
                                  <p className="text-muted-foreground text-[10px] text-center">
                                    {new Date(ev.start).toLocaleTimeString('es', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                )}
                              </div>
                            ))}
                            {dayTasks.map((t) => (
                              <div key={t.id} className="bg-secondary rounded-md p-1 w-full">
                                <p className="text-primary text-[10px] font-bold text-center truncate">
                                  {t.courseName}
                                </p>
                                <p className="text-muted-foreground text-[10px] whitespace-pre-wrap text-center">
                                  {t.name}
                                </p>
                              </div>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* También en modo manual la vinculación vive abajo, no en la esquina. */}
          <Card className="overflow-hidden">{accountBar}</Card>
        </div>
      )}

      {/* Alta y edición de eventos del calendario local (mismo formulario) */}
      <LocalEventDialog
        open={isEventDialogOpen}
        onOpenChange={(open) => {
          setEventDialogOpen(open);
          if (!open) setEditingEvent(null);
        }}
        onCreate={addLocalEvent}
        onUpdate={updateLocalEvent}
        event={editingEvent}
        allEvents={localEvents}
        defaultDate={editingEvent ? undefined : editingDay ?? undefined}
      />

      {/* Gestión de los eventos de un día (solo con el modo edición activo) */}
      <DayEventsDialog
        day={editingDay}
        events={editingDay ? getEventsForDay(localEvents, dayKey(editingDay)) : []}
        onClose={() => setEditingDay(null)}
        onCreate={() => {
          setEditingEvent(null);
          setEventDialogOpen(true);
        }}
        onEdit={(ev) => {
          setEditingEvent(ev);
          setEventDialogOpen(true);
        }}
        onDelete={deleteLocalEvent}
      />


      {/* Detalle del día (modo manual) */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary font-bold">
              {selectedDay && `${selectedDay.getDate()} de ${MONTHS[selectedDay.getMonth()]}`}
            </DialogTitle>
            <DialogDescription>
              {selectedEvents.length + selectedTasks.length > 0
                ? 'Eventos y tareas del día'
                : 'Sin eventos ni tareas para este día.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-2 pr-3">
              {selectedEvents.map((ev, i) => (
                <React.Fragment key={ev.id}>
                  <div className="flex items-start justify-between gap-2 rounded-md bg-secondary/50 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{ev.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.allDay
                          ? 'Todo el día'
                          : `${new Date(ev.start).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} – ${new Date(ev.end).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                      {ev.location && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /> {ev.location}
                        </p>
                      )}
                    </div>
                    {ev.htmlLink && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground"
                        onClick={() => void openExternal(ev.htmlLink!)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {i === selectedEvents.length - 1 && selectedTasks.length > 0 && <Separator />}
                </React.Fragment>
              ))}
              {selectedTasks.map((t) => (
                <div key={t.id} className="rounded-md bg-secondary/50 p-3">
                  <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Tarea · {t.courseName} · Importancia {t.priority.toLowerCase()}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
