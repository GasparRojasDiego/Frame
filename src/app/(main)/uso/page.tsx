import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Smartphone,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCourse } from '@/context/CourseContext';
import { useReportExport } from '@/hooks/use-report-export';
import { useToast } from '@/hooks/use-toast';
import { buildImpactDoc, type ImpactData, type UsageSummary } from '@/lib/impact-report';
import type { ReportFormat } from '@/lib/report-export';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { isFrameOwner } from '@/lib/owner';
import { cn } from '@/lib/utils';

// ============================================================
// Panel de uso — solo para el responsable de Frame.
//
// Responde a la pregunta de quien mantiene la app: ¿cuántos estudiantes la
// usan, cuánto y con qué? Todo sale de `usage_overview` (Supabase), que
// agrega en el servidor datos seudónimos (identificador aleatorio, nunca
// nombres ni contenido), deja fuera la cuenta del propio responsable y solo
// le responde a ella: cualquier otra sesión recibe «permiso denegado».
//
// Desde la 1.5.7:
//   · Los errores ya no se miran aquí: se agrupan solos en `error_log`
//     (migración 0008) y se corrigen desde el código.
//   · El antiguo apartado «Impacto» es un informe PDF/Word (botón de arriba).
// Desde la 1.5.9 no hay «Institución» ni «Sugerencias»: los eventos y
// pantallas que ya no existen no se listan.
//
// La interfaz no existe para el resto: la ruta redirige a Inicio.
// ============================================================

interface StudentRow {
  id: string;
  guest: boolean;
  country: string | null;
  version: string | null;
  platform: string | null;
  first_seen: string;
  last_seen: string;
  minutes: number | null;
  sessions: number | null;
  tasks: number | null;
  courses: number | null;
  habits: number | null;
  songs: number | null;
  active_days: number;
}

interface Overview {
  generated_at: string;
  days: number;
  since: string;
  today: string;
  totals: {
    users_total: number;
    accounts_total: number;
    guests_total: number;
    users_new: number;
    active_today: number;
    active_7d: number;
    active_30d: number;
    active_period: number;
    sessions_period: number;
    minutes_period: number;
    tasks_period: number;
    opens_period: number;
    study_minutes_all: number;
    sessions_all: number;
    tasks_all: number;
  };
  retention: { this_week: number; prev_week: number; retained: number };
  recency: { today: number; week: number; month: number; older: number };
  study_buckets: { none: number; lt1h: number; h1_5: number; h5_20: number; h20: number };
  daily: { date: string; active_users: number; sessions: number; minutes: number; tasks: number; opens: number }[];
  versions: { version: string; platform: string; users: number }[];
  countries: { country: string; users: number }[];
  platforms: { platform: string; users: number }[];
  screens: { screen: string; views: number; users: number }[];
  events: { event: string; count: number; users: number }[];
  reports: { format: string; count: number }[];
  weekly: { week_start: string; users: number; sessions: number; minutes: number; tasks: number }[];
  users: StudentRow[];
}

/** Resumen de invitados (función `guest_overview`, migración 0006). */
interface GuestOverview {
  started_period: number;
  started_today: number;
  resumed_period: number;
  linked_period: number;
  linked_today: number;
  guests_total: number;
  guests_active_7d: number;
}

type Period = 7 | 30 | 90;

const EVENT_LABELS: Record<string, string> = {
  app_open: 'Aperturas de la app',
  screen_view: 'Interfaces abiertas',
  study_session_end: 'Sesiones de estudio',
  task_created: 'Tareas creadas',
  task_completed: 'Tareas culminadas',
  task_incomplete: 'Tareas no culminadas',
  habit_checked: 'Hábitos marcados',
  report_generated: 'Informes generados',
  account_signed_in: 'Inicios de sesión',
  guest_started: 'Entradas como invitado',
  guest_linked: 'Invitados que vincularon Google',
  help_asked: 'Preguntas a la ayuda',
  help_tour: 'Recorridos «Descubrir» (hasta la 1.6.4)',
};

const SCREEN_LABELS: Record<string, string> = {
  '/': 'Inicio',
  '/temporizador': 'Estudio',
  '/tareas': 'Tareas',
  '/habitos': 'Hábitos',
  '/cursos': 'Asignatura (detalle)',
  '/knowledge': 'Asignaturas',
  '/calendario': 'Calendario',
  '/gmail': 'Gmail',
  '/youtube': 'YouTube',
  '/drive': 'Drive',
  '/classroom': 'Classroom',
  '/music': 'Música',
  '/playlists': 'Playlists',
  '/settings': 'Ajustes',
  '/ayuda': 'Ayuda',
  '/presentacion': 'Presentación',
  '/uso': 'Uso',
};

const PLATFORM_LABEL: Record<string, string> = { windows: 'Windows', android: 'Android' };

const minutesLabel = (minutes: number) => {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  // Con cientos de horas los minutos sobran y rompen la línea del recuadro.
  if (h >= 100) return `${h.toLocaleString('es-PE')} h`;
  return h > 0 ? `${h} h ${m % 60} min` : `${m} min`;
};

const dayLabel = (iso: string) => {
  try {
    return format(parseISO(iso), 'd MMM', { locale: es });
  } catch {
    return iso;
  }
};

const ago = (iso: string) => {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: true });
  } catch {
    return '—';
  }
};

/** '1.5.10' frente a '1.5.9', por números. */
const compareVersions = (a: string, b: string) => {
  const pa = a.split('.').map((n) => Number(n) || 0);
  const pb = b.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--background))',
  borderColor: 'hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

// ------------------------------------------------------------
// Piezas
// ------------------------------------------------------------

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-headline text-2xl font-bold tabular-nums text-foreground">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Lista con barras proporcionales, para pantallas, actividad y versiones. */
function RankList({
  title,
  rows,
  empty,
  limit = 8,
}: {
  title: string;
  rows: { label: string; value: number; extra?: string; muted?: boolean }[];
  empty: string;
  limit?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-headline text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
        ) : (
          rows.slice(0, limit).map((r) => (
            <div key={r.label} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={cn('truncate', r.muted ? 'text-muted-foreground' : 'text-foreground')}>{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {r.value}
                  {r.extra && <span className="text-muted-foreground/70"> · {r.extra}</span>}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn('h-full rounded-full', r.muted ? 'bg-muted-foreground/40' : 'bg-primary/70')}
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** Barra apilada horizontal con leyenda: el reparto de un vistazo. */
function SplitBar({
  segments,
  active,
  onSelect,
}: {
  segments: { id: string; label: string; value: number; className: string }[];
  active?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
        {total > 0 &&
          segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.id}
                className={cn(s.className, 'transition-opacity', active && active !== s.id && 'opacity-30')}
                style={{ width: `${(s.value / total) * 100}%` }}
              />
            ) : null
          )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {segments.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={!onSelect || s.value === 0}
            onClick={() => onSelect?.(active === s.id ? null : s.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
              active === s.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border/70 text-muted-foreground',
              onSelect && s.value > 0 && 'hover:border-primary/60',
              s.value === 0 && 'opacity-50'
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', s.className)} />
            {s.label}
            <span className="font-semibold tabular-nums text-foreground">{s.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Estudiantes: tabla ordenable, filtrable y paginada
// ------------------------------------------------------------

type Recency = 'today' | 'week' | 'month' | 'older';
type SortKey = 'last_seen' | 'minutes' | 'active_days' | 'tasks' | 'first_seen';

const PAGE_SIZE = 8;

const recencyOf = (iso: string): Recency => {
  try {
    const days = differenceInCalendarDays(new Date(), parseISO(iso));
    if (days <= 0) return 'today';
    if (days <= 6) return 'week';
    if (days <= 29) return 'month';
    return 'older';
  } catch {
    return 'older';
  }
};

const RECENCY_DOT: Record<Recency, string> = {
  today: 'bg-emerald-500',
  week: 'bg-primary',
  month: 'bg-amber-500',
  older: 'bg-muted-foreground/50',
};

const SORT_LABEL: Record<SortKey, string> = {
  last_seen: 'Última vez',
  minutes: 'Estudio acumulado',
  active_days: 'Días activos',
  tasks: 'Tareas',
  first_seen: 'Más recientes',
};

function StudentsCard({ data }: { data: Overview }) {
  const [kind, setKind] = useState<'all' | 'account' | 'guest'>('all');
  const [recency, setRecency] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('last_seen');
  const [page, setPage] = useState(0);

  // La versión más nueva por sistema: quien no la tiene, va desactualizado.
  const latest = useMemo(() => {
    const out: Record<string, string> = {};
    for (const v of data.versions) {
      if (!v.version || v.version === '?') continue;
      const current = out[v.platform];
      if (!current || compareVersions(v.version, current) > 0) out[v.platform] = v.version;
    }
    return out;
  }, [data.versions]);

  const rows = useMemo(() => {
    const filtered = data.users.filter(
      (u) =>
        (kind === 'all' || (kind === 'guest' ? u.guest : !u.guest)) &&
        (!recency || recencyOf(u.last_seen) === recency)
    );
    const value = (u: StudentRow): number => {
      switch (sort) {
        case 'minutes':
          return u.minutes ?? 0;
        case 'active_days':
          return u.active_days;
        case 'tasks':
          return u.tasks ?? 0;
        case 'first_seen':
          return Date.parse(u.first_seen) || 0;
        default:
          return Date.parse(u.last_seen) || 0;
      }
    };
    return [...filtered].sort((a, b) => value(b) - value(a));
  }, [data.users, kind, recency, sort]);

  // Al cambiar el filtro, de vuelta a la primera página.
  useEffect(() => setPage(0), [kind, recency, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const maxDays = Math.max(1, data.days);

  const segments = [
    { id: 'today', label: 'Hoy', value: data.recency.today, className: RECENCY_DOT.today },
    { id: 'week', label: 'Esta semana', value: data.recency.week, className: RECENCY_DOT.week },
    { id: 'month', label: 'Este mes', value: data.recency.month, className: RECENCY_DOT.month },
    { id: 'older', label: 'Hace más de un mes', value: data.recency.older, className: RECENCY_DOT.older },
  ];

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-headline text-muted-foreground">Estudiantes · última vez que abrieron Frame</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="h-6 px-2.5 text-xs">
                  Todos {data.totals.users_total}
                </TabsTrigger>
                <TabsTrigger value="account" className="h-6 px-2.5 text-xs">
                  Cuentas {data.totals.accounts_total}
                </TabsTrigger>
                <TabsTrigger value="guest" className="h-6 px-2.5 text-xs">
                  Invitados {data.totals.guests_total}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <ArrowDownUp className="h-3.5 w-3.5" /> {SORT_LABEL[sort]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">Ordenar por</DropdownMenuLabel>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                  <DropdownMenuItem key={key} onSelect={() => setSort(key)} className={cn('text-xs', sort === key && 'text-primary')}>
                    {SORT_LABEL[key]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <SplitBar segments={segments} active={recency} onSelect={setRecency} />
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">Nadie en este grupo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-y border-border/60 bg-secondary/30">
                  <th className="px-4 py-2 text-left font-bold">Estudiante</th>
                  <th className="px-2 py-2 text-left font-bold">Última vez</th>
                  <th className="px-2 py-2 text-left font-bold">Días activos</th>
                  <th className="px-2 py-2 text-right font-bold">Estudio</th>
                  <th className="px-2 py-2 text-right font-bold">Sesiones</th>
                  <th className="px-2 py-2 text-right font-bold">Tareas</th>
                  <th className="px-2 py-2 text-right font-bold">Asignaturas</th>
                  <th className="px-4 py-2 text-left font-bold">Versión</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u, i) => {
                  const rec = recencyOf(u.last_seen);
                  const PlatformIcon = u.platform === 'android' ? Smartphone : Monitor;
                  const outdated = !!(u.version && u.platform && latest[u.platform] && compareVersions(u.version, latest[u.platform]) < 0);
                  return (
                    <tr key={`${u.id}-${i}`} className="border-b border-border/40 last:border-0 hover:bg-secondary/20">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <PlatformIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={PLATFORM_LABEL[u.platform ?? ''] ?? 'Sistema'} />
                          <span className="font-mono text-muted-foreground">{u.id}</span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide',
                              u.guest ? 'bg-amber-500/15 text-amber-500' : 'bg-primary/15 text-primary'
                            )}
                          >
                            {u.guest ? 'Invitado' : 'Cuenta'}
                          </span>
                        </div>
                        <p className="mt-0.5 pl-[22px] text-[10px] text-muted-foreground/70">
                          {u.country ?? 'País desconocido'} · desde {dayLabel(u.first_seen)}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className={cn('h-1.5 w-1.5 rounded-full', RECENCY_DOT[rec])} />
                          {ago(u.last_seen)}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, (u.active_days / maxDays) * 100)}%` }} />
                          </div>
                          <span className="tabular-nums text-muted-foreground">{u.active_days}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{minutesLabel(u.minutes ?? 0)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{u.sessions ?? 0}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{u.tasks ?? 0}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{u.courses ?? 0}</td>
                      <td className="px-4 py-2">
                        <span className={cn('tabular-nums', outdated ? 'text-amber-500' : 'text-muted-foreground')} title={outdated ? `Hay una más nueva: ${latest[u.platform ?? '']}` : undefined}>
                          {u.version ?? '—'}
                          {outdated && ' ↑'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="tabular-nums">
              {current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} de {rows.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">
                {current + 1} / {pages}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Página siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------

function UsagePanel() {
  const { userProfile } = useCourse();
  const { toast } = useToast();
  const { run, busy } = useReportExport();
  const [days, setDays] = useState<Period>(30);
  const [data, setData] = useState<Overview | null>(null);
  const [guests, setGuests] = useState<GuestOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const isOwner = isFrameOwner(userProfile) && isSupabaseConfigured;

  const load = useCallback(async (period: Period) => {
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase no está configurado.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [{ data: result, error: rpcError }, guestReply] = await Promise.all([
      supabase.rpc('usage_overview', { days: period }),
      supabase.rpc('guest_overview', { days: period }),
    ]);
    // Los invitados son un extra: si su resumen falla, el panel sigue.
    setGuests(guestReply.error ? null : (guestReply.data as GuestOverview));
    if (rpcError) {
      setError(
        rpcError.code === '42501'
          ? 'Solo la cuenta del responsable de Frame puede ver este panel. Inicia sesión con ella.'
          : rpcError.message
      );
      setData(null);
    } else {
      setData(result as Overview);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    void load(days);
  }, [isOwner, days, load]);

  const daily = useMemo(
    () => (data?.daily ?? []).map((d) => ({ ...d, label: dayLabel(d.date), minutes: Math.round(d.minutes) })),
    [data]
  );

  const retentionPct = useMemo(() => {
    const r = data?.retention;
    if (!r || r.prev_week === 0) return null;
    return Math.round((r.retained / r.prev_week) * 100);
  }, [data]);

  /** El informe de impacto: pide su serie al servidor y arma el documento. */
  const downloadImpact = async (formatId: ReportFormat) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setPreparing(true);
    try {
      const { data: impact, error: rpcError } = await supabase.rpc('impact_overview');
      if (rpcError || !impact) {
        toast({ variant: 'destructive', title: 'No se pudo preparar el informe', description: rpcError?.message ?? 'Sin respuesta del servidor.' });
        return;
      }
      const usage: UsageSummary | null = data
        ? {
            days: data.days,
            totals: data.totals,
            retention: data.retention,
            screens: data.screens.filter((s) => s.screen in SCREEN_LABELS).map((s) => ({ label: SCREEN_LABELS[s.screen], views: s.views, users: s.users })),
            versions: data.versions,
            platforms: data.platforms,
          }
        : null;
      const report = impact as ImpactData;
      await run(() => buildImpactDoc(report, usage), `Frame - Informe de impacto - ${report.today}`, formatId);
    } finally {
      setPreparing(false);
    }
  };

  if (!isOwner) return <Navigate to="/" replace />;

  const t = data?.totals;
  const nothingYet = !!data && t?.users_total === 0;
  const reportBusy = preparing || busy !== null;

  // Las versiones agrupadas por sistema, con la más nueva marcada.
  const versionRows = (() => {
    if (!data) return [];
    const newest: Record<string, string> = {};
    for (const v of data.versions) {
      if (!newest[v.platform] || compareVersions(v.version, newest[v.platform]) > 0) newest[v.platform] = v.version;
    }
    return [...data.versions]
      .sort((a, b) => a.platform.localeCompare(b.platform) || compareVersions(b.version, a.version))
      .map((v) => ({
        label: `${PLATFORM_LABEL[v.platform] ?? v.platform} ${v.version}${v.version === newest[v.platform] ? ' · la más nueva' : ''}`,
        value: v.users,
        extra: v.users === 1 ? 'estudiante' : 'estudiantes',
        muted: v.version !== newest[v.platform],
      }));
  })();

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold text-foreground">Panel de uso</h1>
          <p className="text-sm text-muted-foreground">
            Frame en manos de tus estudiantes · datos seudónimos, calculados en el servidor y sin contar tu propia cuenta
          </p>
          {data && (
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              Actualizado {ago(data.generated_at)} · periodo {dayLabel(data.since)} – {dayLabel(data.today)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="h-9 gap-2" disabled={reportBusy}>
                {reportBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Informe de impacto
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Cifras citables, evolución por semana de uso y resumen del uso de la app
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void downloadImpact('pdf')}>
                <FileText className="mr-2 h-4 w-4" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void downloadImpact('docx')}>
                <FileText className="mr-2 h-4 w-4" /> Word (.docx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as Period)}>
            <TabsList>
              <TabsTrigger value="7">7 días</TabsTrigger>
              <TabsTrigger value="30">30 días</TabsTrigger>
              <TabsTrigger value="90">90 días</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" onClick={() => void load(days)} disabled={loading} title="Actualizar">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {loading && !data && (
        <div className="flex h-40 items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {nothingYet && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Todavía no hay datos. Aparecen en cuanto un estudiante abra Frame con conexión: primero la
            apertura del día, y después cada sesión de estudio, tarea terminada e informe generado.
          </CardContent>
        </Card>
      )}

      {data && t && !nothingYet && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={Users}
              label="Estudiantes"
              value={t.users_total}
              hint={`${t.accounts_total} con cuenta · ${t.guests_total} invitados · ${t.users_new} nuevos`}
            />
            <Kpi icon={Activity} label="Activos en 7 días" value={t.active_7d} hint={`${t.active_today} hoy · ${t.active_30d} en 30 días`} />
            <Kpi
              icon={CalendarDays}
              label="Retención semanal"
              value={retentionPct === null ? '—' : `${retentionPct}%`}
              hint={
                data.retention.prev_week === 0
                  ? 'Sin semana anterior con la que comparar'
                  : `${data.retention.retained} de ${data.retention.prev_week} volvieron esta semana`
              }
            />
            <Kpi
              icon={Clock3}
              label="Estudio en el periodo"
              value={minutesLabel(t.minutes_period)}
              hint={`${t.sessions_period} sesiones · ${t.tasks_period} tareas culminadas`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-headline text-muted-foreground">Estudiantes activos por día</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="usoActivos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--foreground))" strokeDasharray="3 3" strokeOpacity={0.12} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Activos']} />
                    <Area type="monotone" dataKey="active_users" stroke="hsl(var(--primary))" fill="url(#usoActivos)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-headline text-muted-foreground">Minutos de estudio y sesiones por día</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={daily} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--foreground))" strokeDasharray="3 3" strokeOpacity={0.12} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                    <YAxis yAxisId="min" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis yAxisId="ses" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar yAxisId="min" dataKey="minutes" name="Minutos" fill="hsl(var(--primary))" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="ses" type="monotone" dataKey="sessions" name="Sesiones" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <StudentsCard data={data} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RankList
              title="Interfaces más abiertas"
              rows={data.screens.filter((s) => s.screen in SCREEN_LABELS).map((s) => ({
                label: SCREEN_LABELS[s.screen],
                value: s.views,
                extra: `${s.users} est.`,
              }))}
              empty="Sin interfaces registradas en el periodo"
            />
            <RankList
              title="Actividad en el periodo"
              rows={data.events.filter((e) => e.event in EVENT_LABELS).map((e) => ({ label: EVENT_LABELS[e.event], value: e.count, extra: `${e.users} est.` }))}
              empty="Sin actividad en el periodo"
            />
            <RankList title="Versiones instaladas" rows={versionRows} empty="Sin instalaciones registradas" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border-border/70 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-headline text-muted-foreground">Últimas semanas</CardTitle>
              </CardHeader>
              <CardContent className="h-48">
                {data.weekly.length === 0 ? (
                  <p className="py-10 text-center text-xs text-muted-foreground">Sin semanas registradas todavía</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weekly.map((w) => ({ ...w, label: dayLabel(w.week_start) }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--foreground))" strokeDasharray="3 3" strokeOpacity={0.12} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="users" name="Estudiantes" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="sessions" name="Sesiones" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-headline text-muted-foreground">Estudio acumulado por estudiante</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SplitBar
                  segments={[
                    { id: 'none', label: 'Sin estudio', value: data.study_buckets.none, className: 'bg-muted-foreground/40' },
                    { id: 'lt1h', label: '< 1 h', value: data.study_buckets.lt1h, className: 'bg-primary/35' },
                    { id: 'h1_5', label: '1–5 h', value: data.study_buckets.h1_5, className: 'bg-primary/60' },
                    { id: 'h5_20', label: '5–20 h', value: data.study_buckets.h5_20, className: 'bg-primary/85' },
                    { id: 'h20', label: '20 h o más', value: data.study_buckets.h20, className: 'bg-primary' },
                  ]}
                />
                <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Desde el inicio</p>
                    <p className="font-semibold tabular-nums">{minutesLabel(t.study_minutes_all)}</p>
                    <p className="text-[11px] text-muted-foreground">{t.sessions_all} sesiones</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Informes</p>
                    <p className="font-semibold tabular-nums">{data.reports.reduce((acc, r) => acc + r.count, 0)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {data.reports.length > 0 ? data.reports.map((r) => `${r.count} ${r.format.toUpperCase()}`).join(' · ') : 'ninguno en el periodo'}
                    </p>
                  </div>
                </div>
                {guests && (guests.started_period > 0 || guests.guests_total > 0) && (
                  <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entraron como invitado</p>
                      <p className="font-semibold tabular-nums">{guests.started_period}</p>
                      <p className="text-[11px] text-muted-foreground">{guests.guests_active_7d} activos en 7 días</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vincularon Google</p>
                      <p className="font-semibold tabular-nums">{guests.linked_period}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {guests.started_period > 0 ? `${Math.round((guests.linked_period / guests.started_period) * 100)} % de los invitados` : 'en el periodo'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function UsagePage() {
  const { userProfile } = useCourse();
  if (!(isFrameOwner(userProfile) && isSupabaseConfigured)) return <Navigate to="/" replace />;
  return <UsagePanel />;
}
