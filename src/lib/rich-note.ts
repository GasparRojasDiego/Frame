// ============================================================
// Formato de las anotaciones de estudio: un markdown MÍNIMO.
//
// La nota de cierre de una sesión y los avances anotados durante ella siguen
// siendo UNA cadena, en los mismos campos de siempre (`notes` de la sesión y
// `text` de cada avance). Así viajan igual por la nube, el respaldo y la app
// de Android, que lee el mismo dato: aunque no pinte el formato, lo que ve es
// texto corriente y legible.
//
// Lo único que se reconoce:
//   **negrita**   *cursiva*   __subrayado__
//   «- » al principio de la línea → viñeta;  «1. » → lista numerada, con el
//   número que se escribió («15. » sigue siendo el 15, no se renumera).
//   \*  \_  \\  → el carácter tal cual (escape).
//   «\» delante de una línea de texto que parecería lista: no lo es.
//
// Las marcas solo cuentan donde lo parecen (ver `flanking`): «3*4», «a * b»,
// «__init__(self)» o «______» se quedan como están. Las notas de antes de la
// 1.6.2 y las de Android son texto plano, y así se siguen leyendo igual.
//
// Las notas viejas en modo «Lista» guardaban sus viñetas como «• » (o «- »):
// se siguen leyendo como viñetas, y al editarlas se reescriben con «- ».
//
// Nada de HTML en ningún sentido: lo que se guarda sale de `serializeRichNote`,
// que solo sabe escribir este formato, y lo que se pinta sale de
// `parseRichNote`, que solo entrega texto y tres marcas. No hay por dónde
// colar una etiqueta.
// ============================================================

export type RichLineKind = 'text' | 'bullet' | 'number';

export interface RichRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface RichLine {
  kind: RichLineKind;
  runs: RichRun[];
  /** Solo en las numeradas: el número escrito. Si falta, sigue al de la
   *  línea numerada anterior (o empieza en 1). */
  number?: number;
}

type Mark = 'bold' | 'italic' | 'underline';

const BULLET_LINE = /^(?:- |• )/;
const NUMBER_LINE = /^(\d{1,3})[.)] /;
/** Línea de texto que empieza como una lista: se guarda con «\» delante. */
const LIST_LIKE = /^(?:- |• |\d{1,3}[.)] )/;
const ESCAPABLE = new Set(['*', '_', '\\']);
const MARK_RAW: Record<Mark, string> = { bold: '**', italic: '*', underline: '__' };
const MARKS: Mark[] = ['bold', 'italic', 'underline'];

// ------------------------------------------------------------
// Lectura
// ------------------------------------------------------------

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'delim'; marks: Mark[]; canOpen: boolean; canClose: boolean; at: number };

const isSpace = (char: string) => char === '' || /\s/.test(char);
const isAlnum = (char: string) => /[\p{L}\p{N}]/u.test(char);
const isDigit = (char: string) => /\p{Nd}/u.test(char);
const isWordChar = (char: string) => char === '_' || isAlnum(char);

/**
 * ¿Puede una tira de «*» o de «__» abrir o cerrar una marca? Reglas de
 * flanqueo como las de CommonMark, más dos para que el texto plano de siempre
 * no cambie de sentido:
 *   · Abre si lo que sigue no es un espacio; cierra si lo que precede no lo
 *     es. «3 * 4» no es nada.
 *   · «*» con una cifra a un lado y letra o cifra al otro es una operación:
 *     «3*4», «2*x», «2**3».
 *   · «__» dentro de una palabra no es nada («mi__var»), y tampoco el del
 *     código: «self.__dict__», «__init__(self)», «__init__.py».
 */
function flanking(char: '*' | '_', before: string, after: string, afterNext: string) {
  if (char === '*') {
    const arithmetic = isAlnum(before) && isAlnum(after) && (isDigit(before) || isDigit(after));
    return { canOpen: !isSpace(after) && !arithmetic, canClose: !isSpace(before) && !arithmetic };
  }
  return {
    canOpen: !isSpace(after) && !isWordChar(before) && before !== '.',
    canClose:
      !isSpace(before) &&
      !isWordChar(after) &&
      after !== '(' &&
      after !== '[' &&
      !(after === '.' && isWordChar(afterNext)),
  };
}

function tokenize(source: string): Token[] {
  const out: Token[] = [];
  let buffer = '';
  /** El carácter anterior tal como se lee: lo escapado cuenta como un signo. */
  let before = '';
  const flush = () => {
    if (buffer) out.push({ kind: 'text', value: buffer });
    buffer = '';
  };

  for (let k = 0; k < source.length; k++) {
    const char = source[k];
    const next = source[k + 1];
    if (char === '\\' && next !== undefined && ESCAPABLE.has(next)) {
      buffer += next;
      before = '\\';
      k++;
      continue;
    }
    if (char === '*' || char === '_') {
      // La tira entera de asteriscos (o de guiones bajos) va junta.
      let end = k;
      while (source[end] === char) end++;
      const length = end - k;
      const marks: Mark[] | null =
        char === '*'
          ? length === 1
            ? ['italic']
            : length === 2
              ? ['bold']
              : length === 3
                ? ['bold', 'italic']
                : null
          : length === 2
            ? ['underline']
            : null;
      if (marks) {
        flush();
        out.push({ kind: 'delim', marks, at: k, ...flanking(char, before, source[end] ?? '', source[end + 1] ?? '') });
      } else {
        buffer += source.slice(k, end); // «______», «****», «_» suelto: texto
      }
      before = char;
      k = end - 1;
      continue;
    }
    buffer += char;
    before = char;
  }
  flush();
  return out;
}

function pushRun(runs: RichRun[], text: string, state: Record<Mark, boolean>) {
  if (!text) return;
  const last = runs[runs.length - 1];
  if (
    last &&
    !!last.bold === state.bold &&
    !!last.italic === state.italic &&
    !!last.underline === state.underline
  ) {
    last.text += text;
    return;
  }
  const run: RichRun = { text };
  if (state.bold) run.bold = true;
  if (state.italic) run.italic = true;
  if (state.underline) run.underline = true;
  runs.push(run);
}

/**
 * Marcas de una línea. Cada cierre se empareja con la apertura pendiente más
 * cercana de su misma marca; la que se queda sin pareja (o no puede abrir ni
 * cerrar donde está) se lee como el carácter que es.
 */
function parseInline(source: string): RichRun[] {
  const tokens = tokenize(source);
  type Role = 'open' | 'close' | 'literal';
  const roles: Role[][] = tokens.map((token) =>
    token.kind === 'delim' ? token.marks.map((): Role => 'literal') : []
  );
  const pending: Record<Mark, { token: number; part: number }[]> = { bold: [], italic: [], underline: [] };
  tokens.forEach((token, index) => {
    if (token.kind !== 'delim') return;
    token.marks.forEach((mark, part) => {
      const stack = pending[mark];
      if (token.canClose && stack.length > 0) {
        const opener = stack.pop()!;
        roles[opener.token][opener.part] = 'open';
        roles[index][part] = 'close';
      } else if (token.canOpen) {
        stack.push({ token: index, part });
      }
    });
  });

  const depth: Record<Mark, number> = { bold: 0, italic: 0, underline: 0 };
  const state = () => ({ bold: depth.bold > 0, italic: depth.italic > 0, underline: depth.underline > 0 });
  const runs: RichRun[] = [];
  tokens.forEach((token, index) => {
    if (token.kind === 'text') {
      pushRun(runs, token.value, state());
      return;
    }
    // Primero lo que cierra, luego lo que sobra (tal cual) y al final lo que abre.
    token.marks.forEach((mark, part) => {
      if (roles[index][part] === 'close') depth[mark]--;
    });
    const literal = token.marks.filter((_, part) => roles[index][part] === 'literal');
    pushRun(runs, literal.map((mark) => MARK_RAW[mark]).join(''), state());
    token.marks.forEach((mark, part) => {
      if (roles[index][part] === 'open') depth[mark]++;
    });
  });
  return runs;
}

function parseLine(raw: string): RichLine {
  if (BULLET_LINE.test(raw)) return { kind: 'bullet', runs: parseInline(raw.slice(2)) };
  const numbered = raw.match(NUMBER_LINE);
  if (numbered) {
    return { kind: 'number', number: Number(numbered[1]), runs: parseInline(raw.slice(numbered[0].length)) };
  }
  // «\- algo»: texto que empieza con guion, no una viñeta.
  const body = raw.startsWith('\\') && LIST_LIKE.test(raw.slice(1)) ? raw.slice(1) : raw;
  return { kind: 'text', runs: parseInline(body) };
}

/** La anotación guardada, línea a línea. Acepta también el formato viejo. */
export function parseRichNote(text: string): RichLine[] {
  const source = (text ?? '').replace(/\r\n?/g, '\n');
  if (source.trim() === '') return [];
  return source.split('\n').map(parseLine);
}

// ------------------------------------------------------------
// Escritura
// ------------------------------------------------------------

/** Escapa solo lo que el lector confundiría con una marca. */
function escapeText(text: string): string {
  let out = '';
  for (let k = 0; k < text.length; k++) {
    const char = text[k];
    if (char === '\\') out += '\\\\';
    else if (char === '*') out += '\\*';
    // «snake_case» se queda limpio; «__» o un «_» pegado a una marca, no.
    else if (char === '_' && (k === 0 || k === text.length - 1 || text[k - 1] === '_' || text[k + 1] === '_'))
      out += '\\_';
    else out += char;
  }
  return out;
}

const marksOf = (run: RichRun | undefined): Record<Mark, boolean> => ({
  bold: !!run?.bold,
  italic: !!run?.italic,
  underline: !!run?.underline,
});

/**
 * Los espacios de los extremos de un tramo con formato salen fuera de sus
 * marcas: «**a **b» no se leería (un cierre no puede ir tras un espacio), y
 * «**a** b» sí. Cada espacio se queda con las marcas que comparten los tramos
 * de ambos lados.
 */
function tidyRuns(runs: RichRun[]): RichRun[] {
  const pieces: { text: string; run: RichRun | null }[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(run.text)!;
    if (lead) pieces.push({ text: lead, run: null });
    if (core) pieces.push({ text: core, run });
    if (trail) pieces.push({ text: trail, run: null });
  }
  const out: RichRun[] = [];
  pieces.forEach((piece, index) => {
    if (piece.run) {
      pushRun(out, piece.text, marksOf(piece.run));
      return;
    }
    const left = marksOf(pieces.slice(0, index).reverse().find((p) => p.run)?.run ?? undefined);
    const right = marksOf(pieces.slice(index + 1).find((p) => p.run)?.run ?? undefined);
    pushRun(out, piece.text, {
      bold: left.bold && right.bold,
      italic: left.italic && right.italic,
      underline: left.underline && right.underline,
    });
  });
  return out;
}

/** Las marcas que se cierran y abren entre el tramo `index - 1` y el `index`,
 *  y dónde quedan escritas. */
type Boundary = { index: number; start: number; end: number; closes: Mark[]; opens: Mark[] };

function serializeRuns(runs: RichRun[], escape: boolean): { text: string; boundaries: Boundary[] } {
  const state: Record<Mark, boolean> = { bold: false, italic: false, underline: false };
  let out = '';
  const boundaries: Boundary[] = [];
  // Se cierran y abren solo las marcas que cambian respecto al tramo anterior;
  // primero lo que se cierra, en orden inverso al de apertura: «**__a__**».
  const shift = (index: number, wanted: Record<Mark, boolean>) => {
    const start = out.length;
    const closes = [...MARKS].reverse().filter((mark) => state[mark] && !wanted[mark]);
    const opens = MARKS.filter((mark) => !state[mark] && wanted[mark]);
    for (const mark of [...closes, ...opens]) {
      out += MARK_RAW[mark];
      state[mark] = !state[mark];
    }
    if (out.length > start) boundaries.push({ index, start, end: out.length, closes, opens });
  };
  runs.forEach((run, index) => {
    shift(index, marksOf(run));
    out += escape ? escapeText(run.text) : run.text;
  });
  shift(runs.length, marksOf(undefined));
  return { text: out, boundaries };
}

function serializeLine(line: RichLine, escape: boolean): string {
  const body = serializeRuns(line.runs, escape).text;
  if (line.kind === 'number') return `${line.number ?? 1}. ${body}`;
  if (line.kind === 'bullet') return `- ${body}`;
  return LIST_LIKE.test(body) ? `\\${body}` : body;
}

/**
 * Una marca que no se puede escribir donde está (cursiva en mitad de «123»,
 * subrayado que acaba pegado a una letra): se quita del tramo que la lleva,
 * para que lo guardado se lea tal cual y no con asteriscos sueltos. Devuelve
 * null si no encuentra ninguna.
 */
function dropUnwritableMark(runs: RichRun[]): RichRun[] | null {
  const { text, boundaries } = serializeRuns(runs, true);
  for (const token of tokenize(text)) {
    if (token.kind !== 'delim') continue;
    const boundary = boundaries.find((b) => token.at >= b.start && token.at < b.end);
    if (!boundary) continue;
    for (const mark of token.marks) {
      const closing = boundary.closes.includes(mark);
      if (closing ? token.canClose : token.canOpen) continue;
      // Si no cierra, se quita del tramo de antes; si no abre, del de después.
      const target = closing ? boundary.index - 1 : boundary.index;
      return tidyRuns(runs.map((run, index) => (index === target ? { ...run, [mark]: false } : run)));
    }
  }
  return null;
}

/** Una línea → su texto guardado. Lo que sale se lee exactamente como `line`
 *  (salvo los espacios sacados de las marcas y, rarísimo, alguna marca
 *  imposible de escribir). */
function writeLine(line: RichLine): string {
  let runs = tidyRuns(line.runs);
  for (let attempt = 0; attempt <= runs.length * MARKS.length; attempt++) {
    const wanted: RichLine = { ...line, runs };
    // Sin escapes si se lee igual (el texto plano de siempre queda idéntico:
    // «3*4» no pasa a «3\*4»); si no, escapando todo lo que podría ser marca.
    const plain = serializeLine(wanted, false);
    if (sameLine(parseLine(plain), wanted)) return plain;
    const escaped = serializeLine(wanted, true);
    if (sameLine(parseLine(escaped), wanted)) return escaped;
    const next = dropUnwritableMark(runs);
    if (!next) break;
    runs = next;
  }
  // Último recurso: el texto sin formato.
  return serializeLine({ ...line, runs: [{ text: line.runs.map((run) => run.text).join('') }] }, true);
}

function sameLine(a: RichLine, b: RichLine): boolean {
  if (a.kind !== b.kind || (a.kind === 'number' && a.number !== b.number)) return false;
  if (a.runs.length !== b.runs.length) return false;
  return a.runs.every((run, index) => {
    const other = b.runs[index];
    return (
      run.text === other.text &&
      !!run.bold === !!other.bold &&
      !!run.italic === !!other.italic &&
      !!run.underline === !!other.underline
    );
  });
}

const lineIsBlank = (line: RichLine) => line.runs.every((run) => run.text.trim() === '');

/**
 * Líneas → la cadena que se guarda. Sin líneas vacías en los extremos (ni de
 * texto ni de lista: una viñeta o un número vacío al final no dice nada).
 */
export function serializeRichNote(lines: RichLine[]): string {
  let first = 0;
  let last = lines.length - 1;
  while (first <= last && lineIsBlank(lines[first])) first++;
  while (last >= first && lineIsBlank(lines[last])) last--;

  /** Número de la línea numerada anterior (null si la anterior no lo era). */
  let previous: number | null = null;
  const out: string[] = [];
  for (let index = first; index <= last; index++) {
    const line = lines[index];
    const number: number | undefined =
      line.kind === 'number' ? (line.number ?? (previous === null ? 1 : previous + 1)) : undefined;
    previous = number ?? null;
    out.push(writeLine({ kind: line.kind, runs: line.runs, number }));
  }
  return out.join('\n');
}

// ------------------------------------------------------------
// Texto limpio
// ------------------------------------------------------------

const lineText = (line: RichLine) => line.runs.map((run) => run.text).join('');

/** Líneas sin marcas; las viñetas vacías se caen (no dicen nada). */
function plainLines(text: string): { kind: RichLineKind; body: string; number: number }[] {
  return parseRichNote(text)
    .filter((line) => line.kind === 'text' || !lineIsBlank(line))
    .map((line) => ({ kind: line.kind, body: lineText(line), number: line.number ?? 1 }));
}

/**
 * La anotación sin marcas: para informes, búsquedas y la vista flotante
 * compacta. Las viñetas quedan como «• » y cada número, el que se escribió.
 */
export function richNoteToPlain(text: string): string {
  return plainLines(text)
    .map((line) =>
      line.kind === 'bullet' ? `• ${line.body}` : line.kind === 'number' ? `${line.number}. ${line.body}` : line.body
    )
    .join('\n')
    .trim();
}

/** En una sola línea («a · b · c»): para celdas de tabla y textos de una fila. */
export function richNoteToLine(text: string): string {
  return plainLines(text)
    .map((line) => (line.kind === 'number' ? `${line.number}. ${line.body.trim()}` : line.body.trim()))
    .filter((line) => line !== '')
    .join(' · ');
}

/** ¿No hay nada escrito? (Una viñeta vacía o solo marcas no cuentan.) */
export function isRichNoteEmpty(text: string): boolean {
  return parseRichNote(text).every(lineIsBlank);
}
