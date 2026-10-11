import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setGuestLinkState, useGuestLinkState } from '@/lib/guest-link';

// ============================================================
// Aviso a pantalla completa mientras los datos del invitado pasan a su
// cuenta de Google. Tapa la app a propósito: durante esos segundos no debe
// crearse nada que luego no esté en ningún sitio.
// ============================================================

export default function GuestLinkOverlay() {
  const { phase, message, result } = useGuestLinkState();

  // El «listo» se retira solo.
  useEffect(() => {
    if (phase !== 'done') return;
    const timer = window.setTimeout(() => setGuestLinkState({ phase: 'idle' }), 6000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'idle') return null;

  const brought = result
    ? [
        result.records > 0 ? `${result.records} registros` : '',
        result.images > 0 ? `${result.images} imágenes` : '',
        result.recordings > 0 ? `${result.recordings} grabaciones` : '',
      ].filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="alertdialog" aria-live="assertive">
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-6 text-center shadow-2xl">
        {phase === 'done' ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        ) : phase === 'error' ? (
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        ) : (
          <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-primary" />
        )}

        <p className="text-lg font-bold text-foreground">
          {phase === 'merging' && 'Pasando tus datos a tu cuenta…'}
          {phase === 'uploading' && 'Guardando una copia en la nube…'}
          {phase === 'done' && '¡Listo! Tu cuenta ya tiene todo'}
          {phase === 'error' && 'La vinculación no terminó'}
        </p>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {(phase === 'merging' || phase === 'uploading') &&
            'Solo tarda unos segundos. No cierres Frame: tus datos de invitado siguen guardados en este equipo.'}
          {phase === 'done' &&
            (brought.length > 0
              ? `Se trajo a tu cuenta: ${brought.join(', ')}. Ya está respaldado en la nube.`
              : 'Tu cuenta de Google ya está vinculada y respaldada en la nube.')}
          {phase === 'error' &&
            `${message ? `${message} ` : ''}Tus datos de invitado siguen intactos en este equipo y Frame volverá a intentarlo solo la próxima vez que se abra.`}
        </p>

        {(phase === 'done' || phase === 'error') && (
          <Button className="w-full" onClick={() => setGuestLinkState({ phase: 'idle' })}>
            {phase === 'done' ? 'Continuar' : 'Entendido'}
          </Button>
        )}
      </div>
    </div>
  );
}
