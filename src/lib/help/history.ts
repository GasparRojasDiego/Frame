import { useCallback, useEffect, useState } from 'react';
import { helpIndex } from '@/lib/help/kb';
import type { Resolved } from '@/lib/help/resolve';

// ============================================================
// Las conversaciones con la Ayuda (desde la 1.6.0).
//
// Cada pregunta con su respuesta queda en este equipo, por perfil, y se ve
// en «Conversaciones». Se guarda solo lo necesario para
// volver a mostrarla: la pregunta y el id de la respuesta del banco (o el
// texto, si no hubo respuesta del banco). Nunca sale del equipo.
// ============================================================

export interface HelpTurn {
  id: string;
  /** Lo que escribió el usuario. */
  q: string;
  at: number;
  /** Respuesta del banco. */
  entryId?: string;
  /** Respuesta de texto (saludo, «no la encontré»…). */
  text?: string;
  /** Respuestas sugeridas junto al texto. */
  options?: string[];
}

const MAX_TURNS = 60;
const keyFor = (uid: string | null | undefined) => `frameHelpHistory_${uid ?? 'local'}`;

function read(uid: string | null | undefined): HelpTurn[] {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    const list = raw ? (JSON.parse(raw) as HelpTurn[]) : [];
    return Array.isArray(list) ? list.filter((t) => t && typeof t.q === 'string' && typeof t.at === 'number') : [];
  } catch {
    return [];
  }
}

function write(uid: string | null | undefined, list: HelpTurn[]) {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(list.slice(0, MAX_TURNS)));
  } catch {
    /* sin almacenamiento: la conversación vive solo en esta sesión */
  }
}

export function turnFromResolved(result: Resolved): HelpTurn {
  const base = { id: crypto.randomUUID(), q: result.question, at: Date.now() };
  if (result.kind === 'entry') return { ...base, entryId: result.entry.id };
  if (result.kind === 'text') return { ...base, text: result.text, options: result.options.map((o) => o.id) };
  return { ...base, text: result.text };
}

/** Vuelve a montar la respuesta guardada (null si la entrada ya no existe). */
export function resolvedFromTurn(turn: HelpTurn): Resolved | null {
  const index = helpIndex();
  if (turn.entryId) {
    const entry = index.byId.get(turn.entryId);
    return entry ? { kind: 'entry', question: turn.q, entry, alternatives: [] } : null;
  }
  if (turn.text) {
    const options = (turn.options ?? []).map((id) => index.byId.get(id)).filter((e): e is NonNullable<typeof e> => !!e);
    return { kind: 'text', question: turn.q, text: turn.text, options };
  }
  return null;
}

/** Historial del perfil, de la más reciente a la más antigua. */
export function useHelpHistory(uid: string | null | undefined) {
  const [turns, setTurns] = useState<HelpTurn[]>(() => read(uid));
  useEffect(() => setTurns(read(uid)), [uid]);

  const add = useCallback(
    (turn: HelpTurn) => {
      setTurns((prev) => {
        const next = [turn, ...prev].slice(0, MAX_TURNS);
        write(uid, next);
        return next;
      });
    },
    [uid]
  );

  const remove = useCallback(
    (id: string) => {
      setTurns((prev) => {
        const next = prev.filter((t) => t.id !== id);
        write(uid, next);
        return next;
      });
    },
    [uid]
  );

  const clear = useCallback(() => {
    write(uid, []);
    setTurns([]);
  }, [uid]);

  return { turns, add, remove, clear };
}
