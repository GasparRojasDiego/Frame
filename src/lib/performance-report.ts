// ============================================================
// Informe de rendimiento académico (diario, semanal, mensual o anual).
//
// Dos responsabilidades, ambas puras (sin React):
//   1. `buildReport`  — reúne y calcula todo el periodo a partir de los datos
//      que ya vive en la app.
//   2. `renderReportHtml` — lo maqueta como un documento imprimible.
//
// El HTML es AUTOCONTENIDO y usa solo tablas con celdas de color para los
// gráficos. No es una limitación estética sino de destino: el mismo documento
// tiene que salir bien impreso a PDF y abierto en Word, y Word no dibuja SVG
// incrustado de forma fiable. Una tabla con fondos de color, sí.
// ============================================================

import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfISOWeek,
  endOfMonth,
  endOfYear,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfISOWeek,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  ArchivedTask,
  Course,
  DailyPerformance,
  Space,
  StudyGoals,
  StudySession,
  Task,
} from '@/types';
import { sessionSeconds } from '@/lib/duration';
import type { DocBlock, DocModel, DocTone } from '@/lib/report-doc';

export type ReportScope = 'dia' | 'semana' | 'mes' | 'anio';

export const SCOPE_LABEL: Record<ReportScope, string> = {
  dia: 'Informe diario',
  semana: 'Informe semanal',
  mes: 'Informe mensual',
  anio: 'Informe anual',
};

/** getDay() (0 = domingo) → clave de StudyGoals. */
const GOAL_KEYS: (keyof StudyGoals)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

const UNASSIGNED = 'Sin asignatura';
const LOOSE_SPACE = 'Sin colección';

/** Rango del periodo: del primer día al último, ambos incluidos. */
export function reportRange(scope: ReportScope, reference: Date): { start: Date; end: Date } {
  if (scope === 'dia') return { start: startOfDay(reference), end: endOfDay(reference) };
  if (scope === 'semana') return { start: startOfISOWeek(reference), end: endOfISOWeek(reference) };
  if (scope === 'mes') return { start: startOfMonth(reference), end: endOfMonth(reference) };
  return { start: startOfYear(reference), end: endOfYear(reference) };
}

export function rangeLabel(scope: ReportScope, start: Date, end: Date): string {
  if (scope === 'dia') return format(start, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  if (scope === 'anio') return format(start, 'yyyy');
  if (scope === 'mes') return format(start, "MMMM 'de' yyyy", { locale: es });
  return `${format(start, "d 'de' MMMM", { locale: es })} — ${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
}

export interface ReportBar {
  label: string;
  minutes: number;
  /** Meta del día, si la había (solo en las series por día). */
  goal?: number;
}

export interface ReportRow {
  name: string;
  minutes: number;
  percent: number;
  sessions: number;
}

export interface ReportSessionRow {
  date: string;
  time: string;
  minutes: number;
  subjects: string;
  type: string;
  focus: number | null;
  /** Lo que el estudiante anotó al cerrar la sesión. */
  notes: string;
}

export interface ReportData {
  scope: ReportScope;
  periodLabel: string;
  generatedAt: string;
  studentName: string;

  totalMinutes: number;
  sessionCount: number;
  activeDays: number;
  periodDays: number;
  /** Media diaria contando SOLO los días con estudio. */
  averageActiveDay: number;
  goalMinutes: number;
  goalDaysMet: number;
  goalDaysSet: number;

  longest: { minutes: number; date: string; subjects: string } | null;
  bestDay: { label: string; minutes: number } | null;

  byPeriod: ReportBar[];
  bySubject: ReportRow[];
  bySpace: ReportRow[];

  tasksDone: number;
  tasksOnTime: number;
  tasksWithDeadline: number;
  tasksDoneByCourse: { name: string; count: number; minutes: number }[];

  pendingTotal: number;
  pendingByCourse: { name: string; count: number; overdue: number }[];
  pendingBySpace: { name: string; count: number }[];

  gradeAverage: number | null;
  gradeCounts: { AD: number; A: number; B: number; C: number };

  sessions: ReportSessionRow[];
  /** El detalle sesión a sesión se omite en el informe anual (sería ilegible). */
  sessionsOmitted: boolean;
}

interface BuildInput {
  scope: ReportScope;
  reference: Date;
  studentName: string;
  sessions: StudySession[];
  tasks: Task[];
  archivedTasks: ArchivedTask[];
  courses: Course[];
  spaces: Space[];
  performances: DailyPerformance[];
  studyGoals: StudyGoals;
}

const safeParse = (iso?: string | null): Date | null => {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

export function buildReport(input: BuildInput): ReportData {
  const { scope, reference, studentName } = input;
  const { start, end } = reportRange(scope, reference);
  /** Último día que cuenta para la meta: hoy, o el fin del periodo si ya pasó. */
  const todayEnd = endOfDay(new Date());
  const lastCountedDay = end < todayEnd ? end : todayEnd;
  const within = (d: Date) => isWithinInterval(d, { start, end });

  // ---------- Sesiones del periodo ----------
  const periodSessions = (input.sessions ?? []).filter((s) => {
    const d = safeParse(s.startTime);
    return d ? within(d) : false;
  });

  const minutesOf = (s: StudySession) => sessionSeconds(s) / 60;
  const totalMinutes = periodSessions.reduce((acc, s) => acc + minutesOf(s), 0);

  // ---------- Serie temporal ----------
  const dayMinutes = new Map<string, number>();
  for (const s of periodSessions) {
    const d = safeParse(s.startTime);
    if (!d) continue;
    const key = format(d, 'yyyy-MM-dd');
    dayMinutes.set(key, (dayMinutes.get(key) ?? 0) + minutesOf(s));
  }

  let byPeriod: ReportBar[];
  let goalMinutes = 0;
  let goalDaysMet = 0;
  let goalDaysSet = 0;

  if (scope === 'dia') {
    // Un solo día no tiene "serie de días": lo que informa es CUÁNDO se
    // estudió. Se reparte en tres franjas por el punto medio de cada sesión,
    // el mismo criterio que usa la tarjeta de Inicio.
    const franjas = [
      { label: 'Mañana (5–12 h)', minutes: 0 },
      { label: 'Tarde (12–19 h)', minutes: 0 },
      { label: 'Noche (19–5 h)', minutes: 0 },
    ];
    for (const session of periodSessions) {
      const endMs = safeParse(session.endTime)?.getTime() ?? safeParse(session.startTime)?.getTime();
      if (!endMs) continue;
      const seconds = sessionSeconds(session);
      const hour = new Date(endMs - (seconds * 1000) / 2).getHours();
      const index = hour >= 5 && hour < 12 ? 0 : hour >= 12 && hour < 19 ? 1 : 2;
      franjas[index].minutes += seconds / 60;
    }
    byPeriod = franjas;

    const goal = input.studyGoals?.[GOAL_KEYS[start.getDay()]] ?? 0;
    if (goal > 0) {
      goalMinutes = goal;
      goalDaysSet = 1;
      if (totalMinutes >= goal) goalDaysMet = 1;
    }
  } else if (scope === 'anio') {
    byPeriod = eachMonthOfInterval({ start, end }).map((month) => {
      const prefix = format(month, 'yyyy-MM');
      let minutes = 0;
      for (const [key, value] of dayMinutes) if (key.startsWith(prefix)) minutes += value;
      return { label: format(month, 'MMM', { locale: es }), minutes };
    });
    // La meta anual se suma día a día: cada día tiene la suya según el día de
    // la semana que le tocó.
    for (const day of eachDayOfInterval({ start, end })) {
      if (day > lastCountedDay) break; // los días que no han llegado no son meta incumplida
      const goal = input.studyGoals?.[GOAL_KEYS[day.getDay()]] ?? 0;
      if (goal <= 0) continue;
      goalMinutes += goal;
      goalDaysSet += 1;
      if ((dayMinutes.get(format(day, 'yyyy-MM-dd')) ?? 0) >= goal) goalDaysMet += 1;
    }
  } else {
    byPeriod = eachDayOfInterval({ start, end }).map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const goal = input.studyGoals?.[GOAL_KEYS[day.getDay()]] ?? 0;
      const minutes = dayMinutes.get(key) ?? 0;
      // Solo cuentan para la meta los días YA vividos: a mitad de semana, sumar
      // la meta del jueves al domingo hacía salir el cumplimiento por debajo
      // del real sin que el estudiante hubiera fallado nada. La barra del día
      // futuro se sigue dibujando, con su marca de meta.
      if (goal > 0 && day <= lastCountedDay) {
        goalMinutes += goal;
        goalDaysSet += 1;
        if (minutes >= goal) goalDaysMet += 1;
      }
      return {
        label:
          scope === 'semana'
            ? format(day, 'EEEE d', { locale: es })
            : format(day, 'd EEE', { locale: es }),
        minutes,
        goal,
      };
    });
  }

  const activeDays = [...dayMinutes.values()].filter((m) => m > 0).length;
  const periodDays = eachDayOfInterval({ start, end }).length;

  const bestDayEntry = [...dayMinutes.entries()].sort((a, b) => b[1] - a[1])[0];
  const bestDay = bestDayEntry
    ? {
        label: format(parseISO(`${bestDayEntry[0]}T00:00:00`), "EEEE d 'de' MMMM", { locale: es }),
        minutes: bestDayEntry[1],
      }
    : null;

  // ---------- Sesión más larga ----------
  const longestSession = [...periodSessions].sort((a, b) => minutesOf(b) - minutesOf(a))[0];
  const longest = longestSession
    ? {
        minutes: minutesOf(longestSession),
        date: format(parseISO(longestSession.startTime), "d 'de' MMMM", { locale: es }),
        subjects: longestSession.subjects?.join(', ') || UNASSIGNED,
      }
    : null;

  // ---------- Reparto por asignatura ----------
  // Una sesión puede declarar varias asignaturas: su tiempo se reparte a
  // partes iguales, la misma regla con la que Frame reparte el avance.
  const subjectMinutes = new Map<string, { minutes: number; sessions: number }>();
  for (const s of periodSessions) {
    const names = s.subjects?.length ? s.subjects : [UNASSIGNED];
    const share = minutesOf(s) / names.length;
    for (const name of names) {
      const entry = subjectMinutes.get(name) ?? { minutes: 0, sessions: 0 };
      entry.minutes += share;
      entry.sessions += 1;
      subjectMinutes.set(name, entry);
    }
  }
  const bySubject: ReportRow[] = [...subjectMinutes.entries()]
    .map(([name, v]) => ({
      name,
      minutes: v.minutes,
      sessions: v.sessions,
      percent: totalMinutes > 0 ? (v.minutes / totalMinutes) * 100 : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // ---------- Reparto por colección ----------
  const spaceOfCourseName = new Map<string, string>();
  for (const space of input.spaces ?? []) {
    for (const courseId of space.courseIds) {
      const course = (input.courses ?? []).find((c) => c.id === courseId);
      if (course) spaceOfCourseName.set(course.name, space.name);
    }
  }
  const spaceMinutes = new Map<string, { minutes: number; sessions: number }>();
  for (const row of bySubject) {
    const spaceName = spaceOfCourseName.get(row.name) ?? LOOSE_SPACE;
    const entry = spaceMinutes.get(spaceName) ?? { minutes: 0, sessions: 0 };
    entry.minutes += row.minutes;
    entry.sessions += row.sessions;
    spaceMinutes.set(spaceName, entry);
  }
  const bySpace: ReportRow[] = [...spaceMinutes.entries()]
    .map(([name, v]) => ({
      name,
      minutes: v.minutes,
      sessions: v.sessions,
      percent: totalMinutes > 0 ? (v.minutes / totalMinutes) * 100 : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // ---------- Tareas culminadas en el periodo ----------
  const minutesPerTask = new Map<string, number>();
  for (const s of periodSessions) {
    const ids = s.taskIds ?? [];
    if (ids.length === 0) continue;
    const share = minutesOf(s) / ids.length;
    for (const id of ids) minutesPerTask.set(id, (minutesPerTask.get(id) ?? 0) + share);
  }

  const doneInPeriod = (input.archivedTasks ?? []).filter((t) => {
    const d = safeParse(t.archivedAt);
    return d ? within(d) : false;
  });

  let tasksOnTime = 0;
  let tasksWithDeadline = 0;
  const doneByCourse = new Map<string, { count: number; minutes: number }>();
  for (const t of doneInPeriod) {
    const entry = doneByCourse.get(t.courseName) ?? { count: 0, minutes: 0 };
    entry.count += 1;
    entry.minutes += minutesPerTask.get(t.id) ?? 0;
    doneByCourse.set(t.courseName, entry);

    const due = safeParse(t.dueDate);
    const archived = safeParse(t.archivedAt);
    if (!due || !archived) continue;
    tasksWithDeadline += 1;
    // "A tiempo" = archivada el mismo día de la fecha límite o antes.
    if (format(archived, 'yyyy-MM-dd') <= format(due, 'yyyy-MM-dd')) tasksOnTime += 1;
  }

  // ---------- Pendientes (foto de HOY, no del periodo) ----------
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const pending = (input.tasks ?? []).filter((t) => (t.progress || 0) < 100);
  const pendingByCourseMap = new Map<string, { count: number; overdue: number }>();
  for (const t of pending) {
    const entry = pendingByCourseMap.get(t.courseName) ?? { count: 0, overdue: 0 };
    entry.count += 1;
    const due = safeParse(t.dueDate);
    if (due && format(due, 'yyyy-MM-dd') < todayStr) entry.overdue += 1;
    pendingByCourseMap.set(t.courseName, entry);
  }
  const pendingBySpaceMap = new Map<string, number>();
  for (const [courseName, v] of pendingByCourseMap) {
    const spaceName = spaceOfCourseName.get(courseName) ?? LOOSE_SPACE;
    pendingBySpaceMap.set(spaceName, (pendingBySpaceMap.get(spaceName) ?? 0) + v.count);
  }

  // ---------- Calificación diaria ----------
  const periodPerformances = (input.performances ?? []).filter((p) => {
    const d = safeParse(`${p.id}T00:00:00`);
    return d ? within(d) : false;
  });
  const gradeCounts = { AD: 0, A: 0, B: 0, C: 0 };
  for (const p of periodPerformances) {
    if (p.grade in gradeCounts) gradeCounts[p.grade] += 1;
  }
  const gradeAverage =
    periodPerformances.length > 0
      ? periodPerformances.reduce((acc, p) => acc + p.score, 0) / periodPerformances.length
      : null;

  // ---------- Detalle sesión a sesión ----------
  const sessionsOmitted = scope === 'anio';
  const sessions: ReportSessionRow[] = sessionsOmitted
    ? []
    : [...periodSessions]
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((s) => {
          const started = safeParse(s.startTime);
          const ended = safeParse(s.endTime) ?? started;
          // startTime y endTime guardan el instante de registro: el tramo real
          // se deduce restando la duración.
          const realStart = ended ? new Date(ended.getTime() - sessionSeconds(s) * 1000) : null;
          return {
            date: started ? format(started, 'dd/MM/yyyy') : '—',
            time:
              realStart && ended
                ? `${format(realStart, 'HH:mm')}–${format(ended, 'HH:mm')}`
                : '—',
            minutes: minutesOf(s),
            subjects: s.subjects?.join(', ') || UNASSIGNED,
            type: s.sessionType,
            focus: s.mode === 'rendimiento' ? s.perception : null,
            notes: s.notes?.trim() ?? '',
          };
        });

  return {
    scope,
    periodLabel: rangeLabel(scope, start, end),
    generatedAt: format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
    studentName,

    totalMinutes,
    sessionCount: periodSessions.length,
    activeDays,
    periodDays,
    averageActiveDay: activeDays > 0 ? totalMinutes / activeDays : 0,
    goalMinutes,
    goalDaysMet,
    goalDaysSet,

    longest,
    bestDay,

    byPeriod,
    bySubject,
    bySpace,

    tasksDone: doneInPeriod.length,
    tasksOnTime,
    tasksWithDeadline,
    tasksDoneByCourse: [...doneByCourse.entries()]
      .map(([name, v]) => ({ name, count: v.count, minutes: v.minutes }))
      .sort((a, b) => b.count - a.count),

    pendingTotal: pending.length,
    pendingByCourse: [...pendingByCourseMap.entries()]
      .map(([name, v]) => ({ name, count: v.count, overdue: v.overdue }))
      .sort((a, b) => b.count - a.count),
    pendingBySpace: [...pendingBySpaceMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),

    gradeAverage,
    gradeCounts,

    sessions,
    sessionsOmitted,
  };
}

// ------------------------------------------------------------
// Maquetación: de los datos al documento
//
// No hay HTML aquí. Este módulo produce un `DocModel` y el maquetador único
// (src/lib/report-doc.ts) lo convierte en PDF, DOCX o Markdown. Esa es la
// razón de que este informe, el de pendientes, el de hábitos y el general se
// vean como cuatro capítulos del mismo documento y no como cuatro plantillas.
// ------------------------------------------------------------

/** Horas y minutos, siempre con la misma forma: "3 h 05 min". */
export function hm(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const share = (value: number, total: number): number => (total > 0 ? (value / total) * 100 : 0);

/** Tonos de la rueda: hasta seis series distinguibles en la barra apilada. */
const WHEEL: DocTone[] = ['accent', 'ok', 'warn', 'danger', 'ink', 'muted'];

/**
 * La lectura del periodo en una frase. Un informe que solo enseña cifras
 * obliga al lector a sacar la conclusión; este la ofrece y deja las cifras
 * para comprobarla.
 */
function readPeriod(data: ReportData): string {
  if (data.sessionCount === 0 && data.tasksDone === 0) {
    return 'No hay actividad registrada en este periodo: ni sesiones de estudio ni tareas culminadas.';
  }
  const parts: string[] = [];
  parts.push(
    `Se registraron ${hm(data.totalMinutes)} de estudio en ${data.sessionCount} ${
      data.sessionCount === 1 ? 'sesión' : 'sesiones'
    }, repartidas en ${data.activeDays} de los ${data.periodDays} días del periodo`
  );
  if (data.goalMinutes > 0) {
    const ratio = Math.round(share(data.totalMinutes, data.goalMinutes));
    parts.push(
      ratio >= 100 ? `, por encima de la meta acumulada (${ratio} %)` : `, un ${ratio} % de la meta acumulada`
    );
  }
  parts.push('. ');
  if (data.bySubject.length > 0) {
    const first = data.bySubject[0];
    parts.push(
      `La asignatura con más tiempo fue ${first.name}, con ${hm(first.minutes)} (${Math.round(first.percent)} % del total)`
    );
    if (data.bySubject.length > 2) {
      const tail = data.bySubject[data.bySubject.length - 1];
      parts.push(`, y la que menos, ${tail.name}, con ${hm(tail.minutes)}`);
    }
    parts.push('. ');
  }
  if (data.tasksDone > 0) {
    parts.push(`Se culminaron ${data.tasksDone} ${data.tasksDone === 1 ? 'tarea' : 'tareas'}`);
    if (data.tasksWithDeadline > 0) {
      parts.push(
        `, ${data.tasksOnTime} de ellas dentro del plazo (${Math.round(share(data.tasksOnTime, data.tasksWithDeadline))} % de puntualidad)`
      );
    }
    parts.push('. ');
  }
  if (data.pendingTotal > 0) {
    parts.push(`Quedan ${data.pendingTotal} tareas pendientes al cierre del informe.`);
  }
  return parts.join('').replace(/\s+\./g, '.').trim();
}

/** Serie del periodo como barras, con la meta marcada sobre cada una. */
function rhythmBars(data: ReportData): DocBlock {
  const max = Math.max(1, ...data.byPeriod.map((b) => Math.max(b.minutes, b.goal ?? 0)));
  return {
    kind: 'bars',
    caption: data.scope === 'dia' ? 'Reparto por franja horaria' : 'Minutos por día frente a la meta',
    items: data.byPeriod.map((b) => ({
      label: capitalize(b.label),
      value: b.minutes > 0 ? hm(b.minutes) : '—',
      percent: share(b.minutes, max),
      target: b.goal && b.goal > 0 ? share(b.goal, max) : undefined,
      note: b.goal && b.goal > 0 ? `meta ${hm(b.goal)}` : undefined,
      tone: b.goal && b.goal > 0 && b.minutes >= b.goal ? ('ok' as DocTone) : ('accent' as DocTone),
    })),
    legend:
      data.scope === 'dia'
        ? undefined
        : 'La línea vertical sobre cada barra marca la meta de ese día; en verde, los días que la alcanzaron.',
  };
}

/** Composición del tiempo: las cinco asignaturas mayores y el resto agrupado. */
function subjectMix(data: ReportData): DocBlock | null {
  if (data.bySubject.length === 0) return null;
  const top = data.bySubject.slice(0, 5);
  const rest = data.bySubject.slice(5);
  const items = top.map((row, i) => ({
    label: row.name,
    percent: row.percent,
    value: `${Math.round(row.percent)} %`,
    tone: WHEEL[i % WHEEL.length],
  }));
  if (rest.length > 0) {
    const restPct = rest.reduce((sum, r) => sum + r.percent, 0);
    items.push({
      label: `Otras ${rest.length}`,
      percent: restPct,
      value: `${Math.round(restPct)} %`,
      tone: 'muted' as DocTone,
    });
  }
  return { kind: 'stacked', caption: 'Composición del tiempo de estudio', items };
}

/** Embudo de tareas: de las que existían a las entregadas dentro de plazo. */
function taskFunnel(data: ReportData): DocBlock | null {
  if (data.tasksDone === 0 && data.pendingTotal === 0) return null;
  const universe = Math.max(1, data.tasksDone + data.pendingTotal);
  return {
    kind: 'funnel',
    steps: [
      {
        label: 'Tareas del periodo',
        value: String(data.tasksDone + data.pendingTotal),
        percent: 100,
        note: 'culminadas y pendientes',
      },
      {
        label: 'Culminadas',
        value: String(data.tasksDone),
        percent: share(data.tasksDone, universe),
        note: `${Math.round(share(data.tasksDone, universe))} %`,
      },
      {
        label: 'Con fecha límite',
        value: String(data.tasksWithDeadline),
        percent: share(data.tasksWithDeadline, universe),
        note: `${Math.round(share(data.tasksWithDeadline, universe))} %`,
      },
      {
        label: 'Entregadas a tiempo',
        value: String(data.tasksOnTime),
        percent: share(data.tasksOnTime, universe),
        note: `${Math.round(share(data.tasksOnTime, universe))} %`,
      },
    ],
  };
}

export interface PerformanceDocOptions {
  /** En modo síntesis se omiten las tablas de detalle largas. */
  brief?: boolean;
  /** Numeración de sección de partida (el informe general encadena varias). */
  startIndex?: number;
  /** Sin portada: el informe general aporta la suya. */
  omitCover?: boolean;
}

/**
 * El informe de rendimiento como bloques.
 * Quien llama decide si los imprime, los guarda en Word o los encadena dentro
 * del informe general.
 */
export function performanceBlocks(data: ReportData, options: PerformanceDocOptions = {}): DocBlock[] {
  const brief = options.brief ?? false;
  let index = options.startIndex ?? 1;
  const num = () => String(index++).padStart(2, '0');
  const blocks: DocBlock[] = [];

  const goalNote =
    data.goalDaysSet > 0
      ? `${data.goalDaysMet} de ${data.goalDaysSet} días con meta cumplida`
      : 'sin metas configuradas';
  const punctuality =
    data.tasksWithDeadline > 0 ? `${Math.round(share(data.tasksOnTime, data.tasksWithDeadline))} %` : '—';

  // ---------- Panorama ----------
  blocks.push({ kind: 'section', index: num(), title: 'Panorama del periodo', note: capitalize(data.periodLabel) });
  blocks.push({
    kind: 'kpis',
    items: [
      { label: 'Tiempo de estudio', value: hm(data.totalMinutes), note: `${data.sessionCount} sesiones` },
      {
        label: 'Días con estudio',
        value: `${data.activeDays} / ${data.periodDays}`,
        note: `media de ${hm(data.averageActiveDay)} por día activo`,
      },
      {
        label: 'Tareas culminadas',
        value: String(data.tasksDone),
        note: `${data.tasksOnTime} a tiempo de ${data.tasksWithDeadline} con fecha`,
      },
      {
        label: 'Cumplimiento de meta',
        value: data.goalMinutes > 0 ? `${Math.round(share(data.totalMinutes, data.goalMinutes))} %` : '—',
        note: goalNote,
      },
      {
        label: 'Sesión más larga',
        value: data.longest ? hm(data.longest.minutes) : '—',
        note: data.longest ? `${data.longest.date} · ${data.longest.subjects}` : undefined,
      },
      { label: 'Mejor día', value: data.bestDay ? hm(data.bestDay.minutes) : '—', note: data.bestDay?.label },
      { label: 'Puntualidad', value: punctuality, note: 'entregas dentro de plazo' },
      {
        label: 'Calificación media',
        value: data.gradeAverage !== null ? `${data.gradeAverage.toFixed(1)} / 20` : '—',
        note:
          data.gradeAverage !== null
            ? `AD ${data.gradeCounts.AD} · A ${data.gradeCounts.A} · B ${data.gradeCounts.B} · C ${data.gradeCounts.C}`
            : 'sin registro de rendimiento',
      },
    ],
  });
  blocks.push({ kind: 'callout', title: 'Lectura del periodo', text: readPeriod(data) });

  // ---------- Ritmo ----------
  blocks.push({
    kind: 'section',
    index: num(),
    title: data.scope === 'dia' ? 'Distribución de la jornada' : 'Ritmo de estudio',
  });
  blocks.push(rhythmBars(data));

  // ---------- Asignaturas ----------
  if (data.bySubject.length > 0) {
    blocks.push({ kind: 'section', index: num(), title: 'Reparto por asignatura' });
    const mix = subjectMix(data);
    if (mix) blocks.push(mix);
    const maxSubject = Math.max(1, ...data.bySubject.map((r) => r.minutes));
    blocks.push({
      kind: 'bars',
      caption: 'Tiempo dedicado',
      items: data.bySubject.map((row) => ({
        label: row.name,
        value: hm(row.minutes),
        percent: share(row.minutes, maxSubject),
        note: `${row.sessions} ${row.sessions === 1 ? 'sesión' : 'sesiones'} · ${Math.round(row.percent)} % del total`,
      })),
    });
    if (data.bySpace.length > 0) {
      const maxSpace = Math.max(1, ...data.bySpace.map((r) => r.minutes));
      blocks.push({
        kind: 'bars',
        caption: 'Por colección',
        items: data.bySpace.map((row) => ({
          label: row.name,
          value: hm(row.minutes),
          percent: share(row.minutes, maxSpace),
          note: `${Math.round(row.percent)} %`,
          tone: 'ink' as DocTone,
        })),
      });
    }
  }

  // ---------- Tareas ----------
  blocks.push({ kind: 'section', index: num(), title: 'Tareas y entregas' });
  const funnel = taskFunnel(data);
  if (funnel) blocks.push(funnel);
  if (data.tasksDoneByCourse.length > 0) {
    blocks.push({
      kind: 'table',
      caption: 'Tareas culminadas por asignatura',
      head: ['Asignatura', 'Culminadas', 'Tiempo dedicado'],
      aligns: ['left', 'right', 'right'],
      weights: [56, 20, 24],
      rows: data.tasksDoneByCourse.map((row) => [
        { text: row.name },
        { text: String(row.count), bold: true },
        { text: row.minutes > 0 ? hm(row.minutes) : '—', tone: 'muted' as DocTone },
      ]),
    });
  }
  if (data.pendingByCourse.length > 0) {
    blocks.push({
      kind: 'table',
      caption: 'Pendientes al cierre',
      head: ['Asignatura', 'Pendientes', 'Vencidas'],
      aligns: ['left', 'right', 'right'],
      weights: [56, 22, 22],
      rows: data.pendingByCourse.map((row) => [
        { text: row.name },
        { text: String(row.count), bold: true },
        {
          text: row.overdue > 0 ? String(row.overdue) : '—',
          tone: (row.overdue > 0 ? 'danger' : 'muted') as DocTone,
          bold: row.overdue > 0,
        },
      ]),
    });
  }

  // ---------- Calificación ----------
  if (data.gradeAverage !== null) {
    blocks.push({ kind: 'section', index: num(), title: 'Calificación diaria' });
    const graded = Math.max(
      1,
      data.gradeCounts.AD + data.gradeCounts.A + data.gradeCounts.B + data.gradeCounts.C
    );
    blocks.push({
      kind: 'stacked',
      caption: 'Reparto de las calificaciones del periodo',
      items: [
        { label: 'AD', percent: share(data.gradeCounts.AD, graded), value: `${data.gradeCounts.AD} d.`, tone: 'ok' },
        { label: 'A', percent: share(data.gradeCounts.A, graded), value: `${data.gradeCounts.A} d.`, tone: 'accent' },
        { label: 'B', percent: share(data.gradeCounts.B, graded), value: `${data.gradeCounts.B} d.`, tone: 'warn' },
        { label: 'C', percent: share(data.gradeCounts.C, graded), value: `${data.gradeCounts.C} d.`, tone: 'danger' },
      ],
    });
    blocks.push({
      kind: 'paragraph',
      text: `La calificación diaria se calcula sobre 20 a partir de la valoración de enfoque de cada sesión y del tiempo frente a la meta del día. La media del periodo es ${data.gradeAverage.toFixed(1)} sobre ${graded} ${graded === 1 ? 'día calificado' : 'días calificados'}.`,
      tone: 'muted',
    });
  }

  // ---------- Detalle ----------
  if (!brief && data.sessions.length > 0 && !data.sessionsOmitted) {
    blocks.push({
      kind: 'section',
      index: num(),
      title: 'Detalle de las sesiones',
      note: `${data.sessions.length} registros`,
    });
    blocks.push({
      kind: 'table',
      head: ['Fecha', 'Horario', 'Duración', 'Asignaturas', 'Enfoque'],
      aligns: ['left', 'left', 'right', 'left', 'right'],
      weights: [14, 16, 13, 45, 12],
      rows: data.sessions.map((row) => [
        { text: row.date },
        { text: row.time, tone: 'muted' as DocTone },
        { text: hm(row.minutes), bold: true },
        { text: row.subjects, note: row.notes || undefined },
        { text: row.focus !== null ? `${row.focus}/20` : '—', tone: 'muted' as DocTone },
      ]),
    });
  } else if (data.sessionsOmitted && !brief) {
    blocks.push({
      kind: 'paragraph',
      text: 'El detalle sesión a sesión se omite en el informe anual: son cientos de registros y su sitio es el informe mensual.',
      tone: 'muted',
    });
  }

  return blocks;
}

/** Documento completo del informe de rendimiento, con portada y cierre. */
export function buildPerformanceDoc(data: ReportData, options: PerformanceDocOptions = {}): DocModel {
  const title = `${SCOPE_LABEL[data.scope]} · ${capitalize(data.periodLabel)}`;
  const blocks: DocBlock[] = [];

  if (!options.omitCover) {
    blocks.push({
      kind: 'cover',
      eyebrow: SCOPE_LABEL[data.scope],
      title: 'Informe de rendimiento académico',
      subtitle: capitalize(data.periodLabel),
      meta: [
        { label: 'Estudiante', value: data.studentName },
        { label: 'Periodo', value: capitalize(data.periodLabel) },
        { label: 'Generado', value: data.generatedAt },
        { label: 'Documento', value: 'Registro de estudio' },
      ],
      footnote:
        'Documento generado por Frame a partir del registro personal del estudiante. Las calificaciones y métricas que contiene son de autoseguimiento y no proceden de institución educativa alguna.',
    });
  }

  blocks.push(...performanceBlocks(data, options));
  blocks.push({
    kind: 'footer',
    text: `Frame · VT Asvent — ${title}. Generado el ${data.generatedAt}.`,
  });

  return { title, blocks };
}
