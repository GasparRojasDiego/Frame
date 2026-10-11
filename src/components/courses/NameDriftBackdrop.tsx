import { cn } from '@/lib/utils';

// ============================================================
// Fondo de la cabecera de una asignatura: su propio nombre, repetido muchas
// veces y casi transparente, derivando sin pausa de izquierda a derecha. Tres
// filas a distinto ritmo dan profundidad sin distraer del título de verdad.
// ============================================================

const ROWS: { seconds: number; size: string; opacity: string; offset: string }[] = [
  { seconds: 70, size: 'text-4xl', opacity: 'opacity-[0.07]', offset: '-ml-24' },
  { seconds: 95, size: 'text-5xl', opacity: 'opacity-[0.05]', offset: '-ml-4' },
  { seconds: 60, size: 'text-4xl', opacity: 'opacity-[0.07]', offset: '-ml-40' },
];

/** Copias por MITAD de pista: suficientes para cubrir un monitor ancho. */
const COPIES = 10;

export default function NameDriftBackdrop({ name, className }: { name: string; className?: string }) {
  const label = name.trim() || 'Asignatura';
  const half = Array.from({ length: COPIES }, (_, index) => index);

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 flex select-none flex-col justify-center gap-1 overflow-hidden', className)}
    >
      {ROWS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={cn('frame-name-drift flex w-max whitespace-nowrap font-headline font-black uppercase tracking-tight text-foreground', row.size, row.opacity, row.offset)}
          style={{ animation: `frame-name-drift ${row.seconds}s linear infinite` }}
        >
          {/* Dos mitades idénticas: el bucle no tiene costura. */}
          {[0, 1].map((halfIndex) => (
            <span key={halfIndex} className="flex shrink-0">
              {half.map((copy) => (
                <span key={copy} className="px-6">
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
