import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setGuestLinkState, useGuestLinkState } from '@/lib/guest-link';
import { tr } from '@/lib/i18n';

// ============================================================
// Aviso a pantalla completa mientras los datos del invitado pasan a su
// cuenta de Google. Tapa la app a propósito: durante esos segundos no debe
// crearse nada que luego no esté en ningún sitio.
// ============================================================

export default function GuestLinkOverlay() {
  const { phase, message, result, answer } = useGuestLinkState();

  // El «listo» se retira solo.
  useEffect(() => {
    if (phase !== 'done') return;
    const timer = window.setTimeout(() => setGuestLinkState({ phase: 'idle' }), 6000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'idle') return null;

  // Recién entrado con Google y con datos de invitado en este equipo.
  if (phase === 'ask') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
        <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-6 text-center shadow-2xl">
          <UserPlus className="mx-auto h-10 w-10 text-primary" />
          <p className="text-lg font-bold text-foreground">{tr('¿Sumar tus datos de invitado a tu cuenta?')}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {message
              ? tr('En este equipo usaste Frame como invitado («{name}») y hay datos guardados: asignaturas, tareas, sesiones, anotaciones, grabaciones o el calendario.', { name: message })
              : tr('En este equipo usaste Frame como invitado y hay datos guardados: asignaturas, tareas, sesiones, anotaciones, grabaciones o el calendario.')}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tr('Se suman sin borrar nada de lo que tu cuenta ya tenía y quedan respaldados en la nube. Si prefieres no hacerlo, los datos de invitado tampoco se borran.')}
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <Button className="w-full" onClick={() => answer?.(true)}>
              {tr('Sumar a mi cuenta')}
            </Button>
            <Button variant="gris" className="w-full" onClick={() => answer?.(false)}>
              {tr('Dejar mi cuenta como está')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const brought = result
    ? [
        result.records > 0 ? tr('{records} registros', { records: result.records }) : '',
        result.images > 0 ? tr('{images} imágenes', { images: result.images }) : '',
        result.recordings > 0 ? tr('{recordings} grabaciones', { recordings: result.recordings }) : '',
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
          {phase === 'merging' && tr('Pasando tus datos a tu cuenta…')}
          {phase === 'uploading' && tr('Guardando una copia en la nube…')}
          {phase === 'done' && tr('¡Listo! Tu cuenta ya tiene todo')}
          {phase === 'error' && tr('La vinculación no terminó')}
        </p>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {(phase === 'merging' || phase === 'uploading') &&
            tr('Solo tarda unos segundos. No cierres Frame: tus datos de invitado siguen guardados en este equipo.')}
          {phase === 'done' &&
            (brought.length > 0
              ? tr('Se trajo a tu cuenta: {p}. Ya está respaldado en la nube.', { p: brought.join(', ') })
              : tr('Tu cuenta de Google ya está vinculada y respaldada en la nube.'))}
          {phase === 'error' &&
            tr('{p}Tus datos de invitado siguen intactos en este equipo y Frame volverá a intentarlo solo la próxima vez que se abra.', { p: message ? `${message} ` : '' })}
        </p>

        {(phase === 'done' || phase === 'error') && (
          <Button className="w-full" onClick={() => setGuestLinkState({ phase: 'idle' })}>
            {phase === 'done' ? tr('Continuar') : tr('Entendido')}
          </Button>
        )}
      </div>
    </div>
  );
}
