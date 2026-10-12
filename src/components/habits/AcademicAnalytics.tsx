import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfISOWeek,
  format,
  getISOWeek,
  isSameMonth,
  parseISO,
  startOfISOWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Gauge,
  ListChecks,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EchoTileHeader } from '@/components/shared/EchoWord';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/duration';
import {
  buildDayIndex,
  computeMetrics,
  dayKey,
  periodRange,
  PRIORITIES,
  shiftRange,
  UNASSIGNED_SUBJECT,
  type DayIndex,
  type MetricsOptions,
  type PeriodScope,
} from '@/lib/academic-metrics';

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const OTHER_SUBJECTS = 'Otras';
const HEAT_LEVELS = ['bg-muted', 'bg-primary/25', 'bg-primary/45', 'bg-primary/70', 'bg-primary'];
/** Columnas de la rejilla de cifras secundarias según cuántas hay (de 2 a 6):
 *  siempre filas completas. Clases escritas enteras para que Tailwind las vea. */
const SECONDARY_COLUMNS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-3',
};

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--background))',
  borderColor: 'hsl(var(--border))',
  borderRadius: 'var(--radius)',
  fontSize: 12,
} as const;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const chartColor = (i: number) => `hsl(var(--chart-${(i % 5) + 1}))`;

/** Top `limit` asignaturas por minutos + una serie agregada con el resto.
 *  `othersLabel` se desambigua si el usuario tiene una asignatura llamada "Otras". */
function groupTopSubjects(
  minutesBySubject: Record<string, number>,
  limit: number
): { items: { name: string; value: number }[]; othersLabel: string | null } {
  const sorted = Object.entries(minutesBySubject)
    .filter(([, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1]);
  const toItem = ([name, value]: [string, number]) => ({ name, value });
  if (sorted.length <= limit) return { items: sorted.map(toItem), othersLabel: null };
  const head = sorted.slice(0, limit);
  const othersLabel = head.some(([name]) => name === OTHER_SUBJECTS)
    ? 'Otras asignaturas'
    : OTHER_SUBJECTS;
  const rest = sorted.slice(limit).reduce((acc, [, minutes]) => acc + minutes, 0);
  return { items: [...head.map(toItem), { name: othersLabel, value: rest }], othersLabel };
}

function Delta({
  now,
  before,
  scopeLabel,
  formatValue,
}: {
  now: number;
  before: number;
  scopeLabel: string;
  formatValue?: (v: number) => string;
}) {
  const diff = now - before;
  if (before === 0 && now === 0) {
    return <span className="text-[11px] text-muted-foreground/70">Sin datos previos</span>;
  }
  if (Math.abs(diff) < 0.5) {
    return <span className="text-[11px] text-muted-foreground/70">Igual que {scopeLabel}</span>;
  }
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  const magnitude = formatValue ? formatValue(Math.abs(diff)) : String(Math.round(Math.abs(diff)));
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[11px] font-medium',
        diff > 0 ? 'text-green-500' : 'text-red-500'
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {diff > 0 ? '+' : '−'}
      {magnitude} vs. {scopeLabel}
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  children,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="bg-card/50">
      <CardContent className="flex h-full flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 shrink-0 text-primary/70" />
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        <div className="mt-auto pt-1">{children}</div>
      </CardContent>
    </Card>
  );
}

function MetricBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold text-foreground">{Math.round(clamped)}%</span>
      </div>
      <Progress value={clamped} className="h-1.5" />
      {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden bg-card/50', className)}>
      <CardContent className="p-4 pt-5">
        <EchoTileHeader word={title.split(' ')[0]} className="-mt-5 mb-4 pt-5 text-center">
          <h4 className="text-sm font-semibold text-primary">{title}</h4>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </EchoTileHeader>
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="flex h-[250px] flex-col items-center justify-center gap-1 text-center">
      <ChartColumn className="h-5 w-5 text-muted-foreground/50" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export default function AcademicAnalytics() {
  const { archivedTasks, studySessions, dailyPerformances, habits, studyGoals } = useCourse();
  const [scope, setScope] = useState<PeriodScope>('week');
  // 0 = periodo actual. Solo se navega hacia atrás: el futuro no tiene datos.
  const [offset, setOffset] = useState(0);

  const scopeLabel = scope === 'week' ? 'la semana anterior' : 'el mes anterior';

  const activeHabits = useMemo(() => habits.filter((h) => !h.isArchived), [habits]);

  // Una sola pasada sobre TODO el historial: se reutiliza para el periodo
  // actual, el anterior y la tendencia. No depende del periodo elegido.
  const dayIndex: DayIndex = useMemo(
    () => buildDayIndex(studySessions, archivedTasks, activeHabits),
    [studySessions, archivedTasks, activeHabits]
  );

  const { start, end } = useMemo(() => periodRange(scope, offset), [scope, offset]);

  const periodLabel = useMemo(() => {
    if (scope === 'month') return capitalize(format(start, 'MMMM yyyy', { locale: es }));
    const startMonth = format(start, 'MMMM', { locale: es });
    const endMonth = format(end, 'MMMM', { locale: es });
    const range =
      startMonth === endMonth
        ? `${format(start, 'd')} - ${format(end, 'd')} de ${startMonth}`
        : `${format(start, 'd')} de ${startMonth} - ${format(end, 'd')} de ${endMonth}`;
    return `Semana ${getISOWeek(start)} · ${range}`;
  }, [scope, start, end]);

  const options: MetricsOptions = useMemo(
    () => ({
      studyGoals,
      activeHabitCount: activeHabits.length,
      performances: dailyPerformances,
    }),
    [studyGoals, activeHabits.length, dailyPerformances]
  );

  const current = useMemo(
    () => computeMetrics(dayIndex, start, end, options),
    [dayIndex, start, end, options]
  );

  const previous = useMemo(() => {
    const range = shiftRange(scope, start, -1);
    return computeMetrics(dayIndex, range.start, range.end, options);
  }, [dayIndex, scope, start, options]);

  const periodDays = useMemo(() => eachDayOfInterval({ start, end }), [start, end]);

  const stacked = useMemo(() => groupTopSubjects(current.minutesBySubject, 4), [current.minutesBySubject]);
  const subjectKeys = useMemo(() => stacked.items.map((s) => s.name), [stacked]);

  const activityData = useMemo(() => {
    const buckets: { name: string; days: Date[] }[] =
      scope === 'week'
        ? periodDays.map((d) => ({ name: WEEKDAY_LABELS[(d.getDay() + 6) % 7], days: [d] }))
        : eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((w) => ({
            name: `S${getISOWeek(w)}`,
            days: eachDayOfInterval({ start: startOfISOWeek(w), end: endOfISOWeek(w) }).filter(
              (d) => d >= start && d <= end
            ),
          }));

    return buckets.map(({ name, days }) => {
      const row: Record<string, string | number> = { name, Tareas: 0 };
      for (const key of subjectKeys) row[key] = 0;
      for (const d of days) {
        const bucket = dayIndex.get(dayKey(d));
        if (!bucket) continue;
        row.Tareas = (row.Tareas as number) + bucket.tasksDone;
        for (const [subject, minutes] of Object.entries(bucket.minutesBySubject)) {
          const key = subjectKeys.includes(subject) ? subject : stacked.othersLabel;
          if (!key || row[key] === undefined) continue;
          row[key] = Math.round(((row[key] as number) + minutes) * 10) / 10;
        }
      }
      return row;
    });
  }, [scope, periodDays, start, end, subjectKeys, stacked.othersLabel, dayIndex]);

  const trendData = useMemo(() => {
    const count = scope === 'week' ? 8 : 6;
    return Array.from({ length: count }, (_, i) => {
      const range = shiftRange(scope, start, i - (count - 1));
      const metrics = computeMetrics(dayIndex, range.start, range.end, options);
      return {
        name:
          scope === 'week'
            ? `S${getISOWeek(range.start)}`
            : capitalize(format(range.start, 'MMM', { locale: es })),
        Horas: Math.round((metrics.minutes / 60) * 10) / 10,
        Efectividad: metrics.effectiveness,
      };
    });
  }, [scope, start, dayIndex, options]);

  const subjectSplit = useMemo(
    () =>
      // 4 + "Otras" = 5 sectores, uno por cada color de la paleta: con 5 el
      // sexto sector repetiría el color del primero.
      groupTopSubjects(current.minutesBySubject, 4)
        .items.map((s) => ({ name: s.name, value: Math.round(s.value) }))
        .filter((s) => s.value > 0),
    [current.minutesBySubject]
  );

  const heatmap = useMemo(() => {
    const days =
      scope === 'week'
        ? periodDays
        : eachDayOfInterval({ start: startOfISOWeek(start), end: endOfISOWeek(end) });
    const max = Math.max(1, ...days.map((d) => dayIndex.get(dayKey(d))?.minutes ?? 0));
    return days.map((date) => {
      const bucket = dayIndex.get(dayKey(date));
      const minutes = bucket?.minutes ?? 0;
      const level =
        minutes === 0
          ? 0
          : minutes <= max * 0.25
            ? 1
            : minutes <= max * 0.5
              ? 2
              : minutes <= max * 0.75
                ? 3
                : 4;
      return {
        date,
        minutes,
        level,
        tasksDone: bucket?.tasksDone ?? 0,
        inPeriod: scope === 'week' || isSameMonth(date, start),
      };
    });
  }, [scope, periodDays, start, end, dayIndex]);

  const secondaryMetrics = useMemo(() => {
    const items: { label: string; value: string; hint?: string }[] = [
      {
        label: 'Sesiones de estudio',
        value: String(current.sessions),
        hint:
          current.sessions > 0
            ? `Media de ${formatMinutes(current.avgSessionMinutes)} por sesión`
            : undefined,
      },
      {
        label: 'Días con meta cumplida',
        value: `${current.daysMeetingGoal}/${current.elapsedDays}`,
        hint: `Meta acumulada: ${formatMinutes(current.goalMinutes)}`,
      },
    ];
    if (current.avgPerception !== null) {
      items.push({
        label: 'Percepción media',
        value: `${current.avgPerception.toFixed(1)}/20`,
        hint: 'Cómo valoraste tus sesiones',
      });
    }
    if (current.bestDay) {
      items.push({
        label: 'Mejor día',
        value: capitalize(format(parseISO(current.bestDay.key), "EEE d 'de' MMM", { locale: es })),
        hint: formatMinutes(current.bestDay.minutes),
      });
    }
    if (current.tasksDone > 0) {
      items.push({
        label: 'Tiempo por tarea',
        value: formatMinutes(current.minutes / current.tasksDone),
        hint: 'Estudio del periodo entre tareas terminadas',
      });
    }
    if (current.tasksWithDue > 0) {
      items.push({
        label: 'Entregas a tiempo',
        value: `${current.tasksOnTime}/${current.tasksWithDue}`,
        hint: 'Tareas culminadas antes de su fecha límite',
      });
    }
    return items;
  }, [current]);

  const isEmpty = current.minutes === 0 && current.tasksDone === 0 && current.sessions === 0;

  return (
    <section className="space-y-6">
      <div className="relative flex items-center justify-center">
        <h3 className="text-xl font-semibold text-primary">Progreso académico</h3>
        <div className="absolute right-0">
          <Tabs
            value={scope}
            onValueChange={(value) => {
              setScope(value as PeriodScope);
              setOffset(0);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-foreground"
          onClick={() => setOffset((o) => o - 1)}
          title="Periodo anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <p className="whitespace-nowrap text-sm font-semibold text-primary">{periodLabel}</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-foreground"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          title="Periodo siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {isEmpty ? (
        <Card className="flex h-44 flex-col items-center justify-center gap-2 border-dashed bg-card/50">
          <ChartColumn className="h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Aún no hay actividad registrada en este periodo.
          </p>
          <p className="px-6 text-center text-xs text-muted-foreground/70">
            Estudia con el reloj de Estudio o culmina tareas y tus métricas aparecerán aquí.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              icon={ListChecks}
              label="Tareas culminadas"
              value={String(current.tasksDone)}
              hint={
                current.tasksWithDue > 0
                  ? `${current.tasksOnTime} de ${current.tasksWithDue} a tiempo`
                  : 'Sin fechas límite registradas'
              }
            >
              <Delta now={current.tasksDone} before={previous.tasksDone} scopeLabel={scopeLabel} />
            </KpiCard>

            <KpiCard
              icon={Clock}
              label="Tiempo de estudio"
              value={formatMinutes(current.minutes)}
              hint={`Meta del periodo: ${formatMinutes(current.goalMinutes)}`}
            >
              <Delta
                now={current.minutes}
                before={previous.minutes}
                scopeLabel={scopeLabel}
                formatValue={formatMinutes}
              />
            </KpiCard>

            <KpiCard
              icon={Gauge}
              label="Efectividad"
              value={`${current.effectiveness}%`}
              hint={`Meta cumplida al ${current.goalCompliance}%`}
            >
              <Delta
                now={current.effectiveness}
                before={previous.effectiveness}
                scopeLabel={scopeLabel}
                formatValue={(v) => `${Math.round(v)}%`}
              />
            </KpiCard>

            <KpiCard
              icon={Flame}
              label="Constancia"
              value={`${current.activeDays}/${current.totalDays}`}
              hint="Días con estudio registrado"
            >
              <Delta now={current.activeDays} before={previous.activeDays} scopeLabel={scopeLabel} />
            </KpiCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard
              title="Actividad del periodo"
              subtitle="Minutos de estudio por asignatura y tareas terminadas"
              className="lg:col-span-2"
            >
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={activityData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid stroke="hsl(var(--foreground))" strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--foreground))' }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="hsl(var(--foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${Math.round(v)}m`)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--primary))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'hsl(var(--accent))', radius: 4 }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, name: string) =>
                      name === 'Tareas' ? [value, name] : [formatMinutes(value), name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {subjectKeys.map((key, i) => (
                    <Bar
                      key={key}
                      yAxisId="left"
                      dataKey={key}
                      stackId="minutos"
                      fill={chartColor(i)}
                      radius={i === subjectKeys.length - 1 ? [4, 4, 0, 0] : undefined}
                      maxBarSize={scope === 'month' ? 44 : 36}
                    />
                  ))}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Tareas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              {subjectKeys.includes(UNASSIGNED_SUBJECT) && (
                <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
                  Las sesiones sin asignatura elegida se agrupan como «{UNASSIGNED_SUBJECT}».
                </p>
              )}
            </SectionCard>

            <SectionCard title="Efectividad" subtitle="Meta, puntualidad y constancia combinadas">
              <div className="relative">
                <ResponsiveContainer width="100%" height={190}>
                  {/* El barrido lo escala PolarAngleAxis (dominio 0-100): el arco
                      del gráfico debe ser SIEMPRE la circunferencia completa. */}
                  <RadialBarChart
                    innerRadius="74%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    data={[{ name: 'Efectividad', value: current.effectiveness }]}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar
                      dataKey="value"
                      cornerRadius={999}
                      fill="hsl(var(--primary))"
                      background={{ fill: 'hsl(var(--muted))' }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-4xl font-bold text-primary">{current.effectiveness}%</p>
                  <p className="text-[11px] text-muted-foreground">efectividad</p>
                </div>
              </div>
              <div className="space-y-3 px-1 pb-1 pt-2">
                <MetricBar
                  label="Meta de estudio"
                  value={current.goalCompliance}
                  hint={`${formatMinutes(current.minutes)} de ${formatMinutes(current.goalMinutes)}`}
                />
                {current.punctuality !== null && (
                  <MetricBar
                    label="Puntualidad"
                    value={current.punctuality}
                    hint={`${current.tasksOnTime} de ${current.tasksWithDue} tareas a tiempo`}
                  />
                )}
                {current.habitConsistency !== null && (
                  <MetricBar
                    label="Constancia de hábitos"
                    value={current.habitConsistency}
                    hint={`${activeHabits.length} ${activeHabits.length === 1 ? 'hábito activo' : 'hábitos activos'}`}
                  />
                )}
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard
              title="Tendencia"
              subtitle={scope === 'week' ? 'Últimas 8 semanas' : 'Últimos 6 meses'}
              className="lg:col-span-2"
            >
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid stroke="hsl(var(--foreground))" strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--foreground))' }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="hsl(var(--foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v}h`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    stroke="hsl(var(--primary))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    cursor={{ stroke: 'hsl(var(--border))' }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, name: string) =>
                      name === 'Horas' ? [`${value} h`, name] : [`${value}%`, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="Horas"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Efectividad"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="Reparto por asignatura" subtitle="Minutos de estudio del periodo">
              {subjectSplit.length === 0 ? (
                <EmptyBox message="Sin sesiones de estudio en el periodo." />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={subjectSplit}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="86%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {subjectSplit.map((entry, i) => (
                        <Cell key={entry.name} fill={chartColor(i)} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => formatMinutes(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Mapa de constancia"
            subtitle="Intensidad de estudio de cada día del periodo"
          >
            <TooltipProvider delayDuration={200}>
              <div className="mx-auto max-w-xl space-y-2">
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAY_LABELS.map((d) => (
                    <p key={d} className="text-center text-[10px] font-semibold text-muted-foreground">
                      {d}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {heatmap.map((cell) => (
                    <Tooltip key={cell.date.toISOString()}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'aspect-square rounded-sm transition-colors',
                            HEAT_LEVELS[cell.level],
                            !cell.inPeriod && 'opacity-30'
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs font-semibold capitalize">
                          {format(cell.date, "EEEE d 'de' MMMM", { locale: es })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMinutes(cell.minutes)} de estudio ·{' '}
                          {cell.tasksDone === 1 ? '1 tarea' : `${cell.tasksDone} tareas`}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <span className="text-[10px] text-muted-foreground">Menos</span>
                  {HEAT_LEVELS.map((level) => (
                    <div key={level} className={cn('h-2.5 w-2.5 rounded-sm', level)} />
                  ))}
                  <span className="text-[10px] text-muted-foreground">Más</span>
                </div>
              </div>
            </TooltipProvider>
          </SectionCard>

          {/* Rejilla sin huecos: las columnas siguen al número de cifras que
              hay (cuatro en una fila; seis, en dos filas de tres). */}
          <div className={cn('grid grid-cols-2 gap-4', SECONDARY_COLUMNS[secondaryMetrics.length] ?? 'md:grid-cols-4')}>
            {secondaryMetrics.map((item) => (
              <Card key={item.label} className="bg-card/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{item.value}</p>
                  {item.hint && (
                    <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground/80">
                      {item.hint}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {current.tasksDone > 0 && (
            <Card className="bg-card/50">
              <CardContent className="flex flex-wrap items-center justify-center gap-3 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Target className="h-4 w-4 text-primary/70" />
                  Tareas culminadas por importancia
                </div>
                {PRIORITIES.map((priority) => (
                  <Badge key={priority} variant="secondary" className="gap-1.5">
                    {priority}
                    <span className="font-bold text-primary">{current.tasksByPriority[priority]}</span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
