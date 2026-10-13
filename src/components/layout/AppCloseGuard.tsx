import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { PauseCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useActiveSessionSeconds, useCourse } from '@/context/CourseContext';
import { useRouter } from '@/lib/navigation';
import { formatHMS } from '@/lib/duration';
import { tr } from '@/lib/i18n';

/**
 * Despedida de Frame.
 *
 * Cerrar la app la cierra de verdad: no queda nada corriendo en la bandeja.
 * Lo único que se interpone es una sesión de estudio en curso, porque salir
 * sin más tiraría el tiempo estudiado. En ese caso se pregunta, y el usuario
 * decide entre aparcarla (y retomarla al volver), registrarla ya o quedarse.
 *
 * Rust manda `main-close-requested` y espera; si la interfaz no contestara,
 * una segunda pulsación de la X cierra igualmente.
 */
export default function AppCloseGuard() {
  const { suspendActiveSession, requestFinish } = useCourse();
  const activeSessionSeconds = useActiveSessionSeconds();
  const router = useRouter();
  const [askOpen, setAskOpen] = useState(false);

  const quit = useCallback(() => {
    void invoke('quit_app').catch(() => window.close());
  }, []);

  // `activeSessionSeconds` cambia CADA SEGUNDO con el temporizador en marcha.
  // Si el efecto dependiera de él, la suscripción se destruiría y recrearía a
  // ese ritmo, y un evento de cierre que cayera en el hueco se perdería. Se
  // registra una sola vez y el valor se consulta por referencia.
  const secondsRef = useRef(activeSessionSeconds);
  secondsRef.current = activeSessionSeconds;

  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen('main-close-requested', () => {
      if (secondsRef.current > 0) setAskOpen(true);
      else quit();
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [quit]);

  const handleSuspend = () => {
    suspendActiveSession();
    quit();
  };

  const handleRegisterNow = () => {
    setAskOpen(false);
    void invoke('cancel_quit').catch(() => {});
    router.push('/temporizador');
    requestFinish();
  };

  const handleStay = () => {
    setAskOpen(false);
    void invoke('cancel_quit').catch(() => {});
  };

  return (
    <AlertDialog open={askOpen} onOpenChange={(open) => !open && handleStay()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="items-center text-center">
          <span className="mb-1 rounded-full bg-primary/15 p-3">
            <PauseCircle className="h-7 w-7 text-primary" />
          </span>
          <AlertDialogTitle>{tr('Tienes una sesión de estudio en curso')}</AlertDialogTitle>
          <AlertDialogDescription>
            {tr('Llevas')}{' '}
            <span className="font-semibold tabular-nums text-primary">
              {formatHMS(activeSessionSeconds)}
            </span>{' '}
            {tr('estudiando. Si cierras Frame ahora, ese tiempo se pierde salvo que lo dejes en suspenso o lo registres.')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleSuspend}>{tr('Pausar la sesión y cerrar')}</Button>
          <Button variant="outline" onClick={handleRegisterNow}>
            {tr('Registrar la sesión ahora')}
          </Button>
          <Button variant="ghost" onClick={handleStay}>
            {tr('Seguir estudiando')}
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          {tr('Si la suspendes, al volver a abrir Frame hoy podrás retomarla justo donde la dejaste, registrarla o descartarla.')}
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
}
