import { useEffect, useRef, type RefObject } from 'react';

// ============================================================
// Cursor de las pantallas de acceso: el mismo de la página web.
//
// Doce puntos giran alrededor del cursor, cada uno con su propio retraso: al
// moverse se estiran en rayas en la dirección del movimiento; quietos vuelven
// a ser puntos y crecen apenas. Sobre botones y enlaces el círculo se abre.
// Dentro del recuadro de acceso se apaga (ahí se escribe). Solo con ratón y
// sin «reducir movimiento».
// ============================================================

const DOTS = 12;

/** Color de marca (`--primary`, «H S% L%») como «r,g,b». */
function readPrimaryRgb(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  const match = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(raw);
  if (!match) return '104,130,242';
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map((v) => Math.round(v * 255)).join(',');
}

export default function CursorRing({ avoidRef }: { avoidRef?: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reduced) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    let rgb = readPrimaryRgb();
    const themeObserver = new MutationObserver(() => {
      rgb = readPrimaryRgb();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });

    const pointer = { x: -9999, y: -9999, active: false };
    const dots = Array.from({ length: DOTS }, (_, i) => ({ x: -9999, y: -9999, px: -9999, py: -9999, r: 1.4, ease: 0.2 + (i % 4) * 0.035 }));
    const center = { x: -9999, y: -9999 };
    let radius = 16;
    let radiusTarget = 16;
    let rotation = 0;
    let alpha = 0;
    let lastMove = 0;
    let lastX = -9999;
    let lastY = -9999;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const rect = avoidRef?.current?.getBoundingClientRect();
      const inside =
        !!rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      pointer.active = !inside;
      const target = event.target as Element | null;
      radiusTarget = target?.closest?.('a, button, [role="button"]') ? 24 : 16;
    };
    const onLeave = () => {
      pointer.active = false;
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      alpha += ((pointer.active ? 1 : 0) - alpha) * 0.12;
      if (pointer.x !== lastX || pointer.y !== lastY) {
        lastMove = now;
        lastX = pointer.x;
        lastY = pointer.y;
      }
      if (center.x < -9000) {
        center.x = pointer.x;
        center.y = pointer.y;
      }
      center.x += (pointer.x - center.x) * 0.35;
      center.y += (pointer.y - center.y) * 0.35;
      radius += (radiusTarget - radius) * 0.15;
      rotation += 0.006;
      const still = now - lastMove > 260;

      if (alpha > 0.01) {
        for (let i = 0; i < DOTS; i++) {
          const d = dots[i];
          const angle = rotation + (i / DOTS) * Math.PI * 2;
          const tx = center.x + Math.cos(angle) * radius;
          const ty = center.y + Math.sin(angle) * radius;
          if (d.x < -9000) {
            d.x = tx;
            d.y = ty;
          }
          d.px = d.x;
          d.py = d.y;
          d.x += (tx - d.x) * d.ease;
          d.y += (ty - d.y) * d.ease;
          const vx = d.x - d.px;
          const vy = d.y - d.py;
          const speed = Math.hypot(vx, vy);
          d.r += ((still ? 1.95 : 1.4) - d.r) * 0.12;
          ctx.globalAlpha = alpha;
          if (speed > 0.9) {
            // En movimiento: la raya apunta hacia donde viene el punto.
            const length = Math.min(14, speed * 2.2);
            ctx.strokeStyle = `rgba(${rgb},0.85)`;
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - (vx / speed) * length, d.y - (vy / speed) * length);
            ctx.stroke();
          } else {
            ctx.fillStyle = `rgba(${rgb},0.85)`;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      frame = requestAnimationFrame(draw);
    };

    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, [avoidRef]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-50" />;
}
