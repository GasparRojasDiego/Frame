import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Pencil, Target, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MarqueeText from '@/components/ui/marquee-text';
import { useRouter } from '@/lib/navigation';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import {
  COMPETENCY_MAX,
  COMPETENCY_RINGS,
  COMPETENCY_SEED_COURSES,
  MAX_COMPETENCY_COURSES,
  MIN_COMPETENCY_COURSES,
  averageLevel,
  buildCompetencyData,
  competencyGrade,
  competencyStorageKey,
  legacyCompetencyKeys,
  readCompetencySelection,
  type CompetencyVertex,
} from '@/lib/competency';
import CompetencyCoursesDialog from './CompetencyCoursesDialog';
import { CLOUD_APPLIED_EVENT } from '@/lib/supabase/sync';
import { tr } from '@/lib/i18n';

/** Rampa monocroma sobre el color primario, cortada por los umbrales del
 *  sistema peruano: aprobado holgado, aprobado justo y desaprobado. */
const levelTone = (level: number) =>
  level >= 14 ? 'bg-primary' : level >= 11 ? 'bg-primary/60' : 'bg-destructive/70';

const pluralPending = (pending: number) =>
  pending === 1 ? tr('1 tarea pendiente') : tr('{pending} tareas pendientes', { pending });

interface TooltipProps {
  active?: boolean;
  payload?: { payload: CompetencyVertex }[];
}

const CompetencyTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const vertex = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-semibold text-foreground">{vertex.name}</p>
      <p className="text-muted-foreground">
        {vertex.pending === 0 ? tr('Sin tareas pendientes') : pluralPending(vertex.pending)}
      </p>
      <p className="text-primary font-semibold tabular-nums">
        {tr('Dominio')}{' '}{vertex.level}/{COMPETENCY_MAX}{' '}
        <span className="text-[10px] font-bold">{competencyGrade(vertex.level)}</span>
      </p>
    </div>
  );
};

const GhostPolygon = () => (
  <svg viewBox="0 0 120 120" className="h-28 w-28 opacity-25" aria-hidden="true">
    <polygon
      points="60,8 110,44 91,104 29,104 10,44"
      fill="none"
      stroke="hsl(var(--border))"
      strokeWidth="2"
      strokeDasharray="4 4"
    />
    <polygon
      points="60,32 85,50 76,80 44,80 35,50"
      fill="none"
      stroke="hsl(var(--border))"
      strokeWidth="1.5"
    />
  </svg>
);

export default function CompetencyMatrix() {
  const { courses, tasks, userProfile } = useCourse();
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const adjustLevelsCardRef = useRef<HTMLDivElement>(null);
  const [syncedHeight, setSyncedHeight] = useState<number | undefined>(undefined);

  // Hidratación + retirada de los datos de la matriz MANUAL legada.
  useEffect(() => {
    if (!userProfile) {
      setHydrated(false);
      setSelectedIds([]);
      return;
    }
    legacyCompetencyKeys(userProfile.id).forEach((key) => localStorage.removeItem(key));
    const uid = userProfile.id;
    setSelectedIds(readCompetencySelection(uid) ?? []);
    setHydrated(true);
    // La selección viaja con la cuenta: lo que llega de otro dispositivo se ve
    // al instante (1.6.8; antes solo al volver a abrir Inicio).
    const reload = () => setSelectedIds(readCompetencySelection(uid) ?? []);
    window.addEventListener(CLOUD_APPLIED_EVENT, reload);
    return () => window.removeEventListener(CLOUD_APPLIED_EVENT, reload);
  }, [userProfile]);

  const persist = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      if (userProfile) {
        localStorage.setItem(competencyStorageKey(userProfile.id), JSON.stringify(ids));
      }
    },
    [userProfile]
  );

  // Siembra inicial: SOLO si la clave nunca existió. Un array vacío guardado es
  // una decisión explícita del usuario y debe respetarse entre recargas.
  useEffect(() => {
    if (!hydrated || !userProfile) return;
    if (readCompetencySelection(userProfile.id) !== null) return;
    if (courses.length < MIN_COMPETENCY_COURSES) return;
    persist(courses.slice(0, COMPETENCY_SEED_COURSES).map((c) => c.id));
  }, [hydrated, userProfile, courses, persist]);

  // Poda de asignaturas eliminadas. La guarda `courses.length === 0` es
  // imprescindible: el contexto carga los cursos en un efecto de montaje, así
  // que el primer render los ve vacíos y borraría la selección entera.
  useEffect(() => {
    if (!hydrated || !userProfile) return;
    if (selectedIds.length === 0 || courses.length === 0) return;
    const alive = new Set(courses.map((c) => c.id));
    const pruned = selectedIds.filter((id) => alive.has(id));
    if (pruned.length !== selectedIds.length) persist(pruned);
  }, [hydrated, userProfile, courses, selectedIds, persist]);

  // La Card del radar iguala la altura de "Nivel por asignatura".
  useEffect(() => {
    const adjustCard = adjustLevelsCardRef.current;
    if (!adjustCard) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) setSyncedHeight(entry.contentRect.height);
    });
    resizeObserver.observe(adjustCard);
    if (adjustCard.offsetHeight > 0) setSyncedHeight(adjustCard.offsetHeight);

    return () => resizeObserver.disconnect();
  }, []);

  const data = useMemo(
    () => buildCompetencyData(courses, tasks, selectedIds),
    [courses, tasks, selectedIds]
  );
  const average = useMemo(() => averageLevel(data), [data]);

  const hasEnough = data.length >= MIN_COMPETENCY_COURSES;
  const canConfigure = courses.length >= MIN_COMPETENCY_COURSES;
  const isComplete = hasEnough && data.every((v) => v.level === COMPETENCY_MAX);

  // Recharts entrega { x, y, textAnchor, index, payload: { value, coordinate } }.
  // Solo el nombre: el nivel se consulta pasando el cursor por el punto del
  // vértice, así el radar respira en lugar de arrastrar un contador por lado.
  const renderTick = useCallback((props: any) => {
    const { x, y, textAnchor, payload } = props;
    const angle = typeof payload?.coordinate === 'number' ? payload.coordinate : 90;
    const sin = Math.sin((angle * Math.PI) / 180);
    const dy = sin < -0.2 ? 12 : sin > 0.2 ? -2 : 4;
    const dx = textAnchor === 'start' ? 6 : textAnchor === 'end' ? -6 : 0;
    return (
      <text
        x={x + dx}
        y={y + dy}
        textAnchor={textAnchor}
        className="fill-foreground"
        fontSize={10}
      >
        {payload?.value}
      </text>
    );
  }, []);

  const handleSave = useCallback(
    (ids: string[]) => {
      // Orden canónico = orden de `courses` (creación) ⇒ vértices estables.
      const ordered = courses
        .filter((c) => ids.includes(c.id))
        .map((c) => c.id)
        .slice(0, MAX_COMPETENCY_COURSES);
      persist(ordered);
      setPickerOpen(false);
    },
    [courses, persist]
  );

  const emptyState = !canConfigure ? (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
      <Target className="h-9 w-9 opacity-60" />
      <p className="text-sm font-semibold text-foreground">{tr('Aún no hay asignaturas suficientes')}</p>
      <p className="text-xs max-w-[240px]">
        {tr('Crea al menos')}{' '}{MIN_COMPETENCY_COURSES}{' '}{tr('asignaturas para dibujar tu matriz de competencias.')}
      </p>
      <Button size="sm" className="mt-1" onClick={() => router.push('/cursos')}>
        {tr('Ir a Asignaturas')}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
      <Target className="h-9 w-9 opacity-60" />
      <p className="text-sm font-semibold text-foreground">{tr('Tu matriz está sin configurar')}</p>
      <p className="text-xs max-w-[240px]">
        {tr('Elige entre {min} y {max} asignaturas para dibujar tu radar.', { min: MIN_COMPETENCY_COURSES, max: MAX_COMPETENCY_COURSES })}
      </p>
      <Button size="sm" className="mt-1" onClick={() => setPickerOpen(true)}>
        {tr('Elegir asignaturas')}
      </Button>
    </div>
  );

  return (
    <>
      <h1 className="text-2xl font-bold text-primary font-headline pt-8 pb-4 text-center">
        {tr('Matriz de competencias')}
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card
            className="h-full min-h-[320px] flex flex-col"
            style={{ height: syncedHeight ? `${syncedHeight}px` : undefined }}
          >
            <CardContent className="flex-1 pt-6 pb-2 min-h-0">
              {hasEnough ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="68%" data={data}>
                    <PolarGrid
                      gridType="polygon"
                      stroke="hsl(var(--border))"
                      strokeOpacity={0.8}
                    />
                    <PolarAngleAxis dataKey="axisLabel" tick={renderTick} tickLine={false} />
                    {/* Escala [0,20] repartida en 6 marcas: el tick 0 colapsa
                        al centro ⇒ 5 anillos, uno cada 4 puntos. */}
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, COMPETENCY_MAX]}
                      tickCount={COMPETENCY_RINGS + 1}
                      tick={false}
                      axisLine={false}
                      stroke="hsl(var(--border))"
                    />
                    <Radar
                      name="Dominio"
                      dataKey="plotted"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      // Relleno PLANO: el degradado radial aclaraba el centro y
                      // parecía una mancha blanquecina. Un solo azul translúcido
                      // en toda la figura se lee mucho mejor.
                      fill="hsl(var(--primary))"
                      fillOpacity={0.18}
                      dot={{
                        r: 3,
                        fill: 'hsl(var(--primary))',
                        stroke: 'hsl(var(--background))',
                        strokeWidth: 1.5,
                      }}
                      activeDot={{
                        r: 6,
                        fill: 'hsl(var(--primary))',
                        stroke: 'hsl(var(--background))',
                        strokeWidth: 2,
                      }}
                      isAnimationActive
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                    <RechartsTooltip content={<CompetencyTooltip />} cursor={false} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <GhostPolygon />
                  <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                    {tr('Aquí aparecerá tu radar en cuanto la matriz tenga asignaturas.')}
                  </p>
                </div>
              )}
            </CardContent>
            {hasEnough && (
              <div className="flex items-center justify-center gap-2 pb-3 text-[11px] text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                {tr('Dominio actual · media')}{' '}
                <span className="font-semibold text-primary tabular-nums">
                  {average.toFixed(1)}
                </span>
                /{COMPETENCY_MAX}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card ref={adjustLevelsCardRef}>
            <CardHeader className="relative">
              <CardTitle className="text-lg font-headline text-center">{tr('Nivel por asignatura')}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => setPickerOpen(true)}
                disabled={!canConfigure}
                aria-label={tr('Elegir asignaturas de la matriz')}
                title={tr('Elegir asignaturas')}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {hasEnough ? (
                <>
                  {/* Una fila por asignatura: nombre a la izquierda (con
                      marquesina si no cabe) y barra de avance a la derecha,
                      todas del mismo ancho para que la columna quede a plomo. */}
                  <TooltipProvider delayDuration={200}>
                    <div className="space-y-2.5">
                      {data.map((vertex) => (
                        <div key={vertex.courseId} className="flex items-center gap-2.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Reparto fijo: ~22% para el nombre y el resto
                                  para la barra. La marquesina arranca en cuanto
                                  el nombre no cabe en ese 22%. */}
                              <div className="w-[22%] shrink-0 cursor-default">
                                <MarqueeText text={vertex.name} className="text-xs" align="left" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px]">
                              <p className="font-semibold">{vertex.name}</p>
                              <p className="text-muted-foreground">
                                {vertex.pending === 0
                                  ? tr('Al día · sin tareas pendientes')
                                  : pluralPending(vertex.pending)}
                              </p>
                            </TooltipContent>
                          </Tooltip>

                          {/* Barra CONTINUA: sin segmentos ni huecos. El nivel
                              se lee por cuánto avanza el relleno. */}
                          <div
                            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary"
                            aria-label={tr('Dominio {level} de {COMPETENCY_MAX}', { level: vertex.level, COMPETENCY_MAX })}
                          >
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                levelTone(vertex.level)
                              )}
                              style={{ width: `${(vertex.level / COMPETENCY_MAX) * 100}%` }}
                            />
                          </div>

                          <span className="w-8 shrink-0 rounded-md bg-primary/20 text-center text-xs font-semibold tabular-nums text-primary">
                            {vertex.level}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TooltipProvider>

                  <Separator className="!mt-6" />
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Trophy
                        className={cn('h-4 w-4', isComplete && 'text-primary')}
                      />
                      {isComplete ? tr('Matriz completa: todo al día') : tr('Dominio medio')}
                    </div>
                    <p className="font-headline text-2xl font-bold text-primary tabular-nums">
                      {average.toFixed(1)}
                      <span className="text-sm text-muted-foreground">/{COMPETENCY_MAX}</span>
                      <span className="ml-2 rounded-md bg-primary/20 px-1.5 py-0.5 text-xs font-bold">
                        {competencyGrade(average)}
                      </span>
                    </p>
                  </div>
                </>
              ) : (
                emptyState
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CompetencyCoursesDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedIds={selectedIds}
        onSave={handleSave}
      />
    </>
  );
}
