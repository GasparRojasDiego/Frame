import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfDay, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  Clock,
  Download,
  Info,
  Settings,
  Timer,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  clearLog,
  markAllRead,
  markRead,
  setNotificationPrefs,
  setNotificationUser,
  syncCurrent,
  useNotificationLog,
  useNotificationPrefs,
  type LogEntry,
  type LogKind,
} from '@/lib/notification-log';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getUpdateState, openUpdateDialog, subscribeUpdate } from '@/lib/updater';
import { useCourse } from '@/context/CourseContext';
import { useRouter } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { signInAgain, useConnectionState } from '@/lib/connection-status';
import { BELL_PING_EVENT } from '@/components/layout/ConnectionNotice';

interface AppNotification {
  id: string;
  kind: 'vencida' | 'hoy' | 'proxima' | 'actualizacion' | 'conexion';
  /** Ausentes en las notificaciones que no son de una tarea. */
  taskId?: string;
  courseId?: string;
  title: string;
  detail: string;
}

const KIND_META: Record<LogKind, { icon: React.ElementType; className: string; label: string }> = {
  vencida: { icon: AlertTriangle, className: 'text-red-500 bg-red-500/10 border-red-500/30', label: 'Vencida' },
  hoy: { icon: Clock, className: 'text-amber-500 bg-amber-500/10 border-amber-500/30', label: 'Vence hoy' },
  proxima: { icon: CalendarClock, className: 'text-primary bg-primary/10 border-primary/30', label: 'Próxima' },
  actualizacion: { icon: Download, className: 'text-primary bg-primary/15 border-primary/40', label: 'Actualización' },
  conexion: { icon: WifiOff, className: 'text-amber-500 bg-amber-500/10 border-amber-500/30', label: 'Sin conexión' },
  recordatorio: { icon: BellRing, className: 'text-primary bg-primary/10 border-primary/30', label: 'Recordatorio' },
  sesion: { icon: Timer, className: 'text-primary bg-primary/10 border-primary/30', label: 'Estudio' },
  aviso: { icon: Info, className: 'text-muted-foreground bg-muted border-border', label: 'Aviso' },
};

/** Las que la campana calcula (y dejan de estar vigentes); el resto llegan una vez. */
const CALCULATED = new Set<LogKind>(['vencida', 'hoy', 'proxima', 'actualizacion', 'conexion']);

/**
 * Centro de notificaciones de la campana: recuadro emergente bajo el botón
 * con el REGISTRO de notificaciones (lib/notification-log.ts): lo vigente
 * (tareas vencidas, de hoy y de los próximos 3 días, versión nueva,
 * conexión) y lo que llegó al sistema (recordatorios, fin de la sesión),
 * cada una con su hora. El engranaje activa o silencia las notificaciones y
 * borra el registro; «Marcar como leído» apaga el contador.
 */
export default function NotificationCenter() {
  const { tasks, courses, userProfile } = useCourse();
  const router = useRouter();
  const [isOpen, setOpen] = useState(false);
  const connection = useConnectionState();
  // El aviso «Sin conexión» llega volando a la campana: late un instante.
  const [ping, setPing] = useState(false);
  useEffect(() => {
    const onPing = () => {
      setPing(true);
      window.setTimeout(() => setPing(false), 900);
    };
    window.addEventListener(BELL_PING_EVENT, onPing);
    return () => window.removeEventListener(BELL_PING_EVENT, onPing);
  }, []);

  // Estado del actualizador: vive fuera de React, así que hay que suscribirse.
  const [, forceRender] = useState(0);
  useEffect(() => subscribeUpdate(() => forceRender((n) => n + 1)), []);
  const update = getUpdateState();
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});

  const seenKey = userProfile ? `notificationsSeen_${userProfile.id}` : null;

  useEffect(() => {
    if (!seenKey) return;
    try {
      setSeenMap(JSON.parse(window.localStorage.getItem(seenKey) ?? '{}'));
    } catch {
      setSeenMap({});
    }
  }, [seenKey]);

  // Todos los pendientes con fecha: vencidos, de hoy y de los próximos 3 días.
  const notifications = useMemo<AppNotification[]>(() => {
    const today = startOfDay(new Date());
    const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? 'Sin asignatura';
    const items: AppNotification[] = [];

    // Conexión (solo cuentas: un invitado no sincroniza nada).
    if (userProfile && !userProfile.isGuest) {
      if (connection.sessionLostFor === userProfile.id) {
        items.push({
          id: 'sesion-perdida',
          kind: 'conexion',
          title: 'Sin conexión con tu cuenta',
          detail: 'Pulsa para volver a entrar; tus datos siguen aquí',
        });
      } else if (connection.offlineSince !== null) {
        items.push({
          id: `sin-internet-${connection.offlineSince}`,
          kind: 'conexion',
          title: 'Sin conexión',
          detail: 'Tus cambios se guardan aquí y se sincronizan al volver',
        });
      }
    }

    // Versión nueva publicada: va la PRIMERA, por delante de las tareas.
    // Pulsarla no instala: abre el recuadro de actualización, que es donde se
    // ve el peso, el tiempo estimado y se confirma.
    if (update.version) {
      items.push({
        id: `actualizacion-${update.version}`,
        kind: 'actualizacion',
        title: `Frame ${update.version} disponible`,
        detail: 'Pulsa para ver el peso y el tiempo estimado',
      });
    }

    for (const task of tasks) {
      if (!task.dueDate || (task.progress ?? 0) >= 100) continue;
      let due: Date;
      try {
        due = startOfDay(parseISO(task.dueDate));
      } catch {
        continue;
      }
      const diff = differenceInCalendarDays(due, today);
      const when = format(due, "d 'de' MMMM", { locale: es });
      const base = { taskId: task.id, courseId: task.courseId, detail: `${courseName(task.courseId)} · ${when}` };
      if (diff < 0) {
        items.push({
          ...base,
          id: `vencida-${task.id}-${task.dueDate}`,
          kind: 'vencida',
          title: task.name,
        });
      } else if (diff === 0) {
        items.push({ ...base, id: `hoy-${task.id}-${task.dueDate}`, kind: 'hoy', title: task.name });
      } else if (diff <= 3) {
        items.push({ ...base, id: `proxima-${task.id}-${task.dueDate}`, kind: 'proxima', title: task.name });
      }
    }

    // La actualización encabeza: es la única accionable en un clic.
    const order: Record<AppNotification['kind'], number> = {
      conexion: -2,
      actualizacion: -1,
      vencida: 0,
      hoy: 1,
      proxima: 2,
    };
    return items.sort((a, b) => order[a.kind] - order[b.kind]);
  }, [tasks, courses, update.version, connection, userProfile]);

  // Lo vigente se anota en el registro (con la hora en que apareció); lo que
  // ya pasó sigue en el registro como historial.
  useEffect(() => setNotificationUser(userProfile?.id ?? null), [userProfile?.id]);
  const log = useNotificationLog();
  const prefs = useNotificationPrefs();
  useEffect(() => {
    // Lo visto con la campana anterior (1.6.3 y antes) entra ya leído.
    syncCurrent(notifications, new Set(Object.keys(seenMap)));
  }, [notifications, seenMap]);

  const activeIds = useMemo(() => new Set(notifications.map((n) => n.id)), [notifications]);
  const badgeCount = log.filter((entry) => !entry.read).length;

  const openEntry = useCallback(
    (entry: LogEntry) => {
      markRead(entry.id);
      setOpen(false);
      if (entry.kind === 'conexion') {
        if (entry.id === 'sesion-perdida') void signInAgain();
        return;
      }
      if (entry.kind === 'actualizacion') {
        openUpdateDialog();
        return;
      }
      if (entry.taskId) {
        router.push(`/tareas?highlightTaskId=${entry.taskId}`, { scroll: false });
        return;
      }
      if (entry.route) router.push(entry.route);
    },
    [router]
  );

  const whenLabel = (at: number) => {
    const date = new Date(at);
    const days = differenceInCalendarDays(startOfDay(new Date()), startOfDay(date));
    const hour = format(date, 'HH:mm');
    if (days === 0) return `Hoy, ${hour}`;
    if (days === 1) return `Ayer, ${hour}`;
    return `${format(date, "d 'de' MMM", { locale: es })}, ${hour}`;
  };

  const renderItem = (entry: LogEntry) => {
    const meta = KIND_META[entry.kind] ?? KIND_META.aviso;
    const Icon = meta.icon;
    // Lo que ya no está vigente (tarea culminada, versión instalada…) queda
    // como historial, más tenue.
    const past = !activeIds.has(entry.id) && CALCULATED.has(entry.kind);
    return (
      <div
        key={entry.id}
        className={cn(
          'group flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-accent/50',
          (entry.read || past) && 'opacity-60'
        )}
      >
        <button className="flex min-w-0 flex-1 items-start gap-2.5 text-left" onClick={() => openEntry(entry)}>
          <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', meta.className)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{entry.title}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{whenLabel(entry.at)}</span>
            </span>
            <span className="block text-[11px] leading-snug text-muted-foreground">
              {meta.label}
              {past ? ' · ya no está vigente' : ''} · {entry.detail}
            </span>
          </span>
        </button>
        {!entry.read && <span aria-label="Sin leer" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Fantasma como el resto de la barra; sólido mientras el recuadro
            de notificaciones está abierto. */}
        <Button
          size="icon"
          variant={isOpen ? 'default' : 'fantasma'}
          title="Notificaciones"
          data-notification-bell
          className={cn(
            'relative h-9 w-9 rounded-md border border-primary',
            ping && 'animate-pulse ring-2 ring-amber-500/60'
          )}
        >
          <Bell className="h-5 w-5" />
          {/* El aro del color del fondo separa la cifra del botón cuando
              este se pinta sólido (los dos son del azul primario). */}
          {badgeCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0" withArrow>
        <div className="flex items-center gap-1 px-2 py-2">
          {/* Engranaje: sonido, notificaciones y borrar el registro. */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title="Ajustes de notificaciones">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuCheckboxItem
                checked={prefs.sound}
                onCheckedChange={(checked) => setNotificationPrefs({ sound: !!checked })}
                onSelect={(event) => event.preventDefault()}
              >
                Sonido de las notificaciones
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={prefs.enabled}
                onCheckedChange={(checked) => setNotificationPrefs({ enabled: !!checked })}
                onSelect={(event) => event.preventDefault()}
              >
                Notificaciones activadas
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => clearLog()} disabled={log.length === 0}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Borrar todas las notificaciones
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
            onClick={markAllRead}
            disabled={badgeCount === 0}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Marcar como leído
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto h-7 w-7 text-muted-foreground"
            title="Cerrar"
            onClick={() => setOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Divisoria con aire a ambos lados, no de borde a borde. */}
        <Separator className="mx-3 w-auto" />

        {log.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs font-semibold text-foreground">Estás al día</p>
          </div>
        ) : (
          // Todo el registro, con su propio desplazamiento.
          <ScrollArea className="h-[min(30rem,65vh)]">
            <div className="space-y-0.5 p-1.5">{log.map(renderItem)}</div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
