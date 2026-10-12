import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Cloud,
  Compass,
  CornerDownLeft,
  FileText,
  Globe,
  GraduationCap,
  Home,
  Lightbulb,
  MessagesSquare,
  Mic,
  Music,
  PanelTop,
  Puzzle,
  Repeat,
  Settings,
  SquarePen,
  Timer,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { format, formatDistanceToNowStrict, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import PolySphere from '@/components/help/PolySphere';
import { useCourse } from '@/context/CourseContext';
import { HELP_ENTRIES, STARTER_QUESTIONS, helpIndex } from '@/lib/help/kb';
import { HELP_AREAS, relatedTo, suggest, type HelpAreaId, type HelpEntry } from '@/lib/help/search';
import { entryFor, resolveQuestion, resolvedId, type Resolved } from '@/lib/help/resolve';
import {
  HELP_RUN,
  resolvedFromTurn,
  turnFromResolved,
  useHelpConversations,
  type HelpConversation,
} from '@/lib/help/history';
import { startTour } from '@/lib/help/tour';
import { tourFor } from '@/lib/help/tours';
import { setNotionOpen, type ExtensionId } from '@/lib/extensions/registry';
import { usePathname, useRouter } from '@/lib/navigation';
import { trackEvent } from '@/lib/telemetry';
import { cn } from '@/lib/utils';

// ============================================================
// El Centro de ayuda (botón de la barra superior, ruta /ayuda).
//
// Una conversación al estilo de un chat: lo que escribe el usuario, a la
// derecha en un globo; lo que responde Frame, a la izquierda, como texto.
// Responde buscando en el banco de respuestas (lib/help), sin internet; quién
// responde a cada pregunta lo decide lib/help/resolve.ts.
//
// No se intenta adivinar cada forma de preguntar: si la pregunta no encaja,
// se ofrecen los TEMAS en tarjetas y, dentro de cada tema, sus preguntas.
// Tras una respuesta, «Mostrar cómo» lanza el recorrido guiado
// (lib/help/tours.ts).
//
// Antes de la primera pregunta se ve la esfera de polígonos; desaparece al
// preguntar y vuelve con una conversación nueva.
// ============================================================

const THINK_MS = 420;

/** La última pregunta ocupa al menos el alto visible: así sube hasta arriba
 *  aunque su respuesta aún se esté escribiendo. */
const LAST_TURN = 'min-h-[calc(100vh-14rem)]';

/** El importador de Notion es un botón de Ajustes; /notion lo abre siempre. */
const ALWAYS_ON: ExtensionId[] = ['notion'];

/** Los temas de las tarjetas, en el orden del menú lateral (16: cuatro filas de cuatro). */
const TOPICS: { area: HelpAreaId; icon: typeof Home; short?: string }[] = [
  { area: 'basico', icon: Compass },
  { area: 'inicio', icon: Home },
  { area: 'enfoque', icon: Timer },
  { area: 'habitos', icon: Repeat },
  { area: 'asignaturas', icon: GraduationCap },
  { area: 'tareas', icon: BookOpen },
  { area: 'calendario', icon: CalendarDays },
  { area: 'google', icon: Globe, short: 'Google' },
  { area: 'musica', icon: Music },
  { area: 'grabaciones', icon: Mic },
  { area: 'barra', icon: PanelTop },
  { area: 'informes', icon: FileText },
  { area: 'ajustes', icon: Settings },
  { area: 'cuenta', icon: Cloud },
  { area: 'extensiones', icon: Puzzle },
  { area: 'problemas', icon: Wrench },
];

/** Las respuestas de un tema: primero las principales. */
function entriesOf(area: HelpAreaId): HelpEntry[] {
  return HELP_ENTRIES.filter((entry) => entry.area === area).sort((a, b) => (b.prior ?? 0) - (a.prior ?? 0));
}

const TOPIC_COUNTS = new Map(TOPICS.map(({ area }) => [area, entriesOf(area).length]));
const VISIBLE_TOPICS = TOPICS.filter(({ area }) => (TOPIC_COUNTS.get(area) ?? 0) > 0);

function pickStarters(count: number): HelpEntry[] {
  const pool = [...STARTER_QUESTIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool
    .slice(0, count)
    .map(entryFor)
    .filter((e): e is HelpEntry => !!e);
}

/** Letras por segundo al «escribir» la respuesta. */
const TYPE_RATE = 220;

/**
 * Escribe el texto de a poco. Va por TIEMPO, no por fotogramas: con el equipo
 * cargado (menos fotogramas) termina igual de rápido.
 */
function useTyped(text: string, key: string, instant: boolean): string {
  const [shown, setShown] = useState(instant ? text : '');
  useEffect(() => {
    if (instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      return;
    }
    setShown('');
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const i = Math.min(text.length, Math.round(((now - start) / 1000) * TYPE_RATE));
      setShown(text.slice(0, i));
      if (i < text.length) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, key, instant]);
  return shown;
}

/** «hoy, 14:05» o «10 de oct, 18:42». */
function whenLabel(at: number): string {
  return isToday(at) ? `hoy, ${format(at, 'HH:mm')}` : format(at, "d 'de' MMM, HH:mm", { locale: es });
}

const questionsLabel = (n: number) => `${n} ${n === 1 ? 'pregunta' : 'preguntas'}`;

/** Las tarjetas de temas. */
function TopicCards({ onPick, compact = false }: { onPick: (area: HelpAreaId) => void; compact?: boolean }) {
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4')}>
      {VISIBLE_TOPICS.map(({ area, icon: Icon, short }) => (
        <button
          key={area}
          type="button"
          onClick={() => onPick(area)}
          className="group/topic flex items-center gap-2.5 rounded-lg border border-border/70 bg-card/70 px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
        >
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{short ?? HELP_AREAS[area].label}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{TOPIC_COUNTS.get(area)}</span>
        </button>
      ))}
    </div>
  );
}

/** Preguntas para elegir, como tarjetas. */
function QuestionCards({ entries, onPick, limit = 8 }: { entries: HelpEntry[]; onPick: (entry: HelpEntry) => void; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, limit);
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onPick(entry)}
            className="group/q flex items-center gap-2 rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/90">{entry.title}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover/q:text-primary" />
          </button>
        ))}
      </div>
      {entries.length > limit && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', all && 'rotate-180')} />
          {all ? 'Ver menos' : `Ver las ${entries.length}`}
        </button>
      )}
    </div>
  );
}

/** Lo que escribió el usuario: un globo a la derecha. */
function UserBubble({ text, at }: { text: string; at?: number }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md border border-primary/25 bg-primary/10 px-4 py-2.5">
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{text}</p>
        {at !== undefined && <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">{format(at, 'HH:mm')}</p>}
      </div>
    </div>
  );
}

/** Lo que responde Frame: texto a la izquierda, sin globo. */
function Answer({
  shown,
  instant,
  onPick,
  onTopic,
  onShowHow,
}: {
  shown: Resolved;
  instant: boolean;
  onPick: (entry: HelpEntry) => void;
  onTopic: (area: HelpAreaId) => void;
  onShowHow: (entry: HelpEntry) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const entry = shown.kind === 'entry' ? shown.entry : null;
  const lead = shown.kind === 'entry' ? shown.entry.a : shown.text;
  const typed = useTyped(lead, shown.question + lead, instant);
  const done = typed.length >= lead.length;
  const related = useMemo(() => {
    if (!entry || shown.kind !== 'entry') return [];
    const seen = new Set<string>([entry.id]);
    return [...shown.alternatives, ...relatedTo(helpIndex(), entry, 3)]
      .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
      .slice(0, 4);
  }, [entry, shown]);
  const options = shown.kind === 'text' ? shown.options : [];
  const topics = shown.kind === 'text' && shown.topics;
  const goTo = entry?.go && entry.go !== pathname ? entry.go : null;
  const goLabel = goTo ? (Object.values(HELP_AREAS).find((a) => a.route === goTo)?.label ?? 'la interfaz') : null;
  const hasTour = !!entry && !!tourFor(entry.id);

  return (
    <article className={cn('max-w-[46rem]', !instant && 'animate-in fade-in-0 duration-300')}>
      {entry && (
        <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-semibold text-foreground">{entry.title}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">{HELP_AREAS[entry.area].label}</span>
        </p>
      )}
      <p className="text-sm leading-relaxed text-foreground/90">
        {typed}
        {!done && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary" />}
      </p>
      {done && entry?.steps && entry.steps.length > 0 && (
        <ol className="mt-3 space-y-2">
          {entry.steps.map((step, i) => (
            <li
              key={step}
              className="flex animate-in fade-in-0 gap-2.5 text-sm text-foreground/90 fill-mode-both"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}
      {done && entry?.tip && (
        <p className="mt-3 flex animate-in fade-in-0 gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          {entry.tip}
        </p>
      )}
      {done && entry && (hasTour || goTo) && (
        <div className="mt-4 flex animate-in fade-in-0 flex-wrap items-center gap-2">
          {hasTour && (
            <Button size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => onShowHow(entry)} data-tour="ayuda-mostrar">
              Mostrar cómo
            </Button>
          )}
          {goTo && (
            <Button size="sm" variant="fantasma" className="h-8 gap-1.5 px-3 text-xs" onClick={() => router.push(goTo)}>
              Ir a {goLabel} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
      {done && options.length > 0 && (
        <div className="mt-4 animate-in fade-in-0">
          <QuestionCards entries={options} onPick={onPick} />
        </div>
      )}
      {done && topics && (
        <div className="mt-4 animate-in fade-in-0">
          <TopicCards onPick={onTopic} compact />
        </div>
      )}
      {done && related.length > 0 && (
        <div className="mt-5 animate-in fade-in-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Relacionado</p>
          <QuestionCards entries={related} onPick={onPick} />
        </div>
      )}
    </article>
  );
}

/** Las conversaciones guardadas (solo en este equipo). */
function History({
  conversations,
  onOpen,
  onRemove,
  onClear,
}: {
  conversations: HelpConversation[];
  onOpen: (conversation: HelpConversation) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground animate-in fade-in-0">
        <MessagesSquare className="h-7 w-7 text-primary/70" />
        <p>Aún no hay conversaciones guardadas.</p>
      </div>
    );
  }
  return (
    <div className="animate-in fade-in-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {conversations.length} {conversations.length === 1 ? 'conversación' : 'conversaciones'} en este equipo
        </p>
        <Button size="sm" variant="gris" className="h-7 gap-1 px-2.5 text-xs" onClick={onClear}>
          <Trash2 className="h-3.5 w-3.5" /> Borrar todas
        </Button>
      </div>
      <ul className="space-y-2">
        {conversations.map((conversation) => {
          const [first, ...rest] = conversation.turns;
          const live = conversation.run === HELP_RUN;
          return (
            <li key={conversation.id} className="group/conv relative">
              <button
                type="button"
                onClick={() => onOpen(conversation)}
                className="w-full rounded-lg border border-border/70 bg-card/70 px-4 py-3 pr-10 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{first.q}</span>
                  {live && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">En curso</span>
                  )}
                </span>
                {rest.length > 0 && (
                  <span className="mt-1 block truncate text-xs text-foreground/65">
                    {rest
                      .slice(0, 3)
                      .map((turn) => turn.q)
                      .join(' · ')}
                    {rest.length > 3 && ` · y ${rest.length - 3} más`}
                  </span>
                )}
                <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{questionsLabel(conversation.turns.length)}</span>
                  <span aria-hidden>·</span>
                  <span>{whenLabel(conversation.startedAt)}</span>
                  <span className="ml-auto shrink-0">
                    {formatDistanceToNowStrict(conversation.updatedAt, { locale: es, addSuffix: true })}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(conversation.id)}
                className="absolute right-2 top-3 rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/conv:opacity-100"
                title="Borrar esta conversación"
                aria-label="Borrar esta conversación"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function HelpAsk({ onExit }: { onExit: () => void }) {
  const { userProfile } = useCourse();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const history = useHelpConversations(userProfile?.id);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  /** Pregunta ya guardada que aún «se piensa»: se muestra al acabar la espera. */
  const [pendingId, setPendingId] = useState<string | null>(null);
  /** La recién respondida: la única que se «escribe» letra a letra. */
  const [freshId, setFreshId] = useState<string | null>(null);
  const [view, setView] = useState<'thread' | 'history'>('thread');
  /** Conversación anterior abierta desde la lista; null = la de ahora. */
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(-1);
  const starters = useMemo(() => pickStarters(3), []);
  const timers = useRef<number[]>([]);
  const thinking = pendingId !== null;

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  // El índice (~0,2 s) se prepara cuando el equipo está libre, no al teclear.
  useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => helpIndex());
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => helpIndex(), 800);
    return () => window.clearTimeout(id);
  }, []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const suggestions = useMemo(
    () => (focused && !thinking && query.trim().length >= 3 && !query.trim().startsWith('/') ? suggest(helpIndex(), query, 5) : []),
    [query, focused, thinking]
  );
  useEffect(() => setHighlight(-1), [query]);

  // El cuadro crece con el texto (hasta 4 líneas).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [query]);

  useEffect(() => inputRef.current?.focus(), [view]);

  const viewing = (viewingId ? history.conversations.find((c) => c.id === viewingId) : null) ?? history.current;
  const viewingOld = !!viewing && viewing.run !== HELP_RUN;
  const turns = useMemo(() => (viewing?.turns ?? []).filter((t) => t.id !== pendingId), [viewing, pendingId]);
  const resolved = useMemo(() => new Map(turns.map((t) => [t.id, resolvedFromTurn(t)])), [turns]);
  const pendingTurn = pendingId ? (history.current?.turns.find((t) => t.id === pendingId) ?? null) : null;
  const lastId = pendingTurn?.id ?? turns[turns.length - 1]?.id ?? null;
  const empty = turns.length === 0 && !pendingTurn;

  // Cada pregunta nueva se ve desde su principio: queda arriba del todo.
  const scrollKey = `${view}:${viewing?.id ?? ''}:${lastId ?? ''}:${pendingId ?? ''}`;
  const firstScroll = useRef(true);
  useLayoutEffect(() => {
    const box = threadRef.current;
    if (!box || view !== 'thread') return;
    const target = box.querySelector<HTMLElement>('[data-turn-last]');
    if (!target) return;
    const smooth = !firstScroll.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    firstScroll.current = false;
    box.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: smooth ? 'smooth' : 'auto' });
  }, [scrollKey, view]);

  const begin = (make: () => Resolved) => {
    if (thinking) return;
    const started = performance.now();
    const result = make();
    // Se guarda en el acto (si se sale durante la espera, no se pierde) y se
    // muestra al acabar de «pensar».
    const turn = turnFromResolved(result);
    history.add(turn);
    trackEvent('help_asked', { ...resolvedId(result), length: result.question.length });
    setQuery('');
    setView('thread');
    setViewingId(null);
    setPendingId(turn.id);
    later(() => {
      setPendingId(null);
      setFreshId(turn.id);
      if (result.kind === 'action') setNotionOpen(true);
    }, Math.max(0, THINK_MS - (performance.now() - started)));
  };

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    begin(() => resolveQuestion(question, { installed: ALWAYS_ON, starters }));
  };

  const showEntry = (entry: HelpEntry, question = entry.title) =>
    begin(() => ({ kind: 'entry', question, entry, alternatives: [] }));

  const showTopic = (area: HelpAreaId) =>
    begin(() => ({
      kind: 'text',
      question: HELP_AREAS[area].label,
      text: `Esto es lo que puedo explicarte sobre ${HELP_AREAS[area].label}. Elige una pregunta:`,
      options: entriesOf(area),
    }));

  const newConversation = () => {
    if (thinking) return;
    history.startNew();
    setViewingId(null);
    setFreshId(null);
    setView('thread');
    setQuery('');
  };

  const openConversation = (conversation: HelpConversation) => {
    if (thinking) return;
    setViewingId(conversation.run === HELP_RUN ? null : conversation.id);
    setFreshId(null);
    setView('thread');
  };

  const removeConversation = (id: string) => {
    if (id === viewingId) setViewingId(null);
    history.remove(id);
  };

  const showHow = (entry: HelpEntry) => {
    const tour = tourFor(entry.id);
    if (!tour) return;
    // Se sale de la ayuda (la conversación sigue al volver) y el recorrido
    // toma la pantalla. Temporizador suelto: la ayuda se desmonta al salir.
    onExit();
    window.setTimeout(() => startTour(tour), 380);
  };

  /** Atrás: de «Conversaciones» a la conversación; si no, fuera de la ayuda. */
  const back = () => {
    if (view === 'history') setView('thread');
    else if (viewingOld) setViewingId(null);
    else onExit();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target === inputRef.current && query) return;
      back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) showEntry(suggestions[highlight], query.trim() || suggestions[highlight].title);
      else ask(query);
    } else if (event.key === 'Escape' && query) {
      event.preventDefault();
      setQuery('');
    }
  };

  const canSend = query.trim().length > 0 && !thinking;

  const composer = (
    <div className="relative w-full">
      <div
        className={cn(
          'rounded-2xl border bg-card py-2 pl-4 pr-2 shadow-sm transition-colors',
          focused ? 'border-primary/60' : 'border-border'
        )}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            placeholder={empty ? 'Escribe tu duda sobre Frame…' : 'Responder…'}
            aria-label="Pregunta cómo usar Frame"
            className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <button
            type="button"
            onClick={() => ask(query)}
            disabled={!canSend}
            title="Enviar (Enter)"
            aria-label="Enviar"
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
              canSend ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <ul
          role="listbox"
          className={cn(
            'absolute left-2 right-2 z-20 overflow-hidden rounded-lg border border-border/70 bg-popover py-1 shadow-xl animate-in fade-in-0',
            empty ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          )}
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => showEntry(s, query.trim() || s.title)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors',
                  i === highlight ? 'bg-primary/10 text-foreground' : 'text-foreground/85'
                )}
              >
                <span className="flex-1 truncate">{s.title}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{HELP_AREAS[s.area].label}</span>
                {i === highlight && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section data-tour="ayuda" aria-label="Centro de ayuda" className="relative flex h-full min-h-0 flex-col">
      {/* Barra: Atrás a la izquierda; conversaciones a la derecha. */}
      <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3 md:px-6">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={back} title="Atrás (Esc)" aria-label="Atrás">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {view === 'history'
            ? 'Conversaciones'
            : viewingOld && viewing
              ? `Conversación del ${whenLabel(viewing.startedAt)}`
              : 'Centro de ayuda'}
        </p>
        <Button
          size="sm"
          variant={view === 'history' ? 'default' : 'fantasma'}
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={() => setView(view === 'history' ? 'thread' : 'history')}
          data-tour="ayuda-conversaciones"
        >
          <MessagesSquare className="h-3.5 w-3.5" />
          Conversaciones
          {history.conversations.length > 0 && <span className="tabular-nums opacity-70">{history.conversations.length}</span>}
        </Button>
        <Button
          size="sm"
          variant="fantasma"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={newConversation}
          disabled={!history.current && !viewingOld && view === 'thread'}
          title="Empezar una conversación nueva"
          data-tour="ayuda-nueva"
        >
          <SquarePen className="h-3.5 w-3.5" />
          Nueva
        </Button>
      </div>

      {view === 'history' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <History
              conversations={history.conversations}
              onOpen={openConversation}
              onRemove={removeConversation}
              onClear={history.clear}
            />
          </div>
        </div>
      ) : empty ? (
        // Sin preguntas: la esfera, la barra y los temas.
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 md:px-6">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-6 py-6">
            <PolySphere size={150} className="animate-in fade-in-0 zoom-in-95 duration-500" />
            <h2 className="text-center font-headline text-2xl font-semibold text-foreground">¿En qué te ayudo?</h2>
            {composer}
            <div className="w-full">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Temas</p>
              <TopicCards onPick={showTopic} />
            </div>
            {starters.length > 0 && (
              <div className="flex w-full flex-wrap justify-center gap-2">
                {starters.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => showEntry(entry)}
                    className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {entry.title}
                  </button>
                ))}
              </div>
            )}
            <p className="text-center text-[11px] text-muted-foreground/70">{HELP_ENTRIES.length} respuestas · funciona sin internet</p>
          </div>
        </div>
      ) : (
        <>
          <div ref={threadRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 md:px-6">
            <div className="mx-auto w-full max-w-3xl space-y-6 pb-10 pt-4">
              {turns.map((turn) => {
                const shown = resolved.get(turn.id) ?? null;
                const last = turn.id === lastId;
                return (
                  <div key={turn.id} data-turn-last={last ? '' : undefined} className={cn('space-y-3', last && LAST_TURN)}>
                    <UserBubble text={turn.q} at={turn.at} />
                    {shown ? (
                      <Answer
                        shown={shown}
                        instant={turn.id !== freshId}
                        onPick={(e) => showEntry(e)}
                        onTopic={showTopic}
                        onShowHow={showHow}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Esta respuesta ya no está en la ayuda.</p>
                    )}
                  </div>
                );
              })}
              {pendingTurn && (
                <div data-turn-last="" className={cn('space-y-3 animate-in fade-in-0', LAST_TURN)} aria-live="polite">
                  <UserBubble text={pendingTurn.q} at={pendingTurn.at} />
                  <span className="flex gap-1 py-2" aria-label="Escribiendo">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/80" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 px-4 pb-4 pt-2 md:px-6">
            <div className="mx-auto w-full max-w-3xl">{composer}</div>
          </div>
        </>
      )}
    </section>
  );
}
