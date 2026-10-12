import { useEffect, useRef } from 'react';

// ============================================================
// La figura del Centro de ayuda: un icosaedro truncado, como un balón de
// fútbol (12 pentágonos y 20 hexágonos, desde la 1.6.5; antes un dodecaedro
// y, en la 1.6.3, una esfera de triángulos) que gira despacio. Aristas en el
// azul de la app y caras del mismo azul, tenue; las de atrás solo se insinúan.
//
// Se pinta sin React en cada fotograma: los 32 polígonos se crean una vez y
// solo se les cambian los puntos. Con «reducir movimiento», queda quieta.
// `pulse` cambia con cada tecla: la figura se encoge y se agranda un poco.
// ============================================================

type Vec = [number, number, number];

const normalize = ([x, y, z]: Vec): Vec => {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
};
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Icosaedro truncado (el balón de fútbol, desde la 1.6.5): se corta cada
 * vértice del icosaedro a un tercio de sus aristas. Cada vértice deja un
 * pentágono (los 5 puntos de corte a su alrededor) y cada cara triangular,
 * un hexágono (2 puntos por arista). 12 pentágonos y 20 hexágonos; los 60
 * vértices quedan a la misma distancia del centro.
 */
interface Face {
  points: Vec[];
  pentagon: boolean;
}

function buildMesh(): Face[] {
  const t = (1 + Math.sqrt(5)) / 2;
  const ico: Vec[] = (
    [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ] as Vec[]
  ).map(normalize);
  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  /** Punto de corte cerca de `a` sobre la arista a→b. */
  const cut = (a: number, b: number): Vec => add(ico[a], sub(ico[b], ico[a]).map((v) => v / 3) as Vec);
  const radius = Math.hypot(...cut(0, 1));
  const unit = (v: Vec): Vec => v.map((c) => c / radius) as Vec;

  const hexagons: Face[] = faces.map(([a, b, c]) => ({
    points: [cut(a, b), cut(b, a), cut(b, c), cut(c, b), cut(c, a), cut(a, c)].map(unit),
    pentagon: false,
  }));

  const pentagons: Face[] = ico.map((vertex, index) => {
    const neighbours = new Set<number>();
    for (const face of faces) if (face.includes(index)) face.forEach((v) => v !== index && neighbours.add(v));
    const around = [...neighbours].map((n) => unit(cut(index, n)));
    // Base del plano tangente para ordenar los 5 puntos por ángulo.
    const u = normalize(sub(around[0], vertex.map((v) => v * dot(around[0], vertex)) as Vec));
    const w = cross(vertex, u);
    around.sort((p, q) => Math.atan2(dot(p, w), dot(p, u)) - Math.atan2(dot(q, w), dot(q, u)));
    return { points: around, pentagon: true };
  });

  return [...pentagons, ...hexagons];
}

const MESH = buildMesh();
const LIGHT = normalize([-0.45, 0.6, 0.65]);
const TILT = 0.38;
/** Radianes por milisegundo: una vuelta cada ~22 s. */
const SPEED = 0.000285;
const SCALE = 1;

export default function PolySphere({
  size = 168,
  pulse = 0,
  className,
}: {
  size?: number;
  /** Cambia con cada tecla escrita: la figura «respira». */
  pulse?: number;
  className?: string;
}) {
  const group = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!pulse || !svg.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    svg.current.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
      { duration: 460, easing: 'ease-out' }
    );
  }, [pulse]);

  useEffect(() => {
    const root = group.current;
    if (!root) return;
    const polygons = MESH.map(() => {
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('stroke-linejoin', 'round');
      root.appendChild(polygon);
      return polygon;
    });
    const r = (size / 2 - 3) / SCALE;
    const c = size / 2;
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    const rotate = ([x, y, z]: Vec, cosA: number, sinA: number): Vec => {
      // Giro sobre el eje vertical y, luego, una leve inclinación hacia el usuario.
      const x1 = x * cosA + z * sinA;
      const z1 = -x * sinA + z * cosA;
      return [x1 * SCALE, (y * cosT - z1 * sinT) * SCALE, (y * sinT + z1 * cosT) * SCALE];
    };

    const draw = (angle: number) => {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      MESH.forEach((face, index) => {
        const points = face.points.map((vertex) => rotate(vertex, cosA, sinA));
        const centre = normalize(points.reduce(add, [0, 0, 0] as Vec));
        const front = centre[2] > 0;
        const polygon = polygons[index];
        polygon.setAttribute('points', points.map(([x, y]) => `${(c + x * r).toFixed(2)},${(c - y * r).toFixed(2)}`).join(' '));
        // Por estilo y no por atributo: los atributos de SVG no resuelven var().
        if (front) {
          const light = Math.max(0, dot(centre, LIGHT));
          // Los pentágonos, algo más llenos: el dibujo del balón.
          const base = face.pentagon ? 0.16 : 0.04;
          polygon.style.fill = `hsl(var(--primary) / ${(base + light * 0.12).toFixed(3)})`;
          polygon.style.stroke = 'hsl(var(--primary) / 0.9)';
          polygon.style.strokeWidth = '1.15';
        } else {
          polygon.style.fill = 'none';
          polygon.style.stroke = 'hsl(var(--primary) / 0.16)';
          polygon.style.strokeWidth = '0.8';
        }
        // Las de atrás, debajo: el orden del DOM es el orden de pintado.
        if (!front && polygon !== root.firstChild) root.insertBefore(polygon, root.firstChild);
      });
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(0.6);
      return () => polygons.forEach((polygon) => polygon.remove());
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      draw(0.6 + (now - start) * SPEED);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      polygons.forEach((polygon) => polygon.remove());
    };
  }, [size]);

  return (
    <svg
      ref={svg}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ transformOrigin: 'center' }}
      aria-hidden="true"
      focusable="false"
    >
      <g ref={group} />
    </svg>
  );
}
