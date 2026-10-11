import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfISOWeek,
  endOfMonth,
  endOfYear,
  format,
  isAfter,
  parseISO,
  startOfDay,
  startOfISOWeek,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Habit } from '@/types';
import { isScheduledKey } from '@/lib/habit-schedule';
import type { DocBlock, DocHeatCell, DocModel, DocTone } from '@/lib/report-doc';

// ============================================================
// Informe de hábitos.
//
// Un tracker de hábitos guarda marcas; lo que hace falta saber es otra cosa:
// cuál se sostiene, cuál se abandonó hace tres semanas sin que nadie lo
// notara, y qué día de la semana es el que rompe siempre la racha. Este
// informe responde eso y deja las marcas como respaldo.
//
// Es puro (sin React) por dos razones: se usa desde el botón del Tracker y
// desde el informe general, y así ambos ven exactamente los mismos números.
// ============================================================

export type HabitScope = 'semana' | 'mes' | 'trimestre' | 'anio';

export const HABIT_SCOPE_LABEL: Record<HabitScope, string> = {
  semana: 'Informe semanal de hábitos',
  mes: 'Informe mensual de hábitos',
  trimestre: 'Informe trimestral de hábitos',
  anio: 'Informe anual de hábitos',
};

const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const dayKey = (date: Date): string => format(date, 'yyyy-MM-dd');

/** getDay(): 0 = domingo. En Frame la semana empieza en lunes. */
const isoIndex = (date: Date): number => (date.getDay() + 6) % 7;

export function habitRange(scope: HabitScope, reference: Date): { start: Date; end: Date } {
  if (scope === 'semana') return { start: startOfISOWeek(reference), end: endOfISOWeek(reference) };
  if (scope === 'mes') return { start: startOfMonth(reference), end: endOfMonth(reference) };
  if (scope === 'anio') return { start: startOfYear(reference), end: endOfYear(reference) };
  // Dos meses atrás + el mes en curso = tres. Restar 62 días desde el día 1
  // solo acertaba cuando los dos meses anteriores sumaban 62 (julio-agosto):
  // en diez de los doce meses el "trimestre" abarcaba cuatro.
  const start = startOfMonth(subMonths(reference, 2));
  return { start, end: endOfMonth(reference) };
}

export function habitRangeLabel(scope: HabitScope, start: Date, end: Date): string {
  if (scope === 'anio') return format(start, 'yyyy');
  if (scope === 'mes') return format(start, "MMMM 'de' yyyy", { locale: es });
  return `${format(start, "d 'de' MMMM", { locale: es })} — ${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
}

export interface HabitRow {
  name: string;
  archived: boolean;
  /** Marcas dentro del periodo. */
  done: number;
  possible: number;
  compliance: number;
  currentStreak: number;
  bestStreak: number;
  /** Día de la semana con más marcas (índice ISO) o null. */
  bestWeekday: number | null;
  worstWeekday: number | null;
  lastMark: string | null;
  daysSinceLastMark: number | null;
}

export interface HabitsReportData {
  scope: HabitScope;
  periodLabel: string;
  generatedAt: string;
  studentName: string;

  habitCount: number;
  periodDays: number;
  done: number;
  possible: number;
  compliance: number;
  activeDays: number;
  perfectDays: number;
  perfectStreakCurrent: number;
  perfectStreakBest: number;

  /** Mismo cálculo sobre el periodo inmediatamente anterior. */
  previous: { compliance: number; done: number; possible: number; activeDays: number; perfectDays: number };

  rows: HabitRow[];
  /** Cumplidos por día, en orden. */
  series: { date: Date; done: number }[];
  /** Cumplimiento por día de la semana, en orden ISO (lunes primero). */
  byWeekday: { label: string; done: number; possible: number; compliance: number }[];
  /** Marcas por mes (solo tiene sentido en trimestre y año). */
  byMonth: { label: string; done: number; possible: number; compliance: number }[];
}

interface BuildInput {
  scope: HabitScope;
  reference: Date;
  studentName: string;
  habits: Habit[];
  /** Incluye los archivados; por defecto se excluyen del cálculo. */
  includeArchived?: boolean;
}

function streaks(marks: Set<string>, today: Date): { current: number; best: number } {
  if (marks.size === 0) return { current: 0, best: 0 };

  let current = 0;
  let cursor = marks.has(dayKey(today)) ? today : subDays(today, 1);
  while (marks.has(dayKey(cursor))) {
    current += 1;
    cursor = subDays(cursor, 1);
  }

  const sorted = [...marks].sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of sorted) {
    const date = parseISO(`${key}T00:00:00`);
    if (previous && differenceInCalendarDays(date, previous) === 1) run += 1;
    else run = 1;
    if (run > best) best = run;
    previous = date;
  }
  return { current, best };
}

/**
 * Un hábito preparado para el informe: sus marcas como conjunto (consultar un
 * día es instantáneo; antes cada consulta recorría la lista entera, y el
 * informe anual hacía cientos de miles) y el día desde el que EXISTE.
 *
 * `since` importa: un hábito creado el día 20 no "falló" del 1 al 19. Dividir
 * sus marcas entre todos los días del periodo le daba un 35 % de cumplimiento
 * a un hábito cumplido a rajatabla desde que nació. Si el hábito guarda su
 * fecha de alta se usa esa; los anteriores a este cambio no la tienen, y su
 * primera marca es la mejor aproximación disponible.
 */
interface PreparedHabit {
  habit: Habit;
  marks: Set<string>;
  /** "yyyy-MM-dd" desde el que cuenta; '' = desde siempre (sin datos). */
  since: string;
}

function prepareHabit(habit: Habit): PreparedHabit {
  const marks = new Set(habit.completedOn ?? []);
  let since = '';
  if (habit.createdAt) {
    const created = parseISO(habit.createdAt);
    if (!Number.isNaN(created.getTime())) since = dayKey(created);
  }
  // Los hábitos creados en Frame antes de guardar la fecha de alta usaban la
  // marca de tiempo como orden: si sigue pareciendo una fecha, vale de alta.
  if (!since && typeof habit.order === 'number' && habit.order > 1_000_000_000_000) {
    since = dayKey(new Date(habit.order));
  }
  let first = '';
  for (const key of marks) if (!first || key < first) first = key;
  // Una marca anterior al alta manda: el usuario puede rellenar días pasados.
  if (first && (!since || first < since)) since = first;
  return { habit, marks, since };
}

/**
 * ¿Se esperaba este hábito ese día? Solo si ya existía y le tocaba (un
 * hábito de «solo los sábados» no se espera un martes). Una marca en un día
 * que no le tocaba cuenta igual: se hizo.
 */
const existsOn = (prepared: PreparedHabit, key: string): boolean =>
  (!prepared.since || key >= prepared.since) &&
  (isScheduledKey(prepared.habit, key) || prepared.marks.has(key));

function periodStats(prepared: PreparedHabit[], dayKeys: string[], days: Date[]) {
  let possible = 0;
  let done = 0;
  let activeDays = 0;
  let perfectDays = 0;
  const series: { date: Date; done: number }[] = [];

  dayKeys.forEach((key, index) => {
    let count = 0;
    let alive = 0;
    for (const item of prepared) {
      if (!existsOn(item, key)) continue;
      alive += 1;
      if (item.marks.has(key)) count += 1;
    }
    possible += alive;
    done += count;
    if (count > 0) activeDays += 1;
    if (alive > 0 && count === alive) perfectDays += 1;
    series.push({ date: days[index], done: count });
  });

  return {
    done,
    possible,
    compliance: possible > 0 ? (done / possible) * 100 : 0,
    activeDays,
    perfectDays,
    series,
  };
}

export function buildHabitsReport(input: BuildInput): HabitsReportData {
  const { start, end } = habitRange(input.scope, input.reference);
  const today = startOfDay(new Date());
  const habits = (input.habits ?? []).filter((h) => input.includeArchived || !h.isArchived);
  const prepared = habits.map(prepareHabit);

  // El periodo no se proyecta al futuro: contar días que aún no han ocurrido
  // hunde el cumplimiento del mes en curso sin que el usuario haya fallado.
  const lastDay = isAfter(end, today) ? today : end;
  const days = isAfter(start, lastDay) ? [] : eachDayOfInterval({ start, end: lastDay });
  // Las claves de día se calculan UNA vez: formatear la misma fecha dentro de
  // cada bucle era lo más caro del informe.
  const dayKeys = days.map(dayKey);

  const stats = periodStats(prepared, dayKeys, days);

  // Periodo anterior de la misma longitud, para la comparación.
  const span = Math.max(1, days.length);
  const previousEnd = subDays(start, 1);
  const previousStart = subDays(previousEnd, span - 1);
  const previousDays = eachDayOfInterval({ start: previousStart, end: previousEnd });
  const previous = periodStats(prepared, previousDays.map(dayKey), previousDays);

  const rows: HabitRow[] = prepared
    .map(({ habit, marks, since }) => {
      const weekday = Array.from({ length: 7 }, () => ({ done: 0, possible: 0 }));
      let possible = 0;
      let doneInPeriod = 0;
      dayKeys.forEach((key, index) => {
        if (since && key < since) return; // el hábito aún no existía
        possible += 1;
        const slot = weekday[isoIndex(days[index])];
        slot.possible += 1;
        if (marks.has(key)) {
          slot.done += 1;
          doneInPeriod += 1;
        }
      });
      const ranked = weekday
        .map((slot, i) => ({ i, ratio: slot.possible > 0 ? slot.done / slot.possible : -1 }))
        .filter((entry) => entry.ratio >= 0)
        .sort((a, b) => b.ratio - a.ratio);
      const streak = streaks(marks, today);
      const last = [...marks].sort().pop() ?? null;

      return {
        name: habit.name,
        archived: Boolean(habit.isArchived),
        done: doneInPeriod,
        possible,
        compliance: possible > 0 ? (doneInPeriod / possible) * 100 : 0,
        currentStreak: streak.current,
        bestStreak: streak.best,
        bestWeekday: ranked.length > 0 ? ranked[0].i : null,
        worstWeekday: ranked.length > 1 ? ranked[ranked.length - 1].i : null,
        lastMark: last,
        daysSinceLastMark: last ? differenceInCalendarDays(today, parseISO(`${last}T00:00:00`)) : null,
      };
    })
    .sort((a, b) => b.compliance - a.compliance || a.name.localeCompare(b.name, 'es'));

  // Cumplimiento por día de la semana y por mes, en UNA sola pasada.
  const weekdayTotals = Array.from({ length: 7 }, () => ({ done: 0, possible: 0 }));
  const monthMap = new Map<string, { done: number; possible: number }>();
  const perfectMarks = new Set<string>();
  dayKeys.forEach((key, index) => {
    let alive = 0;
    let count = 0;
    for (const item of prepared) {
      if (!existsOn(item, key)) continue;
      alive += 1;
      if (item.marks.has(key)) count += 1;
    }
    const slot = weekdayTotals[isoIndex(days[index])];
    slot.possible += alive;
    slot.done += count;

    const monthKey = key.slice(0, 7);
    const entry = monthMap.get(monthKey) ?? { done: 0, possible: 0 };
    entry.possible += alive;
    entry.done += count;
    monthMap.set(monthKey, entry);

    if (alive > 0 && count === alive) perfectMarks.add(key);
  });

  // La racha perfecta mira TODO el historial, no solo el periodo: una racha de
  // 40 días no debería reiniciarse porque el informe sea semanal.
  const allPerfect = new Set<string>();
  if (prepared.length > 0) {
    const universe = new Set<string>();
    for (const item of prepared) for (const key of item.marks) universe.add(key);
    for (const key of universe) {
      const alive = prepared.filter((item) => existsOn(item, key));
      if (alive.length > 0 && alive.every((item) => item.marks.has(key))) allPerfect.add(key);
    }
  }
  const perfectStreak = streaks(allPerfect, today);

  return {
    scope: input.scope,
    periodLabel: habitRangeLabel(input.scope, start, end),
    generatedAt: format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
    studentName: input.studentName,

    habitCount: habits.length,
    periodDays: days.length,
    done: stats.done,
    possible: stats.possible,
    compliance: stats.compliance,
    activeDays: stats.activeDays,
    perfectDays: stats.perfectDays,
    perfectStreakCurrent: perfectStreak.current,
    perfectStreakBest: perfectStreak.best,

    previous: {
      compliance: previous.compliance,
      done: previous.done,
      possible: previous.possible,
      activeDays: previous.activeDays,
      perfectDays: previous.perfectDays,
    },

    rows,
    series: stats.series,
    byWeekday: weekdayTotals.map((slot, i) => ({
      label: DAY_NAMES[i],
      done: slot.done,
      possible: slot.possible,
      compliance: slot.possible > 0 ? (slot.done / slot.possible) * 100 : 0,
    })),
    byMonth: [...monthMap.entries()]
      .sort()
      .map(([key, value]) => ({
        label: format(parseISO(`${key}-01T00:00:00`), 'MMMM', { locale: es }),
        done: value.done,
        possible: value.possible,
        compliance: value.possible > 0 ? (value.done / value.possible) * 100 : 0,
      })),
  };
}

// ------------------------------------------------------------
// Maquetación
// ------------------------------------------------------------

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const deltaOf = (now: number, before: number): { dir: 'up' | 'down' | 'flat'; text: string } => {
  const diff = now - before;
  if (Math.abs(diff) < 0.5) return { dir: 'flat', text: 'igual que el periodo anterior' };
  return {
    dir: diff > 0 ? 'up' : 'down',
    text: `${diff > 0 ? '+' : ''}${diff.toFixed(0)} pts frente al periodo anterior`,
  };
};

/** Cinco pasos de intensidad a partir del número de hábitos cumplidos. */
const levelOf = (done: number, total: number): DocHeatCell['level'] => {
  if (total <= 0 || done <= 0) return 0;
  const ratio = done / total;
  if (ratio >= 1) return 4;
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.34) return 2;
  return 1;
};

/** Mapa de constancia: una fila por semana, una columna por día. */
function heatBlock(data: HabitsReportData): DocBlock | null {
  if (data.series.length === 0) return null;

  const rows: { label: string; cells: DocHeatCell[] }[] = [];
  let week: DocHeatCell[] = [];
  let label = '';

  for (const point of data.series) {
    if (week.length === 0) label = format(point.date, 'd MMM', { locale: es });
    // Rellena el hueco del primer día si la semana no empieza en lunes.
    if (week.length === 0 && isoIndex(point.date) > 0) {
      for (let i = 0; i < isoIndex(point.date); i++) week.push({ level: 0 });
    }
    week.push({
      level: levelOf(point.done, data.habitCount),
      text: format(point.date, 'd'),
    });
    if (week.length === 7) {
      rows.push({ label, cells: week });
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push({ level: 0 });
    rows.push({ label, cells: week });
  }

  return {
    kind: 'heat',
    caption: 'Mapa de constancia',
    dayLabels: DAY_INITIALS,
    rows,
    legend: 'cada casilla es un día; cuanto más oscura, más hábitos cumplidos',
  };
}

function readHabits(data: HabitsReportData): string {
  if (data.habitCount === 0) {
    return 'No hay hábitos activos: el tracker está vacío y no hay nada que medir todavía.';
  }
  if (data.done === 0) {
    return `Hay ${data.habitCount} hábitos declarados pero ninguna marca en el periodo. El seguimiento está abierto y sin usar, que es la forma más silenciosa de abandonarlo.`;
  }

  const parts: string[] = [];
  parts.push(
    `Se cumplieron ${data.done} de ${data.possible} marcas posibles, un ${data.compliance.toFixed(0)} % de cumplimiento sobre ${data.periodDays} ${data.periodDays === 1 ? 'día' : 'días'}`
  );
  const diff = data.compliance - data.previous.compliance;
  if (Math.abs(diff) >= 1) {
    parts.push(
      `, ${Math.abs(diff).toFixed(0)} puntos ${diff > 0 ? 'por encima' : 'por debajo'} del periodo anterior`
    );
  }
  parts.push('. ');

  const best = data.rows[0];
  const worst = data.rows[data.rows.length - 1];
  if (best && worst && best.name !== worst.name) {
    parts.push(
      `El hábito más sostenido es ${best.name} (${best.compliance.toFixed(0)} %), y el que más cuesta, ${worst.name} (${worst.compliance.toFixed(0)} %). `
    );
  }

  const weekdays = data.byWeekday.filter((d) => d.possible > 0);
  if (weekdays.length > 1) {
    const ordered = [...weekdays].sort((a, b) => b.compliance - a.compliance);
    parts.push(
      `Por día de la semana, el mejor es el ${ordered[0].label} (${ordered[0].compliance.toFixed(0)} %) y el peor, el ${ordered[ordered.length - 1].label} (${ordered[ordered.length - 1].compliance.toFixed(0)} %). `
    );
  }

  const abandoned = data.rows.filter((row) => row.daysSinceLastMark !== null && row.daysSinceLastMark >= 7);
  if (abandoned.length > 0) {
    parts.push(
      `Atención: ${abandoned.length === 1 ? 'un hábito lleva' : `${abandoned.length} hábitos llevan`} más de una semana sin marcarse (${abandoned
        .map((row) => row.name)
        .join(', ')}).`
    );
  }

  return parts.join('').trim();
}

export interface HabitsDocOptions {
  brief?: boolean;
  startIndex?: number;
  omitCover?: boolean;
}

export function habitsBlocks(data: HabitsReportData, options: HabitsDocOptions = {}): DocBlock[] {
  const brief = options.brief ?? false;
  let index = options.startIndex ?? 1;
  const num = () => String(index++).padStart(2, '0');
  const blocks: DocBlock[] = [];

  // ---------- Panorama ----------
  blocks.push({ kind: 'section', index: num(), title: 'Cumplimiento del periodo', note: capitalize(data.periodLabel) });
  blocks.push({
    kind: 'kpis',
    items: [
      {
        label: 'Cumplimiento',
        value: `${data.compliance.toFixed(0)} %`,
        note: `${data.done} de ${data.possible} marcas`,
        delta: data.previous.possible === 0 ? undefined : deltaOf(data.compliance, data.previous.compliance),
      },
      {
        label: 'Días con actividad',
        value: `${data.activeDays} / ${data.periodDays}`,
        note: 'días con al menos una marca',
      },
      {
        label: 'Días perfectos',
        value: String(data.perfectDays),
        note: 'todos los hábitos cumplidos',
      },
      {
        label: 'Racha perfecta',
        value: `${data.perfectStreakCurrent} d.`,
        note: `máxima histórica: ${data.perfectStreakBest} días`,
      },
    ],
  });
  blocks.push({ kind: 'callout', title: 'Lectura del periodo', text: readHabits(data) });

  if (data.habitCount === 0) return blocks;

  // ---------- Embudo ----------
  blocks.push({ kind: 'section', index: num(), title: 'Del propósito al hecho' });
  blocks.push({
    kind: 'funnel',
    steps: [
      { label: 'Marcas posibles', value: String(data.possible), percent: 100, note: `${data.habitCount} hábitos × ${data.periodDays} días` },
      {
        label: 'Marcas cumplidas',
        value: String(data.done),
        percent: data.possible > 0 ? (data.done / data.possible) * 100 : 0,
        note: `${data.compliance.toFixed(0)} %`,
      },
      {
        label: 'Días con actividad',
        value: String(data.activeDays),
        percent: data.periodDays > 0 ? (data.activeDays / data.periodDays) * 100 : 0,
        note: `${data.periodDays > 0 ? Math.round((data.activeDays / data.periodDays) * 100) : 0} % de los días`,
      },
      {
        label: 'Días perfectos',
        value: String(data.perfectDays),
        percent: data.periodDays > 0 ? (data.perfectDays / data.periodDays) * 100 : 0,
        note: `${data.periodDays > 0 ? Math.round((data.perfectDays / data.periodDays) * 100) : 0} % de los días`,
      },
    ],
  });

  // ---------- Hábito a hábito ----------
  blocks.push({ kind: 'section', index: num(), title: 'Hábito por hábito' });
  blocks.push({
    kind: 'bars',
    caption: 'Cumplimiento individual',
    items: data.rows.map((row) => ({
      label: row.name,
      value: `${row.compliance.toFixed(0)} %`,
      percent: row.compliance,
      note: `${row.done} de ${row.possible} días${row.currentStreak > 0 ? ` · racha de ${row.currentStreak}` : ''}`,
      tone: (row.compliance >= 80 ? 'ok' : row.compliance >= 50 ? 'accent' : 'warn') as DocTone,
    })),
    legend: 'Verde por encima del 80 %, ámbar por debajo del 50 %.',
  });

  if (!brief) {
    blocks.push({
      kind: 'table',
      caption: 'Detalle por hábito',
      head: ['Hábito', 'Marcas', 'Cumplimiento', 'Racha', 'Máxima', 'Última marca'],
      aligns: ['left', 'right', 'right', 'right', 'right', 'left'],
      weights: [30, 12, 15, 11, 11, 21],
      rows: data.rows.map((row) => [
        { text: row.name, bold: true },
        { text: `${row.done}/${row.possible}` },
        {
          text: `${row.compliance.toFixed(0)} %`,
          tone: (row.compliance >= 80 ? 'ok' : row.compliance >= 50 ? 'ink' : 'warn') as DocTone,
          bold: true,
        },
        { text: row.currentStreak > 0 ? `${row.currentStreak} d.` : '—', tone: 'muted' as DocTone },
        { text: row.bestStreak > 0 ? `${row.bestStreak} d.` : '—', tone: 'muted' as DocTone },
        {
          text:
            row.lastMark === null
              ? 'nunca'
              : row.daysSinceLastMark === 0
                ? 'hoy'
                : row.daysSinceLastMark === 1
                  ? 'ayer'
                  : `hace ${row.daysSinceLastMark} días`,
          tone: (row.daysSinceLastMark !== null && row.daysSinceLastMark >= 7 ? 'danger' : 'muted') as DocTone,
          note: row.lastMark ? format(parseISO(`${row.lastMark}T00:00:00`), "d 'de' MMMM", { locale: es }) : undefined,
        },
      ]),
    });
  }

  // ---------- Semana tipo ----------
  const weekdays = data.byWeekday.filter((d) => d.possible > 0);
  if (weekdays.length > 0) {
    blocks.push({ kind: 'section', index: num(), title: 'Semana tipo' });
    const ordered = [...weekdays].sort((a, b) => b.compliance - a.compliance);
    const bestLabel = ordered[0]?.label;
    const worstLabel = ordered[ordered.length - 1]?.label;
    blocks.push({
      kind: 'bars',
      caption: 'Cumplimiento medio según el día de la semana',
      items: data.byWeekday.map((day) => ({
        label: capitalize(day.label),
        value: day.possible > 0 ? `${day.compliance.toFixed(0)} %` : '—',
        percent: day.compliance,
        note: `${day.done} de ${day.possible}`,
        tone: (day.label === bestLabel ? 'ok' : day.label === worstLabel ? 'warn' : 'accent') as DocTone,
      })),
      legend:
        bestLabel && worstLabel && bestLabel !== worstLabel
          ? `El mejor día es el ${bestLabel} y el que peor sale, el ${worstLabel}.`
          : undefined,
    });
  }

  // ---------- Constancia ----------
  const heat = heatBlock(data);
  if (heat) {
    blocks.push({ kind: 'section', index: num(), title: 'Constancia día a día' });
    blocks.push(heat);
  }

  // ---------- Evolución mensual ----------
  if (!brief && data.byMonth.length > 1) {
    blocks.push({ kind: 'section', index: num(), title: 'Evolución mes a mes' });
    blocks.push({
      kind: 'bars',
      caption: 'Cumplimiento por mes',
      items: data.byMonth.map((month) => ({
        label: capitalize(month.label),
        value: `${month.compliance.toFixed(0)} %`,
        percent: month.compliance,
        note: `${month.done} de ${month.possible}`,
      })),
    });
  }

  return blocks;
}

export function buildHabitsDoc(data: HabitsReportData, options: HabitsDocOptions = {}): DocModel {
  const title = `${HABIT_SCOPE_LABEL[data.scope]} · ${capitalize(data.periodLabel)}`;
  const blocks: DocBlock[] = [];

  if (!options.omitCover) {
    blocks.push({
      kind: 'cover',
      eyebrow: HABIT_SCOPE_LABEL[data.scope],
      title: 'Informe de hábitos',
      subtitle: capitalize(data.periodLabel),
      meta: [
        { label: 'Estudiante', value: data.studentName },
        { label: 'Periodo', value: capitalize(data.periodLabel) },
        { label: 'Hábitos activos', value: String(data.habitCount) },
        { label: 'Generado', value: data.generatedAt },
      ],
      footnote:
        'Documento generado por Frame a partir de las marcas registradas por el propio estudiante en su Registro de hábitos.',
    });
  }

  blocks.push(...habitsBlocks(data, options));
  blocks.push({ kind: 'footer', text: `Frame · VT Asvent — ${title}. Generado el ${data.generatedAt}.` });

  return { title, blocks };
}

/** Nombre de archivo del informe de hábitos. */
export function habitsReportFileBase(scope: HabitScope, start: Date): string {
  const stamp =
    scope === 'anio'
      ? format(start, 'yyyy')
      : scope === 'semana'
        ? format(start, "RRRR-'S'II")
        : format(start, 'yyyy-MM');
  return `Frame-Habitos-${scope}-${stamp}`;
}
