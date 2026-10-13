import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DocBlock, DocCell, DocModel } from '@/lib/report-doc';

// ============================================================
// Informe de impacto (panel del responsable).
//
// Antes era una pestaña propia («Impacto»); desde la 1.5.7 es un documento
// que se descarga desde «Uso». Convierte la serie diaria seudónima (minutos,
// sesiones, enfoque, tareas) en las frases que se pueden defender ante un
// jurado: cuántos estudiantes, cuánto estudio registrado, qué pasó entre su
// primera y su segunda semana, cuántas tareas importantes y a tiempo. Cada
// cifra lleva su «n» y su método, porque una cifra sin método no convence a
// nadie que sepa leerla. Cierra con un resumen del uso de la app.
//
// «Semana 1» son los PRIMEROS 7 DÍAS de cada estudiante desde su primera
// actividad, no la semana del calendario. La cuenta del responsable no entra
// en ninguna cifra (migración 0008).
// ============================================================

interface PairStats {
  n: number;
  sum_w1: number;
  sum_w2: number;
  mean_w1: number | null;
  mean_w2: number | null;
  median_change_pct: number | null;
  improved: number;
}

export interface ImpactData {
  generated_at: string;
  today: string;
  headline: {
    students: number;
    students_2w: number;
    first_day: string | null;
    minutes: number;
    sessions: number;
    study_days: number;
    tasks: number;
    tasks_high: number;
    tasks_with_due: number;
    tasks_on_time: number;
    focus_avg: number | null;
    habits_rate: number | null;
  };
  cohort: {
    wk: number;
    users_observable: number;
    users_active: number;
    avg_minutes: number;
    median_minutes: number;
    avg_focus: number | null;
    avg_active_days: number;
    tasks: number;
  }[];
  w1_w2: PairStats;
  w1_w4: PairStats;
  calendar_weeks: { week_start: string; users: number; minutes: number; tasks: number }[];
}

/** Lo del panel «Uso» que también entra en el informe. */
export interface UsageSummary {
  days: number;
  totals: {
    users_total: number;
    accounts_total?: number;
    guests_total?: number;
    active_today: number;
    active_7d: number;
    active_30d: number;
    opens_period: number;
    sessions_period: number;
    minutes_period: number;
    tasks_period: number;
  };
  retention: { this_week: number; prev_week: number; retained: number };
  screens: { label: string; views: number; users: number }[];
  versions: { version: string; platform?: string; users: number }[];
  platforms: { platform: string; users: number }[];
}

const hours = (minutes: number): string => {
  const value = minutes / 60;
  return value >= 100 ? `${Math.round(value)} h` : `${value.toFixed(1).replace('.', ',')} h`;
};
const cells = (values: string[]): DocCell[] => values.map((text, index) => ({ text, bold: index === 0 }));
const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);
const signed = (value: number): string => `${value > 0 ? '+' : ''}${value} %`;
const longDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return iso;
  }
};

function pairSentence(pair: PairStats, label: string): string | null {
  if (!pair || pair.n === 0 || !pair.sum_w1) return null;
  const change = Math.round(((pair.sum_w2 - pair.sum_w1) / pair.sum_w1) * 100);
  const direction = change >= 0 ? 'subió' : 'bajó';
  const caution = pair.n < 10 ? `Con solo ${pair.n} estudiantes esta cifra aún no es sólida. ` : '';
  return (
    `${caution}Entre los ${pair.n} estudiantes que ya completaron ${label} de uso, el estudio registrado ${direction} de ` +
    `${hours(pair.mean_w1 ?? 0)} a ${hours(pair.mean_w2 ?? 0)} por estudiante (${signed(change)}). ` +
    `${pair.improved} de ${pair.n} estudiaron más que en su primera semana` +
    (pair.median_change_pct !== null ? `; la mediana del cambio individual fue ${signed(pair.median_change_pct)}.` : '.')
  );
}

/** Las frases citables del informe. */
function impactStatements(data: ImpactData): string[] {
  const h = data.headline;
  const lines: string[] = [];
  if (h.students === 0) return lines;

  const kept = pct(h.students_2w, h.students);
  lines.push(
    `Frame acompañó a ${h.students} estudiantes desde el ${longDate(h.first_day)}. ` +
      `${h.students_2w} de ellos${kept !== null ? ` (${kept} %)` : ''} la usaron en al menos dos semanas distintas.`
  );
  lines.push(
    `Registraron ${hours(h.minutes)} de estudio en ${h.sessions} sesiones, repartidas en ${h.study_days} jornadas de estudio` +
      (h.focus_avg !== null ? `, con un enfoque autoevaluado medio de ${String(h.focus_avg).replace('.', ',')} sobre 20.` : '.')
  );
  const second = pairSentence(data.w1_w2, 'dos semanas');
  if (second) lines.push(second);
  const fourth = pairSentence(data.w1_w4, 'cuatro semanas');
  if (fourth) lines.push(fourth.replace('su primera semana', 'su primera semana (comparada con la cuarta)'));
  if (h.tasks > 0) {
    const high = pct(h.tasks_high, h.tasks);
    const onTime = pct(h.tasks_on_time, h.tasks_with_due);
    lines.push(
      `Culminaron ${h.tasks} tareas; ${h.tasks_high}${high !== null ? ` (${high} %)` : ''} eran de importancia alta para el propio estudiante.` +
        (h.tasks_with_due > 0 ? ` De las ${h.tasks_with_due} que tenían fecha límite, ${h.tasks_on_time} (${onTime} %) se culminaron a tiempo.` : '')
    );
  }
  if (h.habits_rate !== null) lines.push(`La constancia media de sus hábitos fue del ${h.habits_rate} %.`);
  return lines;
}

const METHOD =
  'Son datos reales y seudónimos (cada estudiante es un identificador, sin nombre ni contenido), enviados por la app cifrados en tránsito ' +
  'y guardados cifrados en reposo; solo la cuenta del responsable puede leerlos, y sus propios datos no se cuentan. «Semana 1» son los ' +
  'primeros siete días de cada estudiante desde su primera actividad, y solo entran en cada comparación quienes ya completaron ese tramo. ' +
  'Miden lo que el estudiante registra en Frame: describen lo ocurrido, no prueban por sí solos que Frame sea la causa.';

const PLATFORM_LABEL: Record<string, string> = { windows: 'Windows', android: 'Android' };

export function buildImpactDoc(data: ImpactData, usage: UsageSummary | null): DocModel {
  const h = data.headline;
  const lines = impactStatements(data);
  const maxCohort = Math.max(1, ...data.cohort.map((row) => row.avg_minutes));
  const onTime = pct(h.tasks_on_time, h.tasks_with_due);
  // Numeración seguida aunque falte alguna sección (p. ej. sin salones).
  let sectionNo = 0;
  const nextIndex = () => String(++sectionNo).padStart(2, '0');
  const blocks: DocBlock[] = [
    {
      kind: 'cover',
      eyebrow: 'Informe de impacto',
      title: 'Frame en manos de los estudiantes',
      subtitle: h.first_day ? `Del ${longDate(h.first_day)} al ${longDate(data.today)}` : `Al ${longDate(data.today)}`,
      meta: [
        { label: 'Estudiantes', value: String(h.students) },
        { label: 'Estudio registrado', value: hours(h.minutes) },
        { label: 'Tareas culminadas', value: String(h.tasks) },
        { label: 'Generado', value: longDate(data.today) },
      ],
      footnote: 'Documento generado por Frame (VT Asvent) a partir de indicadores de uso seudónimos y agregados.',
    },
    { kind: 'section', title: 'Resumen', index: nextIndex() },
  ];

  if (lines.length === 0) {
    blocks.push({
      kind: 'callout',
      title: 'Aún no hay datos de estudio',
      text: 'Ningún estudiante ha registrado todavía una sesión o una tarea. Las cifras aparecen solas en cuanto lo hagan.',
      tone: 'muted',
    });
  } else {
    blocks.push(...lines.map((text): DocBlock => ({ kind: 'paragraph', text })));
  }

  blocks.push({
    kind: 'kpis',
    items: [
      { label: 'Estudiantes', value: String(h.students), note: `${h.students_2w} con 2 o más semanas de uso` },
      { label: 'Horas de estudio', value: hours(h.minutes), note: `${h.sessions} sesiones · ${h.study_days} jornadas` },
      { label: 'Enfoque medio', value: h.focus_avg !== null ? `${String(h.focus_avg).replace('.', ',')} / 20` : '—' },
      {
        label: 'Tareas a tiempo',
        value: onTime !== null ? `${onTime} %` : '—',
        note: `${h.tasks_on_time} de ${h.tasks_with_due} con plazo · ${h.tasks_high} de importancia alta`,
      },
    ],
  });

  if (data.cohort.length > 0) {
    blocks.push(
      { kind: 'section', title: 'Evolución por semana de uso', index: nextIndex(), note: 'Promedio por estudiante; semana 1 = primeros siete días de cada uno.' },
      {
        kind: 'bars',
        items: data.cohort.map((row) => ({
          label: `Semana ${row.wk}`,
          value: `${hours(row.avg_minutes)} · ${row.users_active}/${row.users_observable} activos`,
          percent: Math.round((row.avg_minutes / maxCohort) * 100),
        })),
        caption: 'Estudio registrado por estudiante en cada semana de uso, y cuántos seguían activos.',
      },
      {
        kind: 'table',
        head: ['Semana', 'Estudiantes', 'Activos', 'Media', 'Mediana', 'Días de estudio', 'Enfoque'],
        aligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
        weights: [16, 14, 12, 15, 15, 16, 12],
        rows: data.cohort.map((row) =>
          cells([
            `Semana ${row.wk}`,
            String(row.users_observable),
            String(row.users_active),
            hours(row.avg_minutes),
            hours(row.median_minutes),
            String(row.avg_active_days).replace('.', ','),
            row.avg_focus !== null ? String(row.avg_focus).replace('.', ',') : '—',
          ])
        ),
      }
    );
  }

  if (data.calendar_weeks.length > 0) {
    const maxWeek = Math.max(1, ...data.calendar_weeks.map((w) => w.minutes));
    blocks.push(
      { kind: 'section', title: 'Semanas del calendario', index: nextIndex(), note: 'Todo lo registrado cada semana, de lunes a domingo.' },
      {
        kind: 'bars',
        items: data.calendar_weeks.map((w) => ({
          label: format(parseISO(w.week_start), "d 'de' MMM", { locale: es }),
          value: `${hours(w.minutes)} · ${w.users} est. · ${w.tasks} tareas`,
          percent: Math.round((w.minutes / maxWeek) * 100),
        })),
      }
    );
  }

  if (usage) {
    const t = usage.totals;
    const retention = usage.retention.prev_week > 0 ? Math.round((usage.retention.retained / usage.retention.prev_week) * 100) : null;
    const maxScreen = Math.max(1, ...usage.screens.map((s) => s.views));
    blocks.push(
      { kind: 'section', title: 'Uso de la app', index: nextIndex(), note: `Últimos ${usage.days} días.` },
      {
        kind: 'kpis',
        items: [
          {
            label: 'Instalaciones',
            value: String(t.users_total),
            note:
              t.accounts_total !== undefined
                ? `${t.accounts_total} con cuenta · ${t.guests_total ?? 0} invitados`
                : undefined,
          },
          { label: 'Activos', value: String(t.active_7d), note: `en 7 días · ${t.active_today} hoy` },
          {
            label: 'Retención semanal',
            value: retention !== null ? `${retention} %` : '—',
            note: retention !== null ? `${usage.retention.retained} de ${usage.retention.prev_week} volvieron` : 'sin semana anterior',
          },
          { label: 'Aperturas', value: String(t.opens_period), note: `${t.sessions_period} sesiones · ${hours(t.minutes_period)}` },
        ],
      }
    );
    if (usage.screens.length > 0) {
      blocks.push({
        kind: 'bars',
        items: usage.screens.slice(0, 10).map((s) => ({
          label: s.label,
          value: `${s.views} visitas · ${s.users} est.`,
          percent: Math.round((s.views / maxScreen) * 100),
        })),
        caption: 'Interfaces más abiertas.',
      });
    }
    if (usage.versions.length > 0) {
      blocks.push({
        kind: 'table',
        head: ['Versión', 'Sistema', 'Estudiantes'],
        aligns: ['left', 'left', 'right'],
        weights: [34, 33, 33],
        rows: usage.versions.map((v) =>
          cells([v.version, PLATFORM_LABEL[v.platform ?? ''] ?? v.platform ?? '—', String(v.users)])
        ),
        caption: 'Versión instalada por estudiante (la más reciente que reportó).',
      });
    }
  }

  blocks.push(
    { kind: 'callout', title: 'Cómo leer estas cifras', text: METHOD, tone: 'muted' },
    { kind: 'footer', text: `Frame · VT Asvent — Informe de impacto. Generado el ${longDate(data.today)}.` }
  );
  return { title: 'Frame · Informe de impacto', blocks };
}
