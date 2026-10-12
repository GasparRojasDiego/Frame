import type { SVGProps } from 'react';

// ============================================================
// Icono del Centro de ayuda (1.6.5): dos estrellas de cuatro puntas de lados
// curvos, una grande y otra pequeña arriba a la derecha (como el símbolo de
// Gemini). Trazo y grosor de los iconos de lucide, para que conviva con el
// resto de la barra superior.
// ============================================================

/** Estrella de 4 puntas con lados cóncavos, centrada en (cx, cy) y radio r. */
const star = (cx: number, cy: number, r: number) => {
  const k = r * 0.08; // curvatura: cuánto se hunden los lados hacia el centro
  return [
    `M${cx} ${cy - r}`,
    `C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy}`,
    `C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r}`,
    `C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy}`,
    `C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}`,
    'Z',
  ].join(' ');
};

export default function TwinStarsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={star(10, 13.5, 8.5)} />
      <path d={star(18.5, 5.5, 3.5)} />
    </svg>
  );
}
