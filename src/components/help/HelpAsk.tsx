import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, CornerDownLeft, Lightbulb, MessagesSquare, SquarePen, Sparkles, Trash2, X } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import ExtensionsMenu from '@/components/extensions/ExtensionsMenu';
import { ExtensionIcon } from '@/components/extensions/ExtensionIcons';
import { useCourse } from '@/context/CourseContext';
import { HELP_ENTRIES, STARTER_QUESTIONS, helpIndex } from '@/lib/help/kb';
import { HELP_AREAS, relatedTo, suggest, type HelpEntry } from '@/lib/help/search';
import { entryFor, resolveQuestion, resolvedId, type Resolved } from '@/lib/help/resolve';
import { resolvedFromTurn, turnFromResolved, useHelpHistory, type HelpTurn } from '@/lib/help/history';
import { startTour, type MascotPose } from '@/lib/help/tour';
import { tourFor } from '@/lib/help/tours';
import { extensionInfo, setNotionOpen, useExtensions } from '@/lib/extensions/registry';
import { usePathname, useRouter } from '@/lib/navigation';
import { trackEvent } from '@/lib/telemetry';
import { cn } from '@/lib/utils';

// ============================================================
// La interfaz «Ayuda» (botón redondo de abajo a la derecha, ruta /ayuda).
//
// Se parece a la barra de una IA, pero no lo es: responde cómo usar Frame
// buscando en el banco de respuestas (lib/help), sin internet. Quién responde
// a cada pregunta lo decide lib/help/resolve.ts.
//
// Antes de preguntar, Apex saluda junto a la barra, en el centro. Al
// preguntar, la barra y Apex pasan a la izquierda y la respuesta ocupa los
// 3/5 de la derecha. Cada pregunta queda en «Conversaciones». Tras la
// respuesta, «Descubrir» lanza el recorrido guiado de esa función
// (lib/help/tours.ts).
//
// La espera de ~0,5 s antes de responder deja ver a Apex «pensar» y marca el
// cambio entre escribir y leer.
// ============================================================

const THINK_MS = 520;

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
const TYPE_RATE = 190;

/**
 * Escribe el texto de a poco, como lo haría una IA. Va por TIEMPO, no por
 * fotogramas: con el equipo cargado (menos fotogramas) termina igual de rápido.
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

function Chips({ items, label }: { items: { key: string; text: string; onClick: () => void }[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6 flex animate-in fade-in-0 flex-wrap items-center gap-2 border-t border-border/60 pt-4">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      {items.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={m.onClick}
          className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          {m.text}
        </button>
      ))}
    </div>
  );
}

/** La respuesta, grande, en la parte derecha de la conversación. */
function Answer({
  shown,
  instant,
  onPick,
  onDiscover,
}: {
  shown: Resolved;
  instant: boolean;
  onPick: (entry: HelpEntry) => void;
  onDiscover: (entry: HelpEntry) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const entry = shown.kind === 'entry' ? shown.entry : null;
  const lead = shown.kind === 'entry' ? shown.entry.a : shown.text;
  const typed = useTyped(lead, shown.question + lead, instant);
  const done = typed.length >= lead.length;
  const more = useMemo(() => {
    if (shown.kind === 'text') return shown.options;
    if (!entry || shown.kind !== 'entry') return [];
    const related = relatedTo(helpIndex(), entry, 3);
    const seen = new Set<string>([entry.id]);
    return [...shown.alternatives, ...related].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).slice(0, 4);
  }, [entry, shown]);
  const goTo = entry?.go && entry.go !== pathname ? entry.go : null;
  const goLabel = goTo ? (Object.values(HELP_AREAS).find((a) => a.route === goTo)?.label ?? 'la interfaz') : null;
  const hasTour = !!entry && !!tourFor(entry.id);

  return (
    <article className="animate-in fade-in-0 slide-in-from-right-3 duration-300">
      <p className="mb-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground/80">«{shown.question}»</span>
      </p>
      {entry && (
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
            {HELP_AREAS[entry.area].label}
          </span>
          <h3 className="font-headline text-2xl font-bold leading-tight text-foreground">{entry.title}</h3>
        </div>
      )}
      <p className="text-base leading-relaxed text-foreground/90">
        {typed}
        {!done && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary" />}
      </p>
      {done && entry?.steps && entry.steps.length > 0 && (
        <ol className="mt-5 space-y-2.5">
          {entry.steps.map((step, i) => (
            <li
              key={step}
              className="flex animate-in fade-in-0 slide-in-from-left-1 gap-3 text-[15px] text-foreground/90 fill-mode-both"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}
      {done && entry?.tip && (
        <p className="mt-5 flex animate-in fade-in-0 gap-2.5 rounded-xl bg-secondary/50 p-3.5 text-sm leading-relaxed text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {entry.tip}
        </p>
      )}
      {done && (hasTour || goTo) && entry && (
        <div className="mt-6 flex animate-in fade-in-0 flex-wrap items-center gap-2.5">
          {hasTour && (
            <Button className="h-10 gap-2 rounded-full px-5 text-sm font-semibold" onClick={() => onDiscover(entry)}>
              <Sparkles className="h-4 w-4" />
              Descubrir
            </Button>
          )}
          {goTo && (
            <Button
              variant={hasTour ? 'outline' : 'default'}
              className="h-10 gap-1.5 rounded-full px-4 text-sm"
              onClick={() => router.push(goTo)}
            >
              Ir a {goLabel} <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {hasTour && <span className="text-xs text-muted-foreground">Te muestro paso a paso dónde pulsar.</span>}
        </div>
      )}
      {done && (
        <Chips
          label={entry ? 'También:' : undefined}
          items={more.map((m) => ({ key: m.id, text: m.title, onClick: () => onPick(m) }))}
        />
      )}
    </article>
  );
}

/** Las conversaciones anteriores (solo en este equipo). */
function History({
  turns,
  onOpen,
  onRemove,
  onClear,
}: {
  turns: HelpTurn[];
  onOpen: (turn: HelpTurn) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const index = helpIndex();
  if (turns.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground animate-in fade-in-0">
        <MessagesSquare className="h-8 w-8 text-primary/70" />
        <p>Aún no hay conversaciones guardadas.</p>
        <p className="text-xs">Cada pregunta que me hagas queda aquí.</p>
      </div>
    );
  }
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-3 duration-300">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {turns.length} {turns.length === 1 ? 'conversación guardada' : 'conversaciones guardadas'} en este equipo
        </p>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" /> Borrar todas
        </button>
      </div>
      <ul className="space-y-2">
        {turns.map((turn) => {
          const entry = turn.entryId ? index.byId.get(turn.entryId) : null;
          const answerText = entry ? entry.title : (turn.text ?? '');
          return (
            <li key={turn.id} className="group/turn relative">
              <button
                type="button"
                onClick={() => onOpen(turn)}
                className="w-full rounded-xl border border-border/60 bg-card/60 px-4 py-3 pr-10 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <p className="truncate text-sm font-medium text-foreground">«{turn.q}»</p>
                <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                  {entry && <span className="shrink-0 font-semibold uppercase tracking-wider text-primary/80">{HELP_AREAS[entry.area].label}</span>}
                  <span className="truncate">{answerText}</span>
                  <span className="ml-auto shrink-0">{formatDistanceToNowStrict(turn.at, { locale: es, addSuffix: true })}</span>
                </p>
              </button>
              <button
                type="button"
                onClick={() => onRemove(turn.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/turn:opacity-100"
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

/** Apex junto a la barra: cambia de pose según lo que está pasando. */
function Apex({ pose, size }: { pose: MascotPose; size: number }) {
  return (
    <div className="tour-bob pointer-events-none select-none" style={{ height: size }} aria-hidden="true">
      <img
        key={pose}
        src={`/mascota/apex-${pose}.webp`}
        alt=""
        draggable={false}
        decoding="async"
        className="tour-mascot h-full w-auto animate-in fade-in-0 zoom-in-95 duration-300"
        // «apunta» señala a su izquierda: aquí la respuesta queda a su derecha.
        style={pose === 'apunta' ? { transform: 'scaleX(-1)' } : undefined}
      />
    </div>
  );
}

export default function HelpAsk({ onExit }: { onExit: () => void }) {
  const { userProfile } = useCourse();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { installed } = useExtensions();
  const history = useHelpHistory(userProfile?.id);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [shown, setShown] = useState<Resolved | null>(null);
  const [instant, setInstant] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'answer' | 'history'>('answer');
  const [highlight, setHighlight] = useState(-1);
  const starters = useMemo(() => pickStarters(3), []);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  // El índice de la ayuda (~0,2 s) se prepara cuando el equipo está libre,
  // no al pulsar la primera tecla.
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

  // El cuadro crece con el texto (hasta 4 líneas), como el de una IA.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [query]);

  // La barra recibe el foco al entrar: se viene a preguntar.
  useEffect(() => inputRef.current?.focus(), []);

  const present = (result: Resolved, started: number, fresh: boolean) => {
    const wait = Math.max(0, THINK_MS - (performance.now() - started));
    later(() => {
      setInstant(!fresh);
      setShown(result);
      setThinking(false);
      setView('answer');
      if (result.kind === 'action') setNotionOpen(true);
      if (fresh) {
        history.add(turnFromResolved(result));
        trackEvent('help_asked', { ...resolvedId(result), length: result.question.length });
      }
    }, wait);
  };

  const begin = (make: () => Resolved, fresh: boolean) => {
    if (thinking) return;
    setQuery('');
    setOpen(true);
    setView('answer');
    setShown(null);
    setThinking(true);
    present(make(), performance.now(), fresh);
  };

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    begin(() => resolveQuestion(question, { installed, starters }), true);
  };

  const showEntry = (entry: HelpEntry, question = entry.title) =>
    begin(() => ({ kind: 'entry', question, entry, alternatives: [] }), true);

  const openTurn = (turn: HelpTurn) => {
    const result = resolvedFromTurn(turn);
    if (!result) return;
    setInstant(true);
    setShown(result);
    setThinking(false);
    setView('answer');
  };

  const openHistory = () => {
    if (thinking) return;
    setOpen(true);
    setView('history');
  };

  /** Vuelve a la barra centrada (la conversación ya quedó guardada). */
  const close = () => {
    setShown(null);
    setOpen(false);
    setView('answer');
  };

  const discover = (entry: HelpEntry) => {
    const tour = tourFor(entry.id);
    if (!tour) return;
    // Se sale de la ayuda (la respuesta ya quedó en «Conversaciones») y el
    // recorrido toma la pantalla. Temporizador suelto, no `later`: la ayuda
    // se desmonta al salir y cancelaría los suyos.
    onExit();
    window.setTimeout(() => startTour(tour), 380);
  };

  // Escape: cierra la conversación y, sin conversación, sale de la ayuda
  // (si no se está escribiendo nada).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target === inputRef.current && query) return;
      if (open) close();
      else onExit();
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
  const pose: MascotPose = thinking ? 'mira' : !open ? 'saluda' : view === 'history' ? 'frente' : shown ? 'apunta' : 'frente';

  const tabs = (
    <div className="flex shrink-0 items-center gap-1 border-b border-border/60 pb-2">
      <button
        type="button"
        onClick={() => setView('answer')}
        disabled={!shown && !thinking}
        className={cn(
          'rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-40',
          view === 'answer' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Respuesta
      </button>
      <button
        type="button"
        onClick={() => setView('history')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
          view === 'history' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <MessagesSquare className="h-3.5 w-3.5" />
        Conversaciones
        {history.turns.length > 0 && <span className="tabular-nums opacity-70">{history.turns.length}</span>}
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={close}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        title="Nueva pregunta (Esc): esta queda guardada en «Conversaciones»"
      >
        <SquarePen className="h-3.5 w-3.5" />
        Nueva pregunta
      </button>
    </div>
  );

  return (
    <section data-tour="ayuda" aria-label="Ayuda de Frame" className="relative flex h-full min-h-0 flex-col px-6 pb-6 pt-4 md:px-10">
      <div className="flex shrink-0 items-center justify-end gap-1">
        {!open && history.turns.length > 0 && (
          <button
            type="button"
            onClick={openHistory}
            data-tour="ayuda-conversaciones"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            Conversaciones <span className="tabular-nums opacity-70">{history.turns.length}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onExit}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Salir de la ayuda (Esc)"
          aria-label="Salir de la ayuda"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className={cn(
          'grid min-h-0 flex-1 transition-[grid-template-columns,gap] duration-500 ease-out',
          open ? 'grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-10' : 'grid-cols-[minmax(0,1fr)_minmax(0,0fr)] gap-0'
        )}
      >
        {/* Izquierda (o centro, sin conversación): Apex y la barra. */}
        <div className="flex min-w-0 flex-col items-center justify-center gap-6 pb-[6vh]">
          <Apex pose={pose} size={open ? 150 : 170} />
          {!open && (
            <h2 className="-mt-2 text-center font-headline text-2xl font-bold text-foreground animate-in fade-in-0">
              ¿En qué te ayudo?
            </h2>
          )}
          <div className="relative w-full max-w-2xl">
            <div
              className={cn(
                'rounded-[26px] border bg-card/90 py-2 pl-5 pr-2 shadow-lg backdrop-blur-sm transition-colors',
                focused ? 'border-primary/60' : 'border-border/80'
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
                  placeholder={open ? 'Pregúntame otra cosa…' : 'Pregúntame cómo usar Frame…'}
                  aria-label="Pregunta cómo usar Frame"
                  className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70"
                />
                <ExtensionsMenu />
                <button
                  type="button"
                  onClick={() => ask(query)}
                  disabled={!canSend}
                  title="Preguntar (Enter)"
                  aria-label="Preguntar"
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all',
                    canSend ? 'bg-primary text-primary-foreground hover:scale-105' : 'bg-secondary text-muted-foreground'
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
              {installed.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-0.5 pt-1.5">
                  {installed.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setNotionOpen(true)}
                      title={extensionInfo(id).detail}
                      className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 py-0.5 pl-1 pr-2.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                    >
                      <ExtensionIcon id={id} small />
                      {extensionInfo(id).name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {suggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-3 right-3 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-border/70 bg-popover py-1 shadow-xl animate-in fade-in-0 slide-in-from-top-1"
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

          {!open && (
            <div className="flex max-w-2xl flex-wrap justify-center gap-2 animate-in fade-in-0">
              {starters.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => showEntry(entry)}
                  className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  {entry.title}
                </button>
              ))}
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground/70">
            {open
              ? 'Esc cierra la respuesta · tus preguntas quedan en «Conversaciones»'
              : `Responde dudas sobre cómo usar Frame · ${HELP_ENTRIES.length} respuestas · funciona sin internet`}
          </p>
        </div>

        {/* Derecha: la respuesta (o las conversaciones guardadas). */}
        <div className={cn('relative min-h-0 min-w-0 overflow-hidden', !open && 'pointer-events-none')} aria-hidden={!open}>
          {open && (
            <div className="flex h-full flex-col animate-in fade-in-0 duration-500">
              {tabs}
              <div className="relative min-h-0 flex-1 overflow-y-auto pb-6 pr-3 pt-5">
                {view === 'history' ? (
                  <History turns={history.turns} onOpen={openTurn} onRemove={history.remove} onClear={history.clear} />
                ) : thinking ? (
                  <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground" aria-live="polite">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary/80" style={{ animationDelay: `${i * 120}ms` }} />
                      ))}
                    </span>
                    Pensando…
                  </div>
                ) : shown ? (
                  <Answer key={shown.question + (shown.kind === 'entry' ? shown.entry.id : '')} shown={shown} instant={instant} onPick={(e) => showEntry(e)} onDiscover={discover} />
                ) : null}

              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
