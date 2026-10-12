import { useState } from 'react';
import { Link2, LoaderCircle, LogOut, Settings, ShieldAlert, Trash2 } from 'lucide-react';
import GuestLinkDialog from '@/components/auth/GuestLinkDialog';
import NotionImportDialog from '@/components/extensions/NotionImportDialog';
import { NotionLogo } from '@/components/extensions/ExtensionIcons';
import UsagePanelButton from '@/components/settings/UsagePanelCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { wipeLocalAccountData } from '@/lib/account';
import { markAccountDeletion } from '@/lib/account-deletion';
import { disconnectGoogle } from '@/lib/google/auth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { deleteRemoteAccount, signOut, type DeleteAccountMode } from '@/lib/supabase/auth';
import { pushToCloud } from '@/lib/supabase/sync';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types';

const CONFIRM_WORD = 'ELIMINAR';
const SUPPORT_EMAIL = 'vt.asvent@gmail.com';

const WHAT_IS_LOST = [
  'Asignaturas, tareas y todo el archivo histórico',
  'Recursos, notas y documentos adjuntos',
  'Sesiones de estudio, rendimiento diario y rachas',
  'Hábitos y eventos del calendario',
  'Grabaciones de voz guardadas en la aplicación',
  'Biblioteca de música, playlists y carátulas',
  'Imágenes de perfil, portadas y personalización',
];

type DeletePhase = 'confirm' | 'working' | 'done';

interface DeleteOutcome {
  mode: DeleteAccountMode;
  remoteError: string | null;
}

/**
 * Rueda de la cuenta (Ajustes) y su menú pequeño, anclado a ella: vincular
 * (solo invitados), cerrar sesión, importar de Notion, eliminar la cuenta y,
 * solo para el responsable de Frame, el panel de uso.
 *
 * Sustituye al antiguo recuadro «Ajustes de cuenta» (de ahí el nombre del
 * archivo): eran cuatro opciones metidas en un recuadro a pantalla completa.
 *
 * El menú NO es modal: así el recorrido «Descubrir» ve el clic en la rueda y
 * puede señalar sus botones con el menú ya abierto.
 *
 * Cierre de sesión con último respaldo; eliminación definitiva con
 * confirmación fuerte (casilla + palabra escrita). El flujo de borrado
 * termina SIEMPRE con una recarga dura de la ventana: si se desmontara
 * `MainApp` cambiando de estado, la limpieza del intervalo de sincronización
 * del layout volvería a subir un snapshot a la nube.
 */
export default function AccountMenu({ userProfile }: { userProfile: UserProfile | null }) {
  const { toast } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notionOpen, setNotionOpen] = useState(false);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [phase, setPhase] = useState<DeletePhase>('confirm');
  const [confirmText, setConfirmText] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [outcome, setOutcome] = useState<DeleteOutcome | null>(null);
  const [isWiping, setIsWiping] = useState(false);

  // Solo las cuentas de Supabase tienen identificador estable: en las sesiones
  // locales, cerrar sesión generaría un perfil nuevo y dejaría los datos
  // huérfanos, así que ahí no se ofrece la acción.
  const isCloud = !!userProfile && !userProfile.isGuest && isSupabaseConfigured;
  /** Invitado con servicio de cuentas disponible: puede vincular Google. */
  const canLink = !!userProfile && userProfile.isGuest && isSupabaseConfigured;
  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && understood;

  /** Cada opción cierra el menú antes de abrir lo suyo. */
  const pick = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  const openDeleteDialog = () => {
    setConfirmText('');
    setUnderstood(false);
    setOutcome(null);
    setPhase('confirm');
    setDeleteOpen(true);
  };

  const handleLogout = async () => {
    if (!userProfile) return;
    setIsLoggingOut(true);

    // Último respaldo antes de salir: el ciclo automático es de 60 s y, sin
    // esto, se perdería hasta un minuto de trabajo.
    if (isCloud) {
      try {
        await pushToCloud(userProfile.id);
      } catch {
        /* respaldo de cortesía: no debe impedir cerrar sesión */
      }
    }

    try {
      disconnectGoogle();
    } catch {
      /* revocar tokens locales es un extra */
    }
    try {
      await signOut();
    } catch {
      /* la sesión local se limpia igualmente */
    }

    // Sesión de INVITADO: se recuerda el perfil. «Entrar como invitado» lo
    // ofrece para retomarlo, y al entrar con una cuenta Frame ofrece sumar
    // sus datos (guest-migration); sin esto quedarían huérfanos.
    if (!isCloud) {
      try {
        localStorage.setItem('lastLocalProfile', JSON.stringify(userProfile));
      } catch {
        /* si no cabe, el borrado de sesión sigue adelante */
      }
    }

    // Ruta de perfiles locales: el layout escucha 'profileUpdated'.
    localStorage.removeItem('userProfile');
    window.dispatchEvent(new Event('profileUpdated'));
    setIsLoggingOut(false);
  };

  const handleDeleteAccount = async () => {
    if (!userProfile || !canDelete) return;
    setPhase('working');
    // Desde aquí el respaldo automático queda anulado: si no, su siguiente ciclo
    // volvería a subir a la nube lo que se está borrando.
    markAccountDeletion();

    try {
      let mode: DeleteAccountMode = 'data-only';
      let remoteError: string | null = null;

      if (isCloud) {
        const result = await deleteRemoteAccount(userProfile.id);
        mode = result.mode;
        remoteError = result.error;
      }

      if (remoteError) console.error('Borrado remoto parcial:', remoteError);
      // El cierre de sesión y la purga local se dejan para el botón final: al
      // cerrar sesión el layout devuelve a la pantalla de acceso y desmontaría
      // este menú, con lo que el usuario nunca vería el resultado.
      setOutcome({ mode, remoteError });
      setPhase('done');
    } catch (error) {
      console.error('No se pudo eliminar la cuenta:', error);
      setPhase('confirm');
      toast({
        variant: 'destructive',
        title: 'No se pudo eliminar la cuenta',
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const outcomeMessage = (): string => {
    if (!outcome) return '';
    if (outcome.remoteError) {
      return `Se eliminó todo lo guardado en este dispositivo, pero el borrado en la nube quedó incompleto. Escribe a ${SUPPORT_EMAIL} para terminarlo.`;
    }
    if (!isCloud) {
      return 'Se eliminó todo lo que la aplicación guardaba en este dispositivo. No había ningún dato en la nube.';
    }
    if (outcome.mode === 'full') {
      return 'Tu cuenta y todos tus datos se eliminaron por completo, aquí y en la nube.';
    }
    return `Se eliminaron todos tus datos, aquí y en la nube, y se cerró tu sesión. Tu correo sigue registrado como cuenta de acceso: si quieres retirarlo también, escribe a ${SUPPORT_EMAIL}.`;
  };

  const deleteTitle = isCloud ? 'Eliminar cuenta permanentemente' : 'Eliminar todos mis datos';

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          {/* Cerrada, discreta como los botones del tema; con el menú abierto,
              sólida (como el botón activo de la barra superior). */}
          <Button
            variant={menuOpen ? 'default' : 'ghost'}
            size="icon"
            title="Cerrar sesión, importar de Notion y eliminar cuenta"
            data-tour="cuenta-rueda"
            aria-label="Opciones de la cuenta"
            className={cn(
              'h-9 w-9 rounded-md border',
              menuOpen
                ? 'border-primary'
                : 'border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-primary'
            )}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-56 p-2" data-tour="cuenta-menu">
          <div className="flex flex-col gap-1.5">
            {canLink && (
              <>
                <Button
                  variant="fantasma"
                  size="sm"
                  className="w-full justify-start"
                  onClick={pick(() => setLinkOpen(true))}
                  title="Pasa tus datos de invitado a una cuenta y quedan respaldados en la nube"
                  data-tour="vincular-cuenta"
                >
                  <Link2 className="h-4 w-4" />
                  Vincular mi cuenta
                </Button>
                <div role="separator" className="mx-2 my-0.5 h-px bg-border/70" />
              </>
            )}

            <Button
              variant="fantasma"
              size="sm"
              className="w-full justify-start"
              onClick={pick(() => setLogoutOpen(true))}
              data-tour="cerrar-sesion"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>

            <Button
              variant="fantasma"
              size="sm"
              className="w-full justify-start"
              onClick={pick(() => setNotionOpen(true))}
              title="Tus tareas y fechas de una base de datos de Notion"
              data-tour="importar-notion"
            >
              <NotionLogo className="h-4 w-4" />
              Importar de Notion
            </Button>

            <Button
              variant="gris"
              size="sm"
              className="w-full justify-start"
              onClick={pick(openDeleteDialog)}
              data-tour="eliminar-cuenta"
              disabled={!userProfile}
            >
              <Trash2 className="h-4 w-4" />
              {isCloud ? 'Eliminar cuenta' : 'Eliminar mis datos'}
            </Button>

            <UsagePanelButton userProfile={userProfile} onOpen={() => setMenuOpen(false)} />
          </div>
        </PopoverContent>
      </Popover>

      {userProfile && canLink && <GuestLinkDialog open={linkOpen} onOpenChange={setLinkOpen} guest={userProfile} />}

      <NotionImportDialog open={notionOpen} onOpenChange={setNotionOpen} />

      {/* --- Cerrar sesión --- */}
      <AlertDialog open={logoutOpen} onOpenChange={(open) => !isLoggingOut && setLogoutOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCloud
                ? 'Se cerrará tu sesión en este dispositivo y volverás a la pantalla de acceso. Antes de salir se guarda un último respaldo, así que tus datos sincronizados se conservan intactos.'
                : 'Tu sesión es de invitado. Tus datos NO se borran: se quedan en este equipo y vuelves a ellos pulsando «Entrar como invitado». Para no depender de este equipo, mejor vincula antes tu cuenta (en esta misma rueda, «Vincular mi cuenta»): tus datos pasan a tu cuenta y quedan respaldados en la nube.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isLoggingOut}
              onClick={(e) => {
                e.preventDefault();
                void handleLogout();
              }}
            >
              {isLoggingOut && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Eliminar cuenta --- */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          // Durante y después del borrado el cierre solo ocurre por el botón.
          if (!open && phase === 'confirm') setDeleteOpen(false);
        }}
      >
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          {phase === 'done' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isCloud && outcome?.mode === 'full' && !outcome.remoteError
                    ? 'Cuenta eliminada'
                    : 'Datos eliminados'}
                </AlertDialogTitle>
                <AlertDialogDescription>{outcomeMessage()}</AlertDialogDescription>
              </AlertDialogHeader>
              <p className="text-xs text-muted-foreground">
                Los archivos que ya hubieras guardado por tu cuenta en carpetas del equipo (audios
                exportados, música copiada) siguen donde los dejaste.
              </p>
              <AlertDialogFooter>
                <AlertDialogAction
                  disabled={isWiping}
                  onClick={async (event) => {
                    event.preventDefault();
                    setIsWiping(true);
                    try {
                      await signOut();
                    } catch {
                      /* la sesión ya puede estar invalidada en el servidor */
                    }
                    await wipeLocalAccountData(userProfile?.id);
                    // Recarga dura: cualquier desmontaje de React dispararía el
                    // respaldo automático del layout y resucitaría los datos.
                    window.location.reload();
                  }}
                >
                  {isWiping && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                  Volver a la pantalla de acceso
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">{deleteTitle}</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>Se eliminará de forma definitiva:</p>
                    <ul className="list-inside list-disc space-y-1 text-xs">
                      {WHAT_IS_LOST.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                      {isCloud && <li>Tu respaldo y tus métricas en la nube</li>}
                    </ul>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-xs font-semibold text-destructive">
                  Esta acción es irreversible. Frame no puede recuperar nada después.
                </p>
              </div>

              <div role="separator" className="mx-8 h-px bg-border/70" />

              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="confirmar-borrado-cuenta"
                    checked={understood}
                    disabled={phase === 'working'}
                    onCheckedChange={(value) => setUnderstood(value === true)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="confirmar-borrado-cuenta"
                    className="text-xs font-normal leading-snug text-muted-foreground"
                  >
                    Entiendo que perderé todos mis datos y que no hay vuelta atrás.
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="palabra-confirmacion" className="text-xs">
                    Escribe <span className="font-bold text-destructive">{CONFIRM_WORD}</span> para
                    confirmar
                  </Label>
                  <Input
                    id="palabra-confirmacion"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_WORD}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={phase === 'working'}
                  />
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={phase === 'working'}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={!canDelete || phase === 'working'}
                  onClick={(e) => {
                    // Radix cierra el diálogo al hacer clic: hay que impedirlo
                    // para conservar el estado de carga durante el proceso.
                    e.preventDefault();
                    void handleDeleteAccount();
                  }}
                >
                  {phase === 'working' && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                  {phase === 'working' ? 'Eliminando…' : 'Eliminar definitivamente'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
