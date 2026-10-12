// ============================================================
// Informe de tareas pendientes.
//
// La foto exacta de todo lo que queda por hacer, en documento formal. Se
// organiza en dos bloques porque responden a preguntas distintas:
//
//   Bloque 1 — por colección y asignatura: "¿de qué materia voy peor?"
//   Bloque 2 — mes a mes por fecha límite: "¿qué se me viene encima?"
//
// La MISMA tarea aparece en los dos bloques: no es duplicación accidental,
// son dos lecturas del mismo conjunto y cada una se lee por separado.
//
// Devuelve un `DocModel` (ver report-doc.ts), no HTML: de ahí salen los tres
// formatos —PDF, DOCX y Markdown— sin escribir el contenido tres veces.
// ============================================================

import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Course, Space, Task } from '@/types';
import { hm } from '@/lib/performance-report';
import type { DocBlock, DocCell, DocModel, DocTone } from '@/lib/report-doc';

const LOOSE_SPACE = 'Sin colección';
const UNASSIGNED = 'Sin asignatura';

/** Cuántos caracteres de la descripción entran en la celda sin romper la tabla. */
const DESCRIPTION_LIMIT = 240;

export interface PendingReportInput {
  studentName: string;
  tasks: Task[];
  courses: Course[];
  spaces: Space[];
  /** Referencia temporal del informe; se inyecta para poder probarlo. */
  now?: Date;
  /**
   * Periodo elegido en «Informes» (semana, mes o año). Entran las pendientes
   * cuya fecha de entrega cae dentro; si el periodo es el actual, también las
   * vencidas y las que no tienen fecha, porque siguen por hacer «ahora».
   * Sin periodo: todas las pendientes.
   */
  range?: { start: Date; end: Date; label: string };
}

/** Lo que entra en el informe para ese periodo (ver `range`). */
function inRange(due: Date | null, range: NonNullable<PendingReportInput['range']>, today: Date): boolean {
  const current = today >= startOfDay(range.start) && today <= range.end;
  if (!due) return current;
  if (due >= range.start && due <= range.end) return true;
  return current && startOfDay(due) < today;
}

export interface PendingSummary {
  pending: number;
  overdue: number;
  subjects: number;
  estimatedMinutes: number;
}

/** Las cifras del recuadro azul de «Informes»: lo mismo que contará el documento. */
export function pendingSummary(input: PendingReportInput): PendingSummary {
  const today = startOfDay(input.now ?? new Date());
  const rows = (input.tasks ?? []).filter((task) => {
    if ((task.progress ?? 0) >= 100) return false;
    return input.range ? inRange(safeParse(task.dueDate), input.range, today) : true;
  });
  return {
    pending: rows.length,
    overdue: rows.filter((task) => {
      const due = safeParse(task.dueDate);
      return due !== null && startOfDay(due) < today;
    }).length,
    subjects: new Set(rows.map((task) => task.courseName || UNASSIGNED)).size,
    estimatedMinutes: rows.reduce((acc, task) => acc + (task.estimatedMinutes ?? 0), 0),
  };
}

interface PendingRow {
  task: Task;
  due: Date | null;
  /** Días naturales hasta la entrega. Negativo = vencida. `null` = sin fecha. */
  daysLeft: number | null;
  courseName: string;
  spaceName: string;
  estimated: number;
}

function safeParse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Etiqueta y color del plazo: es la columna que primero se mira. */
function deadlineLabel(daysLeft: number | null): { text: string; tone: DocTone } {
  if (daysLeft === null) return { text: 'Sin fecha', tone: 'muted' };
  if (daysLeft < 0) {
    const late = Math.abs(daysLeft);
    return { text: late === 1 ? 'Vencida ayer' : `Vencida hace ${late} días`, tone: 'danger' };
  }
  if (daysLeft === 0) return { text: 'Hoy', tone: 'danger' };
  if (daysLeft === 1) return { text: 'Mañana', tone: 'warn' };
  if (daysLeft <= 7) return { text: `En ${daysLeft} días`, tone: 'warn' };
  return { text: `En ${daysLeft} días`, tone: 'ink' };
}

const difficultyTone = (value: string): DocTone =>
  value === 'Difícil' ? 'danger' : value === 'Media' ? 'warn' : value === 'Fácil' ? 'ok' : 'muted';

const priorityTone = (value: string): DocTone =>
  value === 'Alta' ? 'danger' : value === 'Media' ? 'warn' : 'muted';

/** Descripción, avance y adjuntos condensados en la línea gris de la celda. */
function taskNote(task: Task): string | undefined {
  const pieces: string[] = [];
  const description = (task.description ?? '').replace(/\s+/g, ' ').trim();
  if (description) {
    pieces.push(
      description.length > DESCRIPTION_LIMIT
        ? `${description.slice(0, DESCRIPTION_LIMIT).trimEnd()}…`
        : description
    );
  }
  if ((task.progress ?? 0) > 0) pieces.push(`avance ${Math.round(task.progress)} %`);
  const attachments = task.attachments?.length ?? 0;
  if (attachments > 0) pieces.push(attachments === 1 ? '1 adjunto' : `${attachments} adjuntos`);
  return pieces.length > 0 ? pieces.join('  ·  ') : undefined;
}

const estimatedText = (minutes: number): string => (minutes > 0 ? hm(minutes) : '—');

/** Filas del bloque 1: el detalle completo de una asignatura. */
const DETAIL_HEAD = ['Tarea', 'Categoría', 'Dificultad', 'Importancia', 'Fecha límite', 'Plazo', 'Estimado'];
const DETAIL_WEIGHTS = [34, 11, 11, 11, 15, 10, 8];
const DETAIL_ALIGNS: ('left' | 'right')[] = ['left', 'left', 'left', 'left', 'left', 'left', 'right'];

function detailRow(row: PendingRow): DocCell[] {
  const deadline = deadlineLabel(row.daysLeft);
  return [
    { text: row.task.name, bold: true, note: taskNote(row.task) },
    { text: row.task.kind ?? 'Tarea' },
    { text: row.task.difficulty ?? '—', tone: difficultyTone(row.task.difficulty ?? '') },
    { text: row.task.priority, tone: priorityTone(row.task.priority) },
    { text: row.due ? format(row.due, "EEE d 'de' MMM yyyy", { locale: es }) : '—', tone: row.due ? 'ink' : 'muted' },
    { text: deadline.text, tone: deadline.tone, bold: deadline.tone === 'danger' },
    { text: estimatedText(row.estimated), align: 'right' },
  ];
}

/** Filas del bloque 2: mismas tareas, ordenadas por el calendario. */
const MONTH_HEAD = ['Día', 'Asignatura', 'Tarea', 'Categoría', 'Dificultad', 'Importancia', 'Estimado'];
const MONTH_WEIGHTS = [10, 20, 30, 11, 11, 10, 8];
const MONTH_ALIGNS: ('left' | 'right')[] = ['left', 'left', 'left', 'left', 'left', 'left', 'right'];

function monthRow(row: PendingRow): DocCell[] {
  const deadline = deadlineLabel(row.daysLeft);
  return [
    {
      text: row.due ? format(row.due, 'EEE d', { locale: es }) : '—',
      bold: true,
      tone: deadline.tone,
      note: row.due ? deadline.text : undefined,
    },
    { text: row.courseName },
    { text: row.task.name, note: taskNote(row.task) },
    { text: row.task.kind ?? 'Tarea' },
    { text: row.task.difficulty ?? '—', tone: difficultyTone(row.task.difficulty ?? '') },
    { text: row.task.priority, tone: priorityTone(row.task.priority) },
    { text: estimatedText(row.estimated), align: 'right' },
  ];
}

export function pendingReportFileBase(now: Date = new Date(), stamp?: string): string {
  return `Frame-Pendientes-${stamp ?? format(now, 'yyyy-MM-dd')}`;
}

export interface PendingDocOptions {
  /** En modo síntesis se omiten los dos bloques de detalle tarea a tarea. */
  brief?: boolean;
  /** Numeración de sección de partida (el informe general encadena varias). */
  startIndex?: number;
  /** Sin portada ni cierre: el informe general aporta los suyos. */
  omitCover?: boolean;
}

export function buildPendingReport(
  input: PendingReportInput,
  options: PendingDocOptions = {}
): DocModel {
  const brief = options.brief ?? false;
  let sectionIndex = options.startIndex ?? 1;
  const num = () => String(sectionIndex++).padStart(2, '0');
  const now = input.now ?? new Date();
  const today = startOfDay(now);
  const generatedAt = format(now, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });

  // Colección de cada asignatura. El orden de `spaces` es el que el usuario
  // eligió en Asignaturas, así que el informe lo respeta tal cual.
  const spaceOfCourse = new Map<string, string>();
  const spaceOrder = new Map<string, number>();
  (input.spaces ?? []).forEach((space, index) => {
    spaceOrder.set(space.name, index);
    for (const courseId of space.courseIds) {
      const course = (input.courses ?? []).find((c) => c.id === courseId);
      if (course) spaceOfCourse.set(course.id, space.name);
    }
  });

  // Una tarea al 100 % ya no está pendiente aunque siga en la lista (falta que
  // el estudiante la culmine): contarla aquí contradecía al informe de
  // rendimiento dentro del mismo informe general.
  // Además se normaliza lo que puede faltar en datos antiguos o en tareas
  // creadas deprisa: sin esto, una sola tarea sin prioridad tumbaba el informe.
  const rows: PendingRow[] = (input.tasks ?? [])
    .filter((task) => (task.progress ?? 0) < 100)
    .filter((task) => !input.range || inRange(safeParse(task.dueDate), input.range, today))
    .map((original) => {
    const task = {
      ...original,
      name: original.name?.trim() || 'Sin título',
      priority: original.priority ?? 'Media',
    };
    const due = safeParse(task.dueDate);
    return {
      task,
      due,
      daysLeft: due ? differenceInCalendarDays(startOfDay(due), today) : null,
      courseName: task.courseName || UNASSIGNED,
      spaceName: spaceOfCourse.get(task.courseId) ?? LOOSE_SPACE,
      estimated: task.estimatedMinutes ?? 0,
    };
  });

  const byDeadline = [...rows].sort((a, b) => {
    if (a.daysLeft === null && b.daysLeft !== null) return 1;
    if (a.daysLeft !== null && b.daysLeft === null) return -1;
    if (a.daysLeft !== null && b.daysLeft !== null && a.daysLeft !== b.daysLeft) {
      return a.daysLeft - b.daysLeft;
    }
    const rank = { Alta: 3, Media: 2, Baja: 1 } as const;
    const diff = (rank[b.task.priority] ?? 0) - (rank[a.task.priority] ?? 0);
    return diff !== 0 ? diff : a.task.name.localeCompare(b.task.name, 'es');
  });

  const blocks: DocBlock[] = [];

  // ---------- Portada ----------
  const subjectCount = new Set(rows.map((r) => r.courseName)).size;
  const overdueCount = rows.filter((r) => r.daysLeft !== null && r.daysLeft < 0).length;

  if (!options.omitCover) {
    blocks.push({
      kind: 'cover',
      eyebrow: 'Registro académico',
      title: 'Informe de tareas pendientes',
      subtitle:
        rows.length === 0
          ? 'Sin tareas pendientes'
          : `${rows.length} ${rows.length === 1 ? 'tarea pendiente' : 'tareas pendientes'} en ${subjectCount} ${
              subjectCount === 1 ? 'asignatura' : 'asignaturas'
            }`,
      meta: [
        { label: 'Estudiante', value: input.studentName },
        ...(input.range ? [{ label: 'Periodo', value: input.range.label }] : []),
        { label: 'Pendientes', value: String(rows.length) },
        { label: 'Vencidas', value: String(overdueCount) },
        { label: 'Generado', value: generatedAt },
      ],
      footnote:
        'Fotografía del momento: refleja lo que quedaba por hacer al generar el documento. Las tareas culminadas después ya no figuran aquí.',
    });
  }

  if (rows.length === 0) {
    blocks.push({
      kind: 'callout',
      title: 'Sin pendientes',
      text: 'No hay ninguna tarea pendiente en este momento. Todo lo registrado está culminado.',
      tone: 'ok',
    });
    if (!options.omitCover) {
      blocks.push({
        kind: 'footer',
        text: 'Documento generado automáticamente por Frame a partir de las tareas del propio estudiante.',
      });
    }
    return { title: 'Informe de tareas pendientes', blocks };
  }

  // ---------- Resumen ----------
  const overdue = rows.filter((r) => r.daysLeft !== null && r.daysLeft < 0);
  const dueToday = rows.filter((r) => r.daysLeft === 0);
  const nextWeek = rows.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 7);
  const undated = rows.filter((r) => r.daysLeft === null);
  const totalEstimated = rows.reduce((acc, r) => acc + r.estimated, 0);
  const withEstimate = rows.filter((r) => r.estimated > 0).length;

  const count = (predicate: (r: PendingRow) => boolean) => rows.filter(predicate).length;
  const high = count((r) => r.task.priority === 'Alta');
  const medium = count((r) => r.task.priority === 'Media');
  const low = count((r) => r.task.priority === 'Baja');
  const hard = count((r) => r.task.difficulty === 'Difícil');
  const mediumHard = count((r) => r.task.difficulty === 'Media');
  const easy = count((r) => r.task.difficulty === 'Fácil');

  const nextUp = byDeadline.find((r) => r.daysLeft !== null && r.daysLeft >= 0);

  blocks.push({
    kind: 'section',
    index: num(),
    title: 'Panorama de lo pendiente',
    note: `${rows.length} ${rows.length === 1 ? 'tarea' : 'tareas'}`,
  });
  blocks.push({
    kind: 'kpis',
    items: [
      {
        label: 'Pendientes',
        value: String(rows.length),
        note: `${subjectCount} ${subjectCount === 1 ? 'asignatura' : 'asignaturas'}`,
      },
      { label: 'Vencidas', value: String(overdue.length), note: 'fecha límite ya pasada' },
      {
        label: 'Próximos 7 días',
        value: String(nextWeek.length),
        note: `${dueToday.length} ${dueToday.length === 1 ? 'vence hoy' : 'vencen hoy'}`,
      },
      { label: 'Sin fecha límite', value: String(undated.length), note: 'sin plazo asignado' },
      {
        label: 'Tiempo estimado',
        value: totalEstimated > 0 ? hm(totalEstimated) : '—',
        note: `${withEstimate} de ${rows.length} con estimación`,
      },
      { label: 'Importancia alta', value: String(high), note: `media ${medium} · baja ${low}` },
      { label: 'Dificultad difícil', value: String(hard), note: `media ${mediumHard} · fácil ${easy}` },
      {
        label: 'Siguiente entrega',
        value: nextUp ? deadlineLabel(nextUp.daysLeft).text : '—',
        note: nextUp ? `${nextUp.task.name} · ${nextUp.courseName}` : 'sin entregas por delante',
      },
    ],
  });

  // La conclusión escrita: un informe que solo enseña cifras obliga al lector
  // a sacarla, y quien lo lee deprisa no la saca.
  const urgentText = (() => {
    const pieces: string[] = [];
    pieces.push(
      `Quedan ${rows.length} ${rows.length === 1 ? 'tarea pendiente' : 'tareas pendientes'} repartidas en ${subjectCount} ${
        subjectCount === 1 ? 'asignatura' : 'asignaturas'
      }`
    );
    if (totalEstimated > 0) pieces.push(`, con ${hm(totalEstimated)} de trabajo estimado`);
    pieces.push('. ');
    if (overdue.length > 0) {
      pieces.push(
        `${overdue.length} ${overdue.length === 1 ? 'está vencida' : 'están vencidas'} y ${
          dueToday.length > 0 ? `${dueToday.length} ${dueToday.length === 1 ? 'vence' : 'vencen'} hoy` : 'ninguna vence hoy'
        }. `
      );
    } else if (dueToday.length > 0) {
      pieces.push(`Ninguna está vencida; ${dueToday.length} ${dueToday.length === 1 ? 'vence' : 'vencen'} hoy. `);
    } else {
      pieces.push('Ninguna está vencida. ');
    }
    if (nextUp) {
      pieces.push(`La siguiente entrega es «${nextUp.task.name}» de ${nextUp.courseName}, ${deadlineLabel(nextUp.daysLeft).text.toLowerCase()}. `);
    }
    if (undated.length > 0) {
      pieces.push(
        `${undated.length} ${undated.length === 1 ? 'tarea no tiene' : 'tareas no tienen'} fecha límite: sin plazo no entran en ninguna planificación.`
      );
    }
    return pieces.join('').trim();
  })();
  blocks.push({
    kind: 'callout',
    title: 'Lectura de la carga',
    text: urgentText,
    tone: overdue.length > 0 ? 'danger' : 'accent',
  });

  // ---------- Composición ----------
  const byCourse = [...new Map<string, PendingRow[]>(
    rows.map((r) => [r.courseName, rows.filter((x) => x.courseName === r.courseName)])
  ).entries()]
    .map(([name, list]) => ({
      name,
      count: list.length,
      overdue: list.filter((r) => r.daysLeft !== null && r.daysLeft < 0).length,
      estimated: list.reduce((acc, r) => acc + r.estimated, 0),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));

  blocks.push({ kind: 'section', index: num(), title: 'Dónde está la carga' });
  const maxCourse = Math.max(1, ...byCourse.map((c) => c.count));
  blocks.push({
    kind: 'bars',
    caption: 'Pendientes por asignatura',
    items: byCourse.map((course) => ({
      label: course.name,
      value: String(course.count),
      percent: (course.count / maxCourse) * 100,
      note: [
        course.overdue > 0 ? `${course.overdue} vencidas` : null,
        course.estimated > 0 ? hm(course.estimated) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: (course.overdue > 0 ? 'danger' : 'accent') as DocTone,
    })),
    legend: 'En rojo, las asignaturas con alguna entrega vencida.',
  });
  blocks.push({
    kind: 'stacked',
    caption: 'Reparto por importancia',
    items: [
      { label: 'Alta', percent: high, value: String(high), tone: 'danger' },
      { label: 'Media', percent: medium, value: String(medium), tone: 'warn' },
      { label: 'Baja', percent: low, value: String(low), tone: 'muted' },
    ],
  });
  blocks.push({
    kind: 'stacked',
    caption: 'Reparto por dificultad',
    items: [
      { label: 'Difícil', percent: hard, value: String(hard), tone: 'danger' },
      { label: 'Media', percent: mediumHard, value: String(mediumHard), tone: 'warn' },
      { label: 'Fácil', percent: easy, value: String(easy), tone: 'ok' },
    ],
  });

  // ---------- Situación por plazo ----------
  const tranches: { label: string; rows: PendingRow[]; tone: DocTone }[] = [
    { label: 'Vencidas', rows: overdue, tone: 'danger' },
    { label: 'Vencen hoy', rows: dueToday, tone: 'danger' },
    {
      label: 'Próximos 7 días',
      rows: rows.filter((r) => r.daysLeft !== null && r.daysLeft >= 1 && r.daysLeft <= 7),
      tone: 'warn',
    },
    {
      label: 'De 8 a 30 días',
      rows: rows.filter((r) => r.daysLeft !== null && r.daysLeft >= 8 && r.daysLeft <= 30),
      tone: 'ink',
    },
    { label: 'Más de 30 días', rows: rows.filter((r) => r.daysLeft !== null && r.daysLeft > 30), tone: 'ink' },
    { label: 'Sin fecha límite', rows: undated, tone: 'muted' },
  ];

  blocks.push({ kind: 'section', index: num(), title: 'Situación por plazo' });
  const maxTranche = Math.max(1, ...tranches.map((t) => t.rows.length));
  blocks.push({
    kind: 'bars',
    caption: 'Tareas por tramo de vencimiento',
    items: tranches.map((tranche) => ({
      label: tranche.label,
      value: String(tranche.rows.length),
      percent: (tranche.rows.length / maxTranche) * 100,
      note:
        tranche.rows.reduce((acc, r) => acc + r.estimated, 0) > 0
          ? hm(tranche.rows.reduce((acc, r) => acc + r.estimated, 0))
          : undefined,
      tone: tranche.tone,
    })),
  });
  blocks.push({
    kind: 'table',
    head: ['Tramo', 'Tareas', 'Importancia alta', 'Tiempo estimado'],
    weights: [40, 15, 20, 25],
    aligns: ['left', 'right', 'right', 'right'],
    rows: tranches.map((tranche) => [
      { text: tranche.label, tone: tranche.tone, bold: tranche.rows.length > 0 },
      { text: String(tranche.rows.length), align: 'right' },
      {
        text: String(tranche.rows.filter((r) => r.task.priority === 'Alta').length),
        align: 'right',
      },
      {
        text: estimatedText(tranche.rows.reduce((acc, r) => acc + r.estimated, 0)),
        align: 'right',
      },
    ]),
  });

  // ---------- Las siguientes entregas, en línea de tiempo ----------
  const upcoming = byDeadline.filter((r) => r.due).slice(0, 8);
  if (upcoming.length > 0) {
    blocks.push({ kind: 'section', index: num(), title: 'Lo que viene primero' });
    blocks.push({
      kind: 'timeline',
      items: upcoming.map((row) => ({
        when: format(row.due as Date, "EEE d 'de' MMM", { locale: es }),
        title: row.task.name,
        note: [
          row.courseName,
          deadlineLabel(row.daysLeft).text,
          row.task.priority !== 'Baja' ? `importancia ${row.task.priority.toLowerCase()}` : null,
          row.estimated > 0 ? hm(row.estimated) : null,
        ]
          .filter(Boolean)
          .join('  ·  '),
      })),
    });
  }

  // En modo síntesis el documento termina aquí: el detalle tarea a tarea es
  // exactamente lo que esa lectura no quiere.
  if (brief) {
    if (!options.omitCover) {
      blocks.push({
        kind: 'footer',
        text: `Documento generado automáticamente por Frame el ${generatedAt} a partir de las tareas del propio estudiante.`,
      });
    }
    return { title: 'Informe de tareas pendientes', blocks };
  }

  // ---------- Bloque 1: por colección y asignatura ----------
  blocks.push({ kind: 'pagebreak' });
  blocks.push({ kind: 'section', index: num(), title: 'Pendientes por colección y asignatura' });
  blocks.push({
    kind: 'paragraph',
    text: 'Cada asignatura con su lista completa. Dentro de cada una, las tareas van de la entrega más próxima a la más lejana; las que no tienen fecha quedan al final.',
    tone: 'muted',
  });

  const spaceNames = [...new Set(rows.map((r) => r.spaceName))].sort((a, b) => {
    const orderA = spaceOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
    const orderB = spaceOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
    return orderA !== orderB ? orderA - orderB : a.localeCompare(b, 'es');
  });

  for (const spaceName of spaceNames) {
    const spaceRows = byDeadline.filter((r) => r.spaceName === spaceName);
    const spaceCourses = [...new Set(spaceRows.map((r) => r.courseName))].sort((a, b) =>
      a.localeCompare(b, 'es')
    );
    const spaceOverdue = spaceRows.filter((r) => r.daysLeft !== null && r.daysLeft < 0).length;
    const spaceEstimated = spaceRows.reduce((acc, r) => acc + r.estimated, 0);

    blocks.push({
      kind: 'subheading',
      level: 1,
      text: spaceName,
      note: [
        `${spaceRows.length} ${spaceRows.length === 1 ? 'pendiente' : 'pendientes'}`,
        `${spaceCourses.length} ${spaceCourses.length === 1 ? 'asignatura' : 'asignaturas'}`,
        spaceOverdue > 0 ? `${spaceOverdue} vencidas` : null,
        spaceEstimated > 0 ? `${hm(spaceEstimated)} estimados` : null,
      ]
        .filter(Boolean)
        .join('  ·  '),
    });

    for (const courseName of spaceCourses) {
      const courseRows = spaceRows.filter((r) => r.courseName === courseName);
      const courseOverdue = courseRows.filter((r) => r.daysLeft !== null && r.daysLeft < 0).length;
      const courseEstimated = courseRows.reduce((acc, r) => acc + r.estimated, 0);

      blocks.push({
        kind: 'subheading',
        level: 2,
        text: courseName,
        note: [
          `${courseRows.length} ${courseRows.length === 1 ? 'tarea' : 'tareas'}`,
          courseOverdue > 0 ? `${courseOverdue} vencidas` : null,
          courseEstimated > 0 ? hm(courseEstimated) : null,
        ]
          .filter(Boolean)
          .join('  ·  '),
      });
      blocks.push({
        kind: 'table',
        head: DETAIL_HEAD,
        weights: DETAIL_WEIGHTS,
        aligns: DETAIL_ALIGNS,
        rows: courseRows.map(detailRow),
      });
    }
  }

  // ---------- Bloque 2: mes a mes ----------
  blocks.push({ kind: 'pagebreak' });
  blocks.push({ kind: 'section', index: num(), title: 'Pendientes mes a mes' });
  blocks.push({
    kind: 'paragraph',
    text: 'Las mismas tareas ordenadas por el calendario, para ver la carga real de cada mes. Los meses ya pasados que siguen apareciendo contienen entregas vencidas.',
    tone: 'muted',
  });

  const monthKeys = [
    ...new Set(byDeadline.filter((r) => r.due).map((r) => format(r.due as Date, 'yyyy-MM'))),
  ].sort();

  for (const monthKey of monthKeys) {
    const monthRows = byDeadline.filter((r) => r.due && format(r.due, 'yyyy-MM') === monthKey);
    const monthOverdue = monthRows.filter((r) => r.daysLeft !== null && r.daysLeft < 0).length;
    const monthEstimated = monthRows.reduce((acc, r) => acc + r.estimated, 0);
    const monthLabel = format(parseISO(`${monthKey}-01T00:00:00`), "MMMM 'de' yyyy", { locale: es });

    blocks.push({
      kind: 'subheading',
      level: 1,
      text: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      note: [
        `${monthRows.length} ${monthRows.length === 1 ? 'entrega' : 'entregas'}`,
        monthOverdue > 0 ? `${monthOverdue} vencidas` : null,
        monthEstimated > 0 ? `${hm(monthEstimated)} estimados` : null,
      ]
        .filter(Boolean)
        .join('  ·  '),
    });
    blocks.push({
      kind: 'table',
      head: MONTH_HEAD,
      weights: MONTH_WEIGHTS,
      aligns: MONTH_ALIGNS,
      rows: monthRows.map(monthRow),
    });
  }

  if (undated.length > 0) {
    blocks.push({
      kind: 'subheading',
      level: 1,
      text: 'Sin fecha límite',
      note: `${undated.length} ${undated.length === 1 ? 'tarea' : 'tareas'} · ponerles plazo es lo primero`,
    });
    blocks.push({
      kind: 'table',
      head: MONTH_HEAD,
      weights: MONTH_WEIGHTS,
      aligns: MONTH_ALIGNS,
      rows: undated
        .slice()
        .sort((a, b) => a.courseName.localeCompare(b.courseName, 'es'))
        .map(monthRow),
    });
  }

  if (!options.omitCover) {
    blocks.push({
      kind: 'footer',
      text: `Frame · VT Asvent — Informe de tareas pendientes generado el ${generatedAt} a partir de las tareas del propio estudiante. Refleja la situación en ese instante: las tareas culminadas después ya no figuran aquí.`,
    });
  }

  return { title: 'Informe de tareas pendientes', blocks };
}
