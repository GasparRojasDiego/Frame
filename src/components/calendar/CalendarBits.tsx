import type React from 'react';
import { ArrowLeft, Ban } from 'lucide-react';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EchoWord from '@/components/shared/EchoWord';
import { cn } from '@/lib/utils';
import { eventTextClass } from '@/lib/calendar-events';
import { capitalize } from './calendar-model';

// ============================================================
// Piezas visuales que comparten la cuadrícula, la barra de selección y el
// recuadro del calendario LOCAL: tintes por tema, muestras de color, la
// cabecera de recuadro con la flecha de «Atrás» y las etiquetas de sección.
// ============================================================

/**
 * Los colores de la paleta son pasteles pensados para el tema claro. En el
 * oscuro, un pastel opaco deslumbra y se come el texto blanco, así que se
 * mezcla con el fondo: el mismo dato, legible en los dos temas. El color va
 * en la variable `--tint` (ver `tintVar`).
 */
export const tintVar = (color: string): React.CSSProperties =>
  ({ '--tint': color }) as React.CSSProperties;

/** Barras de evento: el color tal cual en claro, a un tercio en oscuro. */
export const EVENT_TINT =
  '[background-color:var(--tint)] dark:[background-color:color-mix(in_srgb,var(--tint)_34%,transparent)]';

/** Casillas pintadas: un punto por debajo de las barras, para que estas
 *  sigan destacando encima de un día con color. */
export const PAINT_TINT =
  '[background-color:color-mix(in_srgb,var(--tint)_66%,transparent)] dark:[background-color:color-mix(in_srgb,var(--tint)_22%,transparent)]';

/** Texto legible sobre una barra de evento en cualquier tema. */
export const eventInk = (color: string): string => cn(eventTextClass(color), 'dark:text-foreground');

/** Muestra redonda de color (casillas o eventos). */
export function Swatch({
  color,
  name,
  active,
  onClick,
  tint = PAINT_TINT,
  size = 'md',
}: {
  color: string;
  name: string;
  active?: boolean;
  onClick: () => void;
  tint?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Color ${name}`}
      aria-pressed={active}
      title={capitalize(name)}
      className={cn(
        'relative shrink-0 rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:scale-100',
        size === 'sm' ? 'h-5 w-5' : 'h-6 w-6',
        active && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
      )}
      style={tintVar(color)}
    >
      <span className={cn('absolute inset-0 rounded-full border border-black/10 dark:border-white/15', tint)} />
    </button>
  );
}

/** «Sin color»: círculo punteado y tachado, a juego con las muestras. */
export function NoColorSwatch({
  active,
  onClick,
  size = 'md',
  label = 'Quitar el color',
}: {
  active?: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        size === 'sm' ? 'h-5 w-5' : 'h-6 w-6',
        active && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
      )}
    >
      <Ban className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    </button>
  );
}

/**
 * Cabecera de un recuadro del calendario: la palabra de fondo (EchoWord), la
 * flecha de «Atrás» en la esquina superior izquierda —espejo de la X de
 * cerrar— y la línea de cierre con margen a los dos lados. Sin degradado
 * (1.6.7, Diego).
 */
export function PanelHeader({
  word,
  title,
  subtitle,
  onBack,
}: {
  word: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="relative -mx-6 -mt-6 overflow-hidden rounded-t-lg px-12 pb-4 pt-6">
      <EchoWord word={word} />
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Atrás"
          title="Atrás"
          className="absolute left-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <DialogHeader className="relative space-y-1 text-center sm:text-center">
        <DialogTitle className="text-xl font-bold text-primary">{title}</DialogTitle>
        {subtitle ? (
          <DialogDescription className="text-xs">{subtitle}</DialogDescription>
        ) : null}
      </DialogHeader>
      <span aria-hidden className="absolute inset-x-6 bottom-0 h-px bg-border" />
    </div>
  );
}

/** Etiqueta de sección centrada en su línea fina (1.6.7): «—— Cuándo ——». */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-bold text-muted-foreground">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
