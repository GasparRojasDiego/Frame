// ============================================================
// Horario mensual: instrucciones para el asistente, análisis del texto
// pegado y generación de las clases del mes.
//
// El colegio reparte el horario nuevo como una IMAGEN cada mes. Frame no
// interpreta imágenes, así que el camino es: el usuario copia estas
// instrucciones, se las da a un asistente junto con la foto, y pega de vuelta
// el texto que salga. Todo lo demás ocurre aquí, en local.
//
// El analizador es deliberadamente TOLERANTE: el texto lo escribe un modelo
// de lenguaje, y por muy claras que sean las instrucciones puede llegar con
// acentos de más, columnas de menos o los días en mayúsculas. Lo que no puede
// hacer es inventarse una asignatura: si un nombre no cuadra con ninguna de
// las que existen, se informa en lugar de adivinar.
// ============================================================

import type { ClassSession, Course, MonthlySchedule, ScheduleSlot } from '@/types';

/** Instrucciones de fábrica que el usuario copia y pega junto a la foto. */
const PROMPT_TEMPLATE = `Eres un asistente que transcribe horarios escolares. Te voy a dar la imagen del horario de clases de mi colegio para un mes concreto. Tu única tarea es convertirla en texto siguiendo EXACTAMENTE el formato que te indico abajo.

REGLAS ABSOLUTAS
1. Transcribe SOLO lo que veas en la imagen. No inventes clases, ni horas, ni profesores. Si un dato no aparece, deja la celda vacía.
2. Tu respuesta entera es UN SOLO BLOQUE CONTINUO: la línea "MES:" y, justo en la línea siguiente, la tabla completa. No pongas el mes en un bloque aparte del de la tabla, no uses dos bloques de código, no dejes líneas en blanco entre el mes y la tabla, y no añadas títulos, comentarios, saludos ni explicaciones ni antes ni después. Tengo que poder copiar tu respuesta de UNA sola vez y pegarla de UNA sola vez.
3. NO hay feriados ni días sin clase. No escribas ninguna línea de feriados.
4. Una fila por cada clase de la SEMANA TIPO. No repitas la misma clase para cada semana del mes: yo me encargo de repetirla.
5. Si una asignatura se dicta dos veces el mismo día (por ejemplo dos bloques separados), escribe DOS filas.
6. OMITE por completo las filas de "Autoestudio" y las de "Talleres". No son clases y no deben aparecer en la tabla.
__REGLAS_DE_NOMBRES__

FORMATO DE SALIDA
MES: AAAA-MM
| Asignatura | Día | Inicio | Fin | Aula | Profesor |
|---|---|---|---|---|---|
| __ASIGNATURA_DE_MUESTRA__ | Lunes | 07:30 | 09:00 | A-201 | Nombre del profesor |

DETALLE DE CADA CAMPO
- MES: el mes al que corresponde el horario, en formato año-mes con cuatro y dos dígitos. Ejemplo: MES: 2026-09
- Asignatura: el nombre YA RENOMBRADO según la regla 7.
- Día: el día de la semana en español y completo: Lunes, Martes, Miércoles, Jueves o Viernes.
- Inicio y Fin: hora en formato de 24 horas con dos dígitos y dos puntos. Ejemplo: 07:30 y 09:00. Nunca uses "7:30 am".
- Aula: el salón, laboratorio o ambiente. Si no aparece, deja la celda vacía.
- Profesor: el nombre del docente. Si no aparece, deja la celda vacía.

EJEMPLO COMPLETO DE UNA RESPUESTA VÁLIDA
MES: 2026-09
| Asignatura | Día | Inicio | Fin | Aula | Profesor |
|---|---|---|---|---|---|
__FILAS_DE_EJEMPLO__

Si algún dato de la imagen no se lee con seguridad, transcríbelo igual y añade un signo de interrogación entre corchetes al final de esa celda, así: 07:3[?]. No omitas la fila.`;

/**
 * Equivalencias conocidas entre el nombre que trae el horario del colegio y el
 * de la asignatura en Frame. Solo se incluyen en el prompt las que LLEVAN a una
 * asignatura que el estudiante tiene de verdad.
 *
 * Antes estaban todas escritas a fuego en el prompt de fábrica, incluidas
 * «Electivo 1 → Physics» y «Electivo 2 → ESS», que son los electivos de UN
 * alumno: a cualquier otro estudiante le asignaba esas horas a asignaturas que
 * no cursa, sin avisar.
 */
const KNOWN_RENAMES: [string, string][] = [
  ['Literatura NS', 'Literature'],
  ['Inglés NS', 'English'],
  ['TDC', 'TOK'],
  ['Tutoría', 'Advisory'],
  ['Electivo 1', 'Physics'],
  ['Matemática NM', 'Mathematics'],
  ['TEMP', 'TFE'],
  ['Historia NS', 'History'],
  ['Electivo 2', 'ESS'],
  ['Educación Física', 'Physical Education'],
  ['CAS', 'CAS'],
  ['Arte y cultura', 'Visual Arts'],
  ['Habilidades Investigativas', 'Research Skills'],
  ['C Y E', 'Civics & Environments'],
];

const SAMPLE_TEACHERS = ['Carlos Ramos', 'Lucía Fernández', 'Ana Torres', 'Carlos Ramos'];
const SAMPLE_SLOTS: [string, string, string, string][] = [
  ['Lunes', '07:30', '09:00', 'A-201'],
  ['Lunes', '09:15', '10:45', 'A-201'],
  ['Martes', '07:30', '09:00', 'Lab-2'],
  ['Miércoles', '10:00', '11:30', 'A-201'],
];

/**
 * El prompt de fábrica, hecho a la medida de las asignaturas del estudiante:
 * la IA recibe SU lista y la orden de usar exactamente esos nombres, que es lo
 * que permite a Frame casar cada clase con su asignatura al pegar la tabla.
 */
export function buildSchedulePrompt(courseNames: string[] = []): string {
  const names = [...new Set(courseNames.map((name) => name.trim()).filter(Boolean))];
  const owned = new Set(names.map(fold));
  const renames = KNOWN_RENAMES.filter(([, target]) => owned.has(fold(target)));

  const rules: string[] = [];
  if (names.length > 0) {
    rules.push(
      '7. Los nombres de las asignaturas tienen que ser los de MI lista. Estas son mis asignaturas:\n' +
        names.map((name) => `   - ${name}`).join('\n') +
        '\n   Si una clase de la imagen corresponde CON CLARIDAD a una de ellas —aunque venga abreviada, con otro nombre o en otro idioma—, escribe en la columna Asignatura EXACTAMENTE el nombre de mi lista, letra por letra.'
    );
    if (renames.length > 0) {
      rules.push(
        '   Equivalencias que ya te doy resueltas (izquierda: como aparece en el horario; derecha: como debes escribirla):\n' +
          renames.map(([from, to]) => `   - ${from} → ${to}`).join('\n')
      );
    }
    rules.push(
      '8. Si una clase NO corresponde con claridad a ninguna de mi lista (por ejemplo un nombre genérico como «Electivo 1», y no es Autoestudio ni Talleres), escríbela tal cual aparece en la imagen. No la traduzcas ni la asocies por parecido: prefiero verla sin cambiar y decidir yo.'
    );
  } else {
    rules.push(
      '7. Escribe el nombre de cada asignatura tal cual aparece en la imagen, completo y sin traducir.',
      '8. No fusiones ni renombres asignaturas por parecido: prefiero verlas como están y decidir yo.'
    );
  }

  const sampleNames = names.length >= 2 ? names : ['Historia', 'Matemática', 'Física', 'Comunicación'];
  const rows = SAMPLE_SLOTS.map(
    ([weekday, start, end, room], i) =>
      `| ${sampleNames[i % sampleNames.length]} | ${weekday} | ${start} | ${end} | ${room} | ${SAMPLE_TEACHERS[i]} |`
  );

  return PROMPT_TEMPLATE.replace('__REGLAS_DE_NOMBRES__', rules.join('\n'))
    .replace('__ASIGNATURA_DE_MUESTRA__', sampleNames[0])
    .replace('__FILAS_DE_EJEMPLO__', rows.join('\n'));
}

// ------------------------------------------------------------
// Instrucciones editables
//
// El horario del colegio puede cambiar de forma (nombres nuevos, columnas
// distintas) sin que la app cambie. Por eso el prompt se puede editar y
// guardar: vive en localStorage y el de fábrica sigue disponible para volver.
// ------------------------------------------------------------

const PROMPT_KEY = 'schedulePrompt';

/** Un prompt guardado que contiene la vieja tabla fija NO es una versión
 *  propia: es el de fábrica de antes, y se sustituye por el nuevo. */
const isLegacyFactory = (stored: string): boolean =>
  stored.includes('Electivo 1 → Physics') && stored.includes('Los nombres de las asignaturas se RENOMBRAN');

function readStoredPrompt(courseNames: string[]): string | null {
  try {
    const stored = localStorage.getItem(PROMPT_KEY);
    if (!stored || !stored.trim()) return null;
    if (stored.trim() === buildSchedulePrompt(courseNames).trim()) return null;
    if (isLegacyFactory(stored)) return null;
    return stored;
  } catch {
    return null;
  }
}

/** El prompt vigente: el propio del usuario si lo hay, o el de fábrica. */
export function loadSchedulePrompt(courseNames: string[] = []): string {
  return readStoredPrompt(courseNames) ?? buildSchedulePrompt(courseNames);
}

/** Guarda una versión propia. Vacía o idéntica al original ⇒ vuelve al de fábrica. */
export function saveSchedulePrompt(value: string, courseNames: string[] = []): void {
  try {
    if (!value.trim() || value.trim() === buildSchedulePrompt(courseNames).trim()) {
      localStorage.removeItem(PROMPT_KEY);
    } else {
      localStorage.setItem(PROMPT_KEY, value);
    }
  } catch {
    // Sin almacenamiento: el prompt sigue siendo el de fábrica y punto.
  }
}

/** ¿El usuario tiene una versión propia guardada? */
export function isSchedulePromptCustom(courseNames: string[] = []): boolean {
  return readStoredPrompt(courseNames) !== null;
}

// ------------------------------------------------------------
// Utilidades de normalización
// ------------------------------------------------------------

/** Minúsculas y sin acentos: la comparación de nombres tiene que perdonar. */
export const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const WEEKDAYS: Record<string, number> = {
  lunes: 1, martes: 2, miercoles: 3, jueves: 4,
  viernes: 5, sabado: 6, domingo: 7,
};

const MONTH_NAMES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

/** "Miércoles" → 3. Devuelve null si no reconoce el día. */
export function parseWeekday(raw: string): number | null {
  const key = fold(raw).replace(/[^a-z]/g, '');
  for (const [name, value] of Object.entries(WEEKDAYS)) {
    if (key.startsWith(name.slice(0, 4))) return value;
  }
  return null;
}

/** "7:30", "07.30", "7:30 a. m.", "19:00" → "07:30". null si no hay hora. */
export function parseTime(raw: string): string | null {
  const text = fold(raw);
  const match = text.match(/(\d{1,2})\s*[:.\s]\s*(\d{2})/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;
  // Sufijos de 12 horas, por si el modelo los cuela pese a las instrucciones.
  if (/p\.?\s?m/.test(text) && hour < 12) hour += 12;
  if (/a\.?\s?m/.test(text) && hour === 12) hour = 0;
  if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** "2026-09", "septiembre 2026", "09/2026" → "2026-09". */
export function parseMonth(raw: string): string | null {
  const text = fold(raw);

  const iso = text.match(/(\d{4})\s*[-/]\s*(\d{1,2})/);
  if (iso) {
    const month = Number(iso[2]);
    if (month >= 1 && month <= 12) return `${iso[1]}-${String(month).padStart(2, '0')}`;
  }

  const numeric = text.match(/(\d{1,2})\s*[-/]\s*(\d{4})/);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month >= 1 && month <= 12) return `${numeric[2]}-${String(month).padStart(2, '0')}`;
  }

  for (const [name, value] of Object.entries(MONTH_NAMES)) {
    if (text.includes(name)) {
      const year = text.match(/(\d{4})/);
      if (year) return `${year[1]}-${String(value).padStart(2, '0')}`;
    }
  }
  return null;
}

const parseDates = (raw: string): string[] => {
  const out: string[] = [];
  for (const match of raw.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) out.push(match[0]);
  return out;
};

// ------------------------------------------------------------
// Análisis del documento pegado
// ------------------------------------------------------------

export interface ParsedSchedule {
  month: string | null;
  skipDates: string[];
  slots: ScheduleSlot[];
  /** Nombres de asignatura del documento que no existen en la app. */
  unknownCourses: string[];
  /** Filas descartadas por no tener día u hora legibles. */
  droppedRows: number;
}

/**
 * Analiza el texto pegado. Acepta tanto la tabla Markdown de las
 * instrucciones como filas separadas por `|` sin cabecera, que es en lo que
 * suele degenerar cuando el modelo improvisa.
 */
export function parseSchedule(text: string, courses: Course[]): ParsedSchedule {
  const lines = text.split(/\r?\n/);

  let month: string | null = null;
  const skipDates: string[] = [];
  const slots: ScheduleSlot[] = [];
  const unknown = new Set<string>();
  let dropped = 0;

  // Índice de asignaturas: primero por nombre exacto (plegado) y, si falla,
  // por PALABRAS COMPLETAS en cualquiera de los dos sentidos
  // ("Historia" ↔ "Historia del Perú").
  //
  // Antes se comparaba por subcadena, y "CAS" caía dentro de "matemátiCAS":
  // la clase se asignaba a la asignatura equivocada sin ningún aviso. Ahora
  // tienen que coincidir palabras enteras, y si el texto encaja con MÁS de una
  // asignatura no se adivina: la fila sale como desconocida para que decida
  // el estudiante.
  const byName = new Map<string, Course>();
  for (const course of courses) byName.set(fold(course.name), course);

  const wordsOf = (value: string): string[] => value.split(/[^a-z0-9ñ]+/).filter(Boolean);
  const courseWords = courses.map((course) => ({ course, words: new Set(wordsOf(fold(course.name))) }));

  const findCourse = (raw: string): Course | null => {
    const clean = fold(raw.replace(/\[\?\]/g, ''));
    if (!clean) return null;
    const exact = byName.get(clean);
    if (exact) return exact;

    const wanted = wordsOf(clean);
    if (wanted.length === 0) return null;
    const wantedSet = new Set(wanted);
    const candidates = courseWords.filter(({ words }) => {
      if (words.size === 0) return false;
      const textInsideName = wanted.every((word) => words.has(word));
      const nameInsideText = [...words].every((word) => wantedSet.has(word));
      return textInsideName || nameInsideText;
    });
    return candidates.length === 1 ? candidates[0].course : null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const folded = fold(trimmed);

    if (!month && /^mes\s*:/.test(folded)) {
      month = parseMonth(trimmed.split(':').slice(1).join(':'));
      continue;
    }
    if (/^(feriados|sin clases|no hay clases)\s*:/.test(folded)) {
      skipDates.push(...parseDates(trimmed));
      continue;
    }

    if (!trimmed.includes('|')) continue;

    const cells = trimmed.split('|').map((c) => c.trim());
    // Las tuberías de los extremos dejan celdas vacías: se descartan.
    if (cells.length && cells[0] === '') cells.shift();
    if (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (cells.length < 4) continue;

    // Separador de la tabla Markdown (|---|---|).
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    // Fila de cabecera.
    if (fold(cells[0]) === 'asignatura' || fold(cells[1] ?? '') === 'dia') continue;

    const [rawCourse, rawDay, rawStart, rawEnd, rawRoom, rawTeacher] = cells;
    const weekday = parseWeekday(rawDay ?? '');
    const start = parseTime(rawStart ?? '');
    const end = parseTime(rawEnd ?? '');

    if (weekday === null || !start) {
      dropped += 1;
      continue;
    }

    const course = findCourse(rawCourse ?? '');
    if (!course) {
      if (rawCourse?.trim()) unknown.add(rawCourse.trim());
      dropped += 1;
      continue;
    }

    slots.push({
      id: crypto.randomUUID(),
      courseId: course.id,
      courseName: course.name,
      weekday,
      start,
      end: end ?? start,
      room: rawRoom?.trim() || undefined,
      teacher: rawTeacher?.trim() || undefined,
    });
  }

  // Si el documento no dijo el mes, se busca una fecha suelta en el texto.
  if (!month) {
    const anyDate = parseDates(text)[0];
    if (anyDate) month = anyDate.slice(0, 7);
  }

  return {
    month,
    skipDates: [...new Set(skipDates)],
    slots,
    unknownCourses: [...unknown],
    droppedRows: dropped,
  };
}

// ------------------------------------------------------------
// Generación de las clases del mes
// ------------------------------------------------------------

/** Días del mes "yyyy-MM" como cadenas "yyyy-MM-dd", sin tocar husos. */
function daysOfMonth(month: string): { date: string; weekday: number }[] {
  const [year, monthIndex] = month.split('-').map(Number);
  if (!year || !monthIndex) return [];
  const out: { date: string; weekday: number }[] = [];
  const total = new Date(year, monthIndex, 0).getDate();
  for (let day = 1; day <= total; day++) {
    const date = new Date(year, monthIndex - 1, day);
    // getDay(): 0 = domingo. Se pasa a ISO, donde 7 = domingo.
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    out.push({
      date: `${year}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      weekday,
    });
  }
  return out;
}

/**
 * Clave estable de una clase: misma asignatura, mismo día y misma hora de
 * inicio son SIEMPRE la misma clase. Es lo que hace que volver a pulsar
 * "Añadir" no duplique nada.
 */
export const classSessionKey = (s: { courseId: string; date: string; start: string }): string =>
  `${s.courseId}|${s.date}|${s.start}`;

/**
 * Expande la semana tipo a todas las fechas del mes, saltando los feriados.
 * `existing` son las clases ya creadas: las que coincidan no se repiten.
 */
export function buildClassSessions(
  schedule: MonthlySchedule,
  existing: ClassSession[],
  options?: { courseId?: string }
): ClassSession[] {
  const taken = new Set(existing.map(classSessionKey));
  const skip = new Set(schedule.skipDates ?? []);
  const now = new Date().toISOString();
  const out: ClassSession[] = [];

  for (const { date, weekday } of daysOfMonth(schedule.month)) {
    if (skip.has(date)) continue;
    for (const slot of schedule.slots) {
      if (slot.weekday !== weekday) continue;
      if (options?.courseId && slot.courseId !== options.courseId) continue;
      const key = classSessionKey({ courseId: slot.courseId, date, start: slot.start });
      if (taken.has(key)) continue;
      taken.add(key);
      out.push({
        id: crypto.randomUUID(),
        courseId: slot.courseId,
        date,
        weekday,
        start: slot.start,
        end: slot.end,
        room: slot.room,
        teacher: slot.teacher,
        createdAt: now,
      });
    }
  }

  // Orden natural: por fecha y, dentro del día, por hora de inicio.
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** Duración de la clase en minutos; 0 si el horario no traía hora de fin. */
export function classMinutes(session: { start: string; end: string }): number {
  const [sh, sm] = session.start.split(':').map(Number);
  const [eh, em] = session.end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) return 0;
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}
