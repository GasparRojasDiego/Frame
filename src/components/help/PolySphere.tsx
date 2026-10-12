import { useEffect, useRef } from 'react';

// ============================================================
// La figura del Centro de ayuda: un dodecaedro (12 pentágonos) que gira
// despacio de lado. (1.6.3: esfera de triángulos · 1.6.4: dodecaedro ·
// 1.6.5: balón de fútbol · 1.6.6: vuelve el dodecaedro, a pedido de Diego.)
//
// Encuadre (1.6.6): por el CENTRO EXACTO del cuadrado pasa un VÉRTICE, no
// una cara. El dodecaedro gira sobre su eje de 5 caras (vertical) inclinado
// hacia el usuario el ángulo justo para que los vértices de la banda central
// —a 10,8° de latitud— pasen por el centro al girar: una inclinación pequeña,
// dentro de los 10–20° pedidos. Arranca con uno de esos vértices en el centro.
//
// Se pinta sin React en cada fotograma: los 12 polígonos se crean una vez y
// solo se les cambian los puntos. Con «reducir movimiento», queda quieta.
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

/** Gira `v` para que el eje `from` (unitario) quede en +y. */
function alignToY(v: Vec, from: Vec): Vec {
  const to: Vec = [0, 1, 0];
  const axis = cross(from, to);
  const sin = Math.hypot(...axis);
  const cos = dot(from, to);
  if (sin < 1e-9) return cos > 0 ? v : [v[0], -v[1], -v[2]];
  const k = normalize(axis);
  // Rodrigues.
  const kv = cross(k, v);
  const kdv = dot(k, v);
  return [0, 1, 2].map((i) => v[i] * cos + kv[i] * sin + k[i] * kdv * (1 - cos)) as Vec;
}

/**
 * Dodecaedro como dual del icosaedro: sus 20 vértices son los centros de las
 * caras del icosaedro, y cada una de sus 12 caras rodea un vértice del
 * icosaedro. Se orienta con el eje de una cara en vertical.
 */
function buildMesh(): { faces: Vec[][]; tilt: number; phase: number } {
  const t = (1 + Math.sqrt(5)) / 2;
  const ico: Vec[] = (
    [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ] as Vec[]
  ).map(normalize);
  const tris: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const axis = ico[0];
  const vertices = tris.map(([a, b, c]) => alignToY(normalize(add(add(ico[a], ico[b]), ico[c])), axis));
  const centres = ico.map((v) => alignToY(v, axis));

  const faces = centres.map((centre, index) => {
    const around = tris.flatMap((tri, i) => (tri.includes(index) ? [vertices[i]] : []));
    const u = normalize(sub(around[0], centre.map((v) => v * dot(around[0], centre)) as Vec));
    const w = cross(centre, u);
    around.sort((p, q) => Math.atan2(dot(p, w), dot(p, u)) - Math.atan2(dot(q, w), dot(q, u)));
    return around;
  });

  // Vértice de la banda central (latitud positiva más pequeña, ≈10,8°).
  const band = vertices.filter((v) => v[1] > 1e-6).sort((a, b) => a[1] - b[1])[0];
  const tilt = Math.asin(band[1]);
  const phase = Math.atan2(-band[0], band[2]);
  return { faces, tilt, phase };
}

const { faces: MESH, tilt: TILT, phase: PHASE } = buildMesh();
const LIGHT = normalize([-0.45, 0.6, 0.65]);
/** Radianes por milisegundo: una vuelta cada ~22 s. */
const SPEED = 0.000285;

export default function PolySphere({ size = 168, className }: { size?: number; className?: string }) {
  const group = useRef<SVGGElement>(null);

  useEffect(() => {
    const root = group.current;
    if (!root) return;
    const polygons = MESH.map(() => {
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('stroke-linejoin', 'round');
      root.appendChild(polygon);
      return polygon;
    });
    const r = size / 2 - 3;
    const c = size / 2;
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    const rotate = ([x, y, z]: Vec, cosA: number, sinA: number): Vec => {
      // Giro de lado (eje vertical) y la inclinación hacia el usuario.
      const x1 = x * cosA + z * sinA;
      const z1 = -x * sinA + z * cosA;
      return [x1, y * cosT - z1 * sinT, y * sinT + z1 * cosT];
    };

    const draw = (angle: number) => {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      MESH.forEach((face, index) => {
        const points = face.map((vertex) => rotate(vertex, cosA, sinA));
        const centre = normalize(points.reduce(add, [0, 0, 0] as Vec));
        const front = centre[2] > 0;
        const polygon = polygons[index];
        polygon.setAttribute('points', points.map(([x, y]) => `${(c + x * r).toFixed(2)},${(c - y * r).toFixed(2)}`).join(' '));
        // Por estilo y no por atributo: los atributos de SVG no resuelven var().
        if (front) {
          const light = Math.max(0, dot(centre, LIGHT));
          polygon.style.fill = `hsl(var(--primary) / ${(0.06 + light * 0.14).toFixed(3)})`;
          polygon.style.stroke = 'hsl(var(--primary) / 0.9)';
          polygon.style.strokeWidth = '1.25';
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
      draw(PHASE);
      return () => polygons.forEach((polygon) => polygon.remove());
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      draw(PHASE + (now - start) * SPEED);
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
