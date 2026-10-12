import { useEffect, useRef } from 'react';

// ============================================================
// La esfera del Centro de ayuda: una esfera de polígonos (icosaedro
// subdividido, 80 caras) que gira despacio. Aristas en el azul de la app y
// caras del mismo azul, muy tenue; las caras de atrás solo se insinúan.
//
// Se pinta sin React en cada fotograma: los 80 polígonos se crean una vez y
// solo se les cambian los puntos. Con «reducir movimiento», queda quieta.
// ============================================================

type Vec = [number, number, number];

const normalize = ([x, y, z]: Vec): Vec => {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
};

/** Icosaedro subdividido una vez, sobre la esfera unidad. */
function buildMesh(): { vertices: Vec[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const vertices: Vec[] = (
    [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ] as Vec[]
  ).map(normalize);
  let faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const cache = new Map<string, number>();
  const middle = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const found = cache.get(key);
    if (found !== undefined) return found;
    const [p, q] = [vertices[a], vertices[b]];
    vertices.push(normalize([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]));
    cache.set(key, vertices.length - 1);
    return vertices.length - 1;
  };
  faces = faces.flatMap(([a, b, c]) => {
    const ab = middle(a, b);
    const bc = middle(b, c);
    const ca = middle(c, a);
    return [
      [a, ab, ca],
      [b, bc, ab],
      [c, ca, bc],
      [ab, bc, ca],
    ] as [number, number, number][];
  });
  return { vertices, faces };
}

const MESH = buildMesh();
const LIGHT = normalize([-0.45, 0.6, 0.65]);
const TILT = 0.38;
/** Radianes por milisegundo: una vuelta cada ~22 s. */
const SPEED = 0.000285;

export default function PolySphere({ size = 168, className }: { size?: number; className?: string }) {
  const group = useRef<SVGGElement>(null);

  useEffect(() => {
    const root = group.current;
    if (!root) return;
    const polygons = MESH.faces.map(() => {
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('stroke-linejoin', 'round');
      root.appendChild(polygon);
      return polygon;
    });
    const r = size / 2 - 2;
    const c = size / 2;
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    const draw = (angle: number) => {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rotated = MESH.vertices.map(([x, y, z]): Vec => {
        // Giro sobre el eje vertical y, luego, una leve inclinación hacia el usuario.
        const x1 = x * cosA + z * sinA;
        const z1 = -x * sinA + z * cosA;
        return [x1, y * cosT - z1 * sinT, y * sinT + z1 * cosT];
      });
      MESH.faces.forEach((face, index) => {
        const [a, b, d] = face.map((i) => rotated[i]);
        const centre: Vec = [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3];
        const front = centre[2] > 0;
        const polygon = polygons[index];
        polygon.setAttribute(
          'points',
          [a, b, d].map(([x, y]) => `${(c + x * r).toFixed(2)},${(c - y * r).toFixed(2)}`).join(' ')
        );
        // Por estilo y no por atributo: los atributos de SVG no resuelven var().
        if (front) {
          const light = Math.max(0, centre[0] * LIGHT[0] + centre[1] * LIGHT[1] + centre[2] * LIGHT[2]);
          polygon.style.fill = `hsl(var(--primary) / ${(0.05 + light * 0.13).toFixed(3)})`;
          polygon.style.stroke = 'hsl(var(--primary) / 0.85)';
          polygon.style.strokeWidth = '1.1';
        } else {
          polygon.style.fill = 'none';
          polygon.style.stroke = 'hsl(var(--primary) / 0.14)';
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
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g ref={group} />
    </svg>
  );
}
