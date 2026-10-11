import { useEffect, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  getUpdateState,
  installPendingUpdate,
  subscribeUpdate,
} from '@/lib/updater';

/**
 * Testigo de actualización, al borde derecho del botón "Perfil".
 *
 * Solo existe cuando hay una versión nueva publicada. Un clic abre un
 * recuadro mínimo con la versión y un único botón: pulsarlo descarga e
 * instala en silencio y la app vuelve sola ya actualizada.
 */
/** ¿Hay una versión nueva lista para instalar? (el testigo existe solo entonces) */
export function useUpdateAvailable(): boolean {
  const [, force] = useState(0);
  useEffect(() => subscribeUpdate(() => force((n) => n + 1)), []);
  const { phase, version } = getUpdateState();
  return !(phase === 'idle' || phase === 'checking' || !version);
}

export default function UpdateBadge({ collapsed = false }: { collapsed?: boolean }) {
  const available = useUpdateAvailable();
  const { phase, version, progress } = getUpdateState();
  if (!available || !version) return null;

  const working = phase === 'downloading' || phase === 'installing';
  const percent = progress !== null ? Math.round(progress * 100) : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // NADA de preventDefault: Radix descarta su propio manejador si el
          // evento llega con `defaultPrevented`, y el popover no abriría.
          aria-label={`Actualizar Frame a la versión ${version}`}
          data-tour="actualizar"
          title={working ? 'Actualizando…' : `Frame ${version} disponible`}
          className={cn(
            'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
            'bg-primary/15 text-primary transition-colors hover:bg-primary/30',
            'dark:text-white',
            collapsed && 'h-5 w-5'
          )}
        >
          {working ? (
            <LoaderCircle className={cn('animate-spin', collapsed ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')} />
          ) : (
            <>
              <Download className={cn(collapsed ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')} />
              {/* Punto de aviso: se ve incluso con el menú contraído. */}
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent side="right" align="end" className="w-64 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Frame {version} disponible</p>
          <p className="text-xs text-muted-foreground">
            {working
              ? 'No cierres Frame: se reiniciará solo al terminar.'
              : 'Se instala sola, sin asistentes. La app se reinicia y vuelve donde estabas.'}
          </p>
        </div>

        {working && percent !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        <Button
          className="w-full"
          disabled={working}
          onClick={() => void installPendingUpdate()}
        >
          {working ? (
            <>
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              {phase === 'installing' ? 'Instalando…' : `Descargando ${percent ?? 0}%`}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Actualizar ahora
            </>
          )}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
