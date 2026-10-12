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
//   «- » al principio de la línea → viñeta;  «1. » → lista numerada.
//   \*  \_  \\  → el carácter tal cual (escape).
//   «\» delante de una línea de texto que parecería lista: no lo es.
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
}

type Mark = 'bold' | 'italic' | 'underline';

const BULLET_LINE = /^(?:- |• )/;
const NUMBER_LINE = /^\d{1,3}[.)] /;
/** Línea de texto que empieza como una lista: se guarda con «\» delante. */
const LIST_LIKE = /^(?:- |• |\d{1,3}[.)] )/;
const ESCAPABLE = new Set(['*', '_', '\\']);

// ------------------------------------------------------------
// Lectura
// ------------------------------------------------------------

type Token = { kind: 'text'; value: string } | { kind: 'mark'; mark: Mark; raw: string };

function tokenize(source: string): Token[] {
  const out: Token[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ kind: 'text', value: buffer });
    buffer = '';
  };

  for (let k = 0; k < source.length; k++) {
    const char = source[k];
    const next = source[k + 1];
    if (char === '\\' && next !== undefined && ESCAPABLE.has(next)) {
      buffer += next;
      k++;
    } else if (char === '*' && next === '*') {
      flush();
      out.push({ kind: 'mark', mark: 'bold', raw: '**' });
      k++;
    } else if (char === '_' && next === '_') {
      flush();
      out.push({ kind: 'mark', mark: 'underline', raw: '__' });
      k++;
    } else if (char === '*') {
      flush();
      out.push({ kind: 'mark', mark: 'italic', raw: '*' });
    } else {
      buffer += char;
    }
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
 * Marcas de una línea. Cada marca abre y cierra por parejas; la que se queda
 * sin pareja (un «*» suelto en «3*4») se lee como el carácter que es.
 */
function parseInline(source: string): RichRun[] {
  const tokens = tokenize(source);
  const total: Record<Mark, number> = { bold: 0, italic: 0, underline: 0 };
  for (const token of tokens) if (token.kind === 'mark') total[token.mark]++;

  const seen: Record<Mark, number> = { bold: 0, italic: 0, underline: 0 };
  const state: Record<Mark, boolean> = { bold: false, italic: false, underline: false };
  const runs: RichRun[] = [];

  for (const token of tokens) {
    if (token.kind === 'text') {
      pushRun(runs, token.value, state);
      continue;
    }
    seen[token.mark]++;
    const orphan = total[token.mark] % 2 === 1 && seen[token.mark] === total[token.mark];
    if (orphan) pushRun(runs, token.raw, state);
    else state[token.mark] = !state[token.mark];
  }
  return runs;
}

/** La anotación guardada, línea a línea. Acepta también el formato viejo. */
export function parseRichNote(text: string): RichLine[] {
  const source = (text ?? '').replace(/\r\n?/g, '\n');
  if (source.trim() === '') return [];

  return source.split('\n').map((raw): RichLine => {
    if (BULLET_LINE.test(raw)) return { kind: 'bullet', runs: parseInline(raw.slice(2)) };
    const numbered = raw.match(NUMBER_LINE);
    if (numbered) return { kind: 'number', runs: parseInline(raw.slice(numbered[0].length)) };
    // «\- algo»: texto que empieza con guion, no una viñeta.
    const body = raw.startsWith('\\') && LIST_LIKE.test(raw.slice(1)) ? raw.slice(1) : raw;
    return { kind: 'text', runs: parseInline(body) };
  });
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

const MARK_RAW: Record<Mark, string> = { bold: '**', italic: '*', underline: '__' };
const MARKS: Mark[] = ['bold', 'italic', 'underline'];

function serializeRuns(runs: RichRun[]): string {
  const state: Record<Mark, boolean> = { bold: false, italic: false, underline: false };
  let out = '';
  for (const run of runs) {
    if (!run.text) continue;
    // Se abren y cierran solo las marcas que cambian respecto al tramo anterior.
    for (const mark of MARKS) {
      const wanted = !!run[mark];
      if (wanted !== state[mark]) {
        out += MARK_RAW[mark];
        state[mark] = wanted;
      }
    }
    out += escapeText(run.text);
  }
  for (const mark of MARKS) if (state[mark]) out += MARK_RAW[mark];
  return out;
}

const lineIsBlank = (line: RichLine) => line.runs.every((run) => run.text.trim() === '');

/** Líneas → la cadena que se guarda. Sin líneas vacías en los extremos. */
export function serializeRichNote(lines: RichLine[]): string {
  let first = 0;
  let last = lines.length - 1;
  while (first <= last && lines[first].kind === 'text' && lineIsBlank(lines[first])) first++;
  while (last >= first && lines[last].kind === 'text' && lineIsBlank(lines[last])) last--;

  let counter = 0;
  const out: string[] = [];
  for (let index = first; index <= last; index++) {
    const line = lines[index];
    const body = serializeRuns(line.runs);
    if (line.kind === 'number') {
      counter = index > first && lines[index - 1].kind === 'number' ? counter + 1 : 1;
      out.push(`${counter}. ${body}`);
      continue;
    }
    counter = 0;
    if (line.kind === 'bullet') out.push(`- ${body}`);
    else out.push(LIST_LIKE.test(body) ? `\\${body}` : body);
  }
  return out.join('\n');
}

// ------------------------------------------------------------
// Texto limpio
// ------------------------------------------------------------

const lineText = (line: RichLine) => line.runs.map((run) => run.text).join('');

/** Líneas sin marcas; las viñetas vacías se caen (no dicen nada). */
function plainLines(text: string): { kind: RichLineKind; body: string; number: number }[] {
  const lines = parseRichNote(text).filter((line) => line.kind === 'text' || !lineIsBlank(line));
  let counter = 0;
  return lines.map((line, index) => {
    counter = line.kind === 'number' ? (index > 0 && lines[index - 1].kind === 'number' ? counter + 1 : 1) : 0;
    return { kind: line.kind, body: lineText(line), number: counter };
  });
}

/**
 * La anotación sin marcas: para informes, búsquedas y la vista flotante
 * compacta. Las viñetas quedan como «• » y la numeración, recalculada.
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
