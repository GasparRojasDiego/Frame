import type React from 'react';
import { cn } from '@/lib/utils';

// ============================================================
// Eco de una palabra detrás de un título.
//
// La palabra (con mayúscula inicial: sin mayúsculas sostenidas desde la
// 1.6.6), repetida muchas veces y casi transparente, deriva sin pausa de un lado a otro en dos filas a distinto ritmo. Da vida
// a las cabeceras de los recuadros que, con un título corto, quedaban
// vacías («Nueva playlist», «Crear»…). Es el mismo recurso que el nombre de
// cada asignatura a la espalda de su cabecera, a escala de recuadro.
//
// Se coloca dentro de un contenedor con `relative` y `overflow-hidden`; el
// título de verdad va encima con `relative`.
// ============================================================

/** Copias por mitad de pista: de sobra para el ancho de un recuadro. */
const COPIES = 8;

const ROWS: { seconds: number; reverse: boolean; size: string; small: string; opacity: string }[] = [
  { seconds: 38, reverse: false, size: 'text-3xl', small: 'text-xl', opacity: 'opacity-[0.045]' },
  { seconds: 52, reverse: true, size: 'text-4xl', small: 'text-2xl', opacity: 'opacity-[0.03]' },
];

export default function EchoWord({
  word,
  className,
  small = false,
}: {
  word: string;
  className?: string;
  /** Letra más pequeña, para las cabeceras bajas de los recuadros propios. */
  small?: boolean;
}) {
  const trimmed = word.trim();
  const label = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const copies = Array.from({ length: COPIES }, (_, index) => index);

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 flex select-none flex-col justify-center overflow-hidden',
        className,
      )}
    >
      {ROWS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            'frame-name-drift flex w-max whitespace-nowrap font-headline font-black leading-none tracking-tight text-primary',
            small ? row.small : row.size,
            row.opacity,
          )}
          style={{
            animation: `frame-name-drift ${row.seconds}s linear infinite`,
            animationDirection: row.reverse ? 'reverse' : 'normal',
          }}
        >
          {/* Dos mitades idénticas: el bucle no tiene costura. */}
          {[0, 1].map((half) => (
            <span key={half} className="flex shrink-0">
              {copies.map((copy) => (
                <span key={copy} className="px-4">
                  {label}
                </span>
              ))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Cabecera de recuadro con eco: se pone dentro de `DialogContent`, con su
 * `DialogHeader` dentro. El eco ocupa todo el ancho del recuadro (anula su
 * relleno) y la cabecera cierra con una divisoria fina que deja aire a ambos
 * lados (`mx-6`), no de borde a borde. La línea ocupa el mismo píxel que el
 * borde inferior de antes: la altura de la cabecera no cambia.
 */
export function EchoHeader({
  word,
  children,
  className,
}: {
  word: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('-mx-6 -mt-6 mb-2', className)}>
      <div className="relative overflow-hidden px-6 pb-4 pt-6">
        <EchoWord word={word} />
        <div className="relative">{children}</div>
      </div>
      <div aria-hidden className="mx-6 h-px bg-border" />
    </div>
  );
}

/** Relleno de cada recuadro propio: la cabecera lo anula para ir de borde a borde. */
const TILE_PAD = {
  '3': { box: '-mx-3 -mt-3 px-3 pt-3', line: 'inset-x-3' },
  '3.5': { box: '-mx-3.5 -mt-3.5 px-3.5 pt-3.5', line: 'inset-x-3.5' },
  '4': { box: '-mx-4 -mt-4 px-4 pt-4', line: 'inset-x-4' },
  '5': { box: '-mx-5 -mt-5 px-5 pt-5', line: 'inset-x-5' },
} as const;

/**
 * Cabecera de un recuadro propio (sin `CardHeader`; 1.6.6, Diego: «todo
 * recuadro que tenga encabezado»): el eco queda confinado a la cabecera y la
 * cierra una divisoria fina con aire a los lados. Va como primer hijo del
 * recuadro; `pad` es el relleno de ese recuadro.
 */
export function EchoTileHeader({
  word,
  pad = '4',
  children,
  className,
}: {
  word: string;
  pad?: keyof typeof TILE_PAD;
  children: React.ReactNode;
  className?: string;
}) {
  const { box, line } = TILE_PAD[pad];
  return (
    <div className={cn('relative isolate shrink-0 self-stretch overflow-hidden pb-2.5', box, className)}>
      <EchoWord word={word} small className="-z-10" />
      {children}
      <div aria-hidden className={cn('absolute bottom-0 h-px bg-border', line)} />
    </div>
  );
}
