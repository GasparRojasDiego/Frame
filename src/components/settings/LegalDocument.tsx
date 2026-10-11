import React from 'react';
import { cn } from '@/lib/utils';

// ============================================================
// Renderizador de los documentos de la app (información, términos y
// condiciones, privacidad y soporte).
//
// El texto vive como Markdown en src/lib/legal/*: así se actualiza un
// documento legal editando una cadena, sin tocar JSX ni arriesgarse a romper
// la pantalla. Aquí solo se traduce el subconjunto que esos textos usan:
// encabezados, párrafos, listas, tablas, citas y separadores.
// ============================================================

/** Negrita, cursiva, código y los huecos por rellenar. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[A-ZÁÉÍÓÚÑ0-9º][^\]]*\])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith('**')) {
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      out.push(
        <code key={key} className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px] text-foreground">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      out.push(
        <span
          key={key}
          title="Dato pendiente de completar antes de publicar"
          className="rounded bg-amber-500/15 px-1 font-medium text-amber-600 dark:text-amber-400"
        >
          {token.slice(1, -1).toLowerCase()}
        </span>
      );
    } else {
      out.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface Row {
  cells: string[];
}

function Table({ head, rows }: { head: string[]; rows: Row[] }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-secondary/60">
            {head.map((cell, i) => (
              <th
                key={i}
                className="border-b border-border/70 px-2.5 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {inline(cell, `th-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-border/50 last:border-0">
              {row.cells.map((cell, c) => (
                <td key={c} className="px-2.5 py-1.5 align-top text-muted-foreground">
                  {inline(cell, `td-${r}-${c}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const splitRow = (line: string): string[] =>
  line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());

export default function LegalDocument({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];

  let list: string[] = [];
  let quote: string[] = [];
  let tableHead: string[] | null = null;
  let tableRows: Row[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    out.push(
      <ul key={`ul-${out.length}`} className="my-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {list.map((item, i) => (
          <li key={i}>{inline(item, `li-${out.length}-${i}`)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  const flushQuote = () => {
    if (quote.length === 0) return;
    out.push(
      <div
        key={`q-${out.length}`}
        className="my-3 rounded-r-md border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs text-muted-foreground"
      >
        {quote.map((item, i) => (
          <p key={i} className="text-justify leading-relaxed">
            {inline(item, `qp-${out.length}-${i}`)}
          </p>
        ))}
      </div>
    );
    quote = [];
  };

  const flushTable = () => {
    if (!tableHead) return;
    out.push(<Table key={`t-${out.length}`} head={tableHead} rows={tableRows} />);
    tableHead = null;
    tableRows = [];
  };

  const flushAll = () => {
    flushList();
    flushQuote();
    flushTable();
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '') {
      flushAll();
      return;
    }

    // --- Tablas ---
    if (trimmed.startsWith('|')) {
      const cells = splitRow(trimmed);
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return; // separador
      if (!tableHead) tableHead = cells;
      else tableRows.push({ cells });
      return;
    }
    flushTable();

    // --- Listas ---
    if (/^[-*]\s+/.test(trimmed)) {
      flushQuote();
      list.push(trimmed.replace(/^[-*]\s+/, ''));
      return;
    }
    flushList();

    // --- Citas ---
    if (trimmed.startsWith('>')) {
      quote.push(trimmed.replace(/^>\s?/, ''));
      return;
    }
    flushQuote();

    // --- Separador ---
    if (/^---+$/.test(trimmed)) {
      out.push(<div key={`hr-${index}`} className="my-4 h-px bg-border" />);
      return;
    }

    // --- Encabezados ---
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      if (level === 1) {
        out.push(
          <h2
            key={`h-${index}`}
            className="mt-6 text-center font-headline text-xl font-bold text-primary first:mt-0"
          >
            {inline(text, `h1-${index}`)}
          </h2>
        );
      } else if (level === 2) {
        out.push(
          <h3
            key={`h-${index}`}
            className="mt-5 border-b border-border/70 pb-1 font-headline text-base font-bold text-foreground"
          >
            {inline(text, `h2-${index}`)}
          </h3>
        );
      } else {
        out.push(
          <h4
            key={`h-${index}`}
            className={cn('mt-4 text-sm font-semibold', level === 3 ? 'text-primary' : 'text-foreground')}
          >
            {inline(text, `h3-${index}`)}
          </h4>
        );
      }
      return;
    }

    // --- Párrafo ---
    out.push(
      <p key={`p-${index}`} className="my-2 text-justify text-xs leading-relaxed text-muted-foreground">
        {inline(trimmed, `p-${index}`)}
      </p>
    );
  });

  flushAll();

  return <div className="pb-6">{out}</div>;
}
