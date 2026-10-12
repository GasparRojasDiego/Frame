import { Fragment, useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { parseRichNote, type RichLine, type RichLineKind, type RichRun } from '@/lib/rich-note';

// ============================================================
// Pinta una anotación guardada (formato de src/lib/rich-note.ts): párrafos,
// viñetas, listas numeradas y negrita, cursiva y subrayado.
//
// Todo sale como elementos de React con el texto dentro: no hay HTML que
// interpretar, así que lo escrito no puede colar ninguna etiqueta.
// ============================================================

type Block = { kind: RichLineKind; lines: RichLine[] };

/** Las líneas seguidas del mismo tipo forman un bloque (un párrafo o una lista). */
function toBlocks(lines: RichLine[]): Block[] {
  const blocks: Block[] = [];
  for (const line of lines) {
    const last = blocks[blocks.length - 1];
    if (last && last.kind === line.kind) last.lines.push(line);
    else blocks.push({ kind: line.kind, lines: [line] });
  }
  return blocks;
}

function Runs({ runs }: { runs: RichRun[] }) {
  return (
    <>
      {runs.map((run, index) => {
        let node: ReactNode = run.text;
        if (run.underline) node = <u className="underline-offset-2">{node}</u>;
        if (run.italic) node = <em>{node}</em>;
        if (run.bold) node = <strong className="font-bold">{node}</strong>;
        return <Fragment key={index}>{node}</Fragment>;
      })}
    </>
  );
}

export default function RichNoteView({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => toBlocks(parseRichNote(text)), [text]);
  if (blocks.length === 0) return null;

  return (
    <div className={cn('space-y-1 break-words', className)}>
      {blocks.map((block, index) => {
        if (block.kind === 'text') {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {block.lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 && <br />}
                  <Runs runs={line.runs} />
                </Fragment>
              ))}
            </p>
          );
        }
        const List = block.kind === 'bullet' ? 'ul' : 'ol';
        return (
          <List
            key={index}
            className={cn(
              'space-y-0.5 marker:text-primary',
              block.kind === 'bullet' ? 'list-disc pl-4' : 'list-decimal pl-5 marker:font-semibold'
            )}
          >
            {block.lines.map((line, lineIndex) => (
              <li key={lineIndex} className="whitespace-pre-wrap pl-0.5">
                <Runs runs={line.runs} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
