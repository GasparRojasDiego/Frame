import { helpIndex } from '@/lib/help/kb';
import { answer, type HelpEntry } from '@/lib/help/search';
import type { ExtensionId } from '@/lib/extensions/registry';

// ============================================================
// Quién responde a una pregunta de la barra de la Ayuda:
//   1. «/notion» → abre el importador de Notion (viene incluido: desde la
//      1.6.2 no hay extensiones que añadir).
//   2. La guía de Frame (banco de respuestas).
//   3. Si no, no se adivina más: se ofrecen los temas en tarjetas y el
//      usuario elige (1.6.3). Así no hace falta acertar con la frase.
// ============================================================

export type Resolved =
  | { kind: 'entry'; question: string; entry: HelpEntry; alternatives: HelpEntry[] }
  | { kind: 'text'; question: string; text: string; options: HelpEntry[]; topics?: boolean }
  | { kind: 'action'; question: string; action: 'open-notion'; text: string };

export interface ResolveContext {
  /** Ya no decide nada (Notion siempre está); se acepta para no romper a quien aún lo pasa. */
  installed?: ExtensionId[];
  starters: HelpEntry[];
}

export function resolveQuestion(question: string, ctx: ResolveContext): Resolved {
  if (/^\s*\/notion\b/i.test(question)) {
    return { kind: 'action', question, action: 'open-notion', text: 'Importador de Notion abierto.' };
  }

  const reply = answer(helpIndex(), question);
  if (reply.kind === 'answer') {
    return { kind: 'entry', question, entry: reply.match.entry, alternatives: reply.alternatives };
  }
  if (reply.kind === 'greeting') {
    return {
      kind: 'text',
      question,
      text: 'Hola. Puedo explicarte cómo usar cualquier parte de Frame. Escribe tu duda o elige un tema.',
      options: [],
      topics: true,
    };
  }
  if (reply.kind === 'thanks') {
    return { kind: 'text', question, text: 'Con gusto. Si surge otra duda sobre Frame, aquí estaré.', options: [] };
  }
  if (reply.kind === 'unknown' && reply.suggestions.length > 0) {
    return {
      kind: 'text',
      question,
      text: 'No encontré una respuesta exacta. Quizá buscas alguna de estas; si no, elige un tema.',
      options: reply.suggestions.slice(0, 4),
      topics: true,
    };
  }
  return {
    kind: 'text',
    question,
    text:
      reply.kind === 'offtopic'
        ? 'Solo puedo ayudarte con el uso de Frame. Elige un tema y te muestro lo que sé.'
        : 'No tengo una respuesta para eso. Elige un tema y te muestro lo que sé.',
    options: [],
    topics: true,
  };
}

/** Id para la telemetría (qué respondió, nunca el texto). */
export function resolvedId(r: Resolved): { entry: string; answered: boolean } {
  if (r.kind === 'entry') return { entry: r.entry.id, answered: true };
  if (r.kind === 'action') return { entry: `ext:${r.action}`, answered: true };
  return { entry: 'none', answered: false };
}

/** La entrada que responde a una pregunta de ejemplo. */
export function entryFor(question: string): HelpEntry | null {
  const reply = answer(helpIndex(), question);
  return reply.kind === 'answer' ? reply.match.entry : null;
}
