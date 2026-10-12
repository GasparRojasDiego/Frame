import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfDay, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, X, Check, CheckCheck, AlertTriangle, CalendarClock, Clock, Download, WifiOff } from 'lucide-react';
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

const KIND_META: Record<AppNotification['kind'], { icon: React.ElementType; className: string; label: string }> = {
  vencida: { icon: AlertTriangle, className: 'text-red-500 bg-red-500/10 border-red-500/30', label: 'Vencida' },
  hoy: { icon: Clock, className: 'text-amber-500 bg-amber-500/10 border-amber-500/30', label: 'Vence hoy' },
  proxima: { icon: CalendarClock, className: 'text-primary bg-primary/10 border-primary/30', label: 'Próxima' },
  actualizacion: { icon: Download, className: 'text-primary bg-primary/15 border-primary/40', label: 'Actualización' },
  conexion: { icon: WifiOff, className: 'text-amber-500 bg-amber-500/10 border-amber-500/30', label: 'Sin conexión' },
};

/**
 * Centro de notificaciones de la campana: recuadro emergente bajo el botón
 * con TODOS los pendientes (tareas vencidas, de hoy y de los próximos 3
 * días), X para cerrarlo, y la posibilidad de marcar cada notificación (o
 * todas) como vista. Las no vistas alimentan el contador de la campana; las
 * revisadas quedan atenuadas al final. Lo visto se recuerda por usuario.
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

  const persistSeen = useCallback(
    (next: Record<string, string>) => {
      // Poda: solo se recuerdan ids que siguen siendo notificaciones vigentes.
      const validIds = new Set(notifications.map((n) => n.id));
      const pruned: Record<string, string> = {};
      for (const [id, ts] of Object.entries(next)) {
        if (validIds.has(id)) pruned[id] = ts;
      }
      setSeenMap(pruned);
      try {
        if (seenKey) window.localStorage.setItem(seenKey, JSON.stringify(pruned));
      } catch {
        // Cuota llena: lo visto vale para esta sesión y se reintenta luego.
      }
    },
    [notifications, seenKey]
  );

  const markSeen = useCallback(
    (id: string) => persistSeen({ ...seenMap, [id]: new Date().toISOString() }),
    [persistSeen, seenMap]
  );

  const markAllSeen = useCallback(() => {
    const next = { ...seenMap };
    notifications.forEach((n) => {
      next[n.id] = next[n.id] ?? new Date().toISOString();
    });
    persistSeen(next);
  }, [notifications, persistSeen, seenMap]);

  const unseen = notifications.filter((n) => !seenMap[n.id]);
  const seen = notifications.filter((n) => !!seenMap[n.id]);
  const badgeCount = unseen.length;

  const openTask = useCallback(
    (n: AppNotification) => {
      markSeen(n.id);
      setOpen(false);
      if (n.kind === 'conexion') {
        if (n.id === 'sesion-perdida') void signInAgain();
        return;
      }
      if (n.kind === 'actualizacion') {
        openUpdateDialog();
        return;
      }
      router.push(`/tareas?highlightTaskId=${n.taskId}`, { scroll: false });
    },
    [markSeen, router]
  );

  const renderItem = (n: AppNotification, isSeen: boolean) => {
    const meta = KIND_META[n.kind];
    const Icon = meta.icon;
    return (
      <div
        key={n.id}
        className={cn(
          'group flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-accent/50',
          isSeen && 'opacity-55'
        )}
      >
        <button className="flex flex-1 items-start gap-2.5 text-left" onClick={() => openTask(n)}>
          <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', meta.className)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-foreground">{n.title}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {meta.label} · {n.detail}
            </span>
          </span>
        </button>
        {!isSeen && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
            title="Marcar como vista"
            onClick={() => markSeen(n.id)}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
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
          title="Notificaciones" data-tour="campana"
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
      <PopoverContent align="end" className="w-[340px] p-0" withArrow>
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-bold text-primary">Notificaciones</p>
          <div className="flex items-center gap-1">
            {unseen.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary"
                onClick={markAllSeen}
              >
                <CheckCheck className="mr-1 h-3 w-3" />
                Marcar todas
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground"
              title="Cerrar"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {/* Divisoria con aire a ambos lados, no de borde a borde. */}
        <Separator className="mx-3 w-auto" />

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs font-semibold text-foreground">Estás al día</p>
            <p className="text-[11px] text-muted-foreground">No tienes pendientes por vencer.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[340px]">
            <div className="space-y-0.5 p-1.5">
              {unseen.length > 0 && (
                <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  No vistas ({unseen.length})
                </p>
              )}
              {unseen.map((n) => renderItem(n, false))}
              {seen.length > 0 && (
                <>
                  <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Revisadas
                  </p>
                  {seen.map((n) => renderItem(n, true))}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
