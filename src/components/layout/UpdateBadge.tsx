import { useSyncExternalStore } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUpdateState, openUpdateDialog, subscribeUpdate, type UpdateState } from '@/lib/updater';
import { tr } from '@/lib/i18n';

/**
 * Testigo de actualización, al borde derecho del botón "Perfil".
 *
 * Solo existe cuando hay una versión nueva publicada. Un clic abre el
 * recuadro de actualización (UpdateDialog), centrado: peso, tiempo estimado
 * y, al confirmar, el avance real paso a paso. Mientras se descarga, un anillo
 * alrededor del icono muestra el porcentaje aunque el recuadro esté cerrado.
 */

/** Estado del actualizador (vive fuera de React). */
export function useUpdateState(): UpdateState {
  return useSyncExternalStore(subscribeUpdate, getUpdateState, getUpdateState);
}

/** ¿Hay una versión nueva lista para instalar? (el testigo existe solo entonces) */
export function useUpdateAvailable(): boolean {
  const { phase, version } = useUpdateState();
  return !(phase === 'idle' || phase === 'checking' || !version);
}

/** Radio del anillo de avance, en unidades del viewBox (24). */
const RING_R = 10.5;
const RING_C = 2 * Math.PI * RING_R;

export default function UpdateBadge({ collapsed = false }: { collapsed?: boolean }) {
  const available = useUpdateAvailable();
  const { phase, version, progress } = useUpdateState();
  if (!available || !version) return null;

  const working = phase === 'downloading' || phase === 'verifying' || phase === 'installing';
  const downloading = phase === 'downloading' && progress !== null;
  const percent = progress !== null ? Math.round(progress * 100) : null;
  const icon = collapsed ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';

  return (
    <button
      type="button"
      onClick={openUpdateDialog}
      aria-label={tr('Actualizar Frame a la versión {version}', { version })}
      title={
        downloading
          ? `Descargando Frame ${version}: ${percent}%`
          : working
            ? tr('Actualizando…')
            : phase === 'ready'
              ? tr('Frame {version} lista para instalar', { version })
              : tr('Frame {version} disponible', { version })
      }
      className={cn(
        'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
        'bg-primary/15 text-primary transition-colors hover:bg-primary/30',
        'dark:text-white',
        collapsed && 'h-5 w-5'
      )}
    >
      {downloading ? (
        <>
          {/* Anillo con el avance real de la descarga. */}
          <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
            <circle cx="12" cy="12" r={RING_R} fill="none" strokeWidth="2" className="stroke-primary/25" />
            <circle
              cx="12"
              cy="12"
              r={RING_R}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - (progress ?? 0))}
            />
          </svg>
          <Download className={icon} />
        </>
      ) : working ? (
        <LoaderCircle className={cn('motion-safe:animate-spin', icon)} />
      ) : (
        <>
          <Download className={icon} />
          {/* Punto de aviso: se ve incluso con el menú contraído. */}
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </>
      )}
    </button>
  );
}
