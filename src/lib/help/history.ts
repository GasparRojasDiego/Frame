import { useCallback, useEffect, useMemo, useState } from 'react';
import { helpIndex } from '@/lib/help/kb';
import type { Resolved } from '@/lib/help/resolve';

// ============================================================
// Las conversaciones con la Ayuda (desde la 1.6.0; por apertura desde la 1.6.2).
//
// Una conversación es UNA apertura de Frame: de abrir la app a cerrarla.
// Mientras sigue abierta, salir de la Ayuda y volver conserva la conversación
// en curso con todas sus preguntas; al cerrar Frame y volver a abrirla empieza
// otra, y la anterior queda en «Conversaciones» como una sola entrada.
//
// Qué apertura es la de ahora lo dice `HELP_RUN`, guardado en sessionStorage:
// vive lo que vive la ventana (sobrevive a una recarga, no a cerrar Frame).
//
// De cada pregunta se guarda solo lo necesario para volver a mostrarla: la
// pregunta y el id de la respuesta del banco (o el texto, si no hubo
// respuesta del banco). Todo queda en este equipo, por perfil; nunca sale.
// ============================================================

export interface HelpTurn {
  id: string;
  /** Lo que escribió el usuario. */
  q: string;
  at: number;
  /** Respuesta del banco. */
  entryId?: string;
  /** Otras respuestas del banco que también encajaban (las «También:»). */
  alts?: string[];
  /** Respuesta de texto (saludo, «no la encontré»…). */
  text?: string;
  /** Respuestas sugeridas junto al texto. */
  options?: string[];
}

export interface HelpConversation {
  id: string;
  /** Apertura de la app en la que nació (ver `HELP_RUN`). */
  run: string;
  startedAt: number;
  updatedAt: number;
  /** Las preguntas en orden: la primera, arriba. */
  turns: HelpTurn[];
}

const MAX_CONVERSATIONS = 40;
const MAX_TURNS = 80;
/** Historial de antes de la 1.6.2: una entrada por pregunta. */
const LEGACY_GAP_MS = 30 * 60_000;

const keyFor = (uid: string | null | undefined) => `frameHelpConversations_${uid ?? 'local'}`;
const legacyKeyFor = (uid: string | null | undefined) => `frameHelpHistory_${uid ?? 'local'}`;
const RUN_KEY = 'frameHelpRun';

/** Esta apertura de Frame. */
export const HELP_RUN: string = (() => {
  try {
    const saved = sessionStorage.getItem(RUN_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(RUN_KEY, id);
    return id;
  } catch {
    // Sin sessionStorage, la apertura dura lo que esta carga de la página.
    return crypto.randomUUID();
  }
})();

/**
 * Lo leído o escrito en esta apertura, por perfil. Sin almacenamiento (o
 * lleno), la conversación en curso sigue ahí al volver a la Ayuda.
 */
const memory = new Map<string, HelpConversation[]>();

const isTurn = (t: unknown): t is HelpTurn =>
  !!t && typeof (t as HelpTurn).q === 'string' && typeof (t as HelpTurn).at === 'number' && typeof (t as HelpTurn).id === 'string';

/**
 * El historial viejo era una lista de preguntas sueltas (la más reciente
 * primero). Las que se hicieron con menos de media hora entre una y otra
 * pasan a ser una misma conversación: es lo más parecido a «una apertura».
 */
function fromLegacy(raw: unknown): HelpConversation[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw.filter(isTurn).sort((a, b) => a.at - b.at);
  const groups: HelpTurn[][] = [];
  for (const turn of turns) {
    const group = groups[groups.length - 1];
    if (group && turn.at - group[group.length - 1].at <= LEGACY_GAP_MS) group.push(turn);
    else groups.push([turn]);
  }
  // Las preguntas sueltas del historial viejo pueden dar más conversaciones de
  // las que caben: las más antiguas se juntan en una sola, así el tope no
  // borra nada al convertir.
  if (groups.length > MAX_CONVERSATIONS) {
    groups.unshift(groups.splice(0, groups.length - MAX_CONVERSATIONS + 1).flat());
  }
  return groups
    .map((group) => ({
      id: `legacy-${group[0].id}`,
      run: `legacy-${group[0].id}`,
      startedAt: group[0].at,
      updatedAt: group[group.length - 1].at,
      turns: group,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function sanitize(raw: unknown): HelpConversation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is HelpConversation => !!c && typeof c.id === 'string' && typeof c.run === 'string' && Array.isArray(c.turns))
    .map((c) => ({ ...c, turns: c.turns.filter(isTurn) }))
    .filter((c) => c.turns.length > 0);
}

function read(uid: string | null | undefined): HelpConversation[] {
  const key = keyFor(uid);
  const cached = memory.get(key);
  if (cached) return cached;
  let list: HelpConversation[] = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      list = sanitize(JSON.parse(raw));
    } else {
      // Primera vez con la 1.6.2: se convierte el historial viejo, sin perder nada.
      const legacy = localStorage.getItem(legacyKeyFor(uid));
      if (legacy !== null) {
        list = fromLegacy(JSON.parse(legacy));
        if (write(uid, list)) localStorage.removeItem(legacyKeyFor(uid));
      }
    }
  } catch {
    list = [];
  }
  memory.set(key, list);
  return list;
}

/** Guarda la lista; devuelve si llegó al almacenamiento. */
function write(uid: string | null | undefined, list: HelpConversation[]): boolean {
  const key = keyFor(uid);
  const trimmed = list.slice(0, MAX_CONVERSATIONS);
  memory.set(key, trimmed);
  try {
    localStorage.setItem(key, JSON.stringify(trimmed));
    return true;
  } catch {
    /* sin almacenamiento: la conversación vive solo en esta apertura */
    return false;
  }
}

export function turnFromResolved(result: Resolved): HelpTurn {
  const base = { id: crypto.randomUUID(), q: result.question, at: Date.now() };
  if (result.kind === 'entry') {
    const alts = result.alternatives.map((e) => e.id);
    return { ...base, entryId: result.entry.id, ...(alts.length > 0 ? { alts } : {}) };
  }
  if (result.kind === 'text') return { ...base, text: result.text, options: result.options.map((o) => o.id) };
  return { ...base, text: result.text };
}

/** Vuelve a montar la respuesta guardada (null si la entrada ya no existe). */
export function resolvedFromTurn(turn: HelpTurn): Resolved | null {
  const index = helpIndex();
  const pick = (ids: string[] | undefined) =>
    (ids ?? []).map((id) => index.byId.get(id)).filter((e): e is NonNullable<typeof e> => !!e);
  if (turn.entryId) {
    const entry = index.byId.get(turn.entryId);
    return entry ? { kind: 'entry', question: turn.q, entry, alternatives: pick(turn.alts) } : null;
  }
  if (turn.text) {
    return { kind: 'text', question: turn.q, text: turn.text, options: pick(turn.options) };
  }
  return null;
}

/**
 * Las conversaciones del perfil, de la más reciente a la más antigua, y la
 * de esta apertura (`current`, null hasta la primera pregunta).
 */
export function useHelpConversations(uid: string | null | undefined) {
  const [conversations, setConversations] = useState<HelpConversation[]>(() => read(uid));
  useEffect(() => setConversations(read(uid)), [uid]);

  const current = useMemo(() => conversations.find((c) => c.run === HELP_RUN) ?? null, [conversations]);

  /** Suma la pregunta a la conversación de esta apertura (la crea con la primera). */
  const add = useCallback(
    (turn: HelpTurn) => {
      const fresh: HelpConversation = { id: crypto.randomUUID(), run: HELP_RUN, startedAt: turn.at, updatedAt: turn.at, turns: [] };
      const prev = read(uid);
      const existing = prev.find((c) => c.run === HELP_RUN) ?? fresh;
      const updated: HelpConversation = {
        ...existing,
        updatedAt: turn.at,
        turns: [...existing.turns, turn].slice(-MAX_TURNS),
      };
      // La que se acaba de usar va primero.
      const next = [updated, ...prev.filter((c) => c.id !== updated.id)];
      write(uid, next);
      setConversations(read(uid));
    },
    [uid]
  );

  const remove = useCallback(
    (id: string) => {
      write(
        uid,
        read(uid).filter((c) => c.id !== id)
      );
      setConversations(read(uid));
    },
    [uid]
  );

  const clear = useCallback(() => {
    write(uid, []);
    setConversations(read(uid));
  }, [uid]);

  return { conversations, current, add, remove, clear };
}
