import type React from 'react';
import { cn } from '@/lib/utils';

// ============================================================
// Eco de una palabra detrás de un título.
//
// La palabra, en mayúsculas, repetida muchas veces y casi transparente,
// deriva sin pausa de un lado a otro en dos filas a distinto ritmo. Da vida
// a las cabeceras de los recuadros que, con un título corto, quedaban
// vacías («Nueva playlist», «Crear»…). Es el mismo recurso que el nombre de
// cada asignatura a la espalda de su cabecera, a escala de recuadro.
//
// Se coloca dentro de un contenedor con `relative` y `overflow-hidden`; el
// título de verdad va encima con `relative`.
// ============================================================

/** Copias por mitad de pista: de sobra para el ancho de un recuadro. */
const COPIES = 8;

const ROWS: { seconds: number; reverse: boolean; size: string; opacity: string }[] = [
  { seconds: 38, reverse: false, size: 'text-3xl', opacity: 'opacity-[0.045]' },
  { seconds: 52, reverse: true, size: 'text-4xl', opacity: 'opacity-[0.03]' },
];

export default function EchoWord({ word, className }: { word: string; className?: string }) {
  const label = word.trim().toUpperCase();
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
            row.size,
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
