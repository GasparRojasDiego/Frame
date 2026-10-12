import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, Mic, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EchoWord from '@/components/shared/EchoWord';
import NotificationCenter from '@/components/layout/NotificationCenter';
import RecordingDialog from '@/components/recordings/RecordingDialog';
import QuickCreateButton from '@/components/layout/QuickCreateButton';
import { useCourse } from '@/context/CourseContext';
import { useTodayKey } from '@/hooks/use-today';
import { buildHeaderPhrases, type HeaderPhrase } from '@/lib/header-phrases';
import { startQuickRecording } from '@/lib/quick-recording';
import type { RecorderState } from '@/components/recordings/RecordingDialog';
import type { UserProfile } from '@/types';

// Los informes arrastran los generadores de PDF y Word: se cargan al abrir
// su recuadro, no al arrancar la app.
const ReportCenter = lazy(() => import('@/components/settings/ReportCenter'));

// La frase propia (clave `headerQuote`) se retiró en la 1.6.2: la barra ya no
// muestra un texto escrito a mano sino frases con los datos del usuario. Se
// borra lo que quedara guardado para no arrastrarlo en los respaldos.
try {
  if (typeof window !== 'undefined' && window.localStorage.getItem('headerQuote') !== null) {
    window.localStorage.removeItem('headerQuote');
  }
} catch {
  /* almacenamiento vetado: no hay nada que limpiar */
}

/** Cada cuánto cambia la frase: lo bastante para leerla y olvidarse de ella. */
const ROTATE_MS = 90_000;
/** Al retirar el ratón, nunca cambia antes de esto: se acaba de leer. */
const AFTER_HOVER_MS = 5_000;

/** Botones de la barra: fantasma en reposo, sólido con su recuadro abierto. */
const barButton = 'h-9 w-9 rounded-md border border-primary';

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// ============================================================
// La frase del centro de la barra.
//
// Mismo formato exacto que la frase propia de antes (mayúsculas, espaciado
// ancho, azul primario, centrada y truncada) y altura fija, para que nada
// salte al cambiar. El relevo:
//   · la saliente se va un poco a la izquierda, se encoge y se deshace letra
//     a letra —cada una deriva, se desenfoca y se apaga con un leve desfase—;
//   · la entrante nace pequeña y tenue y crece hasta su tamaño.
// Con «reducir movimiento», un fundido simple.
// ============================================================

function PhraseStage({ text }: { text: string }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(text);
  const [leaving, setLeaving] = useState<{ text: string; key: number } | null>(null);
  const turn = useRef(0);
  const inRef = useRef<HTMLHeadingElement>(null);
  const outRef = useRef<HTMLParagraphElement>(null);

  // Llega otra frase: la que estaba pasa a la capa de salida. En layout
  // effect para que no se pinte ni un fotograma con las dos iguales.
  useLayoutEffect(() => {
    if (text === shown) return;
    turn.current += 1;
    setLeaving({ text: shown, key: turn.current });
    setShown(text);
  }, [text, shown]);

  useLayoutEffect(() => {
    if (!leaving) return;
    const out = outRef.current;
    const incoming = inRef.current;
    if (!out || typeof out.animate !== 'function') {
      setLeaving(null);
      return;
    }
    const animations: Animation[] = [];

    if (reduced) {
      animations.push(out.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }));
      if (incoming) {
        animations.push(
          incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 140, easing: 'ease-out', fill: 'backwards' })
        );
      }
    } else {
      const letters = Array.from(out.querySelectorAll<HTMLElement>('[data-letter]'));
      // El desfase total no depende del largo: una frase larga no tarda más.
      const spread = 420;
      const step = letters.length > 1 ? spread / (letters.length - 1) : 0;
      const letterMs = 460;
      letters.forEach((letter, index) => {
        // Azar estable por letra (sin Math.random): cada una cae distinto.
        const r = ((index * 9301 + 49297) % 233280) / 233280;
        animations.push(
          letter.animate(
            [
              { opacity: 1, transform: 'translate(0, 0) scale(1)', filter: 'blur(0px)' },
              {
                opacity: 0,
                transform: `translate(${-(8 + r * 16)}px, ${(r - 0.5) * 8}px) scale(${0.5 + r * 0.3})`,
                filter: 'blur(3px)',
              },
            ],
            { duration: letterMs, delay: index * step, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'both' }
          )
        );
      });
      animations.push(
        out.animate([{ transform: 'translateX(0) scale(1)' }, { transform: 'translateX(-10px) scale(0.94)' }], {
          duration: spread + letterMs,
          easing: 'ease-in',
          fill: 'forwards',
        })
      );
      if (incoming) {
        animations.push(
          incoming.animate(
            [
              { opacity: 0, transform: 'scale(0.86)', filter: 'blur(2px)' },
              { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
            ],
            { duration: 650, delay: spread * 0.6, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }
          )
        );
      }
    }

    const key = leaving.key;
    Promise.all(animations.map((animation) => animation.finished))
      .then(() => setLeaving((current) => (current?.key === key ? null : current)))
      .catch(() => {
        /* cancelada: llegó otra frase a mitad del relevo */
      });
    return () => animations.forEach((animation) => animation.cancel());
    // Solo al empezar cada relevo; `reduced` se lee en ese instante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving?.key]);

  const type = 'text-sm font-semibold uppercase tracking-widest text-primary';

  return (
    <>
      <h1 ref={inRef} className={cn('truncate px-2 text-center', type)}>
        {shown}
      </h1>
      {leaving && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-center">
          <p key={leaving.key} ref={outRef} className={cn('overflow-hidden whitespace-nowrap px-2 text-center', type)}>
            {Array.from(leaving.text).map((char, index) => (
              <span key={index} data-letter className="inline-block">
                {char === ' ' ? ' ' : char}
              </span>
            ))}
          </p>
        </div>
      )}
    </>
  );
}

/**
 * Rota entre las frases con datos (src/lib/header-phrases.ts) cada
 * `ROTATE_MS`, y se detiene mientras el ratón está encima para poder leerla.
 * Las frases se recalculan cuando cambian los datos, al cambiar de día y en
 * cada vuelta (así «buenos días» no sigue en pie por la tarde).
 */
function HeaderPhrases({ name }: { name?: string }) {
  const { tasks, archivedTasks, courses, studySessions, habits, studyGoals, dailyPerformances } = useCourse();
  const todayKey = useTodayKey();
  const [tick, setTick] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const phrases = useMemo<HeaderPhrase[]>(
    () =>
      buildHeaderPhrases({
        now: new Date(),
        name,
        tasks: tasks ?? [],
        archivedTasks: archivedTasks ?? [],
        courses: courses ?? [],
        studySessions: studySessions ?? [],
        habits: habits ?? [],
        studyGoals,
        dailyPerformances: dailyPerformances ?? [],
      }),
    // `tick` y `todayKey` no se leen dentro: solo renuevan el «ahora».
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, todayKey, name, tasks, archivedTasks, courses, studySessions, habits, studyGoals, dailyPerformances]
  );
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;

  // Si la plantilla que se mostraba deja de tener algo que decir, manda la primera.
  const current = phrases.find((phrase) => phrase.id === currentId) ?? phrases[0];

  // Reloj de la rotación: un único temporizador hasta el próximo cambio. Al
  // pasar el ratón se guarda lo que faltaba y se reanuda al retirarlo.
  const deadline = useRef(Date.now() + ROTATE_MS);
  const remaining = useRef(ROTATE_MS);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => {
      deadline.current = Date.now() + ROTATE_MS;
      setCurrentId((previous) => {
        const list = phrasesRef.current;
        const index = Math.max(0, list.findIndex((phrase) => phrase.id === previous));
        return list[(index + 1) % list.length]?.id ?? null;
      });
      setTick((value) => value + 1);
    }, Math.max(0, deadline.current - Date.now()));
    return () => window.clearTimeout(timer);
  }, [paused, tick]);

  return (
    <div
      data-tour="frase"
      title={current?.text}
      className="relative flex h-7 min-w-0 flex-1 flex-col justify-center"
      onMouseEnter={() => {
        remaining.current = Math.max(0, deadline.current - Date.now());
        setPaused(true);
      }}
      onMouseLeave={() => {
        deadline.current = Date.now() + Math.max(remaining.current, AFTER_HOVER_MS);
        setPaused(false);
      }}
    >
      <PhraseStage text={current?.text ?? ''} />
    </div>
  );
}

interface HeaderProps {
  /** Lo inyecta el layout: nombre del saludo y dueño de los informes. */
  userProfile: UserProfile | null;
}

export default function Header({ userProfile }: HeaderProps) {
  const [isRecordingOpen, setRecordingOpen] = useState(false);
  /** Lo que hace la grabadora aunque su recuadro esté cerrado. */
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [isReportsOpen, setReportsOpen] = useState(false);

  // Atajo global de grabación: Ctrl+Shift+F abre la grabadora Y empieza a
  // grabar en el acto, sin pasos intermedios.
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setRecordingOpen(true);
        startQuickRecording();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Para el saludo: el nombre de pila si lo hay; el invitado, sin nombre.
  const greetName = userProfile && !userProfile.isGuest
    ? userProfile.firstNames?.trim() || userProfile.username
    : undefined;

  return (
    <header data-tour="barra-superior" className="flex h-[60px] flex-shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
      {/* Los dos extremos miden lo mismo: así la frase queda centrada de verdad. */}
      <div className="flex w-36 shrink-0 items-center justify-start gap-2">
        {/* Crear una tarea o una anotación sin salir de donde estés. */}
        <QuickCreateButton />

        {/* Centro de informes (antes en Ajustes): los cuatro informes en un recuadro. */}
        <Button
          size="icon"
          variant={isReportsOpen ? 'default' : 'fantasma'}
          className={barButton}
          onClick={() => setReportsOpen(true)}
          title="Centro de informes"
          data-tour="informes-boton"
        >
          <ScrollText className="h-5 w-5" />
        </Button>
      </div>

      <HeaderPhrases name={greetName} />

      <div className="flex w-36 shrink-0 items-center justify-end gap-2">
        {/* Grabación de voz (también con Ctrl+Shift+F). Sólida mientras su
            recuadro está abierto y también mientras graba con el recuadro
            cerrado: entonces además respira con el mismo brillo del dial de
            Enfoque durante una sesión, así nunca se olvida que el micrófono
            sigue abierto. En pausa, sólida sin brillo. */}
        <Button
          size="icon"
          variant={isRecordingOpen || recorderState !== 'idle' ? 'default' : 'fantasma'}
          title={
            recorderState === 'recording'
              ? 'Grabando… (pulsa para ver la grabación)'
              : recorderState === 'paused'
                ? 'Grabación en pausa (pulsa para verla)'
                : 'Grabación (Ctrl+Shift+F)'
          }
          className={cn(barButton, 'transition-colors', recorderState === 'recording' && 'animate-session-glow')}
          onClick={() => setRecordingOpen(true)}
          data-tour="grabar"
        >
          <Mic className="h-5 w-5" />
        </Button>

        <NotificationCenter />
      </div>

      {/* Grabadora global: montada siempre para no perder audio al cerrar */}
      <RecordingDialog
        open={isRecordingOpen}
        onOpenChange={setRecordingOpen}
        onStateChange={setRecorderState}
      />

      <Dialog open={isReportsOpen} onOpenChange={setReportsOpen}>
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {/* `pt-[15px]`: el título en la misma línea que la X, como en «Crear». */}
          <DialogHeader className="relative shrink-0 overflow-hidden px-6 pb-4 pt-[15px]">
            {/* «INFORMES», repetido y a la deriva detrás del título. */}
            <EchoWord word="Informes" />
            <DialogTitle className="relative text-center text-lg font-bold text-primary">Centro de informes</DialogTitle>
            <DialogDescription className="relative text-center text-xs">
              General, rendimiento, pendientes y hábitos, en PDF o Word.
            </DialogDescription>
          </DialogHeader>
          {/* Divisoria con margen a ambos lados, no de borde a borde. */}
          <div aria-hidden className="mx-6 h-px shrink-0 bg-border" />
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <Suspense
              fallback={
                <div className="flex h-72 items-center justify-center">
                  <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                </div>
              }
            >
              <ReportCenter userProfile={userProfile} />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
