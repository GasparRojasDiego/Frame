import { useEffect, useRef, type RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';

/**
 * Fondo "Constelación": puntos que derivan despacio y se enlazan con líneas
 * finas al acercarse, con una leve reacción al cursor que aporta profundidad.
 *
 * Vive DETRÁS de toda la interfaz (`-z-10`), así que solo asoma por los huecos
 * entre tarjetas. El color sale de `--primary`, de modo que acompaña al tema
 * claro y al oscuro sin tocar nada.
 */

/** Intensidad global (0–1). A petición: al máximo. */
const INTENSITY = 1;

/** Un punto cada ~19.000 px², con techo para que un monitor grande no dispare el coste. */
const AREA_PER_NODE = 19000;
const MAX_NODES = 90;
const LINK_DISTANCE = 150;

/** Deriva de los puntos, en px por fotograma a 60 fps. */
const DRIFT = 0.55;
/**
 * Fotogramas por segundo. Una deriva de medio píxel no gana nada por encima
 * de 60: en pantallas de 120/144 Hz, `requestAnimationFrame` dibujaría el
 * doble o más para el MISMO movimiento. Sin el foco de la ventana (se mira
 * otra cosa) basta la mitad; minimizada u oculta, nada.
 */
const FPS_FOCUSED = 60;
const FPS_BLURRED = 30;
/**
 * Niveles de transparencia de los enlaces. Cada enlace se dibujaba con su
 * propio trazo (cientos por fotograma); agrupados por nivel son una docena
 * de trazos. 24 niveles en un rango de 0–0,3 de opacidad: a la vista, igual.
 */
const ALPHA_LEVELS = 24;
/** Amplitud del desplazamiento por parallax, en px. */
const PARALLAX_RANGE = 34;
/** Radio del realce que acompaña al cursor (solo con `spotlight`), en px. */
const SPOT_RADIUS = 250;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Profundidad 0–1: los puntos "lejanos" se mueven menos con el cursor. */
  depth: number;
  px: number;
  py: number;
}

/**
 * Convierte el triplete HSL de `--primary` en una fábrica de colores.
 * `boost` (0–1) sube la saturación: es el realce que sigue al cursor.
 */
function readTone(): (alpha: number, boost?: number) => string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  const parts = raw.split(/\s+/);
  if (parts.length < 3) return (alpha) => `rgba(120, 150, 200, ${alpha})`;
  const [h, s, l] = parts;
  const saturation = parseFloat(s);
  return (alpha, boost = 0) =>
    boost > 0 && Number.isFinite(saturation)
      ? `hsla(${h}, ${Math.min(100, saturation + 32 * boost)}%, ${l}, ${alpha})`
      : `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

interface ConstellationBackdropProps {
  /** Realce leve de la constelación alrededor del cursor (pantalla de acceso). */
  spotlight?: boolean;
  /** Con `spotlight`: mientras el cursor esté SOBRE este elemento no hay realce. */
  avoidRef?: RefObject<HTMLElement | null>;
}

export default function ConstellationBackdrop({ spotlight = false, avoidRef }: ConstellationBackdropProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let nodes: Node[] = [];
    let width = 0;
    let height = 0;
    let frameId = 0;
    let lastFrame = 0;
    let focused = document.hasFocus();
    let tone = readTone();
    /** Color de cada nivel de transparencia de los enlaces (y el de los puntos). */
    let linkColors: string[] = [];
    let nodeFill = '';
    const paintColors = () => {
      linkColors = Array.from({ length: ALPHA_LEVELS }, (_, level) =>
        tone(((level + 0.5) / ALPHA_LEVELS) * INTENSITY * 0.3)
      );
      nodeFill = tone(INTENSITY * 0.62);
    };
    paintColors();
    /** Enlaces del fotograma, repartidos por nivel: x1, y1, x2, y2 seguidos. */
    const buckets: number[][] = Array.from({ length: ALPHA_LEVELS }, () => []);
    const LINK_SQ = LINK_DISTANCE * LINK_DISTANCE;

    // El objetivo lo fija el ratón y la posición real lo persigue con retardo:
    // así el desplazamiento nunca resulta brusco.
    const parallax = { x: 0, y: 0, targetX: 0, targetY: 0 };
    // Realce del cursor: `level` persigue a `target` para que aparezca y se
    // apague con suavidad, nunca de golpe.
    const spot = { x: -9999, y: -9999, level: 0, target: 0 };
    const boostAt = (x: number, y: number) => {
      if (spot.level < 0.01) return 0;
      const distance = Math.hypot(x - spot.x, y - spot.y);
      if (distance >= SPOT_RADIUS) return 0;
      const falloff = 1 - distance / SPOT_RADIUS;
      return spot.level * falloff * falloff;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(MAX_NODES, Math.round((width * height) / AREA_PER_NODE));
      nodes = Array.from({ length: count }, () => {
        const x = Math.random() * width;
        const y = Math.random() * height;
        return {
          x,
          y,
          vx: (Math.random() - 0.5) * DRIFT,
          vy: (Math.random() - 0.5) * DRIFT,
          r: 0.9 + Math.random() * 1.5,
          depth: 0.35 + Math.random() * 0.65,
          px: x,
          py: y,
        };
      });
    };

    const draw = (now: number = performance.now()) => {
      frameId = requestAnimationFrame(draw);
      // Ritmo fijo, sin depender de la frecuencia de la pantalla. El paso se
      // mide en fotogramas de 60 fps para que la deriva vaya igual de rápida
      // a 60 que a 30.
      const interval = 1000 / (focused ? FPS_FOCUSED : FPS_BLURRED);
      const elapsed = now - lastFrame;
      if (lastFrame && elapsed < interval - 2) return;
      const step = lastFrame ? Math.min(4, elapsed / (1000 / 60)) : 1;
      lastFrame = now;

      const ease = (k: number) => 1 - Math.pow(1 - k, step);
      parallax.x += (parallax.targetX - parallax.x) * ease(0.07);
      parallax.y += (parallax.targetY - parallax.y) * ease(0.07);
      spot.level += (spot.target - spot.level) * ease(0.08);

      ctx.clearRect(0, 0, width, height);

      // Halo tenue bajo el cursor: da cuerpo al realce sin competir con el contenido.
      if (spot.level > 0.01) {
        const halo = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, SPOT_RADIUS);
        halo.addColorStop(0, tone(0.075 * spot.level, 1));
        halo.addColorStop(1, tone(0));
        ctx.fillStyle = halo;
        ctx.fillRect(spot.x - SPOT_RADIUS, spot.y - SPOT_RADIUS, SPOT_RADIUS * 2, SPOT_RADIUS * 2);
      }

      for (const node of nodes) {
        if (!reduced) {
          node.x += node.vx * step;
          node.y += node.vy * step;
          // Rebote suave en los bordes: ningún punto se pierde de la escena.
          if (node.x < 0 || node.x > width) node.vx *= -1;
          if (node.y < 0 || node.y > height) node.vy *= -1;
        }
        node.px = node.x + parallax.x * node.depth;
        node.py = node.y + parallax.y * node.depth;
      }

      // Enlaces primero y puntos encima: las líneas nunca tapan los nodos.
      // Sin realce (el caso de toda la app), cada enlace va al trazo de su
      // nivel de transparencia; con realce (pantalla de acceso), los que
      // quedan cerca del cursor se pintan aparte, con su color exacto.
      ctx.lineWidth = 0.7;
      for (const bucket of buckets) bucket.length = 0;
      const spotOn = spot.level >= 0.01;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.px - b.px;
          const dy = a.py - b.py;
          const sq = dx * dx + dy * dy;
          if (sq > LINK_SQ) continue;
          const closeness = 1 - Math.sqrt(sq) / LINK_DISTANCE;
          const boost = spotOn ? boostAt((a.px + b.px) / 2, (a.py + b.py) / 2) : 0;
          if (boost > 0) {
            ctx.strokeStyle = tone(closeness * INTENSITY * 0.3 * (1 + 1.2 * boost), boost);
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.stroke();
            continue;
          }
          buckets[Math.min(ALPHA_LEVELS - 1, Math.floor(closeness * ALPHA_LEVELS))].push(a.px, a.py, b.px, b.py);
        }
      }
      for (let level = 0; level < ALPHA_LEVELS; level++) {
        const segments = buckets[level];
        if (segments.length === 0) continue;
        ctx.strokeStyle = linkColors[level];
        ctx.beginPath();
        for (let k = 0; k < segments.length; k += 4) {
          ctx.moveTo(segments[k], segments[k + 1]);
          ctx.lineTo(segments[k + 2], segments[k + 3]);
        }
        ctx.stroke();
      }

      // Los puntos sin realce, todos de un solo relleno.
      ctx.fillStyle = nodeFill;
      ctx.beginPath();
      for (const node of nodes) {
        if (spotOn && boostAt(node.px, node.py) > 0) continue;
        ctx.moveTo(node.px + node.r, node.py);
        ctx.arc(node.px, node.py, node.r, 0, Math.PI * 2);
      }
      ctx.fill();
      if (spotOn) {
        for (const node of nodes) {
          const boost = boostAt(node.px, node.py);
          if (boost <= 0) continue;
          ctx.fillStyle = tone(Math.min(1, INTENSITY * (0.62 + 0.32 * boost)), boost);
          ctx.beginPath();
          ctx.arc(node.px, node.py, node.r + 0.7 * boost, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // Se dibuja el primer fotograma en el acto (draw se reencola solo): así la
    // constelación ya está ahí en el primer pintado, sin un parpadeo vacío.
    const start = () => {
      if (!frameId) {
        lastFrame = 0;
        draw();
      }
    };
    const stop = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    };

    // Con la ventana oculta o minimizada no hay nada que animar. Sin foco se
    // sigue viendo (al lado de otra ventana, por ejemplo), así que solo baja
    // el ritmo.
    const handleVisibility = () => (document.hidden ? stop() : start());
    const handleFocus = () => {
      focused = true;
    };
    const handleBlur = () => {
      focused = false;
    };
    // Minimizada: WebView2 no siempre lo comunica como «oculta», pero la
    // ventana sí. Se pregunta al cambiar de tamaño (minimizar lo es).
    let stopMinimizeWatch: (() => void) | null = null;
    let disposed = false;
    if (isTauri()) {
      void import('@tauri-apps/api/window')
        .then(async ({ getCurrentWindow }) => {
          const win = getCurrentWindow();
          const unlisten = await win.onResized(() => {
            void win.isMinimized().then((minimized) => (minimized ? stop() : document.hidden || start()));
          });
          if (disposed) unlisten();
          else stopMinimizeWatch = unlisten;
        })
        .catch(() => undefined);
    }

    const handleMouseMove = (event: MouseEvent) => {
      parallax.targetX = (event.clientX / window.innerWidth - 0.5) * PARALLAX_RANGE;
      parallax.targetY = (event.clientY / window.innerHeight - 0.5) * PARALLAX_RANGE;
      if (!spotlight) return;
      spot.x = event.clientX;
      spot.y = event.clientY;
      const rect = avoidRef?.current?.getBoundingClientRect();
      const overAvoided =
        !!rect &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      spot.target = overAvoided ? 0 : 1;
    };
    // El cursor salió de la ventana: el realce se apaga.
    const handleMouseLeave = () => {
      spot.target = 0;
    };

    // El tema claro/oscuro cambia `--primary`: releerlo al vuelo cuesta menos
    // que consultar getComputedStyle en cada fotograma.
    const themeObserver = new MutationObserver(() => {
      tone = readTone();
      paintColors();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });

    resize();
    start();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      disposed = true;
      stopMinimizeWatch?.();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      stop();
      themeObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [spotlight, avoidRef]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Halo suave: evita el aspecto de "fondo plano con puntos". */}
      <div
        className="absolute inset-0"
        style={{
          // Dos halos simétricos, uno en cada esquina en diagonal: la
          // composición queda equilibrada en lugar de cargada arriba.
          background:
            'radial-gradient(70vw 60vh at 18% 8%, hsl(var(--primary) / 0.10), transparent 70%),' +
            'radial-gradient(70vw 60vh at 92% 96%, hsl(var(--primary) / 0.10), transparent 70%)',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 block" />
    </div>
  );
}
