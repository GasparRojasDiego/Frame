import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  ArchivedTask,
  Course,
  DailyPerformance,
  Habit,
  Note,
  Space,
  StudyGoals,
  StudySession,
  Task,
} from '@/types';
import type { DocBlock, DocModel, DocTone } from '@/lib/report-doc';
import {
  buildReport,
  hm,
  performanceBlocks,
  rangeLabel,
  reportRange,
  type ReportData,
} from '@/lib/performance-report';
import { buildPendingReport } from '@/lib/pending-report';
import { buildHabitsReport, habitsBlocks, type HabitsReportData } from '@/lib/habits-report';

// ============================================================
// Informe general.
//
// Los otros tres informes contestan una pregunta cada uno. Este contesta la
// que no cabe en ninguno: «¿cómo voy?». Para eso hace algo que los demás no
// pueden hacer: pone el MISMO indicador en cuatro escalas de tiempo a la vez
// —hoy, esta semana, este mes y el mes pasado— porque una cifra sola no dice
// nada y comparada lo dice casi todo.
//
// Dos lecturas del mismo material:
//   · Denso    — todo: el detalle de cada sesión, cada pendiente, cada hábito.
//   · Síntesis — el cuadro de mando y las figuras, sin las tablas largas.
//
// No recalcula nada por su cuenta: reutiliza los constructores de los otros
// tres informes, así que sus números y los de ellos no pueden discrepar.
// ============================================================

export type GeneralMode = 'denso' | 'sintesis';

export const GENERAL_MODE_LABEL: Record<GeneralMode, string> = {
  denso: 'Informe general · edición densa',
  sintesis: 'Informe general · síntesis',
};

export interface GeneralReportInput {
  studentName: string;
  mode: GeneralMode;
  now?: Date;

  sessions: StudySession[];
  tasks: Task[];
  archivedTasks: ArchivedTask[];
  courses: Course[];
  spaces: Space[];
  performances: DailyPerformance[];
  studyGoals: StudyGoals;
  habits: Habit[];
  notes: Note[];
  /** Totales de la biblioteca, para el inventario de cierre. */
  songCount?: number;
  playlistCount?: number;
  recordingCount?: number;
  studyVideoCount?: number;
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const pctOf = (value: number, total: number): number => (total > 0 ? (value / total) * 100 : 0);

/**
 * Variación en PUNTOS entre dos porcentajes.
 * Un cumplimiento que pasa del 4 % al 41 % no ha subido un 905 %: ha subido
 * 37 puntos. El porcentaje de un porcentaje no significa nada para el lector.
 */
function deltaPoints(now: number, before: number): { dir: 'up' | 'down' | 'flat'; text: string } {
  const diff = now - before;
  if (Math.abs(diff) < 0.5) return { dir: 'flat', text: 'igual que el mes anterior' };
  return {
    dir: diff > 0 ? 'up' : 'down',
    text: `${diff > 0 ? '+' : ''}${diff.toFixed(0)} pts frente al mes anterior`,
  };
}

/** Variación entre dos cifras, con su flecha y su texto. */
function delta(now: number, before: number, unit: string): { dir: 'up' | 'down' | 'flat'; text: string } {
  if (before === 0 && now === 0) return { dir: 'flat', text: 'sin datos previos' };
  if (before === 0) return { dir: 'up', text: `nuevo frente al mes anterior` };
  const diff = ((now - before) / before) * 100;
  if (Math.abs(diff) < 1) return { dir: 'flat', text: `igual que el mes anterior` };
  return {
    dir: diff > 0 ? 'up' : 'down',
    text: `${diff > 0 ? '+' : ''}${diff.toFixed(0)} % ${unit}`,
  };
}

interface Scales {
  day: ReportData;
  week: ReportData;
  month: ReportData;
  previousMonth: ReportData;
  habitsMonth: HabitsReportData;
  habitsPreviousMonth: HabitsReportData;
}

function buildScales(input: GeneralReportInput, now: Date): Scales {
  const common = {
    studentName: input.studentName,
    sessions: input.sessions ?? [],
    tasks: input.tasks ?? [],
    archivedTasks: input.archivedTasks ?? [],
    courses: input.courses ?? [],
    spaces: input.spaces ?? [],
    performances: input.performances ?? [],
    studyGoals: input.studyGoals,
  };
  const lastMonth = subMonths(now, 1);

  return {
    day: buildReport({ ...common, scope: 'dia', reference: now }),
    week: buildReport({ ...common, scope: 'semana', reference: now }),
    month: buildReport({ ...common, scope: 'mes', reference: now }),
    previousMonth: buildReport({ ...common, scope: 'mes', reference: lastMonth }),
    habitsMonth: buildHabitsReport({
      scope: 'mes',
      reference: now,
      studentName: input.studentName,
      habits: input.habits ?? [],
    }),
    habitsPreviousMonth: buildHabitsReport({
      scope: 'mes',
      reference: lastMonth,
      studentName: input.studentName,
      habits: input.habits ?? [],
    }),
  };
}

/**
 * El cuadro de mando: el mismo indicador en cuatro escalas.
 * Es la pieza que justifica que este informe exista.
 */
function dashboard(scales: Scales): DocBlock[] {
  const { day, week, month, previousMonth, habitsMonth, habitsPreviousMonth } = scales;

  const rows: { label: string; values: [string, string, string, string]; tone?: DocTone }[] = [
    {
      label: 'Tiempo de estudio',
      values: [hm(day.totalMinutes), hm(week.totalMinutes), hm(month.totalMinutes), hm(previousMonth.totalMinutes)],
    },
    {
      label: 'Sesiones',
      values: [
        String(day.sessionCount),
        String(week.sessionCount),
        String(month.sessionCount),
        String(previousMonth.sessionCount),
      ],
    },
    {
      label: 'Días con estudio',
      values: [
        `${day.activeDays} / ${day.periodDays}`,
        `${week.activeDays} / ${week.periodDays}`,
        `${month.activeDays} / ${month.periodDays}`,
        `${previousMonth.activeDays} / ${previousMonth.periodDays}`,
      ],
    },
    {
      label: 'Cumplimiento de meta',
      values: [
        day.goalMinutes > 0 ? `${Math.round(pctOf(day.totalMinutes, day.goalMinutes))} %` : '—',
        week.goalMinutes > 0 ? `${Math.round(pctOf(week.totalMinutes, week.goalMinutes))} %` : '—',
        month.goalMinutes > 0 ? `${Math.round(pctOf(month.totalMinutes, month.goalMinutes))} %` : '—',
        previousMonth.goalMinutes > 0
          ? `${Math.round(pctOf(previousMonth.totalMinutes, previousMonth.goalMinutes))} %`
          : '—',
      ],
    },
    {
      label: 'Tareas culminadas',
      values: [
        String(day.tasksDone),
        String(week.tasksDone),
        String(month.tasksDone),
        String(previousMonth.tasksDone),
      ],
    },
    {
      label: 'Entregas a tiempo',
      values: [
        day.tasksWithDeadline > 0 ? `${Math.round(pctOf(day.tasksOnTime, day.tasksWithDeadline))} %` : '—',
        week.tasksWithDeadline > 0 ? `${Math.round(pctOf(week.tasksOnTime, week.tasksWithDeadline))} %` : '—',
        month.tasksWithDeadline > 0 ? `${Math.round(pctOf(month.tasksOnTime, month.tasksWithDeadline))} %` : '—',
        previousMonth.tasksWithDeadline > 0
          ? `${Math.round(pctOf(previousMonth.tasksOnTime, previousMonth.tasksWithDeadline))} %`
          : '—',
      ],
    },
    {
      label: 'Calificación media',
      values: [
        day.gradeAverage !== null ? day.gradeAverage.toFixed(1) : '—',
        week.gradeAverage !== null ? week.gradeAverage.toFixed(1) : '—',
        month.gradeAverage !== null ? month.gradeAverage.toFixed(1) : '—',
        previousMonth.gradeAverage !== null ? previousMonth.gradeAverage.toFixed(1) : '—',
      ],
    },
    {
      label: 'Cumplimiento de hábitos',
      values: [
        '—',
        '—',
        `${habitsMonth.compliance.toFixed(0)} %`,
        `${habitsPreviousMonth.compliance.toFixed(0)} %`,
      ],
    },
  ];

  return [
    {
      kind: 'table',
      caption: 'El mismo indicador en cuatro escalas de tiempo',
      head: ['Indicador', 'Hoy', 'Esta semana', 'Este mes', 'Mes anterior'],
      aligns: ['left', 'right', 'right', 'right', 'right'],
      weights: [32, 15, 17, 17, 19],
      rows: rows.map((row) => [
        { text: row.label, bold: true },
        { text: row.values[0], tone: 'muted' as DocTone },
        { text: row.values[1] },
        { text: row.values[2], bold: true, fill: 'accent' as DocTone },
        { text: row.values[3], tone: 'muted' as DocTone },
      ]),
    },
    {
      kind: 'paragraph',
      text: 'La columna resaltada es el mes en curso. La última columna es el mes cerrado inmediatamente anterior, que es la única comparación honesta: un mes a medias siempre parece peor que uno completo.',
      tone: 'muted',
    },
  ];
}

/** Comparación mes actual frente a mes anterior, en barras enfrentadas. */
function monthComparison(scales: Scales): DocBlock[] {
  const { month, previousMonth, habitsMonth, habitsPreviousMonth } = scales;
  const max = (a: number, b: number) => Math.max(1, a, b);

  return [
    {
      kind: 'bars',
      caption: 'Mes en curso frente al mes anterior',
      items: [
        {
          label: 'Estudio · este mes',
          value: hm(month.totalMinutes),
          percent: pctOf(month.totalMinutes, max(month.totalMinutes, previousMonth.totalMinutes)),
          tone: 'accent',
        },
        {
          label: 'Estudio · mes anterior',
          value: hm(previousMonth.totalMinutes),
          percent: pctOf(previousMonth.totalMinutes, max(month.totalMinutes, previousMonth.totalMinutes)),
          tone: 'muted',
        },
        {
          label: 'Tareas · este mes',
          value: String(month.tasksDone),
          percent: pctOf(month.tasksDone, max(month.tasksDone, previousMonth.tasksDone)),
          tone: 'accent',
        },
        {
          label: 'Tareas · mes anterior',
          value: String(previousMonth.tasksDone),
          percent: pctOf(previousMonth.tasksDone, max(month.tasksDone, previousMonth.tasksDone)),
          tone: 'muted',
        },
        {
          label: 'Hábitos · este mes',
          value: `${habitsMonth.compliance.toFixed(0)} %`,
          percent: habitsMonth.compliance,
          tone: 'accent',
        },
        {
          label: 'Hábitos · mes anterior',
          value: `${habitsPreviousMonth.compliance.toFixed(0)} %`,
          percent: habitsPreviousMonth.compliance,
          tone: 'muted',
        },
      ],
    },
  ];
}

/** La conclusión general, escrita. */
function executiveRead(scales: Scales, input: GeneralReportInput): string {
  const { month, previousMonth, habitsMonth, week } = scales;
  const parts: string[] = [];

  parts.push(
    `En el mes en curso se han registrado ${hm(month.totalMinutes)} de estudio en ${month.sessionCount} ${
      month.sessionCount === 1 ? 'sesión' : 'sesiones'
    }, frente a ${hm(previousMonth.totalMinutes)} del mes anterior. `
  );

  const diff = month.totalMinutes - previousMonth.totalMinutes;
  if (previousMonth.totalMinutes > 0 && Math.abs(diff) > 15) {
    parts.push(
      diff > 0
        ? `El ritmo sube: ${hm(Math.abs(diff))} más. `
        : `El ritmo baja: ${hm(Math.abs(diff))} menos. `
    );
  }

  parts.push(`Esta semana llevas ${hm(week.totalMinutes)} en ${week.activeDays} de ${week.periodDays} días. `);

  if (month.bySubject.length > 0) {
    parts.push(`La asignatura que más tiempo recibe es ${month.bySubject[0].name}. `);
  }
  if (month.pendingTotal > 0) {
    const overdue = month.pendingByCourse.reduce((sum, c) => sum + c.overdue, 0);
    parts.push(
      `Quedan ${month.pendingTotal} tareas pendientes${overdue > 0 ? `, ${overdue} de ellas vencidas` : ''}. `
    );
  }
  if (habitsMonth.habitCount > 0) {
    parts.push(
      `El cumplimiento de hábitos del mes es del ${habitsMonth.compliance.toFixed(0)} % con ${habitsMonth.perfectDays} días perfectos.`
    );
  }

  return parts.join('').trim();
}

export function buildGeneralReport(input: GeneralReportInput): DocModel {
  const now = input.now ?? new Date();
  const brief = input.mode === 'sintesis';
  const scales = buildScales(input, now);
  const generatedAt = format(now, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
  const monthRange = reportRange('mes', now);
  const monthLabel = capitalize(rangeLabel('mes', monthRange.start, monthRange.end));

  let sectionIndex = 1;
  const num = () => String(sectionIndex++).padStart(2, '0');
  const blocks: DocBlock[] = [];

  // ---------- Portada ----------
  blocks.push({
    kind: 'cover',
    eyebrow: brief ? 'Síntesis' : 'Edición densa',
    title: 'Informe general de rendimiento',
    subtitle: `${input.studentName} · ${monthLabel}`,
    meta: [
      { label: 'Estudiante', value: input.studentName },
      { label: 'Corte', value: format(now, "d 'de' MMMM 'de' yyyy", { locale: es }) },
      { label: 'Alcance', value: brief ? 'Datos esenciales' : 'Detalle completo' },
      { label: 'Generado', value: generatedAt },
    ],
    footnote:
      'Reúne el registro de estudio, las tareas pendientes y el seguimiento de hábitos en un solo documento. Todas las cifras proceden del registro personal del estudiante en Frame y no tienen validez académica oficial.',
  });

  // ---------- Resumen ejecutivo ----------
  blocks.push({ kind: 'section', index: num(), title: 'Resumen ejecutivo', note: monthLabel });
  blocks.push({
    kind: 'kpis',
    items: [
      {
        label: 'Estudio del mes',
        value: hm(scales.month.totalMinutes),
        note: `${scales.month.sessionCount} sesiones`,
        delta: delta(scales.month.totalMinutes, scales.previousMonth.totalMinutes, 'frente al mes anterior'),
      },
      {
        label: 'Tareas culminadas',
        value: String(scales.month.tasksDone),
        note: `${scales.month.pendingTotal} pendientes ahora`,
        delta: delta(scales.month.tasksDone, scales.previousMonth.tasksDone, 'frente al mes anterior'),
      },
      {
        label: 'Calificación media',
        value: scales.month.gradeAverage !== null ? `${scales.month.gradeAverage.toFixed(1)} / 20` : '—',
        note:
          scales.previousMonth.gradeAverage !== null
            ? `mes anterior: ${scales.previousMonth.gradeAverage.toFixed(1)}`
            : 'sin registro previo',
      },
      {
        label: 'Hábitos',
        value: `${scales.habitsMonth.compliance.toFixed(0)} %`,
        note: `${scales.habitsMonth.habitCount} hábitos activos`,
        delta:
          scales.habitsPreviousMonth.possible > 0
            ? deltaPoints(scales.habitsMonth.compliance, scales.habitsPreviousMonth.compliance)
            : undefined,
      },
    ],
  });
  blocks.push({ kind: 'callout', title: 'Cómo va el mes', text: executiveRead(scales, input) });

  // ---------- Cuadro de mando ----------
  blocks.push({ kind: 'section', index: num(), title: 'Cuadro de mando' });
  blocks.push(...dashboard(scales));
  blocks.push(...monthComparison(scales));

  // ---------- Hoy y esta semana ----------
  blocks.push({ kind: 'section', index: num(), title: 'Hoy y esta semana' });
  blocks.push({
    kind: 'kpis',
    items: [
      { label: 'Hoy', value: hm(scales.day.totalMinutes), note: `${scales.day.sessionCount} sesiones` },
      {
        label: 'Esta semana',
        value: hm(scales.week.totalMinutes),
        note: `${scales.week.activeDays} de ${scales.week.periodDays} días activos`,
      },
      {
        label: 'Media por día activo',
        value: hm(scales.week.averageActiveDay),
        note: 'esta semana',
      },
      {
        label: 'Meta semanal',
        value: scales.week.goalMinutes > 0 ? `${Math.round(pctOf(scales.week.totalMinutes, scales.week.goalMinutes))} %` : '—',
        note: scales.week.goalMinutes > 0 ? `de ${hm(scales.week.goalMinutes)}` : 'sin metas configuradas',
      },
    ],
  });
  const weekMax = Math.max(1, ...scales.week.byPeriod.map((b) => Math.max(b.minutes, b.goal ?? 0)));
  blocks.push({
    kind: 'bars',
    caption: 'La semana en curso, día a día',
    items: scales.week.byPeriod.map((bar) => ({
      label: capitalize(bar.label),
      value: bar.minutes > 0 ? hm(bar.minutes) : '—',
      percent: pctOf(bar.minutes, weekMax),
      target: bar.goal && bar.goal > 0 ? pctOf(bar.goal, weekMax) : undefined,
      note: bar.goal && bar.goal > 0 ? `meta ${hm(bar.goal)}` : undefined,
      tone: (bar.goal && bar.goal > 0 && bar.minutes >= bar.goal ? 'ok' : 'accent') as DocTone,
    })),
    legend: 'La línea vertical marca la meta del día.',
  });

  // ---------- Rendimiento del mes ----------
  blocks.push({ kind: 'pagebreak' });
  blocks.push({ kind: 'section', index: num(), title: 'Rendimiento del mes en curso', note: monthLabel });
  blocks.push(
    ...performanceBlocks(scales.month, { brief, startIndex: sectionIndex, omitCover: true }).filter(
      // El panorama ya se dio en el resumen ejecutivo: aquí sobra repetirlo.
      (block, i) => !(i === 0 && block.kind === 'section')
    )
  );

  // ---------- Mes anterior ----------
  blocks.push({ kind: 'pagebreak' });
  blocks.push({
    kind: 'section',
    index: num(),
    title: 'Mes anterior, cerrado',
    note: capitalize(rangeLabel('mes', startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1)))),
  });
  blocks.push({
    kind: 'kpis',
    items: [
      {
        label: 'Estudio',
        value: hm(scales.previousMonth.totalMinutes),
        note: `${scales.previousMonth.sessionCount} sesiones`,
      },
      {
        label: 'Días activos',
        value: `${scales.previousMonth.activeDays} / ${scales.previousMonth.periodDays}`,
        note: `media ${hm(scales.previousMonth.averageActiveDay)}`,
      },
      { label: 'Tareas culminadas', value: String(scales.previousMonth.tasksDone), note: `${scales.previousMonth.tasksOnTime} a tiempo` },
      {
        label: 'Calificación',
        value: scales.previousMonth.gradeAverage !== null ? `${scales.previousMonth.gradeAverage.toFixed(1)} / 20` : '—',
        note: 'media del mes cerrado',
      },
    ],
  });
  if (scales.previousMonth.bySubject.length > 0) {
    const maxPrev = Math.max(1, ...scales.previousMonth.bySubject.map((r) => r.minutes));
    blocks.push({
      kind: 'bars',
      caption: 'Reparto por asignatura del mes anterior',
      items: scales.previousMonth.bySubject.slice(0, 10).map((row) => ({
        label: row.name,
        value: hm(row.minutes),
        percent: pctOf(row.minutes, maxPrev),
        note: `${Math.round(row.percent)} %`,
        tone: 'ink' as DocTone,
      })),
    });
  }

  // ---------- Hábitos ----------
  blocks.push({ kind: 'pagebreak' });
  blocks.push({ kind: 'section', index: num(), title: 'Seguimiento de hábitos', note: monthLabel });
  blocks.push(
    ...habitsBlocks(scales.habitsMonth, { brief, startIndex: sectionIndex, omitCover: true }).filter(
      (block, i) => !(i === 0 && block.kind === 'section')
    )
  );

  // ---------- Pendientes ----------
  blocks.push({ kind: 'pagebreak' });
  blocks.push({ kind: 'section', index: num(), title: 'Tareas pendientes' });
  const pending = buildPendingReport(
    {
      studentName: input.studentName,
      tasks: input.tasks ?? [],
      courses: input.courses ?? [],
      spaces: input.spaces ?? [],
      now,
    },
    { brief, startIndex: sectionIndex, omitCover: true }
  );
  blocks.push(...pending.blocks.filter((block, i) => !(i === 0 && block.kind === 'section')));

  // ---------- Inventario ----------
  blocks.push({ kind: 'section', index: num(), title: 'Inventario del sistema' });
  blocks.push({
    kind: 'paragraph',
    text: 'Todo lo que Frame guarda de este estudiante en el momento del corte. Sirve de comprobante: si un dato falta aquí, es que no está registrado.',
    tone: 'muted',
  });
  blocks.push({
    kind: 'table',
    head: ['Elemento', 'Cantidad', 'Detalle'],
    aligns: ['left', 'right', 'left'],
    weights: [34, 14, 52],
    rows: [
      [
        { text: 'Asignaturas', bold: true },
        { text: String(input.courses?.length ?? 0) },
        { text: `${input.spaces?.length ?? 0} colecciones` },
      ],
      [
        { text: 'Tareas pendientes', bold: true },
        { text: String((input.tasks ?? []).filter((t) => (t.progress ?? 0) < 100).length) },
        { text: `${(input.tasks ?? []).filter((t) => (t.progress ?? 0) < 100 && t.dueDate).length} con fecha límite` },
      ],
      [
        { text: 'Tareas culminadas', bold: true },
        { text: String(input.archivedTasks?.length ?? 0) },
        { text: 'archivo histórico completo' },
      ],
      [
        { text: 'Sesiones de estudio', bold: true },
        { text: String(input.sessions?.length ?? 0) },
        { text: 'registro desde el primer día' },
      ],
      [
        { text: 'Hábitos', bold: true },
        { text: String((input.habits ?? []).filter((h) => !h.isArchived).length) },
        { text: `${(input.habits ?? []).filter((h) => h.isArchived).length} archivados` },
      ],
      [
        { text: 'Recursos y notas', bold: true },
        { text: String(input.notes?.length ?? 0) },
        { text: 'apuntes, enlaces y documentos de las asignaturas' },
      ],
      [
        { text: 'Biblioteca de música', bold: true },
        { text: String(input.songCount ?? 0) },
        { text: `${input.playlistCount ?? 0} playlists · no se replica en la nube` },
      ],
      [
        { text: 'Grabaciones de voz', bold: true },
        { text: String(input.recordingCount ?? 0) },
        { text: 'en Documentos\\Frame\\Grabaciones · no se replican en la nube' },
      ],
      [
        { text: 'Vídeos de estudio', bold: true },
        { text: String(input.studyVideoCount ?? 0) },
        { text: 'guardados en Estudio' },
      ],
    ],
  });

  blocks.push({
    kind: 'footer',
    text: `Frame · VT Asvent — ${GENERAL_MODE_LABEL[input.mode]}. Generado el ${generatedAt} para ${input.studentName}. Documento de autoseguimiento sin validez académica oficial.`,
  });

  // Numeración final: los sub-informes traen la suya y aquí se encadenan,
  // así que se reescriben todas de corrido. Contar a mano cuántas secciones
  // aporta cada bloque es exactamente el tipo de cuenta que se desajusta al
  // primer cambio.
  let ordinal = 1;
  for (const block of blocks) {
    if (block.kind === 'section') block.index = String(ordinal++).padStart(2, '0');
  }

  return { title: `Informe general · ${input.studentName} · ${monthLabel}`, blocks };
}

export function generalReportFileBase(mode: GeneralMode, now: Date = new Date()): string {
  return `Frame-Informe-general-${mode}-${format(now, 'yyyy-MM-dd')}`;
}
