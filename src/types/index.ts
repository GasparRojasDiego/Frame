

export type TaskSortMode = 'custom' | 'proximity' | 'relevance';

export interface UserProfile {
  id: string;
  username: string;
  isGuest: boolean;
  createdAt: string;
  email?: string;
  /** Nombres y apellidos reales (se piden al crear la cuenta). Opcionales:
   *  los perfiles anteriores a la 1.4.8 y los de invitado no los traen. */
  firstNames?: string;
  lastNames?: string;
}

export type TaskPriority = 'Baja' | 'Media' | 'Alta';

/** Naturaleza del pendiente. No todo lo que hay que hacer es "tarea del
 *  profesor": hay exámenes, proyectos, actividades del colegio (día del padre)
 *  y cosas que uno se propone por su cuenta. */
export type TaskKind = 'Tarea' | 'Examen' | 'Proyecto' | 'Actividad' | 'Personal';

/** Dificultad percibida. Tres niveles y no una escala 1-20: elegir es
 *  instantáneo, los valores son comparables entre tareas y no se solapa con
 *  `priority` (urgencia), que es un eje distinto. */
export type TaskDifficulty = 'Fácil' | 'Media' | 'Difícil';

export interface Task {
  id: string;
  courseId: string;
  name: string;
  description: string;
  dueDate: string | null; // ISO 8601 string
  priority: TaskPriority;
  /** Opcionales por retrocompatibilidad: las tareas creadas antes de la
   *  Fase 22 no los traen y se tratan como 'Tarea' / sin dificultad. */
  kind?: TaskKind;
  difficulty?: TaskDifficulty;
  progress: number;
  order?: number;
  courseName: string;
  uid: string;
  /** Recordatorio propio de la tarea. DESACTIVADO por defecto: solo cuenta si
   *  es `true` Y hay una hora elegida. */
  reminderEnabled?: boolean;
  /** Hora del recordatorio, formato "HH:mm". */
  reminderTime?: string;
  /** Días de la semana en que suena (0 = domingo … 6 = sábado). Vacío o
   *  ausente = todos los días. */
  reminderDays?: number[];
  /** Cada cuántos minutos REAPARECE ese día a partir de su hora (0 o ausente =
   *  una sola vez). Pensado para lo muy importante. */
  reminderRepeatMinutes?: number;
  /** @deprecated Anterior a la 1.4.8 (repetición en horas). Ya no se usa. */
  reminderFrequencyHours?: number;
  /** Clase en la que se dejó la tarea (clave estable, ver src/lib/class-link.ts). */
  classKey?: string;
  /** Tiempo estimado para culminar la tarea, en minutos. El avance por
   *  sesiones de estudio se calcula en proporción directa a este valor. */
  estimatedMinutes?: number;
  /** Enlaces y documentos asociados a la tarea. */
  attachments?: TaskAttachment[];
}

export type TaskAttachmentKind = 'url' | 'file';

/**
 * Adjunto de una tarea.
 *
 * Los archivos NO se copian dentro de la app: se guarda un manejador al
 * archivo real del disco (ver src/lib/file-handles.ts), de modo que si el
 * usuario sigue trabajando en el documento y lo guarda, Frame ve la versión
 * nueva. `live: false` marca los que sí son una copia congelada.
 */
export interface TaskAttachment {
  id: string;
  kind: TaskAttachmentKind;
  /** Nombre visible: el título del enlace o el nombre del archivo. */
  label: string;
  /** Solo para kind === 'url'. */
  url?: string;
  /** Solo para kind === 'file'. */
  mime?: string;
  live?: boolean;
  addedAt: string; // ISO 8601
}

/**
 * Una clase de la SEMANA TIPO, tal como viene del horario del mes.
 * `weekday` sigue la norma ISO: 1 = lunes … 7 = domingo.
 */
export interface ScheduleSlot {
  id: string;
  courseId: string;
  courseName: string;
  weekday: number;
  /** "HH:mm" en 24 horas. */
  start: string;
  end: string;
  room?: string;
  teacher?: string;
}

/** Horario de un mes concreto, importado desde la foto que reparte el colegio. */
export interface MonthlySchedule {
  /** "yyyy-MM"; es también la clave: un horario por mes. */
  month: string;
  importedAt: string; // ISO 8601
  slots: ScheduleSlot[];
  /** Días de ese mes SIN clase (feriados, aniversario…). */
  skipDates?: string[]; // ["yyyy-MM-dd"]
}

/**
 * Una clase concreta en una fecha concreta: lo que el usuario ve como tarjeta.
 * No confundir con StudySession, que es el tiempo que el usuario dedicó por
 * su cuenta; esto es la clase que le toca según el horario.
 */
export interface ClassSession {
  id: string;
  courseId: string;
  date: string; // "yyyy-MM-dd"
  weekday: number;
  start: string; // "HH:mm"
  end: string;
  room?: string;
  teacher?: string;
  /** Lo que se vio en clase; lo escribe el usuario. */
  topic?: string;
  createdAt: string; // ISO 8601
}

export type NoteKind = 'text' | 'url' | 'file';

export interface Note {
  id: string;
  courseId: string;
  content: string;
  createdAt: string; // ISO 8601 string
  order?: number;
  /** 'text' por defecto si no está definido. */
  kind?: NoteKind;
  /** Para notas de tipo 'url'. */
  url?: string;
  /** Para notas de tipo 'file': el archivo real vive en IndexedDB (music-db, clave `noteFile_<id>`). */
  fileName?: string;
  fileMime?: string;
  /** Clase a la que pertenece (clave estable `asignatura|día|hora`, ver
   *  src/lib/class-link.ts). Ausente = recurso sin clase. */
  classKey?: string;
}

/** Tarea culminada: en lugar de desaparecer, pasa al archivo de la
 *  asignatura con la fecha/hora exacta en que se completó. */
export interface ArchivedTask extends Task {
  archivedAt: string; // ISO 8601
  /** 'incomplete': no se pudo terminar. Vive en su propia colección
   *  (`incompleteTasks`) y NO cuenta como tarea culminada en ninguna métrica. */
  outcome?: 'incomplete';
}

/** Recurso (nota) eliminado: pasa al archivo; su adjunto de IndexedDB se
 *  conserva hasta que el archivo de la asignatura se purga. */
export interface ArchivedNote extends Note {
  archivedAt: string; // ISO 8601
}

export interface Course {
  id: string;
  name: string;
  teacherName?: string;
}

/** Momento del día en que toca un hábito. Ausente = «todo el día». */
export type HabitPhase = 'morning' | 'afternoon' | 'night';

export interface Habit {
  id: string;
  name: string;
  /** Fase del día: el avance de HOY solo cuenta los hábitos cuya fase ya empezó. */
  phase?: HabitPhase;
  /**
   * «Cada cierto tiempo»: días de la semana en que toca (0 = domingo …
   * 6 = sábado). Ausente o vacío = cada día. Los días que no tocan no son
   * fallos (ver src/lib/habit-schedule.ts).
   */
  days?: number[];
  completedOn: string[]; // Array of 'YYYY-MM-DD' date strings
  /** Alta del hábito (ISO). Los informes no cuentan como "fallados" los días
   *  anteriores. Ausente en los hábitos creados antes de la 1.4.6. */
  createdAt?: string;
  isArchived?: boolean;
  order?: number;
}

export interface Song {
  id: string; // Will be a UUID, used as key in IndexedDB
  title: string;
  artist: string;
  album: string;
  picture: string; // base64 data URI for cover art
  fileName: string;
  isFavorite?: boolean;
  /**
   * Orden de llegada a la biblioteca: 0 la más antigua, el número más alto
   * la última descargada. Existe porque IndexedDB devuelve los registros
   * ordenados por CLAVE, y la clave es un UUID: sin este campo la biblioteca
   * se recolocaba al azar en cada arranque. Opcional solo por las canciones
   * anteriores a la Fase 26; se rellena al cargar.
   */
  seq?: number;
}

/**
 * Vídeo de estudio guardado en la interfaz Enfoque.
 *
 * Se guarda la FICHA, no el vídeo: se reproduce con el reproductor de YouTube.
 */
export interface StudyVideo {
  /** Identificador de YouTube. */
  id: string;
  title: string;
  uploader: string;
  /** Duración en segundos; 0 si YouTube no la informó. */
  duration: number;
  addedAt: string; // ISO 8601
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
}

export interface Space {
  id: string;
  name: string;
  courseIds: string[];
}

/**
 * Anotación hecha DURANTE la sesión de estudio, no al final.
 *
 * Existe porque al cerrar la sesión uno ya no se acuerda de lo que hizo en el
 * primer tramo. Guarda la hora exacta y el minuto de sesión en que se escribió,
 * así que además de recordar sirve de registro de por dónde fue avanzando.
 */
export interface SessionNote {
  id: string;
  text: string;
  /** Instante real (ISO) en que se escribió. */
  at: string;
  /** Segundos de sesión transcurridos en ese momento. */
  elapsedSec: number;
  /** Contexto opcional del avance. */
  courseId?: string;
  courseName?: string;
  taskId?: string;
  taskName?: string;
  /** Enfoque percibido (1-20) en ese momento. */
  focus?: number;
}

export interface StudySession {
  id: string;
  startTime: string; // ISO 8601 string
  endTime: string;   // ISO 8601 string
  /** DERIVADO de durationSec: minutos CON DECIMALES (durationSec / 60).
   *  Se conserva por retrocompatibilidad — todas las pantallas que ya
   *  sumaban minutos siguen funcionando sin cambios. NUNCA se redondea
   *  al escribirlo. */
  duration: number;
  /** FUENTE DE VERDAD: duración exacta de la sesión en SEGUNDOS.
   *  Opcional solo para poder LEER datos antiguos; el normalizador de
   *  CourseContext lo rellena (duration * 60) al cargar.
   *  Ver `sessionSeconds` en src/lib/duration.ts. */
  durationSec?: number;
  sessionType: 'Temporizador' | 'Cronómetro';
  perception: number; // Self-perception score (1-20)
  subjects: string[]; // Names of the subjects studied
  subjectIds?: string[];
  mode?: 'rendimiento' | 'tiempo';
  /** Tareas avanzadas durante la sesión: su % de progreso sube en
   *  proporción duración de la sesión / tiempo estimado de la tarea. */
  taskIds?: string[];
  /** Anotación libre de lo que se hizo en la sesión. */
  notes?: string;
  /** Avances anotados MIENTRAS duraba la sesión, con su hora. */
  progressNotes?: SessionNote[];
}

/**
 * Naturaleza de un evento del calendario local. Los tres primeros valores son
 * los originales y se conservan tal cual para no romper los datos ya guardados.
 */
export type LocalEventKind =
  | 'libre'        // día sin clases (feriado, jornada pedagógica)
  | 'vacaciones'   // periodo largo sin clases
  | 'evento'       // acto institucional (aniversario, actuación)
  | 'personal'     // cosa propia
  | 'examen'       // evaluación
  | 'entrega'      // fecha de entrega o exposición
  | 'reunion'      // reunión de padres, tutoría, asesoría
  | 'salida'       // viaje o salida de estudio
  | 'cumple'       // cumpleaños
  | 'recordatorio';// aviso suelto

/** Cómo se dibuja el evento en la cuadrícula del mes. */
export type LocalEventDisplay =
  | 'casilla'   // pinta la casilla ENTERA (máximo uno por día)
  | 'actividad';// pequeña etiqueta de color dentro de la casilla

/** Evento del calendario LOCAL de Frame (independiente de Google). */
export interface LocalCalendarEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD (fecha local) */
  date: string;
  /** rango opcional (p. ej. vacaciones): incluye ambos extremos */
  endDate?: string;
  kind: LocalEventKind;
  /** color de la etiqueta: hex de 6 dígitos o de 8 (los dos últimos, alfa) */
  color: string;
  /** Ausente en los eventos anteriores a esta versión: se deduce del tipo
   *  (los días libres pintaban la casilla entera; el resto, etiqueta). */
  display?: LocalEventDisplay;
  description?: string;
}

/** Nivel de importancia de una grabación de voz. */
export type RecordingImportance = 'baja' | 'media' | 'alta';

/** Grabación de voz hecha con el micrófono desde la barra superior.
 *  Vive suelta en Inicio o asignada a una asignatura, y siempre puede
 *  renombrarse, reasignarse o moverse de asignatura después. */
export interface Recording {
  id: string;
  name: string;
  description?: string;
  importance: RecordingImportance;
  /** ISO 8601 exacto (fecha y hora con minutos) del inicio de la grabación */
  recordedAt: string;
  /** null/undefined = sin asignatura (aparece al final de Inicio) */
  courseId?: string | null;
  durationSec: number;
  mimeType: string;
  /** Ruta permanente en disco (Documentos\Frame\Grabaciones), solo escritorio */
  filePath?: string;
  /** m4a o webm, tal como la grabó el motor web (las anteriores a 1.6.1 pueden ser mp3) */
  fileFormat?: string;
  /** Grabación segmentada: id común a todas las partes de una misma sesión. */
  sessionId?: string;
  /** Índice 1-based de esta parte dentro de la sesión segmentada. */
  partIndex?: number;
  /** Número total de partes de la sesión (>1 solo en modo segmentado). */
  partCount?: number;
}

export interface DailyPerformance {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  score: number; // Final score (0-20)
  grade: 'C' | 'B' | 'A' | 'AD'; // Letter grade
  subjects: string[]; // Unique subjects studied during the day
}

export interface StudyGoals {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface StreakGoal {
  mode: 'rendimiento' | 'tiempo';
  grade: 'B' | 'A' | 'AD';
  minutes: number;
}

export interface InterruptedSession {
  duration: number; // in seconds
  selectionMode: 'rendimiento' | 'tiempo';
  timerMode: 'focus' | 'stopwatch';
  /** ISO del momento en que se guardó. Solo se ofrece "Retomar" si la
   *  suspensión fue HOY: una sesión de anteayer ya no es la misma sesión. */
  suspendedAt?: string;
  /** Reloj y objetivo tal cual estaban, para retomar donde se dejó.
   *  Ausentes solo en registros antiguos. */
  timerTime?: number;
  sessionStartTime?: number;
  /**
   * De dónde salió este registro. Cambia lo que se le ofrece al usuario:
   *   'suspend' — la aparcó a propósito (Suspender y cerrar).
   *   'live'    — latido de la sesión viva: la app murió sin avisar
   *               (actualización, cierre forzado, corte de luz).
   *   'unload'  — red de seguridad del cierre del webview, sin reloj.
   *   'notes'   — no quedó rastro de la sesión, solo sus anotaciones; el
   *               tiempo se deduce del minuto de la última.
   */
  origin?: 'suspend' | 'live' | 'unload' | 'notes';
  /** Último instante (ISO) en que se supo algo de la sesión. */
  updatedAt?: string;
  /** El reloj corría cuando se perdió (frente a estar en pausa). */
  wasRunning?: boolean;
}
    
export type RepeatMode =
  | { mode: 'off' }
  | { mode: 'infinite' }
  | { mode: 'finite'; count: number };

// ============================================================
// Módulo "Asignaturas" (Knowledge). Portado de Aether KN.
// El contenido vive en IndexedDB (Dexie); estas son las formas de datos.
// Se conservan los nombres de campo originales de KN para evitar migración
// de esquema; solo se añade `uid` a las entidades de primer nivel para
// particionar por usuario igual que el resto de Aether OS.
// ============================================================

// Tipos de material de estudio dentro de un tema.
export type MaterialType =
  | 'resource'
  | 'formula'
  | 'concept'
  | 'key-data'
  | 'meaning'
  | 'quiz'
  | 'procedure';

// Asignatura (KN: Category). `name` es la clave lógica usada por Topic.category.
export interface Subject {
  id?: number;
  uid: string;
  name: string;
  image?: string;
}

// Tema (KN: StudyItem). `category` guarda el nombre de la asignatura.
export interface Topic {
  id?: number;
  uid: string;
  title: string;
  content: string;
  category: string;
  mastered: boolean;
  createdAt: number;
  groupId?: number;
  reviewLevel?: number;
  nextReview?: number;
  lastReviewed?: number;
  columnIndex?: number;
  reviewImage?: string;
}

// Agrupación de temas dentro de una asignatura.
export interface TopicGroup {
  id?: number;
  uid: string;
  name: string;
  image?: string;
  subjectName: string;
  createdAt: number;
}

// Campos comunes de SRS/orden a todos los materiales.
interface MaterialBase {
  id?: number;
  topicId: number;
  createdAt: number;
  columnIndex?: number;
  reviewLevel?: number;
  nextReview?: number;
  lastReviewed?: number;
  lastReviewLevel?: string;
  consolidationScore?: number;
  lastReviewedMode?: string;
}

export interface ResourceItem extends MaterialBase {
  name: string;
  type: string;
  data: Blob;
}

export interface FormulaItem extends MaterialBase {
  name: string;
  clarification: string;
  image?: string;
}

export interface ConceptItem extends MaterialBase {
  title: string;
  content: string;
}

export interface KeyDataItem extends MaterialBase {
  title?: string;
  content: string;
}

export interface MeaningItem extends MaterialBase {
  word: string;
  meaning: string;
}

export interface QuizItem extends MaterialBase {
  question: string;
  answer: string;
}

export interface ProcedureItem extends MaterialBase {
  title: string;
  description?: string;
  content: string;
  image?: string;
}
