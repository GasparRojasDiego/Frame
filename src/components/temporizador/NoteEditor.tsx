import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Bold, Italic, List, ListOrdered, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseRichNote,
  serializeRichNote,
  type RichLine,
  type RichLineKind,
  type RichRun,
} from '@/lib/rich-note';
import RichNoteView from './RichNoteView';

// ============================================================
// Editor de anotaciones: un Word en miniatura.
//
// Siempre se escribe texto; la barra de arriba da formato a lo seleccionado
// (o a lo que se escriba a continuación): negrita, cursiva, subrayado, lista
// con viñetas, lista numerada, deshacer y rehacer. Se seleccionan varias
// líneas y un botón las convierte en lista; volver a pulsarlo las devuelve a
// texto. Como en Word, escribir «- » o «1. » al principio de una línea
// también abre la lista.
//
// Por dentro es un `contentEditable`, pero lo que sale de aquí NUNCA es HTML:
// cada cambio se lee del DOM como líneas y tramos (texto + tres marcas) y se
// guarda en el markdown mínimo de src/lib/rich-note.ts. Lo pegado entra como
// texto plano. Así la anotación sigue siendo una cadena en el mismo campo de
// siempre, legible tal cual en la nube y en Android.
//
// · Enter dentro de una lista crea el siguiente punto; en un punto vacío, sale.
//   Mayús+Enter, también (el formato no tiene saltos dentro de un punto).
// · Ctrl+B / Ctrl+I / Ctrl+U dan formato; Ctrl+Enter anota.
// · Ctrl+Z / Ctrl+Y y los botones deshacen y rehacen SOLO la nota: lleva su
//   propio historial, porque el del navegador es uno para toda la página y
//   deshacía lo escrito en otro campo (el buscador de asignaturas, p. ej.).
// ============================================================

type Command = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList';
const COMMANDS: Command[] = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];
type ActiveState = Record<Command, boolean>;
const NOTHING_ACTIVE: ActiveState = {
  bold: false,
  italic: false,
  underline: false,
  insertUnorderedList: false,
  insertOrderedList: false,
};

/** Elementos que empiezan línea nueva. */
const BLOCK_TAGS = new Set([
  'DIV', 'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'TABLE', 'TR',
]);
/** Lo que no aporta texto: se ignora entero. */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IMG', 'svg', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT']);
/** Espacio duro y espacio de ancho cero: los mete el propio navegador al
 *  editar; en la anotación no significan nada distinto de « » y de «». */
const HARD_SPACE = new RegExp(String.fromCharCode(0xa0), 'g');
const ZERO_WIDTH = new RegExp(String.fromCharCode(0x200b), 'g');

type Marks = Pick<RichRun, 'bold' | 'italic' | 'underline'>;

// ------------------------------------------------------------
// DOM → líneas (lo que se guarda)
// ------------------------------------------------------------

function appendRun(line: RichLine, text: string, marks: Marks) {
  const last = line.runs[line.runs.length - 1];
  if (
    last &&
    !!last.bold === !!marks.bold &&
    !!last.italic === !!marks.italic &&
    !!last.underline === !!marks.underline
  ) {
    last.text += text;
    return;
  }
  const run: RichRun = { text };
  if (marks.bold) run.bold = true;
  if (marks.italic) run.italic = true;
  if (marks.underline) run.underline = true;
  line.runs.push(run);
}

/** Las marcas que pone un elemento: etiquetas (b, i, u…) o estilo en línea. */
function marksOf(element: HTMLElement, inherited: Marks): Marks {
  const marks = { ...inherited };
  const tag = element.tagName;
  if (tag === 'B' || tag === 'STRONG') marks.bold = true;
  if (tag === 'I' || tag === 'EM') marks.italic = true;
  if (tag === 'U' || tag === 'INS') marks.underline = true;

  const style = element.style;
  if (style) {
    const weight = style.fontWeight;
    if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) marks.bold = true;
    else if (weight === 'normal' || (Number(weight) > 0 && Number(weight) < 600)) marks.bold = false;
    if (style.fontStyle === 'italic' || style.fontStyle === 'oblique') marks.italic = true;
    else if (style.fontStyle === 'normal') marks.italic = false;
    const decoration = `${style.textDecorationLine} ${style.textDecoration}`;
    if (decoration.includes('underline')) marks.underline = true;
  }
  return marks;
}

/** El número de un punto de lista numerada: se lo queda la primera línea que
 *  se abre dentro; si hubiera más, siguen la cuenta al guardarse. */
type NumberSlot = { number?: number };

function domToLines(root: HTMLElement): RichLine[] {
  const lines: RichLine[] = [];
  const cursor: { line: RichLine | null } = { line: null };
  const open = (kind: RichLineKind, slot: NumberSlot | null) => {
    const line: RichLine = { kind, runs: [] };
    if (kind === 'number' && slot?.number !== undefined) {
      line.number = slot.number;
      slot.number = undefined;
    }
    lines.push(line);
    cursor.line = line;
    return line;
  };
  const close = () => {
    cursor.line = null;
  };

  const walk = (node: Node, marks: Marks, kind: RichLineKind, slot: NumberSlot | null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Un «\n» suelto (texto con white-space: pre-wrap) también parte la línea.
      const parts = (node.nodeValue ?? '').replace(HARD_SPACE, ' ').replace(ZERO_WIDTH, '').split('\n');
      parts.forEach((part, index) => {
        if (index > 0) {
          close();
          if (!part && index < parts.length - 1) open(kind, slot);
        }
        if (part) appendRun(cursor.line ?? open(kind, slot), part, marks);
      });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const tag = element.tagName;
    if (SKIP_TAGS.has(tag)) return;
    if (tag === 'BR') {
      if (!cursor.line) open(kind, slot); // un salto sin texto antes es una línea vacía
      close();
      return;
    }

    const nextMarks = marksOf(element, marks);
    const nextKind: RichLineKind = tag === 'UL' ? 'bullet' : tag === 'OL' ? 'number' : kind;
    const block = BLOCK_TAGS.has(tag);
    if (block) close();
    const before = lines.length;
    // Cada punto numerado lleva el número que se ve: el `start` de su lista
    // (o el `value` del punto) y de ahí en adelante.
    let counter = tag === 'OL' ? (element as HTMLOListElement).start : 1;
    element.childNodes.forEach((child) => {
      let childSlot = tag === 'OL' || tag === 'UL' ? null : slot;
      if (tag === 'OL' && child.nodeName === 'LI') {
        const item = child as HTMLLIElement;
        if (item.hasAttribute('value')) counter = item.value;
        childSlot = { number: counter++ };
      }
      walk(child, nextMarks, tag === 'LI' && nextKind === 'text' ? 'bullet' : nextKind, childSlot);
    });
    // Un punto de lista vacío sigue siendo un punto.
    if (tag === 'LI' && lines.length === before) open(nextKind === 'text' ? 'bullet' : nextKind, slot);
    if (block) close();
  };

  root.childNodes.forEach((child) => walk(child, {}, 'text', null));
  return lines;
}

// ------------------------------------------------------------
// Líneas → DOM (al abrir el editor con una anotación ya escrita)
// ------------------------------------------------------------

function fillRuns(target: HTMLElement, runs: RichRun[]) {
  if (runs.every((run) => !run.text)) {
    target.appendChild(document.createElement('br'));
    return;
  }
  for (const run of runs) {
    if (!run.text) continue;
    let node: Node = document.createTextNode(run.text);
    for (const [flag, tag] of [
      [run.underline, 'u'],
      [run.italic, 'i'],
      [run.bold, 'b'],
    ] as const) {
      if (!flag) continue;
      const wrapper = document.createElement(tag);
      wrapper.appendChild(node);
      node = wrapper;
    }
    target.appendChild(node);
  }
}

function renderLines(root: HTMLElement, lines: RichLine[]) {
  root.replaceChildren();
  let list: HTMLElement | null = null;
  let listKind: RichLineKind | null = null;
  /** Número que tocaría al siguiente punto de la lista numerada abierta. */
  let expected = 1;
  for (const line of lines) {
    if (line.kind === 'text') {
      list = null;
      listKind = null;
      const row = document.createElement('div');
      fillRuns(row, line.runs);
      root.appendChild(row);
      continue;
    }
    // El número escrito se respeta con el `start` de la lista (no con el
    // `value` de cada punto: Enter clona el punto con sus atributos). Si la
    // cuenta salta («3.» y luego «7.»), empieza otra lista en su número.
    const number = line.kind === 'number' ? (line.number ?? (listKind === 'number' ? expected : 1)) : 0;
    if (!list || listKind !== line.kind || (line.kind === 'number' && number !== expected)) {
      list = document.createElement(line.kind === 'bullet' ? 'ul' : 'ol');
      if (line.kind === 'number' && number !== 1) list.setAttribute('start', String(number));
      listKind = line.kind;
      root.appendChild(list);
    }
    expected = number + 1;
    const item = document.createElement('li');
    fillRuns(item, line.runs);
    list.appendChild(item);
  }
}

const isDomEmpty = (root: HTMLElement) =>
  (root.textContent ?? '').replace(ZERO_WIDTH, '') === '' && !root.querySelector('li');

function caretToEnd(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Dónde está el cursor, en caracteres de texto desde el principio (null: fuera). */
function caretOffset(root: HTMLElement): number | null {
  const selection = window.getSelection();
  const node = selection?.focusNode;
  if (!selection || !node || !root.contains(node)) return null;
  try {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, selection.focusOffset);
    return range.toString().length;
  } catch {
    return null;
  }
}

/** Pone el cursor a `offset` caracteres del principio (o al final). */
function placeCaret(root: HTMLElement, offset: number | null) {
  const selection = window.getSelection();
  if (offset === null || !selection) return caretToEnd(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let left = offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0;
    if (left <= length) {
      const range = document.createRange();
      range.setStart(node, left);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    left -= length;
  }
  caretToEnd(root);
}

/** Un estado de la nota en el historial: su valor y dónde quedó el cursor. */
type Snapshot = { value: string; caret: number | null };
const HISTORY_LIMIT = 200;
/** Lo tecleado seguido (sin pausas de más de esto) es un solo paso de deshacer. */
const TYPING_PAUSE_MS = 1000;

/** ¿El nodo de texto abre su línea? (nada escrito antes dentro del mismo bloque) */
function startsLine(node: Node, root: HTMLElement): boolean {
  let current: Node | null = node;
  while (current && current !== root) {
    let previous: ChildNode | null = (current as ChildNode).previousSibling;
    while (previous) {
      if (previous.nodeName === 'BR' || BLOCK_TAGS.has(previous.nodeName)) return true;
      if ((previous.textContent ?? '') !== '') return false;
      previous = previous.previousSibling;
    }
    const parent: Node | null = current.parentNode;
    if (parent && parent !== root && BLOCK_TAGS.has(parent.nodeName)) return true;
    current = parent;
  }
  return true;
}

/** Texto plano (pegado o arrastrado) línea a línea, sin traer formato ajeno. */
function insertPlainText(text: string) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((line, index) => {
    if (index > 0) document.execCommand('insertParagraph');
    if (line) document.execCommand('insertText', false, line);
  });
}

export default function NoteEditor({
  id,
  value,
  onChange,
  onSubmit,
  onCancel,
  rows = 4,
  placeholder,
  autoFocus = false,
  dense = false,
  hint = null,
  toolbarEnd,
  toolbarSide = false,
  className,
  ariaLabel,
  ariaLabelledBy,
}: {
  id?: string;
  /** Botones de formato en columna, a la izquierda del recuadro (1.6.5): el
   *  bloque queda compensado, sin una franja vacía a la derecha. */
  toolbarSide?: boolean;
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
  /** Medidas reducidas: ventanas flotantes y recuadros con poco sitio. */
  dense?: boolean;
  /** Texto breve a la derecha de la barra de formato (null = nada). */
  hint?: string | null;
  /** Lo que va a la derecha de la barra, en lugar del texto breve. */
  toolbarEnd?: ReactNode;
  className?: string;
  /** Nombre del cuadro para lectores de pantalla (si no, el `placeholder`).
   *  Un `<label htmlFor>` no nombra a un `contentEditable`. */
  ariaLabel?: string;
  /** Id del elemento que lo nombra (la etiqueta visible); manda sobre `ariaLabel`. */
  ariaLabelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** Último valor que salió de aquí: si el padre lo devuelve igual, el DOM no
   *  se toca (repintarlo movería el cursor y borraría el historial). */
  const emitted = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [active, setActive] = useState<ActiveState>(NOTHING_ACTIVE);
  const [empty, setEmpty] = useState(() => value.trim() === '');

  // Historial propio de la nota (ver la cabecera): `present` es el estado
  // actual; `past` y `future`, lo que deshacer y rehacer. `group` y `at`
  // juntan lo tecleado seguido en un solo paso.
  const present = useRef<Snapshot>({ value: '', caret: null });
  const history = useRef({ past: [] as Snapshot[], future: [] as Snapshot[], group: null as string | null, at: 0 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncHistory = useCallback(() => {
    setCanUndo(history.current.past.length > 0);
    setCanRedo(history.current.future.length > 0);
  }, []);
  /** Mientras se encadenan órdenes al DOM (pegar, convertir en lista…), sus
   *  `input` no se anotan uno a uno: se emite una vez al terminar. */
  const quiet = useRef(false);
  const quietly = (run: () => void) => {
    quiet.current = true;
    try {
      run();
    } finally {
      quiet.current = false;
    }
  };
  /** El arrastre empezó dentro de la nota: soltarlo en ella es MOVER. */
  const dragFromInside = useRef(false);

  // Valor de fuera (al abrir o al vaciarse tras anotar) → DOM. Es otra nota:
  // el historial empieza de cero.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || value === emitted.current) return;
    renderLines(element, parseRichNote(value));
    emitted.current = value;
    setEmpty(isDomEmpty(element));
    present.current = { value, caret: null };
    history.current = { past: [], future: [], group: null, at: 0 };
    syncHistory();
  }, [value, syncHistory]);

  /** DOM → valor, y un paso más en el historial. `group` junta lo tecleado
   *  seguido; `boundary` (un espacio) abre paso nuevo, como en Word. */
  const emit = useCallback(
    (group: string | null = null, boundary = false) => {
      const element = ref.current;
      if (!element) return;
      setEmpty(isDomEmpty(element));
      const next = serializeRichNote(domToLines(element));
      if (next === emitted.current) return;
      const h = history.current;
      const now = Date.now();
      const sameStep = group !== null && !boundary && h.group === group && now - h.at < TYPING_PAUSE_MS;
      if (!sameStep) {
        h.past.push(present.current);
        if (h.past.length > HISTORY_LIMIT) h.past.shift();
      }
      h.future = [];
      h.group = group;
      h.at = now;
      present.current = { value: next, caret: caretOffset(element) };
      syncHistory();
      emitted.current = next;
      onChangeRef.current(next);
    },
    [syncHistory]
  );

  /** Botones encendidos según dónde esté el cursor, como en Word. */
  const refreshActive = useCallback(() => {
    const element = ref.current;
    const selection = document.getSelection();
    if (!element || !selection?.anchorNode || !element.contains(selection.anchorNode)) return;
    const next = { ...NOTHING_ACTIVE };
    for (const command of COMMANDS) {
      try {
        next[command] = document.queryCommandState(command);
      } catch {
        next[command] = false;
      }
    }
    setActive((prev) => (COMMANDS.every((command) => prev[command] === next[command]) ? prev : next));
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshActive);
    return () => document.removeEventListener('selectionchange', refreshActive);
  }, [refreshActive]);

  useEffect(() => {
    if (!autoFocus) return;
    const element = ref.current;
    if (!element) return;
    const focus = () => {
      if (document.activeElement === element) return;
      element.focus();
      caretToEnd(element);
    };
    focus();
    // Un recuadro que se abre puede llevarse el foco justo después: se recupera.
    const frame = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  /** Deshacer / rehacer con el historial de la nota: se repinta el estado
   *  guardado y el cursor vuelve a donde estaba entonces. */
  const travel = useCallback(
    (direction: 'undo' | 'redo') => {
      const element = ref.current;
      if (!element) return;
      const h = history.current;
      const target = direction === 'undo' ? h.past.pop() : h.future.pop();
      if (!target) return;
      (direction === 'undo' ? h.future : h.past).push(present.current);
      h.group = null;
      present.current = target;
      renderLines(element, parseRichNote(target.value));
      emitted.current = target.value;
      setEmpty(isDomEmpty(element));
      if (document.activeElement !== element) element.focus();
      placeCaret(element, target.caret);
      syncHistory();
      onChangeRef.current(target.value);
      refreshActive();
    },
    [refreshActive, syncHistory]
  );

  // Deshacer desde el menú del clic derecho: también con el historial propio.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') return;
      event.preventDefault();
      travel(event.inputType === 'historyUndo' ? 'undo' : 'redo');
    };
    element.addEventListener('beforeinput', onBeforeInput);
    return () => element.removeEventListener('beforeinput', onBeforeInput);
  }, [travel]);

  const exec = (command: Command | 'undo' | 'redo') => {
    if (command === 'undo' || command === 'redo') return travel(command);
    const element = ref.current;
    if (!element) return;
    if (document.activeElement !== element) {
      element.focus();
      caretToEnd(element);
    }
    quietly(() => document.execCommand(command, false));
    emit();
    refreshActive();
  };

  /** ¿El cursor está dentro de un punto de lista de esta nota? */
  const caretInListItem = () => {
    const element = ref.current;
    const node = window.getSelection()?.anchorNode;
    if (!element || !node || !element.contains(node)) return false;
    const from = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const item = from?.closest('li');
    return !!item && element.contains(item);
  };

  /** «- », «* » o «1. » al principio de una línea: se convierte en lista. */
  const autoList = (): boolean => {
    const element = ref.current;
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    if (!element || !selection || !selection.isCollapsed || !node || node.nodeType !== Node.TEXT_NODE) return false;
    if (!element.contains(node) || node.parentElement?.closest('li')) return false;
    const typed = (node.nodeValue ?? '').slice(0, selection.anchorOffset).replace(HARD_SPACE, ' ');
    const command = /^[-*•] $/.test(typed)
      ? 'insertUnorderedList'
      : /^1[.)] $/.test(typed)
        ? 'insertOrderedList'
        : null;
    if (!command || !startsLine(node, element)) return false;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, selection.anchorOffset);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete');
    document.execCommand(command);
    return true;
  };

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    if (quiet.current) return;
    const native = event.nativeEvent as InputEvent;
    const type = native.inputType ?? '';
    if (type === 'insertText' && native.data === ' ') quietly(autoList);
    // Teclear y borrar seguido se deshace de una vez; mover arrastrando
    // (quitar de un sitio y poner en otro), también.
    const group =
      type === 'insertText' || type === 'insertCompositionText'
        ? 'insert'
        : type === 'deleteContentBackward' || type === 'deleteContentForward'
          ? 'delete'
          : type === 'deleteByDrag' || type === 'insertFromDrop'
            ? 'drag'
            : null;
    emit(group, native.data === ' ');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === 'Enter' && mod) {
      event.preventDefault();
      emit();
      onSubmit?.();
      return;
    }
    const key = event.key.toLowerCase();
    // Sin subrayado desde la 1.6.6: Ctrl+U no hace nada (lo ya subrayado se
    // sigue viendo).
    if (mod && !event.altKey && key === 'u') {
      event.preventDefault();
      return;
    }
    if (mod && !event.altKey && (key === 'z' || key === 'y')) {
      event.preventDefault();
      travel(key === 'y' || event.shiftKey ? 'redo' : 'undo');
      return;
    }
    // Mayús+Enter dentro de una lista: otro punto, como Enter. Un salto dentro
    // del mismo punto se guardaría como dos (el formato no tiene otro modo), y
    // lo que se ve tiene que ser lo que se guarda.
    if (event.key === 'Enter' && event.shiftKey && !mod && caretInListItem()) {
      event.preventDefault();
      document.execCommand('insertParagraph');
      return;
    }
    if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      onCancel();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    quietly(() => insertPlainText(event.clipboardData.getData('text/plain')));
    emit();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (dragFromInside.current) {
      // Mover dentro de la propia nota: lo hace el navegador (quita el texto
      // de donde estaba y lo pone, con su formato, donde se suelta). Lo que
      // quede en el DOM se sanea al emitir.
      dragFromInside.current = false;
      return;
    }
    event.preventDefault();
    const text = event.dataTransfer.getData('text/plain');
    if (!text) return;
    const range =
      typeof document.caretRangeFromPoint === 'function'
        ? document.caretRangeFromPoint(event.clientX, event.clientY)
        : null;
    if (range) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    quietly(() => insertPlainText(text));
    emit();
  };

  // Alto de `rows` líneas (como el textarea de antes) y, como mucho, algo más
  // del doble: a partir de ahí, scroll dentro del recuadro.
  const minHeight = Math.round(rows * (dense ? 15 : 22.75) + (dense ? 14 : 18));

  const tool = (
    command: Command | 'undo' | 'redo',
    label: string,
    Icon: LucideIcon,
    pressed?: boolean,
    disabled = false
  ) => (
    <button
      type="button"
      tabIndex={-1}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      // Sin robar el foco al texto: la selección se queda donde estaba.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => exec(command)}
      className={cn(
        'flex shrink-0 items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40',
        dense ? 'h-5 w-5' : 'h-6 w-6',
        pressed ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-background hover:text-foreground'
      )}
    >
      <Icon className={dense ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    </button>
  );
  const divider = toolbarSide ? (
    <span aria-hidden className="my-0.5 h-px w-4 shrink-0 bg-border" />
  ) : (
    <span aria-hidden className={cn('mx-0.5 w-px shrink-0 bg-border', dense ? 'h-3' : 'h-4')} />
  );

  return (
    <div className={cn('flex min-h-0', toolbarSide ? 'flex-row items-stretch gap-3' : 'flex-col gap-1.5', className)}>
      <div className={cn(toolbarSide ? 'flex shrink-0' : 'flex items-center justify-between gap-2')}>
        <div
          role="toolbar"
          aria-label="Formato del texto"
          aria-orientation={toolbarSide ? 'vertical' : 'horizontal'}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary/50 p-0.5',
            // 1.6.7 (Diego): apilados, miden lo mismo que el recuadro de escribir
            // (crecen con él) y reparten los botones a lo alto.
            toolbarSide && 'flex-col justify-evenly self-stretch'
          )}
        >
          {/* 1.6.6: sin subrayado, deshacer ni rehacer (Diego). Ctrl+Z y Ctrl+Y
              siguen funcionando con teclado. */}
          {tool('bold', 'Negrita (Ctrl+B)', Bold, active.bold)}
          {tool('italic', 'Cursiva (Ctrl+I)', Italic, active.italic)}
          {divider}
          {tool('insertUnorderedList', 'Lista con viñetas', List, active.insertUnorderedList)}
          {tool('insertOrderedList', 'Lista numerada', ListOrdered, active.insertOrderedList)}
        </div>
        {!toolbarSide &&
          (toolbarEnd ??
            (hint && <span className={cn('text-muted-foreground', dense ? 'text-[9px]' : 'text-[10px]')}>{hint}</span>))}
      </div>

      <div className={cn('relative flex min-h-0 flex-1 flex-col', toolbarSide && 'min-w-0')}>
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? placeholder)}
          aria-labelledby={ariaLabelledBy}
          aria-placeholder={placeholder}
          contentEditable
          suppressContentEditableWarning
          tabIndex={0}
          spellCheck
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onFocus={refreshActive}
          onBlur={() => setActive(NOTHING_ACTIVE)}
          onPaste={handlePaste}
          onDragStart={() => {
            dragFromInside.current = true;
          }}
          onDragEnd={() => {
            dragFromInside.current = false;
          }}
          onDrop={handleDrop}
          style={{ minHeight, maxHeight: Math.round(minHeight * 2.4) }}
          className={cn(
            'min-h-0 w-full flex-1 cursor-text select-text overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-input bg-background text-foreground outline-none transition-colors focus:border-primary',
            // Las listas se ven como listas (el reset de Tailwind las deja sin marca).
            '[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:pl-0.5 marker:text-primary',
            dense ? 'px-2 py-1.5 text-[11px] leading-snug' : 'px-3 py-2 text-sm leading-relaxed'
          )}
        />
        {empty && placeholder && (
          <span
            aria-hidden
            // Justo donde empieza el texto: borde de 1 px + el relleno del recuadro.
            className={cn(
              'pointer-events-none absolute truncate text-muted-foreground',
              dense
                ? 'left-[9px] right-[9px] top-[7px] text-[11px] leading-snug'
                : 'left-[13px] right-[13px] top-[9px] text-sm leading-relaxed'
            )}
          >
            {placeholder}
          </span>
        )}
      </div>
    </div>
  );
}

/** Pinta una anotación. Se conserva el nombre de siempre: hoy es `RichNoteView`. */
export function NoteText({ text, className }: { text: string; className?: string }) {
  return <RichNoteView text={text} className={className} />;
}
