import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useTodayKey } from '@/hooks/use-today';
import Image from '@/lib/image';
import { useRouter } from '@/lib/navigation';
import type { DailyPerformance, Task } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, Upload, Flame, AlertTriangle } from 'lucide-react';
import WeatherCard from '@/components/integrations/WeatherCard';
import { useCourse } from '@/context/CourseContext';
import {
  format,
  parseISO,
  subDays,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  isSameDay,
  differenceInCalendarDays,
  startOfToday,
  addDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { saveImage } from '@/lib/music-db';
import { useStoredImage } from '@/hooks/use-stored-image';
import { sessionSeconds } from '@/lib/duration';
import { GOAL_DAY_KEYS, gradeForScore } from '@/lib/academic-metrics';
import RecordingsSection from '@/components/recordings/RecordingsSection';
import InboxTasksSection from '@/components/tasks/InboxTasksSection';
import AcademicPulse from '@/components/dashboard/AcademicPulse';

// El radar usa la biblioteca de gráficos (la más pesada de la app) y está al
// final de Inicio: se carga aparte para que Inicio aparezca antes.
const CompetencyMatrix = lazy(() => import('@/components/dashboard/CompetencyMatrix'));

const formatTotalTime = (totalMinutes: number) => {
  if (totalMinutes === undefined || totalMinutes === null) return { hours: 0, minutes: 0 };
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  return { hours, minutes };
};

// Un solo criterio de nota en toda la app: aquí «A» empezaba en 15 y en
// Enfoque en 14, así que un 14,5 era A en una tarjeta y B en la de al lado.
const getGrade = gradeForScore;

/** Día LOCAL de un instante ISO. Cortar la cadena ('2026-09-16T01:00Z' → el 16)
 *  da el día en UTC: en Perú, lo estudiado de noche caía en el día siguiente. */
const localDayKey = (iso: string): string => {
  try {
    return format(parseISO(iso), 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

// ---------------------------------------------------------------------------
// Piezas del resumen "Rendimiento académico". Un solo molde para las cuatro
// casillas: mismo aire, mismo peso tipográfico y un tinte propio por dato.
// ---------------------------------------------------------------------------

const GRADE_TONE: Record<DailyPerformance['grade'], string> = {
  AD: 'bg-emerald-500/15 text-emerald-500',
  A: 'bg-primary/15 text-primary',
  B: 'bg-amber-500/15 text-amber-500',
  C: 'bg-red-500/15 text-red-400',
};

/** Color de la aguja del medidor, por grado. Mismo criterio que la insignia. */
const GRADE_HSL: Record<DailyPerformance['grade'], string> = {
  AD: 'hsl(160 84% 39%)',
  A: 'hsl(var(--primary))',
  B: 'hsl(38 92% 50%)',
  C: 'hsl(0 72% 60%)',
};

const GradeBadge = ({ grade }: { grade: DailyPerformance['grade'] | null }) => (
  <span
    className={cn(
      'rounded-md px-1.5 py-0.5 text-xs font-bold',
      grade ? GRADE_TONE[grade] : 'bg-secondary text-muted-foreground'
    )}
  >
    {grade ?? '—'}
  </span>
);

/**
 * Semicírculo graduado. Es la pieza que convierte "17.4" en algo que se lee de
 * un vistazo: la aguja recorre 180° y el color sigue al grado.
 */
const ArcGauge = ({
  value,
  max,
  label,
  sub,
  tone = 'hsl(var(--primary))',
}: {
  value: number;
  max: number;
  label: string;
  sub?: string;
  tone?: string;
}) => {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  // Arco de 180° con radio 34 sobre un lienzo de 80x46.
  const LENGTH = Math.PI * 34;
  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 80 46" className="h-[46px] w-20 overflow-visible">
        <path
          d="M6 40 A34 34 0 0 1 74 40"
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-secondary"
        />
        <path
          d="M6 40 A34 34 0 0 1 74 40"
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={tone}
          strokeDasharray={LENGTH}
          strokeDashoffset={LENGTH * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="-mt-4 flex flex-col items-center">
        <span className="font-headline text-2xl font-bold leading-none tabular-nums" style={{ color: tone }}>
          {label}
        </span>
        {sub && <span className="mt-0.5 text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
};

/**
 * Silueta de la semana: siete puntos unidos, con área rellena y el día de hoy
 * marcado. Muestra la TENDENCIA, que es lo que un promedio solo esconde.
 */
const Sparkline = ({ series, max }: { series: number[]; max: number }) => {
  const W = 100;
  const H = 30;
  const step = series.length > 1 ? W / (series.length - 1) : W;
  const y = (v: number) => H - 3 - (max > 0 ? Math.min(1, v / max) : 0) * (H - 7);
  const points = series.map((v, i) => `${i * step},${y(v)}`).join(' ');
  const hasData = series.some((v) => v > 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[30px] w-full overflow-visible" preserveAspectRatio="none">
      {hasData && (
        <>
          <polygon
            points={`0,${H} ${points} ${W},${H}`}
            fill="hsl(var(--primary))"
            fillOpacity={0.16}
          />
          <polyline
            points={points}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      {series.map((v, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={y(v)}
          r={i === series.length - 1 ? 2.4 : 1.4}
          fill={i === series.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary))'}
          fillOpacity={v > 0 ? 1 : 0.3}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
};

/** Anillo de cuenta atrás: cuanto menos queda, más lleno y más rojo. */
const CountdownRing = ({ days, urgent }: { days: number; urgent: boolean }) => {
  const HORIZON = 7; // más de una semana ya no aprieta
  const filled = 1 - Math.min(1, Math.max(0, days) / HORIZON);
  const C = 2 * Math.PI * 15.5;
  return (
    <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-secondary" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - filled)}
          className={cn(urgent ? 'stroke-red-400' : 'stroke-primary')}
          style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="relative text-center leading-none">
        <p
          className={cn(
            'font-headline text-lg font-bold tabular-nums',
            urgent ? 'text-red-400' : 'text-primary'
          )}
        >
          {days <= 0 ? '!' : days}
        </p>
        <p className="text-[8px] uppercase tracking-wide text-muted-foreground">
          {days <= 0 ? 'hoy' : days === 1 ? 'día' : 'días'}
        </p>
      </div>
    </div>
  );
};

const StatTile = ({
  icon: Icon,
  label,
  accent,
  interactive,
  children,
}: {
  icon: React.ElementType;
  label: string;
  /** Clase `from-*` del degradado de fondo: identifica el dato de un vistazo. */
  accent: string;
  interactive?: boolean;
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      'flex flex-1 flex-col gap-2 rounded-xl border border-border/60 bg-gradient-to-br to-transparent p-3.5 transition-all',
      accent,
      interactive && 'hover:border-primary/50 hover:shadow-[0_0_16px_hsl(var(--primary)/0.15)]'
    )}
  >
    <div className="flex items-center gap-2">
      <span className="rounded-md bg-background/60 p-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </span>
      <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
    </div>
    {children}
  </div>
);


export default function HomePage() {
  const todayKey = useTodayKey();
  const { tasks, courses, userProfile, dailyPerformances, studySessions, selectionMode, streakGoal, studyGoals } = useCourse();
  const router = useRouter();

  const [yesterdayPerformance, setYesterdayPerformance] = useState<DailyPerformance | null>(null);
  const [yesterdayStudyTime, setYesterdayStudyTime] = useState(0);
  const [weeklyStudyTime, setWeeklyStudyTime] = useState(0);
  const [weeklyAverageScore, setWeeklyAverageScore] = useState<number | null>(null);
  // Se relee sola: también cuando el horario llega de otro dispositivo.
  const [scheduleImage, setScheduleImage] = useStoredImage('scheduleImage');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [streak, setStreak] = useState(0);
  const [criticalTask, setCriticalTask] = useState<Task | null>(null);

  const studyHoursCardRef = useRef<HTMLDivElement>(null);
  const scheduleCardRef = useRef<HTMLDivElement>(null);
  const [scheduleHeight, setScheduleHeight] = useState<number | undefined>(undefined);
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayFormatted = format(yesterday, 'd MMM', { locale: es });
  
  const courseNameRef = useRef<HTMLParagraphElement>(null);
  const [showTaskName, setShowTaskName] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    if (criticalTask && courseNameRef.current) {
        const singleLineHeightThreshold = 28; 
        setShowTaskName(courseNameRef.current.offsetHeight <= singleLineHeightThreshold);
    }
  }, [criticalTask]);


  useEffect(() => {
    if (!userProfile) return;

    // --- Calculate and set performance data ---
    if (dailyPerformances && studySessions) {
      const now = new Date();

      // 1. Yesterday's data
      const yesterdayDate = subDays(now, 1);
      const yesterdayStr = format(yesterdayDate, 'yyyy-MM-dd');
      const yesterdayPerf = dailyPerformances.find(p => p.id === yesterdayStr) || null;
      setYesterdayPerformance(yesterdayPerf);

      const yesterdaySess = studySessions.filter(s => localDayKey(s.startTime) === yesterdayStr);
      const yesterdayTime = yesterdaySess.reduce((total, session) => total + session.duration, 0);
      setYesterdayStudyTime(yesterdayTime);

      // 2. Weekly data
      const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const endOfThisWeek = endOfWeek(now, { weekStartsOn: 1 });
      
      const weeklySess = studySessions.filter(s => {
          try {
              return isWithinInterval(parseISO(s.startTime), { start: startOfThisWeek, end: endOfThisWeek });
          } catch {
              return false;
          }
      });
      const weeklyTime = weeklySess.reduce((total, session) => total + session.duration, 0);
      setWeeklyStudyTime(weeklyTime);

      const weeklyPerformances = dailyPerformances.filter(p => {
        try {
          return isWithinInterval(parseISO(p.date), { start: startOfThisWeek, end: endOfThisWeek });
        } catch {
          return false;
        }
      });

      if (weeklyPerformances.length > 0) {
          const totalScore = weeklyPerformances.reduce((acc, p) => acc + p.score, 0);
          setWeeklyAverageScore(totalScore / weeklyPerformances.length);
      } else {
          setWeeklyAverageScore(null);
      }

      // 3. Streak
      if (streakGoal) {
          const perfMap = new Map(dailyPerformances.map(p => [p.date, p]));
          const sessionMap = new Map<string, number>();
          studySessions.forEach(session => {
              const dateStr = localDayKey(session.startTime);
              const currentMins = sessionMap.get(dateStr) || 0;
              sessionMap.set(dateStr, currentMins + session.duration);
          });
          
          const gradeValues: Record<string, number> = { 'C':0, 'B': 1, 'A': 2, 'AD': 3 };
          const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

          let currentStreak = 0;
          let dayToCheck = now;
          let isStreakGoing = true;

          for (let i = 0; i < 365 && isStreakGoing; i++) {
              const dateStr = format(dayToCheck, 'yyyy-MM-dd');
              let dayGoalMet = false;

              if (isSameDay(dayToCheck, now)) {
                  // --- Live calculation for today ---
                  if (streakGoal.mode === 'tiempo') {
                      const totalMinsToday = sessionMap.get(dateStr) || 0;
                      if (totalMinsToday >= streakGoal.minutes) {
                          dayGoalMet = true;
                      }
                  } else { // rendimiento mode
                      const todaysPerfSessions = studySessions.filter(s => localDayKey(s.startTime) === dateStr && s.mode === 'rendimiento');
                      if (todaysPerfSessions.length > 0) {
                          const totalMinutes = todaysPerfSessions.reduce((acc, s) => acc + s.duration, 0);
                          const totalPerception = todaysPerfSessions.reduce((acc, s) => acc + s.perception, 0);
                          const pAvg = totalPerception / todaysPerfSessions.length;
                          
                          const todayKey = dayKeys[dayToCheck.getDay()];
                          const tObj = studyGoals[todayKey] || 0;

                          if (tObj > 0) {
                              const rDiarioRaw = pAvg * (totalMinutes / tObj);
                              const rDiario = Math.min(20, rDiarioRaw);
                              const grade = getGrade(rDiario);
                              if (gradeValues[grade] >= gradeValues[streakGoal.grade]) {
                                  dayGoalMet = true;
                              }
                          }
                      }
                  }
              } else {
                  // --- Use stored data for past days ---
                  if (streakGoal.mode === 'tiempo') {
                      const totalMinsPastDay = sessionMap.get(dateStr) || 0;
                      if (totalMinsPastDay >= streakGoal.minutes) {
                          dayGoalMet = true;
                      }
                  } else { // rendimiento mode
                      const perf = perfMap.get(dateStr);
                      if (perf && gradeValues[perf.grade] >= gradeValues[streakGoal.grade]) {
                          dayGoalMet = true;
                      }
                  }
              }

              if (dayGoalMet) {
                  currentStreak++;
                  dayToCheck = subDays(dayToCheck, 1);
              } else if (isSameDay(dayToCheck, now)) {
                  // El día de hoy todavía está en juego: no cuenta, pero tampoco
                  // rompe. La racha se rompe por un día PASADO sin cumplir.
                  dayToCheck = subDays(dayToCheck, 1);
              } else {
                  isStreakGoing = false;
              }
          }
          setStreak(currentStreak);
      } else {
        setStreak(0);
      }
    } else {
      setYesterdayPerformance(null);
      setYesterdayStudyTime(0);
      setWeeklyStudyTime(0);
      setWeeklyAverageScore(null);
      setStreak(0);
    }

    // --- Fetch Critical Task from local data in CourseContext ---
    const findValidCriticalTask = () => {
      if (!tasks || tasks.length === 0 || !courses || courses.length === 0) {
        setCriticalTask(null);
        return;
      }

      const courseIds = new Set(courses.map(c => c.id));
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      const upcomingTasks = tasks
        .filter(t => {
          if (!t.dueDate || !courseIds.has(t.courseId) || (t.progress ?? 0) >= 100) return false;
          try {
            const taskDate = parseISO(t.dueDate);
            return taskDate >= today;
          } catch (e) {
            return false;
          }
        })
        .map(t => ({ ...t, date: parseISO(t.dueDate!) }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (upcomingTasks.length > 0) {
        setCriticalTask(upcomingTasks[0]);
      } else {
        setCriticalTask(null);
      }
    };
    
    findValidCriticalTask();
    // `todayKey`: «ayer», la semana y la racha se recalculan al cambiar de día.
  }, [userProfile, tasks, courses, dailyPerformances, studySessions, streakGoal, studyGoals, todayKey]);

   useEffect(() => {
    const studyCard = studyHoursCardRef.current;
    if (!studyCard) return;

    const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            setScheduleHeight(entry.contentRect.height);
        }
    });

    resizeObserver.observe(studyCard);
    
    setScheduleHeight(studyCard.offsetHeight);

    return () => resizeObserver.disconnect();
  }, []); 

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        try {
          setScheduleImage(result);
          await saveImage('scheduleImage', result);
          // Enciende el vistazo del borde izquierdo: hasta ahora no había
          // ninguna imagen que enseñar y el vigilante estaba apagado.
          window.dispatchEvent(new Event('scheduleImageUpdated'));
        } catch (e: any) {
          console.error("Failed to save schedule image:", e);
          const isQuotaError = e.name === 'QuotaExceededError';
          toast({
            variant: "destructive",
            title: isQuotaError ? "Imagen Demasiado Grande" : "Error al Guardar",
            description: isQuotaError 
              ? "La imagen es demasiado grande. Por favor, elige un archivo más pequeño."
              : "Ocurrió un error inesperado al guardar la imagen.",
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCardClick = () => {
    fileInputRef.current?.click();
  };

  const weeklyScoreGrade = weeklyAverageScore ? getGrade(weeklyAverageScore) : null;
  const { hours: yesterdayHours, minutes: yesterdayMinutes } = formatTotalTime(yesterdayStudyTime);
  const { hours: weeklyHours, minutes: weeklyMinutes } = formatTotalTime(weeklyStudyTime);

  // Serie de los 7 días de la semana en curso para la silueta de tendencia:
  // nota diaria en modo rendimiento, minutos estudiados en modo tiempo.
  const weekSeries = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const scoreByDay = new Map((dailyPerformances ?? []).map((p) => [p.date, p.score]));
    const minutesByDay = new Map<string, number>();
    (studySessions ?? []).forEach((session) => {
      const key = localDayKey(session.startTime);
      minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + sessionSeconds(session) / 60);
    });

    return Array.from({ length: 7 }, (_, index) => {
      const key = format(addDays(monday, index), 'yyyy-MM-dd');
      return selectionMode === 'rendimiento'
        ? (scoreByDay.get(key) ?? 0)
        : (minutesByDay.get(key) ?? 0);
    });
  }, [dailyPerformances, studySessions, selectionMode]);

  const seriesMax = selectionMode === 'rendimiento' ? 20 : Math.max(60, ...weekSeries);

  // Meta de AYER (la casilla habla de ayer, no de hoy): referencia del medidor
  // cuando el usuario trabaja en modo "tiempo" y no hay nota que mostrar.
  const dailyGoalMinutes = studyGoals?.[GOAL_DAY_KEYS[subDays(new Date(), 1).getDay()]] ?? 0;

  // Cuenta atrás de la tarea crítica: "hoy" / "mañana" / "en N días".
  const criticalTaskCountdown = (() => {
    if (!criticalTask?.dueDate) return null;
    try {
      const days = differenceInCalendarDays(parseISO(criticalTask.dueDate), startOfToday());
      if (days < 0) return { days: 0, label: 'vencida', urgent: true };
      if (days === 0) return { days: 0, label: 'vence hoy', urgent: true };
      if (days === 1) return { days: 1, label: 'vence mañana', urgent: true };
      return { days, label: `en ${days} días`, urgent: days <= 3 };
    } catch {
      return null;
    }
  })();


  return (
    <div className="space-y-6 p-6 md:p-8">
       <div data-tour="clima"><WeatherCard /></div>
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6">
             <div 
                className="h-full flex items-center justify-center cursor-pointer transition-colors bg-transparent"
                onClick={handleCardClick}
                ref={scheduleCardRef}
                data-tour="horario"
              >
              <div className="p-0 pt-0 text-center w-full h-full">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                  accept="image/*"
                />
                <div 
                  className="relative flex items-center justify-center w-full overflow-hidden"
                  style={{ height: scheduleHeight ? `${scheduleHeight}px` : 'auto', minHeight: '280px' }}
                >
                  {scheduleImage ? (
                      <Image src={scheduleImage} alt="Horario" layout="fill" objectFit="contain" />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground h-full">
                      <Upload className="h-10 w-10" />
                      <h3 className="font-semibold text-lg">Mi horario</h3>
                      <p className="text-xs">
                        Haz clic para subir una imagen de tu horario.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div ref={studyHoursCardRef} className="lg:col-span-6" data-tour="rendimiento">
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-lg font-headline text-center">Rendimiento académico</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4">
                      <StatTile
                        icon={Clock}
                        label={`Ayer, ${yesterdayFormatted}`}
                        accent="from-primary/15"
                      >
                        {/* Aguja sobre 20 (o sobre la meta diaria en modo
                            tiempo): el número solo no dice si 14 es mucho. */}
                        <div className="flex items-center justify-between gap-2">
                          {selectionMode === 'rendimiento' ? (
                            <ArcGauge
                              value={yesterdayPerformance?.score ?? 0}
                              max={20}
                              label={yesterdayPerformance ? yesterdayPerformance.score.toFixed(1) : '0.0'}
                              sub="de 20"
                              tone={GRADE_HSL[yesterdayPerformance?.grade ?? 'C']}
                            />
                          ) : (
                            <ArcGauge
                              value={yesterdayStudyTime}
                              max={Math.max(60, dailyGoalMinutes)}
                              label={`${yesterdayHours}h`}
                              sub={`${yesterdayMinutes}m`}
                            />
                          )}
                          <div className="flex flex-col items-end gap-1.5">
                            {selectionMode === 'rendimiento' && (
                              <GradeBadge grade={yesterdayPerformance?.grade ?? null} />
                            )}
                            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                              {yesterdayHours}h {yesterdayMinutes}m
                            </span>
                            <span className="text-[10px] text-muted-foreground">estudiados</span>
                          </div>
                        </div>
                      </StatTile>

                      <StatTile
                        icon={Calendar}
                        label="Promedio semanal"
                        accent="from-chart-2/20"
                      >
                        {/* Silueta de los 7 días: la tendencia importa más que
                            el promedio, que oculta si vas subiendo o cayendo. */}
                        <div className="flex items-end justify-between gap-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-headline text-3xl font-bold text-primary tabular-nums">
                              {selectionMode === 'rendimiento'
                                ? (weeklyAverageScore ? weeklyAverageScore.toFixed(1) : '0.0')
                                : `${weeklyHours}h`}
                            </span>
                            {selectionMode === 'rendimiento' ? (
                              <GradeBadge grade={weeklyScoreGrade} />
                            ) : (
                              <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                                {weeklyMinutes}m
                              </span>
                            )}
                          </div>
                          <span className="pb-1 text-[10px] text-muted-foreground">
                            {selectionMode === 'rendimiento' ? 'media · L a D' : 'esta semana'}
                          </span>
                        </div>
                        <Sparkline series={weekSeries} max={seriesMax} />
                        <div className="flex justify-between px-0.5 text-[9px] font-semibold text-muted-foreground">
                          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                            <span key={day}>{day}</span>
                          ))}
                        </div>
                      </StatTile>
                    </div>

                    <div className="flex flex-col gap-4">
                      <StatTile icon={Flame} label="Días de racha" accent="from-orange-500/20">
                        {/* La llama crece con la racha y el anillo mide cuánto
                            falta para el siguiente hito de 7 días. */}
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center">
                            <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
                              <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-secondary" />
                              <circle
                                cx="18"
                                cy="18"
                                r="15.5"
                                fill="none"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 15.5}
                                strokeDashoffset={2 * Math.PI * 15.5 * (1 - (streak % 7) / 7)}
                                className="stroke-orange-400"
                                style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)' }}
                              />
                            </svg>
                            <Flame
                              className={cn(
                                'relative text-orange-400 transition-all duration-500',
                                streak === 0 ? 'h-5 w-5 opacity-40' : streak < 7 ? 'h-6 w-6' : 'h-7 w-7 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]'
                              )}
                              fill={streak >= 7 ? 'currentColor' : 'none'}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-headline text-3xl font-bold leading-none text-primary tabular-nums">
                              {streak}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {streak === 0
                                ? 'empieza hoy'
                                : streak === 1
                                  ? 'día seguido'
                                  : 'días seguidos'}
                            </p>
                            {streak > 0 && (
                              <p className="text-[10px] text-orange-400">
                                {7 - (streak % 7) === 7
                                  ? '¡semana completa!'
                                  : `${7 - (streak % 7)} para la semana`}
                              </p>
                            )}
                          </div>
                        </div>
                      </StatTile>

                      {criticalTask ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <div className="flex-1 cursor-pointer">
                                <StatTile
                                  icon={AlertTriangle}
                                  label="Próxima tarea"
                                  accent="from-amber-500/20"
                                  interactive
                                >
                                  {/* Anillo de cuenta atrás: se llena y se pone
                                      rojo a medida que la entrega se acerca. */}
                                  <div className="flex items-center gap-3">
                                    <CountdownRing
                                      days={criticalTaskCountdown?.days ?? 7}
                                      urgent={Boolean(criticalTaskCountdown?.urgent)}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p ref={courseNameRef} className="truncate font-headline text-base font-bold text-primary">
                                        {criticalTask.courseName}
                                      </p>
                                      {showTaskName && (
                                        <p className="truncate text-xs text-muted-foreground">{criticalTask.name}</p>
                                      )}
                                      {criticalTaskCountdown && (
                                        <span className={cn(
                                          'mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                          criticalTaskCountdown.urgent
                                            ? 'bg-red-500/15 text-red-400'
                                            : 'bg-primary/15 text-primary'
                                        )}>
                                          {criticalTaskCountdown.label}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </StatTile>
                              </div>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle className="text-primary text-xl font-bold text-center">Interfaz</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-2 gap-4 pt-4">
                                    <Button
                                      className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary"
                                      onClick={() => router.push(`/tareas?highlightTaskId=${criticalTask.id}`, { scroll: false })}>
                                      Galería de tareas
                                    </Button>
                                    <Button
                                      className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary"
                                      onClick={() => router.push(`/cursos/?id=${criticalTask.courseId}&highlightTaskId=${criticalTask.id}`, { scroll: false })}>
                                      Ver asignatura
                                    </Button>
                                </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <StatTile icon={AlertTriangle} label="Próxima tarea" accent="from-amber-500/20">
                            <p className="font-headline text-lg font-bold text-primary">Todo en orden</p>
                            <p className="text-xs text-muted-foreground">No tienes tareas pendientes con fecha.</p>
                          </StatTile>
                        )}
                    </div>
                  </div>
                </CardContent>
            </Card>
          </div>
       </div>

      <div data-tour="semana-datos"><AcademicPulse /></div>

      <div data-tour="radar"><Suspense fallback={null}><CompetencyMatrix /></Suspense></div>

      {/* Tareas apuntadas sin asignatura desde el botón «+» de la barra. */}
      <div data-tour="sin-asignatura"><InboxTasksSection /></div>

      {/* Grabaciones de voz sin asignatura: al final de todo, con título centrado */}
      <div data-tour="grabaciones-inicio"><RecordingsSection variant="home" /></div>
    </div>
  );
}
