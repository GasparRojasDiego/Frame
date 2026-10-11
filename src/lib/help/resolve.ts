import { helpIndex } from '@/lib/help/kb';
import { answer, type HelpEntry } from '@/lib/help/search';
import type { ExtensionId } from '@/lib/extensions/registry';

// ============================================================
// Quién responde a una pregunta de la barra de Inicio:
//   1. «/notion» → abre el importador (si la extensión está añadida).
//   2. La guía de Frame (banco de respuestas).
//   3. Si no, «solo respondo dudas sobre Frame».
// ============================================================

export type Resolved =
  | { kind: 'entry'; question: string; entry: HelpEntry; alternatives: HelpEntry[] }
  | { kind: 'text'; question: string; text: string; options: HelpEntry[] }
  | { kind: 'action'; question: string; action: 'open-notion'; text: string };

export interface ResolveContext {
  installed: ExtensionId[];
  starters: HelpEntry[];
}

export function resolveQuestion(question: string, ctx: ResolveContext): Resolved {
  if (/^\s*\/notion\b/i.test(question)) {
    return ctx.installed.includes('notion')
      ? { kind: 'action', question, action: 'open-notion', text: 'Importador de Notion abierto.' }
      : {
          kind: 'text',
          question,
          text: 'Para eso hace falta la extensión «Notion». Añádela con el botón «+» de esta barra y vuelve a preguntar.',
          options: ctx.starters,
        };
  }

  const reply = answer(helpIndex(), question);
  if (reply.kind === 'answer') {
    return { kind: 'entry', question, entry: reply.match.entry, alternatives: reply.alternatives };
  }
  if (reply.kind === 'greeting') {
    return {
      kind: 'text',
      question,
      text: '¡Hola! Pregúntame lo que quieras sobre cómo usar Frame: Estudio, tareas, hábitos, asignaturas, música, informes, tu cuenta…',
      options: ctx.starters,
    };
  }
  if (reply.kind === 'thanks') {
    return { kind: 'text', question, text: '¡De nada! Si te surge otra duda sobre Frame, aquí estoy.', options: [] };
  }
  if (reply.kind === 'unknown' && reply.suggestions.length > 0) {
    return { kind: 'text', question, text: 'No encontré una respuesta exacta. ¿Te refieres a alguna de estas?', options: reply.suggestions.slice(0, 4) };
  }
  return {
    kind: 'text',
    question,
    text:
      reply.kind === 'offtopic'
        ? 'Solo respondo dudas sobre cómo usar Frame, y esa pregunta no es sobre la app.'
        : 'No tengo una respuesta para eso. Pregúntame sobre una función de Frame, con tus palabras.',
    options: ctx.starters,
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
