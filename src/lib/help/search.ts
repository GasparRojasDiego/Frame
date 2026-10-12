// ============================================================
// Motor de la barra de ayuda de Inicio.
//
// No es una IA: es un buscador sobre un banco de respuestas escritas a mano
// (lib/help/kb/*), una por función de Frame. Funciona sin internet, responde
// al instante y nunca inventa: si la pregunta no es sobre cómo usar la app,
// lo dice y propone preguntas que sí sabe responder.
//
// Cómo entiende lo que se escribe:
//   1. Normaliza: minúsculas, sin tildes, sin signos.
//   2. Quita palabras vacías («cómo», «el», «puedo»…).
//   3. Reduce cada palabra a su raíz (canciones → cancion, eliminé → elimin)
//      con un recortador ligero de sufijos del castellano.
//   4. Une sinónimos en un solo concepto (borrar = eliminar = quitar).
//   5. Compara con cada respuesta: coincidencia exacta, por prefijo o con una
//      letra de diferencia (errores de tipeo), ponderada por lo rara que es la
//      palabra en el banco (IDF) y por dónde aparece (título y preguntas pesan
//      más que el texto de la respuesta).
//   6. (1.6.0) Compara además con CADA forma de preguntar del banco, por
//      separado: la respuesta cuya pregunta se parece más a la escrita gana.
//      Así, cuantas más formas tenga una respuesta (kb/variantes.ts), mejor
//      entiende las mil maneras de preguntar lo mismo.
//   7. (1.6.0) Entiende las averías: «no carga», «no suena», «no me deja»…
//      se leen como un fallo, y las respuestas de «Problemas» solo ganan si
//      la pregunta habla de uno.
// ============================================================

export interface HelpEntry {
  id: string;
  /** Interfaz a la que pertenece (la pone el índice de kb/). */
  area: HelpAreaId;
  title: string;
  /** Formas de preguntarlo. Cuantas más, mejor se encuentra. */
  q: string[];
  /** Palabras clave sueltas que no aparecen en las preguntas. */
  k?: string[];
  /** La respuesta corta, en una o dos frases. */
  a: string;
  /** Pasos numerados, si es un procedimiento. */
  steps?: string[];
  /** Matiz o advertencia final. */
  tip?: string;
  /** Ruta a la que lleva el botón «Ir a…». */
  go?: string;
  /** Ids de respuestas relacionadas (se completan solas si faltan). */
  rel?: string[];
  /**
   * Preferencia (0–0,06) para desempatar: la respuesta principal de un tema
   * gana a sus vecinas cuando la pregunta es igual de vaga para todas
   * («grabar» → grabar una nota, no dónde se guardan). La pone kb/index.ts.
   */
  prior?: number;
}

export type HelpAreaId =
  | 'basico'
  | 'inicio'
  | 'barra'
  | 'enfoque'
  | 'tareas'
  | 'habitos'
  | 'asignaturas'
  | 'calendario'
  | 'google'
  | 'musica'
  | 'grabaciones'
  | 'ajustes'
  | 'informes'
  | 'cuenta'
  | 'problemas'
  | 'extensiones'
  | 'sugerencias';

export const HELP_AREAS: Record<HelpAreaId, { label: string; route?: string }> = {
  basico: { label: 'Lo básico' },
  inicio: { label: 'Inicio', route: '/' },
  barra: { label: 'Barra superior' },
  enfoque: { label: 'Estudio', route: '/temporizador' },
  tareas: { label: 'Tareas', route: '/tareas' },
  habitos: { label: 'Hábitos', route: '/habitos' },
  asignaturas: { label: 'Asignaturas', route: '/knowledge' },
  calendario: { label: 'Calendario', route: '/calendario' },
  google: { label: 'Servicios de Google' },
  musica: { label: 'Música', route: '/music' },
  grabaciones: { label: 'Grabaciones' },
  ajustes: { label: 'Ajustes', route: '/settings' },
  // 1.6.3: los informes vuelven a Ajustes; Notion, la única extensión, también.
  informes: { label: 'Informes', route: '/settings' },
  cuenta: { label: 'Cuenta y nube' },
  problemas: { label: 'Problemas' },
  extensiones: { label: 'Extensiones' },
  sugerencias: { label: 'Sugerencias' },
};

// ------------------------------------------------------------
// Texto → raíces
// ------------------------------------------------------------

const STOPWORDS = new Set(
  (
    'a al algo alguna alguno algun ante antes aqui asi cada como con contra cual cuales cualquier cuando de del desde donde ' +
    'dos e el ella ellas ellos en entre era es esa ese eso esta estan este esto estos esas esos estas estoy fue ha hace ' +
    'hacer hacerlo hago hay he la las le les lo los mas me mi mia mis mucho muy nada ni no nos o otra otro para pero poco ' +
    'por porque puede pueden puedo pues que quiero quisiera se sea segun ser si sin sobre solo son su sus tambien tan te ' +
    'tengo tiene tienen todo todos tu tus un una uno unos unas usted y ya yo frame app aplicacion programa favor ' +
    'deseo necesito saber sabes dime explicame explica ayuda ayudame oye hola buenas forma manera modo hacia debo deberia ' +
    'existe existen alli ahi aca luego despues ahora siempre nunca vez veces mismo misma mientras le ' +
    'doy das da dar dale darle solo sola solos solas solamente unicamente alguien sabe podria podrias puedes seria ' +
    'quieres hacia tal cosa cosas algun alguno alguna asi nomas osea bueno pues entonces recien sirve sirven servir'
  ).split(/\s+/)
);

/** minúsculas, sin tildes ni signos. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SUFFIXES = [
  'aciones', 'iciones', 'amiento', 'imiento', 'amente', 'acion', 'icion', 'mente', 'ando', 'iendo',
  'ados', 'adas', 'idos', 'idas', 'ado', 'ada', 'ido', 'ida', 'amos', 'emos', 'imos', 'aste', 'iste',
  'ar', 'er', 'ir', 'as', 'an', 'en', 'a', 'e', 'o',
];

/** Raíz ligera: quita el plural y después un sufijo flexivo. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
  for (const suffix of SUFFIXES) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      return w.slice(0, -suffix.length);
    }
  }
  return w;
}

/** Grupos de sinónimos: todos acaban en la raíz de la primera palabra. */
const SYNONYM_GROUPS: string[][] = [
  ['eliminar', 'borrar', 'quitar', 'suprimir', 'remover', 'deshacerme', 'vaciar', 'limpiar'],
  ['crear', 'agregar', 'anadir', 'nuevo', 'nueva', 'meter', 'insertar', 'generar', 'armar', 'hacer'],
  ['editar', 'cambiar', 'modificar', 'corregir', 'ajustar', 'reemplazar'],
  ['asignatura', 'curso', 'materia', 'ramo', 'area'],
  ['tarea', 'deber', 'deberes', 'pendiente', 'trabajo', 'encargo', 'entrega'],
  ['musica', 'cancion', 'rola', 'track', 'mp3'],
  ['temporizador', 'reloj', 'contador', 'timer'],
  ['celular', 'telefono', 'movil', 'android', 'tablet', 'apk', 'smartphone'],
  ['computadora', 'laptop', 'pc', 'windows', 'escritorio', 'ordenador', 'portatil'],
  ['imagen', 'foto', 'fotografia', 'fondo', 'picture'],
  ['portada', 'caratula', 'cover', 'carátula'],
  ['respaldo', 'backup', 'copia'],
  ['informe', 'reporte', 'documento', 'pdf', 'word', 'docx'],
  ['descargar', 'bajar'],
  ['calificacion', 'puntaje', 'puntuacion', 'grado'],
  ['notificacion', 'alerta', 'campana', 'campanita'],
  ['grabacion', 'grabar', 'voz', 'microfono', 'grabadora', 'audio'],
  ['habito', 'rutina', 'costumbre'],
  ['calendario', 'agenda'],
  ['meta', 'objetivo'],
  ['oscuro', 'dark', 'negro'],
  ['claro', 'light', 'blanco'],
  ['actualizacion', 'actualizar', 'update'],
  ['dato', 'informacion', 'info'],
  ['instalar', 'instalacion', 'instalador'],
  ['playlist'],
  ['letra', 'lyrics', 'karaoke'],
  ['error', 'fallo', 'problema', 'bug', 'falla', 'roto', 'congela', 'cuelga', 'traba', 'trabo'],
  ['adjunto', 'adjuntar', 'archivo', 'fichero'],
  ['horario', 'schedule'],
  ['clima', 'temperatura', 'lluvia', 'pronostico'],
  ['invitado', 'anonimo'],
  ['vincular', 'enlazar', 'conectar', 'asociar', 'unir'],
  ['sincronizar', 'sincronizacion', 'sync', 'nube'],
  ['entrar', 'ingresar', 'login', 'acceder', 'loguear'],
  ['salir', 'desconectar', 'logout'],
  ['ver', 'veo', 'ves', 'vea', 'visto', 'mirar', 'revisar', 'consultar', 'mostrar', 'aparece', 'encontrar', 'ubicar'],
  ['empezar', 'iniciar', 'comenzar', 'arrancar', 'activar', 'play'],
  ['terminar', 'finalizar', 'acabar', 'culminar', 'completar', 'concluir'],
  ['pausar', 'parar', 'detener'],
  ['buscar', 'busqueda', 'buscador'],
  ['exportar', 'pasar', 'transferir', 'llevar'],
  ['importar', 'cargar', 'traer', 'restaurar'],
  ['ordenar', 'reordenar', 'organizar', 'acomodar', 'arrastrar', 'mover'],
  ['poner', 'pongo', 'pones', 'pone', 'ponerle', 'colocar', 'coloco'],
  ['nombre', 'renombrar', 'titulo', 'llamar'],
  ['racha', 'consecutivos'],
  ['cerrar', 'cierro', 'cierras', 'cierra', 'cerro', 'cerre', 'cerrado'],
  ['enfoque', 'concentracion', 'concentrar', 'focus'],
  ['estudiar', 'estudio', 'repasar'],
  ['repetir', 'repeticion', 'bucle', 'loop'],
  ['aleatorio', 'shuffle', 'mezclar', 'azar'],
  ['favorita', 'favorito', 'corazon', 'me gusta'],
  ['anotacion', 'apunte', 'apuntar', 'anotar'],
  ['recordatorio', 'recordar', 'alarma', 'avisar', 'avise', 'aviso'],
  ['video', 'youtube'],
  ['flotante', 'ventana flotante', 'encima', 'siempre visible'],
  ['correo', 'gmail', 'email', 'mail'],
  ['contrasena', 'clave', 'password'],
  ['perfil', 'avatar'],
  ['tema', 'apariencia'],
  ['progreso', 'avance', 'porcentaje'],
  ['dificultad', 'dificil', 'facil'],
  ['importancia', 'prioridad', 'urgente', 'urgencia'],
  ['fecha', 'plazo', 'vencimiento', 'limite', 'deadline'],
  ['vencida', 'atrasada', 'retrasada'],
  ['archivada', 'archivo de tareas', 'historial', 'hechas', 'terminadas', 'hice'],
  ['coleccion', 'grupo', 'carpeta de asignaturas'],
  ['recurso', 'material', 'enlace', 'link', 'url'],
  ['evento', 'feriado', 'cumpleanos'],
  ['examen', 'evaluacion', 'prueba', 'practica calificada'],
  ['pantalla', 'interfaz', 'seccion', 'pestana', 'vista'],
  // Sin «barra lateral»: cada palabra se une por separado, y «barra» sola
  // (la superior, la de la Ayuda, la de búsqueda) no es el menú (1.6.2).
  ['menu', 'sidebar', 'lateral'],
];

const SYNONYMS = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const head = stem(normalize(group[0]).split(' ').pop() ?? group[0]);
  for (const word of group) {
    for (const part of normalize(word).split(' ')) {
      if (!part || STOPWORDS.has(part)) continue;
      const root = stem(part);
      if (!SYNONYMS.has(root)) SYNONYMS.set(root, head);
    }
  }
}

/** Expresiones de varias palabras que significan una sola idea. */
const PHRASES: [RegExp, string][] = [
  // «Inicio» la pantalla no es «iniciar»: «en Inicio», «la pantalla de Inicio».
  [/\binicio de sesion\b/g, ' entrar '],
  [/\b(en|de|a|al|del|el|pantalla|interfaz|pagina|seccion) inicio\b/g, ' $1 pantallainicio '],
  [/^inicio$/g, ' pantallainicio '],
  // «la Ayuda» (la pantalla del botón redondo) no es la palabra vacía «ayuda».
  [/\b(la|esta|pantalla de|interfaz de|boton de|seccion de|abrir|abro|abre|cerrar|cierro|cierra|salir de|salgo de|entrar a|entro a|quitar) (la )?ayuda\b/g, ' $1 pantallaayuda '],
  // «entré sin cuenta»: es el modo invitado.
  [/\bsin (cuenta|registr\w*|iniciar sesion|correo)\b/g, ' invitado '],
  // «sin asignatura» es un sitio (lo que espera en Inicio), no una asignatura:
  // sin esto, «sin» se pierde y queda igual que «apuntes de una asignatura» (1.6.2).
  [/\bsin (asignatura|curso|materia|asignar)s?\b/g, ' sinasignatura '],
  // «el más de la barra», «el botón +»: el botón «+» (el signo se pierde al normalizar).
  [/\b(el|del|al|boton|signo|icono|simbolo) (mas|plus)\b/g, ' $1 botonmas '],
  // «acabo de borrar»: es «recién», no «terminar».
  [/\bacab(o|as|a|amos|an) de\b/g, ' recien '],
  // «dónde fue a parar»: es «dónde quedó», no «pausar» (1.6.2).
  [/\b(fue|fueron|va|van|ira|iran|habra) a parar\b/g, ' quedo '],
  // «no es de esa canción», «no coincide»: está equivocada.
  [/\bno (es|son|coincide|coinciden|corresponde|corresponden)\b/g, ' equivocada '],
  // «se salta sola», «se cierran solas las canciones»: una avería.
  [/\b(salt|pas|cierr|apag|borr|detien|cambi)(\w*)((?: \w+){0,3}) sol[oa]s?\b/g, ' fallo $1$2$3 '],
  // «ya no sirve», «ya no lo uso»: no es una avería, es que sobra.
  [/\bya no\b/g, ' '],
  [/\b(ctrl|control) ?z\b/g, ' deshacer '],
  [/\b(ctrl|control) ?shift ?f\b/g, ' grabar '],
  [/\b(modo|tema) (noche|nocturno|negro|dark)\b/g, ' tema oscuro '],
  [/\bdark ?mode\b/g, ' tema oscuro '],
  [/\blight ?mode\b/g, ' tema claro '],
  // «no terminé», «no pude entregar»: la negación cambia el tema.
  [/\bno (pude |he |alcance a |llegue a )?(termin|culmin|entreg|acab|complet)\w*/g, ' incompleta '],
  [/\bno (la |lo |las |los )?(hice|hicimos|realice|presente|alcance)\b/g, ' incompleta '],
  // «no carga», «no me deja», «no suena»…: es una avería, no una función.
  [
    /\bno (me |se |te |le |lo |la |les |nos )*(funciona|sirve|anda|carga|abre|suena|aparece|sale|llega|deja|reproduce|descarga|guarda|inicia|arranca|responde|detecta|encuentr|ve|ven|oye|escucha|graba|baja|puedo|logro)(\w*)/g,
    ' fallo $2$3 ',
  ],
  // Una hora concreta («a las 8 de la noche») es un detalle, no el tema: se
  // reduce a «hora» para que «noche» no arrastre la pregunta a los hábitos.
  [/\b(a|desde|hasta|antes de|despues de) (la|las) \d{1,2}( \d{2})?( (de la )?(manana|tarde|noche)| am| pm| horas?)?\b/g, ' hora '],
];

/** Abreviaturas y erratas de chat que el recortador no puede adivinar. */
const SHORTHAND: Record<string, string> = {
  q: 'que', k: 'que', ke: 'que', xq: 'porque', pq: 'porque', tmb: 'tambien', pa: 'para', vos: 'voz', komo: 'como',
  kiero: 'quiero', aki: 'aqui', ola: 'hola', porfa: 'favor', plis: 'favor', pls: 'favor', ayudaa: 'ayuda',
};

function prepare(text: string): string {
  // «Inicio» con mayúscula en medio de una frase es la pantalla, no «iniciar».
  let out = normalize(text.replace(/(?<=\S )Inicio\b/g, 'pantallainicio').replace(/«?\+»?/g, ' botonmas '))
    .split(' ')
    .map((word) => SHORTHAND[word] ?? word)
    .join(' ');
  for (const [pattern, replacement] of PHRASES) out = out.replace(pattern, replacement);
  return out;
}

/** Texto → lista de conceptos (raíces con sinónimos unificados). */
export function concepts(text: string): string[] {
  const out: string[] = [];
  for (const word of prepare(text).split(/\s+/)) {
    if (!word || STOPWORDS.has(word) || word.length < 2) continue;
    const root = stem(word);
    out.push(SYNONYMS.get(root) ?? root);
  }
  return out;
}

// ------------------------------------------------------------
// Índice y puntuación
// ------------------------------------------------------------

interface IndexedEntry {
  entry: HelpEntry;
  title: Set<string>;
  q: Set<string>;
  k: Set<string>;
  body: Set<string>;
  phrases: string[];
  /** Conceptos de cada forma de preguntar (título incluido), por separado. */
  asked: string[][];
}

export interface HelpIndex {
  entries: IndexedEntry[];
  idf: Map<string, number>;
  vocabulary: string[];
  byId: Map<string, HelpEntry>;
}

const FIELD_WEIGHT = { title: 3, q: 3, k: 2.2, body: 1 } as const;
/** Peso de lo que le SOBRA a una forma de preguntar respecto de la pregunta. */
const ASKED_EXTRA = 0.4;
/** Mezcla: campos sueltos (vocabulario) y la forma de preguntar más parecida. */
const FIELD_MIX = 0.5;
const ASKED_MIX = 0.8;
/** Las respuestas de «Problemas» pierden fuerza si la pregunta no habla de un fallo. */
const PROBLEM_WITHOUT_FAULT = 0.82;
const MAX_FIELD = 3;
const FIELD_SUM = FIELD_WEIGHT.title + FIELD_WEIGHT.q + FIELD_WEIGHT.k + FIELD_WEIGHT.body;
/** Peso de las coincidencias en campos además del mejor. */
const SECONDARY = 0.1;
/** Bonificación máxima por cubrir el título entero. */
const TITLE_BONUS = 0.3;

export function buildIndex(entries: HelpEntry[]): HelpIndex {
  const indexed = entries.map<IndexedEntry>((entry) => ({
    entry,
    title: new Set(concepts(entry.title)),
    q: new Set(entry.q.flatMap(concepts)),
    k: new Set((entry.k ?? []).flatMap(concepts)),
    body: new Set(concepts([entry.a, ...(entry.steps ?? []), entry.tip ?? ''].join(' '))),
    phrases: [entry.title, ...entry.q].map(normalize),
    asked: [entry.title, ...entry.q].map((text) => [...new Set(concepts(text))]).filter((list) => list.length > 0),
  }));
  const df = new Map<string, number>();
  for (const item of indexed) {
    const all = new Set([...item.title, ...item.q, ...item.k, ...item.body]);
    for (const c of all) df.set(c, (df.get(c) ?? 0) + 1);
  }
  const n = indexed.length;
  const idf = new Map<string, number>();
  for (const [c, count] of df) idf.set(c, Math.log(1 + n / count));
  return {
    entries: indexed,
    idf,
    vocabulary: [...df.keys()],
    byId: new Map(entries.map((e) => [e.id, e])),
  };
}

/**
 * Distancia de edición con tope (solo importa si es 0, 1 o 2). Cuenta como
 * UN error dos letras cambiadas de sitio (calendraio → calendario).
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Cuánto se parecen dos raíces: 1 igual, 0,75 prefijo, 0,6 errata. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  if (short.length >= 4 && long.startsWith(short)) return 0.75;
  if (short.length >= 4) {
    const max = short.length >= 7 ? 2 : 1;
    if (editDistance(a, b, max) <= max) return 0.6;
  }
  return 0;
}

/** Parecido de una palabra de la pregunta con cada palabra del banco (calculado una vez por pregunta). */
type SimilarTo = Map<string, number>;

function similarTo(index: HelpIndex, token: string): SimilarTo {
  const map: SimilarTo = new Map();
  for (const word of index.vocabulary) {
    const sim = word === token ? 1 : similarity(token, word);
    if (sim > 0) map.set(word, sim);
  }
  return map;
}

function bestIn(set: Set<string>, token: string, near: SimilarTo): number {
  if (set.has(token)) return 1;
  let best = 0;
  for (const c of set) {
    const s = near.get(c) ?? 0;
    if (s > best) best = s;
    if (best >= 0.75) break;
  }
  return best;
}

export interface HelpMatch {
  entry: HelpEntry;
  score: number;
  coverage: number;
}

export type HelpReply =
  | { kind: 'answer'; match: HelpMatch; alternatives: HelpEntry[] }
  | { kind: 'greeting' }
  | { kind: 'thanks' }
  | { kind: 'offtopic' }
  | { kind: 'unknown'; suggestions: HelpEntry[] };

/** Lo que más se parece a la pregunta entre las formas de preguntar de una respuesta (0–1). */
function askedSimilarity(
  index: HelpIndex,
  item: IndexedEntry,
  near: SimilarTo[],
  weights: number[],
  weightSum: number
): number {
  let bestScore = 0;
  for (const asked of item.asked) {
    let matched = 0;
    const used = new Array<boolean>(asked.length).fill(false);
    for (let i = 0; i < near.length; i++) {
      let best = 0;
      let at = -1;
      for (let j = 0; j < asked.length; j++) {
        const sim = near[i].get(asked[j]) ?? 0;
        if (sim > best) {
          best = sim;
          at = j;
          if (sim === 1) break;
        }
      }
      if (best > 0) {
        matched += best * weights[i];
        used[at] = true;
      }
    }
    if (matched === 0) continue;
    let extra = 0;
    for (let j = 0; j < asked.length; j++) if (!used[j]) extra += index.idf.get(asked[j]) ?? 1;
    const score = matched / (weightSum + ASKED_EXTRA * extra);
    if (score > bestScore) bestScore = score;
  }
  return bestScore;
}

/**
 * Errata: una palabra que el banco no conoce se cambia por la más parecida
 * que sí conoce (a una letra, o a dos en palabras largas; con empate, la más
 * frecuente). «calendraio» → calendario, «abito» → habito.
 */
function correct(index: HelpIndex, token: string): string {
  if (token.length < 4 || index.idf.has(token)) return token;
  const max = token.length >= 8 ? 2 : 1;
  let best = token;
  let bestDistance = max + 1;
  let bestIdf = Infinity;
  for (const word of index.vocabulary) {
    if (Math.abs(word.length - token.length) > max) continue;
    const distance = editDistance(token, word, max);
    if (distance > max) continue;
    const idf = index.idf.get(word) ?? Infinity;
    if (distance < bestDistance || (distance === bestDistance && idf < bestIdf)) {
      best = word;
      bestDistance = distance;
      bestIdf = idf;
    }
  }
  return best;
}

/** Las mejores respuestas para una pregunta, de mayor a menor. */
export function rank(index: HelpIndex, query: string, limit = 6): HelpMatch[] {
  const tokens = [...new Set(concepts(query).map((token) => correct(index, token)))];
  if (tokens.length === 0) return [];
  const normQuery = normalize(query);
  const weights = tokens.map((t) => {
    // Palabra desconocida: se le da el peso de una palabra rara a medias,
    // así una errata no hunde la pregunta entera.
    let w = index.idf.get(t);
    if (w === undefined) {
      let near = 0;
      for (const v of index.vocabulary) {
        if (similarity(t, v) > 0) {
          near = index.idf.get(v) ?? 0;
          break;
        }
      }
      w = near || 1.2;
    }
    return w;
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const total = weightSum * (MAX_FIELD + SECONDARY * (FIELD_SUM - MAX_FIELD));
  const fault = tokens.includes('error');
  const near = tokens.map((t) => similarTo(index, t));

  const results: HelpMatch[] = [];
  for (const item of index.entries) {
    let sum = 0;
    let matched = 0;
    tokens.forEach((t, i) => {
      const parts = [
        bestIn(item.title, t, near[i]) * FIELD_WEIGHT.title,
        bestIn(item.q, t, near[i]) * FIELD_WEIGHT.q,
        bestIn(item.k, t, near[i]) * FIELD_WEIGHT.k,
        bestIn(item.body, t, near[i]) * FIELD_WEIGHT.body,
      ];
      const primary = Math.max(...parts);
      if (primary > 0) matched++;
      // La palabra que aparece en varios campos (título Y preguntas Y texto)
      // habla más de esa respuesta que la que sale una sola vez.
      const secondary = parts.reduce((a, b) => a + b, 0) - primary;
      sum += (primary + SECONDARY * secondary) * weights[i];
    });
    if (matched === 0) continue;
    let score = FIELD_MIX * (sum / total) + ASKED_MIX * askedSimilarity(index, item, near, weights, weightSum);
    // Cuánto del TÍTULO cubre la pregunta: desempata entre respuestas que
    // mencionan lo mismo (la que trata de eso frente a la que lo nombra).
    if (item.title.size > 0) {
      let covered = 0;
      for (const c of item.title) if (near.some((m) => (m.get(c) ?? 0) >= 0.75)) covered++;
      score += TITLE_BONUS * (covered / item.title.size);
    }
    // La pregunta escrita casi igual que una de las del banco: bonificación.
    if (normQuery.length >= 8 && item.phrases.some((p) => p.includes(normQuery) || (p.length >= 12 && normQuery.includes(p)))) {
      score += 0.4;
    }
    if (item.entry.area === 'problemas' && !fault) score *= PROBLEM_WITHOUT_FAULT;
    score += item.entry.prior ?? 0;
    results.push({ entry: item.entry, score, coverage: matched / tokens.length });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

const GREETING = /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal|saludos)\b/;
const THANKS = /^(gracias|muchas gracias|genial|perfecto|ok|okay|listo|vale|chevere|bacan)\b/;
/** Preguntas de cultura general, tareas escolares o charla: no son de Frame. */
const OFFTOPIC =
  /\b(capital de|quien (fue|es|invento|descubrio|gano)|cuanto es|cuantos anos|resuelve|resolver|traduce|traducir|escribe (un|una)|redacta|chiste|poema|receta|presidente|historia de|que opinas|eres (una )?ia|chatgpt|gemini|significa la palabra|definicion de|ecuacion|derivada|integral de|formula de|que hora es|que dia es hoy|que fecha es hoy|mundial|futbol)\b/;

/** Palabras que delatan que la pregunta es sobre la app. */
const APP_WORDS =
  /\b(frame|tarea|tareas|habito|habitos|asignatura|asignaturas|curso|cursos|enfoque|temporizador|cronometro|sesion|musica|cancion|canciones|playlist|calendario|evento|racha|meta|nota del dia|calificacion|grabacion|informe|cuenta|ajustes|horario|coleccion|recurso|clima|campana|invitado|pomodoro|notificacion|notificaciones|configuracion|perfil|sincronizacion|sincronizar|actualizacion|actualizar|extension|extensiones|notion|sugerencia|sugerencias|youtube|gmail|classroom|respaldo|nube|grabaciones|playlists|colecciones|recursos|metas|informes)\b/;

/** La respuesta a lo que escribió el usuario. */
export function answer(index: HelpIndex, query: string): HelpReply {
  const norm = normalize(query);
  if (!norm) return { kind: 'unknown', suggestions: [] };
  const content = concepts(query);
  if (GREETING.test(norm) && content.length <= 1) return { kind: 'greeting' };
  if (THANKS.test(norm) && content.length <= 2) return { kind: 'thanks' };

  // «¿qué es Frame?»: «frame» y «app» son palabras vacías para el buscador.
  if (content.length === 0 && /\b(que|q) (es|hace|sirve)\b.*\b(frame|app|aplicacion|esto)\b/.test(norm)) {
    const about = index.byId.get('que-es-frame');
    if (about) return { kind: 'answer', match: { entry: about, score: 1, coverage: 1 }, alternatives: [] };
  }

  const ranked = rank(index, query);
  const best = ranked[0];
  const offtopic = OFFTOPIC.test(norm);

  // Umbral: con preguntas largas basta cubrir la mitad de las ideas; con una
  // o dos palabras, la coincidencia tiene que ser casi exacta.
  const minCoverage = content.length >= 3 ? 0.4 : content.length === 2 ? 0.5 : 0.99;
  const second = ranked[1]?.score ?? 0;
  const confident =
    !!best &&
    ((best.score >= 0.26 && best.coverage >= minCoverage) ||
      // Pregunta larga con palabras de relleno: basta una ganadora clara.
      (best.score >= 0.4 && best.coverage >= 0.3 && best.score >= second * 1.25));

  // Una pregunta con forma de cultura general solo se responde si nombra
  // algo propio de Frame («¿cuánto es mi racha?» sí; «¿cuánto es 2 + 2?» no).
  const aboutFrame = APP_WORDS.test(norm);
  if (confident && best && (!offtopic || aboutFrame)) {
    const alternatives = ranked
      .slice(1)
      .filter((m) => m.score >= Math.max(0.2, best.score * 0.55))
      .slice(0, 3)
      .map((m) => m.entry);
    return { kind: 'answer', match: best, alternatives };
  }
  if (offtopic || !best || best.coverage === 0) return { kind: 'offtopic' };
  return { kind: 'unknown', suggestions: ranked.slice(0, 4).map((m) => m.entry) };
}

/** Sugerencias mientras se escribe (umbral más laxo que `answer`). */
export function suggest(index: HelpIndex, query: string, limit = 5): HelpEntry[] {
  if (normalize(query).length < 3) return [];
  return rank(index, query, limit)
    .filter((m) => m.score >= 0.16)
    .map((m) => m.entry);
}

/** Relacionadas: las declaradas y, si faltan, las más parecidas de su área. */
export function relatedTo(index: HelpIndex, entry: HelpEntry, limit = 3): HelpEntry[] {
  const out: HelpEntry[] = [];
  for (const id of entry.rel ?? []) {
    const found = index.byId.get(id);
    if (found && found.id !== entry.id) out.push(found);
  }
  if (out.length < limit) {
    for (const m of rank(index, `${entry.title} ${(entry.k ?? []).join(' ')}`, limit + 4)) {
      if (m.entry.id === entry.id || out.some((e) => e.id === m.entry.id)) continue;
      if (m.entry.area !== entry.area) continue;
      out.push(m.entry);
      if (out.length >= limit) break;
    }
  }
  return out.slice(0, limit);
}
