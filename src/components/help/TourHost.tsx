import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X } from 'lucide-react';
import { findTourTarget, stopTour, useActiveTour, type MascotPose, type Tour } from '@/lib/help/tour';
import { usePathname, useRouter } from '@/lib/navigation';
import { trackEvent } from '@/lib/telemetry';
import { cn } from '@/lib/utils';

// ============================================================
// Pinta el recorrido «Descubrir» en curso (ver lib/help/tour.ts).
//
// La pantalla se oscurece con CUATRO velos alrededor del elemento resaltado:
// el hueco del medio no tiene nada encima, así que el clic llega al botón de
// verdad y la app hace lo de siempre. Los velos se tragan los demás clics
// (también para que un diálogo abierto debajo no se cierre al tocarlos).
//
// Cada paso: ir a su interfaz si hace falta, esperar a que aparezca su
// elemento (hasta 7 s: un diálogo tarda en abrir), centrarlo en pantalla y
// seguirlo si se mueve. Avanza al pulsarlo, o con «Siguiente» en los pasos
// que solo señalan algo o piden escribir.
// ============================================================

const SEEK_MS = 7000;
const PAD = 8;
const MASCOT = 124;

type Phase = 'seek' | 'show' | 'missing' | 'done';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const DEFAULT_POSES: MascotPose[] = ['saluda', 'apunta', 'vuela', 'mira', 'abre', 'apunta', 'frente', 'perfil'];

function poseFor(tour: Tour, index: number): MascotPose {
  return tour.steps[index]?.pose ?? DEFAULT_POSES[index % DEFAULT_POSES.length];
}

const wired = new WeakSet<HTMLElement>();

/** Para que un velo o el globo no dejen pasar el clic a lo de debajo (ni cierren un diálogo). */
function swallow(node: HTMLElement | null, all: boolean) {
  if (!node || wired.has(node)) return;
  wired.add(node);
  const stop = (event: Event) => event.stopPropagation();
  const types = all ? ['pointerdown', 'mousedown', 'touchstart', 'click', 'mouseup', 'pointerup'] : ['pointerdown', 'mousedown', 'touchstart'];
  for (const type of types) node.addEventListener(type, stop);
}

function Mascot({ pose, flip }: { pose: MascotPose; flip: boolean }) {
  return (
    <img
      key={pose}
      src={`/mascota/apex-${pose}.webp`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="tour-mascot pointer-events-none select-none animate-in fade-in-0 zoom-in-75 duration-300"
      style={{ height: MASCOT, width: 'auto', transform: flip ? 'scaleX(-1)' : undefined }}
    />
  );
}

export default function TourHost() {
  const tour = useActiveTour();
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('seek');
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const targetRef = useRef<HTMLElement | null>(null);
  const advanceTimer = useRef<number | null>(null);

  const step = tour?.steps[index];

  const finish = useCallback(
    (completed: boolean) => {
      if (tour) trackEvent('help_tour', { id: tour.id, completed, step: index + 1, steps: tour.steps.length });
      setIndex(0);
      setPhase('seek');
      setBox(null);
      targetRef.current = null;
      stopTour();
    },
    [tour, index]
  );

  const advance = useCallback(() => {
    if (!tour) return;
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    targetRef.current = null;
    setBox(null);
    if (index + 1 >= tour.steps.length) {
      setPhase('done');
      return;
    }
    setIndex(index + 1);
    setPhase('seek');
  }, [tour, index]);

  // Un recorrido nuevo empieza desde el primer paso.
  useEffect(() => {
    setIndex(0);
    setPhase(tour ? 'seek' : 'done');
    setBox(null);
    targetRef.current = null;
  }, [tour]);

  // Buscar el elemento del paso (yendo antes a su interfaz).
  useEffect(() => {
    if (!tour || !step || phase !== 'seek') return;
    if (!step.el) {
      setPhase('show');
      return;
    }
    if (step.go && pathname !== step.go) {
      router.push(step.go);
      return; // al cambiar la ruta, este efecto vuelve a correr
    }
    let cancelled = false;
    const started = performance.now();
    const look = () => {
      if (cancelled) return;
      const found = findTourTarget(step.el!);
      if (found) {
        targetRef.current = found;
        const rect = found.getBoundingClientRect();
        if (rect.top < 70 || rect.bottom > window.innerHeight - 40) found.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setPhase('show');
        return;
      }
      if (performance.now() - started > SEEK_MS) {
        if (step.optional) advance();
        else setPhase('missing');
        return;
      }
      window.setTimeout(look, 140);
    };
    look();
    return () => {
      cancelled = true;
    };
  }, [tour, step, phase, pathname, router, advance]);

  // Seguir al elemento resaltado (se mueve al desplazar, al abrir un panel…).
  useEffect(() => {
    if (!tour || phase !== 'show') return;
    // Los botones que solo asoman al pasar el ratón se ven mientras se señalan
    // (también si el que está transparente es el contenedor que los agrupa).
    const marked: HTMLElement[] = [];
    for (let node = targetRef.current, depth = 0; node && depth < 5; node = node.parentElement, depth++) {
      if (depth === 0 || Number(getComputedStyle(node).opacity) < 0.05) {
        node.setAttribute('data-tour-active', '');
        marked.push(node);
      }
    }
    let frame = 0;
    const follow = () => {
      const target = targetRef.current;
      if (target) {
        if (!target.isConnected) {
          // React lo volvió a crear: se busca otra vez.
          targetRef.current = null;
          setBox(null);
          setPhase('seek');
          return;
        }
        const r = target.getBoundingClientRect();
        setBox((prev) =>
          prev && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.left - r.left) < 0.5 && prev.width === r.width && prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height }
        );
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(frame);
      marked.forEach((node) => node.removeAttribute('data-tour-active'));
    };
  }, [tour, phase]);

  // Pulsar el elemento resaltado avanza (después de que la app haga lo suyo).
  useEffect(() => {
    if (!tour || phase !== 'show' || !step?.el || step.next) return;
    const onClick = (event: MouseEvent) => {
      const target = targetRef.current;
      if (!target || !(event.target instanceof Node) || !target.contains(event.target)) return;
      if (advanceTimer.current) return;
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null;
        advance();
      }, 380);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [tour, phase, step, advance]);

  // Escape sale del recorrido; el tamaño de la ventana recoloca el globo.
  useEffect(() => {
    if (!tour) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        finish(false);
      }
    };
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
    };
  }, [tour, finish]);

  // Al terminar, la despedida se va sola.
  useEffect(() => {
    if (!tour || phase !== 'done') return;
    const id = window.setTimeout(() => finish(true), 5200);
    return () => window.clearTimeout(id);
  }, [tour, phase, finish]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  // El globo se mide después de pintarse para colocarlo sin salirse.
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleSize, setBubbleSize] = useState({ w: 340, h: 160 });
  useLayoutEffect(() => {
    const node = bubbleRef.current;
    if (!node) return;
    const { offsetWidth: w, offsetHeight: h } = node;
    setBubbleSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  });

  if (!tour) return null;

  const hole = phase === 'show' && step?.el && box
    ? { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }
    : null;

  // Globo: debajo del hueco si cabe; si no, encima; sin hueco, en el centro.
  const margin = 16;
  const bw = bubbleSize.w;
  const bh = bubbleSize.h;
  let bubbleTop = viewport.h / 2 - bh / 2;
  let bubbleLeft = viewport.w / 2 - bw / 2;
  if (hole) {
    const below = hole.top + hole.height + 14;
    const above = hole.top - 14 - bh;
    bubbleTop = below + bh <= viewport.h - margin ? below : above >= margin ? above : Math.min(viewport.h - bh - margin, Math.max(margin, hole.top));
    const centerX = hole.left + hole.width / 2;
    bubbleLeft = Math.min(viewport.w - bw - margin, Math.max(margin + MASCOT * 0.7, centerX - bw / 2));
    // Si el globo taparía el hueco (no cupo ni arriba ni abajo), va al lado.
    const overlaps = bubbleTop < hole.top + hole.height && bubbleTop + bh > hole.top;
    if (overlaps) {
      const right = hole.left + hole.width + 16;
      bubbleLeft = right + bw <= viewport.w - margin ? right : Math.max(margin, hole.left - 16 - bw);
    }
  }
  // Apex va al lado del globo, a su altura, por el lado con más sitio; nunca
  // encima del elemento resaltado.
  const targetX = hole ? hole.left + hole.width / 2 : viewport.w / 2;
  const mascotWidth = MASCOT * 0.85;
  const roomRight = viewport.w - (bubbleLeft + bw);
  const mascotOnRight = roomRight >= mascotWidth + 24 ? (hole ? targetX >= bubbleLeft + bw / 2 || bubbleLeft < mascotWidth + 24 : true) : false;
  const mascotLeft = mascotOnRight ? bubbleLeft + bw + 10 : Math.max(8, bubbleLeft - mascotWidth - 10);
  const mascotTop = Math.min(viewport.h - MASCOT - 8, Math.max(8, bubbleTop + bh / 2 - MASCOT / 2));
  const pose: MascotPose = phase === 'done' ? 'celebra' : phase === 'missing' ? 'mira' : poseFor(tour, index);
  // La pose «apunta» señala hacia su izquierda: si el elemento queda a su derecha, se voltea.
  const flip = hole ? targetX > mascotLeft + MASCOT / 2 : false;

  const total = tour.steps.length;
  const shade = 'pointer-events-auto fixed bg-black/70 transition-[top,left,width,height] duration-200';

  return createPortal(
    <div className="fixed inset-0 z-[300]" style={{ pointerEvents: 'none' }} role="dialog" aria-modal="true" aria-label={`Recorrido: ${tour.title}`}>
      {hole ? (
        <>
          <div ref={(n) => swallow(n, true)} className={shade} style={{ top: 0, left: 0, width: '100%', height: Math.max(0, hole.top) }} />
          <div ref={(n) => swallow(n, true)} className={shade} style={{ top: hole.top + hole.height, left: 0, width: '100%', bottom: 0, height: Math.max(0, viewport.h - hole.top - hole.height) }} />
          <div ref={(n) => swallow(n, true)} className={shade} style={{ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height }} />
          <div ref={(n) => swallow(n, true)} className={shade} style={{ top: hole.top, left: hole.left + hole.width, width: Math.max(0, viewport.w - hole.left - hole.width), height: hole.height }} />
          <div
            aria-hidden="true"
            className="tour-ring pointer-events-none fixed rounded-xl"
            style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
          />
        </>
      ) : (
        <div ref={(n) => swallow(n, true)} className="pointer-events-auto fixed inset-0 bg-black/70 animate-in fade-in-0" />
      )}

      {phase !== 'seek' && (
        <>
          <div className="pointer-events-none fixed" style={{ top: mascotTop, left: mascotLeft }}>
            <div className="tour-bob">
              <Mascot pose={pose} flip={flip} />
            </div>
          </div>
          <div
            ref={(node) => {
              bubbleRef.current = node;
              swallow(node, false);
            }}
            className="pointer-events-auto fixed w-[340px] max-w-[calc(100vw-32px)] animate-in fade-in-0 zoom-in-95 rounded-2xl border border-primary/40 bg-popover p-4 text-popover-foreground shadow-2xl duration-200"
            style={{ top: bubbleTop, left: bubbleLeft }}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {phase === 'done' ? '¡Listo!' : `${tour.title} · ${Math.min(index + 1, total)}/${total}`}
              </span>
              <button
                type="button"
                onClick={() => finish(phase === 'done')}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Salir del recorrido"
                title="Salir (Esc)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed">
              {phase === 'done'
                ? tour.done ?? '¡Eso es todo! Ya sabes hacerlo.'
                : phase === 'missing'
                  ? `No encuentro ese botón en la pantalla.${tour.needs ? ` ${tour.needs}` : ''}`
                  : step?.say}
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              {phase === 'missing' && (
                <button
                  type="button"
                  onClick={() => setPhase('seek')}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Buscar otra vez
                </button>
              )}
              {phase === 'missing' && index + 1 < total && (
                <button
                  type="button"
                  onClick={advance}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Saltar este paso
                </button>
              )}
              {phase === 'show' && (step?.next || !step?.el) && (
                <button
                  type="button"
                  onClick={advance}
                  className="flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-105"
                >
                  {index + 1 >= total ? 'Terminar' : 'Siguiente'} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              {phase === 'show' && step?.el && !step.next && (
                <span className="text-[11px] text-muted-foreground">Pulsa lo que está iluminado</span>
              )}
              {phase === 'done' && (
                <button
                  type="button"
                  onClick={() => finish(true)}
                  className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </>
      )}
      <span className={cn('sr-only')} aria-live="polite">
        {phase === 'show' ? step?.say : ''}
      </span>
    </div>,
    document.body
  );
}
