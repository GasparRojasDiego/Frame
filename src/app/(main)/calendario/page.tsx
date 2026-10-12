import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CalendarDays,
  ClipboardList,
  ExternalLink,
  Link2,
  LoaderCircle,
  MapPin,
  RefreshCcw,
  WifiOff,
} from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import FullCalendarView from '@/components/calendar/FullCalendarView';
import MonthBar, { CalendarModeSwitch, type CalendarMode } from '@/components/calendar/MonthBar';
import MonthGrid from '@/components/calendar/MonthGrid';
import { PanelHeader, SectionLabel } from '@/components/calendar/CalendarBits';
import {
  MONTH_NAMES,
  addDays,
  buildTaskItems,
  capitalize,
  cursorOf,
  groupTasksByDay,
  longDayLabel,
  monthKeyOf,
  monthWeeks,
  relativeDayLabel,
  shiftMonth,
  toKey,
  weekdayName,
  type DayRange,
  type GridItem,
  type MonthCursor,
} from '@/components/calendar/calendar-model';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTodayKey } from '@/hooks/use-today';
import { useCourse } from '@/context/CourseContext';
import { isGoogleConfigured, hasScopes, connectIntegration, integrationAccount } from '@/lib/google/auth';
import { listCalendarEvents, cacheGet, type CalendarEvent } from '@/lib/google/api';
import GoogleEmbed, { useOnline } from '@/components/integrations/GoogleEmbed';

async function openExternal(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank');
  }
}

/** Calendario elegido la última vez (preferencia de este equipo). */
const MODE_KEY = 'calendarMode';

const readMode = (): CalendarMode => {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'local' ? 'local' : 'google';
  } catch {
    return 'google';
  }
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

/**
 * Días que ocupa un evento de Google. En los de todo el día el fin es
 * EXCLUSIVO (unas vacaciones del 1 al 7 llegan con fin el 8); en los de hora,
 * acabar justo a medianoche no ocupa el día siguiente.
 */
function googleSpan(ev: CalendarEvent): DayRange | null {
  if (ev.allDay) {
    const start = ev.start.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
    const exclusive = (ev.end || ev.start).slice(0, 10);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(exclusive) ? addDays(exclusive, -1) : start;
    return { start, end: end >= start ? end : start };
  }
  const from = new Date(ev.start);
  if (Number.isNaN(from.getTime())) return null;
  const to = ev.end ? new Date(ev.end) : from;
  const start = toKey(from);
  let end = Number.isNaN(to.getTime()) ? start : toKey(to);
  if (end > start && to.getHours() === 0 && to.getMinutes() === 0) end = addDays(end, -1);
  return { start, end: end >= start ? end : start };
}

// ============================================================
// Interfaz "Calendario":
// - Google (app de escritorio con internet): Google Calendar REAL incrustado
//   como un recuadro del layout, mientras la API sigue registrando los eventos
//   en la caché local en segundo plano. Sin internet (o en el navegador), la
//   misma cuadrícula del calendario local con los últimos eventos
//   sincronizados y las tareas.
// - Local: el calendario propio de Frame (FullCalendarView).
//
// No hay barra de botones encima: el conmutador Google/Local vive en la fila
// del mes del calendario y, con Google incrustado (que trae su propia
// cabecera), al pie, junto a la cuenta vinculada.
// ============================================================
export default function CalendarioPage() {
  const { tasks } = useCourse();
  const { toast } = useToast();
  const online = useOnline();
  const todayKey = useTodayKey();

  const [mode, setModeState] = useState<CalendarMode>(readMode);
  const [cursor, setCursor] = useState<MonthCursor>(() => cursorOf(todayKey));
  const [connected, setConnected] = useState(() => hasScopes('calendar'));
  const [account, setAccount] = useState(() => integrationAccount('calendar'));
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ day: string; nonce: number } | null>(null);

  const monthKey = monthKeyOf(cursor);
  const showEmbed = online && isTauri();

  const setMode = (next: CalendarMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      /* sin almacenamiento: se recuerda solo durante esta visita */
    }
  };

  const loadEvents = useCallback(
    async (month: MonthCursor, useNetwork: boolean) => {
      const first = new Date(month.year, month.month, 1);
      const last = new Date(month.year, month.month + 1, 0, 23, 59, 59);
      const key = `gcal_${monthKeyOf(month)}`;

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
    if (connected) void loadEvents(cursor, true);
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

  // --- Cuadrícula de Google sin conexión: memoizada por mes ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weeks = useMemo(() => monthWeeks(cursor), [cursor.year, cursor.month]);
  const first = weeks[0][0];
  const last = weeks[weeks.length - 1][6];

  const spans = useMemo(
    () =>
      events.flatMap((ev) => {
        const span = googleSpan(ev);
        return span ? [{ ev, ...span }] : [];
      }),
    [events]
  );

  const googleItems = useMemo<GridItem[]>(
    () => [
      ...spans.map(({ ev, start, end }) => ({
        id: `g:${ev.id}`,
        start,
        end,
        label: ev.summary || 'Sin título',
        time: ev.allDay ? undefined : clock(ev.start),
        color: ev.calendarColor,
        variant: 'external' as const,
        faded: end < todayKey,
        hint: [ev.summary, ev.allDay ? 'Todo el día' : clock(ev.start), ev.location].filter(Boolean).join(' · '),
      })),
      ...buildTaskItems(tasks, first, last),
    ],
    [spans, tasks, first, last, todayKey]
  );

  const tasksByDay = useMemo(() => groupTasksByDay(tasks), [tasks]);

  // Mientras el recuadro del día se desvanece al cerrar, sigue mostrando lo último.
  const lastDay = useRef<string | null>(null);
  if (selectedDay) lastDay.current = selectedDay;
  const shownDay = selectedDay ?? lastDay.current;
  const dayEvents = shownDay ? spans.filter((s) => shownDay >= s.start && shownDay <= s.end).map((s) => s.ev) : [];
  const dayTasks = shownDay ? tasksByDay.get(shownDay) ?? [] : [];

  const modeSwitch = <CalendarModeSwitch mode={mode} onChange={setMode} />;

  // Pie del recuadro de Google (misma ubicación que en Gmail): estado de la
  // cuenta + Sincronizar + Vincular/Cambiar de cuenta.
  const accountBar = (withSwitch: boolean) => (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2">
      <p className="mr-auto min-w-0 truncate text-[11px] text-muted-foreground">
        {!isGoogleConfigured
          ? 'Falta VITE_GOOGLE_CLIENT_ID en .env para vincular Google Calendar.'
          : connected && account
            ? `Cuenta vinculada: ${account.email}`
            : 'Vincula una cuenta de Google para sincronizar y guardar tus eventos sin conexión.'}
      </p>
      <div className="flex items-center gap-1">
        {connected && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => void loadEvents(cursor, true)}
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
      {withSwitch && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          {modeSwitch}
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col py-4">
      {mode === 'local' ? (
        <FullCalendarView trailing={modeSwitch} className="min-h-0 flex-1 px-4 md:px-8" />
      ) : showEmbed ? (
        // Google Calendar REAL, integrado como un recuadro del layout, con la
        // vinculación de cuenta y el conmutador en su parte inferior.
        // A sangre: el recuadro toca ambos bordes de la interfaz.
        <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border-x-0">
          <GoogleEmbed kind="calendar" heightClass="min-h-0 flex-1" />
          {accountBar(true)}
        </Card>
      ) : (
        // Sin internet (o en el navegador): la misma cuadrícula del calendario
        // local, de solo lectura, con los últimos eventos sincronizados.
        <section className="flex min-h-0 flex-1 flex-col gap-3 px-4 md:px-8" aria-label="Google Calendar">
          <MonthBar
            cursor={cursor}
            onPrev={() => setCursor((c) => shiftMonth(c, -1))}
            onNext={() => setCursor((c) => shiftMonth(c, 1))}
            onToday={() => {
              setCursor(cursorOf(todayKey));
              setFocusRequest({ day: todayKey, nonce: Date.now() });
            }}
            status={
              !online ? (
                <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <WifiOff className="h-3 w-3" /> Sin conexión · últimos datos sincronizados
                </span>
              ) : isLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Sincronizando" />
              ) : null
            }
          >
            {modeSwitch}
          </MonthBar>
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/40 shadow-sm">
            <MonthGrid
              weeks={weeks}
              cursor={cursor}
              items={googleItems}
              todayKey={todayKey}
              onOpenDay={setSelectedDay}
              onMonthChange={setCursor}
              focusRequest={focusRequest}
              ariaLabel={`Google Calendar, ${MONTH_NAMES[cursor.month]} de ${cursor.year}`}
            />
            {accountBar(false)}
          </div>
        </section>
      )}

      {/* Detalle del día (Google sin conexión) */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
          {shownDay && (
            <>
              <PanelHeader
                word={weekdayName(shownDay)}
                title={capitalize(longDayLabel(shownDay, todayKey))}
                subtitle={relativeDayLabel(shownDay, todayKey)}
              />
              <div className="space-y-5">
                {dayEvents.length + dayTasks.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-3 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                      <CalendarDays className="h-5 w-5" />
                    </span>
                    <p className="text-sm text-muted-foreground">Nada para este día.</p>
                  </div>
                )}

                {dayEvents.length > 0 && (
                  <section className="space-y-2">
                    <SectionLabel>Google Calendar</SectionLabel>
                    <ul className="space-y-1.5">
                      {dayEvents.map((ev) => (
                        <li
                          key={ev.id}
                          className="flex items-start justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{ev.summary || 'Sin título'}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {ev.allDay ? 'Todo el día' : `${clock(ev.start)} – ${clock(ev.end)}`}
                            </p>
                            {ev.location && (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" /> {ev.location}
                              </p>
                            )}
                          </div>
                          {ev.htmlLink && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                              onClick={() => void openExternal(ev.htmlLink!)}
                              aria-label="Abrir en Google Calendar"
                              title="Abrir en Google Calendar"
                            >
                              <ExternalLink />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {dayTasks.length > 0 && (
                  <section className="space-y-2">
                    <SectionLabel>Tareas que vencen</SectionLabel>
                    <ul className="space-y-1.5">
                      {dayTasks.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2"
                        >
                          <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {t.courseName || 'Sin asignatura'} · Importancia {String(t.priority).toLowerCase()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
