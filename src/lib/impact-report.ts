import { format, parseISO } from 'date-fns';
import type { DocBlock, DocCell, DocModel } from '@/lib/report-doc';
import { dateLocale, decimalText, tr } from '@/lib/i18n';

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
  return value >= 100 ? `${Math.round(value)} h` : `${decimalText(value)} h`;
};
const cells = (values: string[]): DocCell[] => values.map((text, index) => ({ text, bold: index === 0 }));
const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);
const signed = (value: number): string => `${value > 0 ? '+' : ''}${value} %`;
const longDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return format(parseISO(iso), tr('d \'de\' MMMM \'de\' yyyy'), { locale: dateLocale() });
  } catch {
    return iso;
  }
};

function pairSentence(pair: PairStats, label: string): string | null {
  if (!pair || pair.n === 0 || !pair.sum_w1) return null;
  const change = Math.round(((pair.sum_w2 - pair.sum_w1) / pair.sum_w1) * 100);
  const direction = change >= 0 ? tr('subió') : tr('bajó');
  const caution = pair.n < 10 ? tr('Con solo {n} estudiantes esta cifra aún no es sólida. ', { n: pair.n }) : '';
  return (
    tr('{caution}Entre los {n} estudiantes que ya completaron {label} de uso, el estudio registrado {direction} de ', { caution, n: pair.n, label, direction }) +
    tr('{hours} a {hours2} por estudiante ({signed}). ', { hours: hours(pair.mean_w1 ?? 0), hours2: hours(pair.mean_w2 ?? 0), signed: signed(change) }) +
    tr('{improved} de {n} estudiaron más que en su primera semana', { improved: pair.improved, n: pair.n }) +
    (pair.median_change_pct !== null ? tr('; la mediana del cambio individual fue {signed}.', { signed: signed(pair.median_change_pct) }) : '.')
  );
}

/** Las frases citables del informe. */
function impactStatements(data: ImpactData): string[] {
  const h = data.headline;
  const lines: string[] = [];
  if (h.students === 0) return lines;

  const kept = pct(h.students_2w, h.students);
  lines.push(
    tr('Frame acompañó a {students} estudiantes desde el {longDate}. ', { students: h.students, longDate: longDate(h.first_day) }) +
      tr('{students_2w} de ellos{p} la usaron en al menos dos semanas distintas.', { students_2w: h.students_2w, p: kept !== null ? ` (${kept} %)` : '' })
  );
  lines.push(
    tr('Registraron {hours} de estudio en {sessions} sesiones, repartidas en {study_days} jornadas de estudio', { hours: hours(h.minutes), sessions: h.sessions, study_days: h.study_days }) +
      (h.focus_avg !== null ? tr(', con un enfoque autoevaluado medio de {p} sobre 20.', { p: decimalText(h.focus_avg) }) : '.')
  );
  const second = pairSentence(data.w1_w2, tr('dos semanas'));
  if (second) lines.push(second);
  const fourth = pairSentence(data.w1_w4, tr('cuatro semanas'));
  if (fourth) lines.push(fourth.replace(tr('su primera semana'), tr('su primera semana (comparada con la cuarta)')));
  if (h.tasks > 0) {
    const high = pct(h.tasks_high, h.tasks);
    const onTime = pct(h.tasks_on_time, h.tasks_with_due);
    lines.push(
      tr('Culminaron {tasks} tareas; {tasks_high}{p} eran de importancia alta para el propio estudiante.', { tasks: h.tasks, tasks_high: h.tasks_high, p: high !== null ? ` (${high} %)` : '' }) +
        (h.tasks_with_due > 0 ? tr(' De las {tasks_with_due} que tenían fecha límite, {tasks_on_time} ({onTime} %) se culminaron a tiempo.', { tasks_with_due: h.tasks_with_due, tasks_on_time: h.tasks_on_time, onTime }) : '')
    );
  }
  if (h.habits_rate !== null) lines.push(tr('La constancia media de sus hábitos fue del {habits_rate} %.', { habits_rate: h.habits_rate }));
  return lines;
}

const method = () =>
  tr(
    'Son datos reales y seudónimos (cada estudiante es un identificador, sin nombre ni contenido), enviados por la app cifrados en tránsito ' +
      'y guardados cifrados en reposo; solo la cuenta del responsable puede leerlos, y sus propios datos no se cuentan. «Semana 1» son los ' +
      'primeros siete días de cada estudiante desde su primera actividad, y solo entran en cada comparación quienes ya completaron ese tramo. ' +
      'Miden lo que el estudiante registra en Frame: describen lo ocurrido, no prueban por sí solos que Frame sea la causa.'
  );

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
      eyebrow: tr('Informe de impacto'),
      title: tr('Frame en manos de los estudiantes'),
      subtitle: h.first_day ? tr('Del {longDate} al {longDate2}', { longDate: longDate(h.first_day), longDate2: longDate(data.today) }) : tr('Al {longDate}', { longDate: longDate(data.today) }),
      meta: [
        { label: tr('Estudiantes'), value: String(h.students) },
        { label: tr('Estudio registrado'), value: hours(h.minutes) },
        { label: tr('Tareas culminadas'), value: String(h.tasks) },
        { label: tr('Generado'), value: longDate(data.today) },
      ],
      footnote: tr('Documento generado por Frame (VT Asvent) a partir de indicadores de uso seudónimos y agregados.'),
    },
    { kind: 'section', title: tr('Resumen'), index: nextIndex() },
  ];

  if (lines.length === 0) {
    blocks.push({
      kind: 'callout',
      title: tr('Aún no hay datos de estudio'),
      text: tr('Ningún estudiante ha registrado todavía una sesión o una tarea. Las cifras aparecen solas en cuanto lo hagan.'),
      tone: 'muted',
    });
  } else {
    blocks.push(...lines.map((text): DocBlock => ({ kind: 'paragraph', text })));
  }

  blocks.push({
    kind: 'kpis',
    items: [
      { label: tr('Estudiantes'), value: String(h.students), note: tr('{students_2w} con 2 o más semanas de uso', { students_2w: h.students_2w }) },
      { label: tr('Horas de estudio'), value: hours(h.minutes), note: tr('{sessions} sesiones · {study_days} jornadas', { sessions: h.sessions, study_days: h.study_days }) },
      { label: tr('Enfoque medio'), value: h.focus_avg !== null ? `${decimalText(h.focus_avg)} / 20` : '—' },
      {
        label: tr('Tareas a tiempo'),
        value: onTime !== null ? `${onTime} %` : '—',
        note: tr('{tasks_on_time} de {tasks_with_due} con plazo · {tasks_high} de importancia alta', { tasks_on_time: h.tasks_on_time, tasks_with_due: h.tasks_with_due, tasks_high: h.tasks_high }),
      },
    ],
  });

  if (data.cohort.length > 0) {
    blocks.push(
      { kind: 'section', title: tr('Evolución por semana de uso'), index: nextIndex(), note: tr('Promedio por estudiante; semana 1 = primeros siete días de cada uno.') },
      {
        kind: 'bars',
        items: data.cohort.map((row) => ({
          label: tr('Semana {wk}', { wk: row.wk }),
          value: tr('{hours} · {users_active}/{users_observable} activos', { hours: hours(row.avg_minutes), users_active: row.users_active, users_observable: row.users_observable }),
          percent: Math.round((row.avg_minutes / maxCohort) * 100),
        })),
        caption: tr('Estudio registrado por estudiante en cada semana de uso, y cuántos seguían activos.'),
      },
      {
        kind: 'table',
        head: [tr('Semana'), tr('Estudiantes'), tr('Activos'), tr('Media'), tr('Mediana'), tr('Días de estudio'), tr('Enfoque')],
        aligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
        weights: [16, 14, 12, 15, 15, 16, 12],
        rows: data.cohort.map((row) =>
          cells([
            tr('Semana {wk}', { wk: row.wk }),
            String(row.users_observable),
            String(row.users_active),
            hours(row.avg_minutes),
            hours(row.median_minutes),
            decimalText(row.avg_active_days),
            row.avg_focus !== null ? decimalText(row.avg_focus) : '—',
          ])
        ),
      }
    );
  }

  if (data.calendar_weeks.length > 0) {
    const maxWeek = Math.max(1, ...data.calendar_weeks.map((w) => w.minutes));
    blocks.push(
      { kind: 'section', title: tr('Semanas del calendario'), index: nextIndex(), note: tr('Todo lo registrado cada semana, de lunes a domingo.') },
      {
        kind: 'bars',
        items: data.calendar_weeks.map((w) => ({
          label: format(parseISO(w.week_start), tr('d \'de\' MMM'), { locale: dateLocale() }),
          value: tr('{hours} · {users} est. · {tasks} tareas', { hours: hours(w.minutes), users: w.users, tasks: w.tasks }),
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
      { kind: 'section', title: tr('Uso de la app'), index: nextIndex(), note: tr('Últimos {days} días.', { days: usage.days }) },
      {
        kind: 'kpis',
        items: [
          {
            label: tr('Instalaciones'),
            value: String(t.users_total),
            note:
              t.accounts_total !== undefined
                ? tr('{accounts_total} con cuenta · {p} invitados', { accounts_total: t.accounts_total, p: t.guests_total ?? 0 })
                : undefined,
          },
          { label: tr('Activos'), value: String(t.active_7d), note: tr('en 7 días · {active_today} hoy', { active_today: t.active_today }) },
          {
            label: tr('Retención semanal'),
            value: retention !== null ? `${retention} %` : '—',
            note: retention !== null ? tr('{retained} de {prev_week} volvieron', { retained: usage.retention.retained, prev_week: usage.retention.prev_week }) : tr('sin semana anterior'),
          },
          { label: tr('Aperturas'), value: String(t.opens_period), note: tr('{sessions_period} sesiones · {hours}', { sessions_period: t.sessions_period, hours: hours(t.minutes_period) }) },
        ],
      }
    );
    if (usage.screens.length > 0) {
      blocks.push({
        kind: 'bars',
        items: usage.screens.slice(0, 10).map((s) => ({
          label: s.label,
          value: tr('{views} visitas · {users} est.', { views: s.views, users: s.users }),
          percent: Math.round((s.views / maxScreen) * 100),
        })),
        caption: tr('Interfaces más abiertas.'),
      });
    }
    if (usage.versions.length > 0) {
      blocks.push({
        kind: 'table',
        head: [tr('Versión'), tr('Sistema'), tr('Estudiantes')],
        aligns: ['left', 'left', 'right'],
        weights: [34, 33, 33],
        rows: usage.versions.map((v) =>
          cells([v.version, PLATFORM_LABEL[v.platform ?? ''] ?? v.platform ?? '—', String(v.users)])
        ),
        caption: tr('Versión instalada por estudiante (la más reciente que reportó).'),
      });
    }
  }

  blocks.push(
    { kind: 'callout', title: tr('Cómo leer estas cifras'), text: method(), tone: 'muted' },
    { kind: 'footer', text: tr('Frame · VT Asvent — Informe de impacto. Generado el {longDate}.', { longDate: longDate(data.today) }) }
  );
  return { title: tr('Frame · Informe de impacto'), blocks };
}
