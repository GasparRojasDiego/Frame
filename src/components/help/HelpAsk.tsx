import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Cloud,
  Compass,
  FileText,
  Globe,
  GraduationCap,
  Home,
  Lightbulb,
  Mic,
  Music,
  PanelTop,
  Repeat,
  Settings,
  Sparkles,
  Timer,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PolySphere from '@/components/help/PolySphere';
import { CURIOSITY_IDS, HELP_ENTRIES, HELP_BY_ID, relatedOf } from '@/lib/help/kb';
import { HELP_AREAS, type HelpAreaId, type HelpEntry } from '@/lib/help/areas';
import { usePathname, useRouter } from '@/lib/navigation';
import { trackEvent } from '@/lib/telemetry';
import { cn } from '@/lib/utils';

// ============================================================
// El Centro de ayuda (botón de la barra superior, ruta /ayuda).
//
// Desde la 1.6.6 no se escribe: no hay barra para preguntar, ni buscador, ni
// historial (Diego). Se elige un TEMA y, dentro, una PREGUNTA; la respuesta,
// escrita a mano para quien empieza, explica en párrafos con negritas dónde
// está cada cosa y empieza saludando según la hora. La flecha de arriba a la
// izquierda vuelve atrás (y Esc, también).
//
// En la portada: el dodecaedro, una frase que cambia a las 6, a las 12 y a
// las 18 horas, y los temas en tarjetas.
// ============================================================

interface Topic {
  key: string;
  label: string;
  icon: typeof Home;
  /** Áreas del banco de respuestas que reúne. */
  areas?: HelpAreaId[];
  /** Respuestas sueltas de otras áreas (las «Curiosidades»). */
  ids?: string[];
}

/** Los 16 temas de las tarjetas, en el orden del menú lateral (cuatro filas de cuatro). */
const TOPICS: Topic[] = [
  { key: 'basico', label: 'Lo básico', icon: Compass, areas: ['basico'] },
  { key: 'inicio', label: 'Inicio', icon: Home, areas: ['inicio'] },
  { key: 'enfoque', label: 'Estudio', icon: Timer, areas: ['enfoque'] },
  { key: 'habitos', label: 'Hábitos', icon: Repeat, areas: ['habitos'] },
  { key: 'asignaturas', label: 'Asignaturas', icon: GraduationCap, areas: ['asignaturas'] },
  { key: 'tareas', label: 'Tareas', icon: BookOpen, areas: ['tareas'] },
  { key: 'calendario', label: 'Calendario', icon: CalendarDays, areas: ['calendario'] },
  { key: 'google', label: 'Google', icon: Globe, areas: ['google'] },
  { key: 'musica', label: 'Música', icon: Music, areas: ['musica'] },
  { key: 'grabaciones', label: 'Grabaciones', icon: Mic, areas: ['grabaciones'] },
  { key: 'barra', label: 'Barra superior', icon: PanelTop, areas: ['barra'] },
  { key: 'informes', label: 'Informes', icon: FileText, areas: ['informes'] },
  // Notion (la única extensión) vive en Ajustes: un solo tema.
  { key: 'ajustes', label: 'Ajustes', icon: Settings, areas: ['ajustes', 'extensiones'] },
  { key: 'cuenta', label: 'Cuenta y nube', icon: Cloud, areas: ['cuenta', 'sugerencias'] },
  { key: 'curiosidades', label: 'Curiosidades', icon: Sparkles, areas: ['curiosidades'], ids: CURIOSITY_IDS },
  { key: 'problemas', label: 'Problemas', icon: Wrench, areas: ['problemas'] },
];

/** Las respuestas de un tema: primero las principales. */
function entriesOf(topic: Topic): HelpEntry[] {
  const fromAreas = HELP_ENTRIES.filter((entry) => topic.areas?.includes(entry.area)).sort(
    (a, b) => (b.prior ?? 0) - (a.prior ?? 0)
  );
  const fromIds = (topic.ids ?? []).map((id) => HELP_BY_ID.get(id)).filter((e): e is HelpEntry => !!e);
  const seen = new Set<string>();
  return [...fromAreas, ...fromIds].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

const TOPIC_ENTRIES = new Map(TOPICS.map((topic) => [topic.key, entriesOf(topic)]));
const VISIBLE_TOPICS = TOPICS.filter((topic) => (TOPIC_ENTRIES.get(topic.key)?.length ?? 0) > 0);

/** Un tramo de texto: normal o en negrita. */
interface Run {
  text: string;
  bold: boolean;
}

/** «Texto con **negrita**» → tramos. */
function parseRuns(text: string): Run[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}

/** Texto con formato en una línea (párrafos, pasos, consejos). */
function Rich({ text }: { text: string }) {
  return (
    <>
      {parseRuns(text).map((run, index) =>
        run.bold ? (
          <strong key={index} className="font-semibold text-foreground">
            {run.text}
          </strong>
        ) : (
          <span key={index}>{run.text}</span>
        )
      )}
    </>
  );
}

/** Saludo según la hora, al principio de cada respuesta. */
function greetingFor(at: number): string {
  const hour = new Date(at).getHours();
  if (hour >= 5 && hour < 12) return '¡Buenos días!';
  if (hour >= 12 && hour < 19) return '¡Buenas tardes!';
  return '¡Buenas noches!';
}

/** Frases de la portada: una por tramo del día. */
const PHRASES = [
  '¿En qué te ayudo?',
  '¿Qué quieres saber de Frame?',
  'Elige un tema para empezar',
  '¿Qué buscas hoy?',
  'Todo lo que Frame puede hacer por ti',
  '¿Te muestro algo nuevo?',
];

/**
 * La frase del tramo actual: cambia a las 6, a las 12 y a las 18 horas (de
 * 18 a 6 es un solo tramo). Devuelve también cuándo toca el siguiente cambio.
 */
function phraseNow(now = new Date()): { text: string; next: number } {
  const hour = now.getHours();
  const base = new Date(now);
  if (hour < 6) base.setDate(base.getDate() - 1); // la madrugada sigue en el tramo de la noche
  const slot = hour >= 18 || hour < 6 ? 2 : hour >= 12 ? 1 : 0;
  const day = Math.floor(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()) / 86_400_000);
  const next = new Date(now);
  const nextHour = hour < 6 ? 6 : hour < 12 ? 12 : hour < 18 ? 18 : 30; // 30 = mañana a las 6
  next.setHours(nextHour, 0, 0, 0);
  return { text: PHRASES[(day * 3 + slot) % PHRASES.length], next: next.getTime() };
}

function DailyPhrase({ className }: { className?: string }) {
  const [phrase, setPhrase] = useState(() => phraseNow());
  useEffect(() => {
    const wait = Math.max(1000, phrase.next - Date.now() + 500);
    const id = window.setTimeout(() => setPhrase(phraseNow()), Math.min(wait, 2 ** 31 - 1));
    return () => window.clearTimeout(id);
  }, [phrase]);
  return <h2 className={cn('text-center font-headline font-semibold text-foreground', className)}>{phrase.text}</h2>;
}

/** Las tarjetas de temas. */
function TopicCards({ onPick }: { onPick: (key: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {VISIBLE_TOPICS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onPick(key)}
          className="group/topic flex items-center gap-2.5 rounded-lg border border-border/70 bg-card/70 px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
        >
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{label}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{TOPIC_ENTRIES.get(key)?.length}</span>
        </button>
      ))}
    </div>
  );
}

/** Preguntas para elegir, como tarjetas. */
function QuestionCards({ entries, onPick }: { entries: HelpEntry[]; onPick: (entry: HelpEntry) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onPick(entry)}
          className="group/q flex items-center gap-2 rounded-lg border border-border/70 bg-card/70 px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
        >
          <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/90">{entry.title}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover/q:text-primary" />
        </button>
      ))}
    </div>
  );
}

/** La respuesta: párrafos justificados, pasos, consejo, «Ir a…» y «Relacionado». */
function Answer({ entry, onPick }: { entry: HelpEntry; onPick: (entry: HelpEntry) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [relatedOpen, setRelatedOpen] = useState(false);
  const paragraphs = useMemo(() => [greetingFor(Date.now()), ...entry.a.split(/\n\s*\n/)], [entry]);
  const related = useMemo(() => relatedOf(entry), [entry]);
  const goTo = entry.go && entry.go !== pathname ? entry.go : null;
  const goLabel = goTo ? (Object.values(HELP_AREAS).find((a) => a.route === goTo)?.label ?? 'la interfaz') : null;

  useEffect(() => setRelatedOpen(false), [entry]);

  return (
    <article key={entry.id} className="animate-in fade-in-0 duration-300">
      <p className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[15px] font-semibold text-foreground">{entry.title}</span>
        <span className="text-[11px] font-semibold text-primary/80">{HELP_AREAS[entry.area].label}</span>
      </p>
      <div className="space-y-2.5 text-justify text-sm leading-relaxed text-foreground/90">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>
            <Rich text={paragraph.trim()} />
          </p>
        ))}
      </div>
      {entry.steps && entry.steps.length > 0 && (
        <ol className="mt-3 space-y-2">
          {entry.steps.map((step, i) => (
            <li key={step} className="flex gap-2.5 text-justify text-sm text-foreground/90">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <span className="leading-relaxed">
                <Rich text={step} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {entry.tip && (
        <p className="mt-3 flex gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-justify text-[13px] leading-relaxed text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <Rich text={entry.tip} />
          </span>
        </p>
      )}
      {goTo && (
        <div className="mt-4">
          <Button size="sm" variant="fantasma" className="h-8 gap-1.5 px-3 text-xs" onClick={() => router.push(goTo)}>
            Ir a {goLabel} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {related.length > 0 && (
        <div className="mt-5">
          {/* Plegado por defecto: un clic lo despliega. */}
          <button
            type="button"
            onClick={() => setRelatedOpen((open) => !open)}
            aria-expanded={relatedOpen}
            className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', relatedOpen && 'rotate-180')} />
            Relacionado
          </button>
          {relatedOpen && <QuestionCards entries={related} onPick={onPick} />}
        </div>
      )}
    </article>
  );
}

/** Dónde está el usuario: la portada, un tema o una respuesta. */
type View = { kind: 'home' } | { kind: 'topic'; key: string } | { kind: 'answer'; id: string };

/** Hasta la 1.6.5 la Ayuda guardaba conversaciones: se borran del equipo. */
function forgetOldConversations() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('frameHelpConversations_') || key.startsWith('frameHelpHistory_') || key === 'frameHelpHistoryOpen') {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.removeItem('frameHelpRun');
  } catch {
    /* sin almacenamiento: nada que borrar */
  }
}

export default function HelpAsk({ onExit }: { onExit: () => void }) {
  /** Pila de vistas: la última es la que se ve. */
  const [stack, setStack] = useState<View[]>([{ kind: 'home' }]);
  const view = stack[stack.length - 1];

  useEffect(forgetOldConversations, []);

  const push = (next: View) => setStack((prev) => [...prev, next]);
  const back = () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const openEntry = (entry: HelpEntry) => {
    trackEvent('help_asked', { entry: entry.id, answered: true });
    push({ kind: 'answer', id: entry.id });
  };

  // Esc: vuelve atrás; en la portada, sale de la ayuda.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (stack.length > 1) back();
      else onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Cada vista nueva empieza arriba.
  useEffect(() => {
    document.getElementById('help-scroll')?.scrollTo({ top: 0 });
  }, [view]);

  const topic = view.kind === 'topic' ? TOPICS.find((t) => t.key === view.key) : null;
  const entry = view.kind === 'answer' ? HELP_BY_ID.get(view.id) : null;

  return (
    <section data-tour="ayuda" aria-label="Centro de ayuda" className="relative flex h-full min-h-0 flex-col">
      <div id="help-scroll" className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 md:px-10">
        {view.kind === 'home' ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-6 py-6">
            <PolySphere size={150} className="animate-in fade-in-0 zoom-in-95 duration-500" />
            <DailyPhrase className="text-2xl" />
            <div className="w-full">
              <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Temas</p>
              <TopicCards onPick={(key) => push({ kind: 'topic', key })} />
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl pb-10 pt-4">
            {/* «Atrás»: una flecha arriba a la izquierda. */}
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={back}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Atrás (Esc)"
                aria-label="Atrás"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              {topic && (
                <h2 className="flex items-center gap-2 font-headline text-lg font-semibold text-foreground">
                  <topic.icon className="h-4 w-4 text-primary" />
                  {topic.label}
                </h2>
              )}
            </div>
            {topic && <QuestionCards entries={TOPIC_ENTRIES.get(topic.key) ?? []} onPick={openEntry} />}
            {view.kind === 'answer' &&
              (entry ? (
                <Answer entry={entry} onPick={openEntry} />
              ) : (
                <p className="text-sm text-muted-foreground">Esta respuesta ya no está en la ayuda.</p>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
