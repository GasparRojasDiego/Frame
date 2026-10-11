import { useRef, useState } from 'react';
import { AlignLeft, List } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Anotaciones con dos formas que conviven en el MISMO texto: párrafos de texto
// continuo y listas de viñetas. La anotación sigue siendo una cadena (las
// viñetas son líneas que empiezan por «• »): así viaja igual que siempre por
// los informes, el respaldo y la sincronización, sin tocar el modelo de datos.
//
// · «Lista» convierte la línea del cursor en viñeta; «Texto» la devuelve.
// · Enter dentro de una viñeta crea la siguiente; Enter en una viñeta vacía
//   sale de la lista. En texto, Enter es un salto de línea normal.
// · Ctrl+Enter anota.
// ============================================================

export const BULLET = '• ';
const BULLET_PREFIX = /^(• |- )/;
const isBulletLine = (line: string) => BULLET_PREFIX.test(line);

function lineBounds(value: string, caret: number) {
  const start = value.lastIndexOf('\n', caret - 1) + 1;
  let end = value.indexOf('\n', caret);
  if (end === -1) end = value.length;
  return { start, end };
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
  hint = 'Ctrl+Enter para anotar',
  className,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
  /** Medidas reducidas: es la variante de la ventana flotante. */
  dense?: boolean;
  /** Texto de ayuda a la derecha de «Texto · Lista» (null = sin texto). */
  hint?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);

  const current = lineBounds(value, Math.min(caret, value.length));
  const listMode = isBulletLine(value.slice(current.start, current.end));

  const apply = (next: string, nextCaret: number) => {
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  };

  const setMode = (list: boolean) => {
    const el = ref.current;
    const pos = el?.selectionStart ?? caret;
    const { start, end } = lineBounds(value, pos);
    const line = value.slice(start, end);
    if (list === isBulletLine(line)) {
      el?.focus();
      return;
    }
    if (list) {
      apply(value.slice(0, start) + BULLET + line + value.slice(end), pos + BULLET.length);
    } else {
      const stripped = line.replace(BULLET_PREFIX, '');
      apply(value.slice(0, start) + stripped + value.slice(end), Math.max(start, pos - (line.length - stripped.length)));
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSubmit?.();
      return;
    }
    if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey) return;
    const pos = event.currentTarget.selectionStart;
    const { start, end } = lineBounds(value, pos);
    const line = value.slice(start, end);
    if (!isBulletLine(line)) return; // texto continuo: salto de línea normal
    event.preventDefault();
    if (line.replace(BULLET_PREFIX, '').trim() === '') {
      // Viñeta vacía: se sale de la lista y se sigue en texto.
      apply(value.slice(0, start) + value.slice(end), start);
    } else {
      apply(value.slice(0, pos) + '\n' + BULLET + value.slice(pos), pos + 1 + BULLET.length);
    }
  };

  const syncCaret = (event: React.SyntheticEvent<HTMLTextAreaElement>) => setCaret(event.currentTarget.selectionStart);

  const modeButton = (list: boolean, label: string, Icon: typeof List) => (
    <button
      type="button"
      // Sin robar el foco al texto: el cursor se queda donde estaba.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => setMode(list)}
      aria-pressed={listMode === list}
      className={cn(
        'flex items-center gap-1 rounded px-2 font-semibold transition-colors',
        dense ? 'h-5 text-[9.5px]' : 'h-6 text-[11px]',
        listMode === list ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className={dense ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {label}
    </button>
  );

  return (
    <div className={cn('flex min-h-0 flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border bg-secondary/50 p-0.5" role="group" aria-label="Formato de la línea">
          {modeButton(false, 'Texto', AlignLeft)}
          {modeButton(true, 'Lista', List)}
        </div>
        {hint && <span className={cn('text-muted-foreground', dense ? 'text-[9px]' : 'text-[10px]')}>{hint}</span>}
      </div>
      <textarea
        id={id}
        ref={ref}
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
        className={cn(
          'min-h-0 w-full flex-1 resize-none rounded-md border border-input bg-background text-foreground outline-none placeholder:text-muted-foreground focus:border-primary',
          dense ? 'px-2 py-1.5 text-[11px] leading-snug' : 'px-3 py-2 text-sm leading-relaxed'
        )}
      />
    </div>
  );
}

/** Pinta una anotación: los párrafos como texto y las viñetas como lista. */
export function NoteText({ text, className }: { text: string; className?: string }) {
  const blocks: Array<{ list: boolean; lines: string[] }> = [];
  for (const raw of text.split('\n')) {
    const list = isBulletLine(raw);
    const line = list ? raw.replace(BULLET_PREFIX, '') : raw;
    const last = blocks[blocks.length - 1];
    if (last && last.list === list) last.lines.push(line);
    else blocks.push({ list, lines: [line] });
  }
  return (
    <div className={cn('space-y-1', className)}>
      {blocks.map((block, index) =>
        block.list ? (
          <ul key={index} className="list-disc space-y-0.5 pl-4 marker:text-primary">
            {block.lines.map((line, lineIndex) => (
              <li key={lineIndex}>{line}</li>
            ))}
          </ul>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            {block.lines.join('\n')}
          </p>
        )
      )}
    </div>
  );
}
