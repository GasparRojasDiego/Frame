import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import AuthForm from '@/components/auth/AuthForm';
import type { UserProfile } from '@/types';
import { tr } from '@/lib/i18n';

// ============================================================
// Vincular la cuenta de quien entró como invitado.
//
// Es el MISMO recuadro de la pantalla de acceso (Google o correo y
// contraseña, para entrar o registrarse), dentro de un recuadro emergente.
// AuthForm, en modo `linkGuest`, deja la marca de «vinculación en curso»
// (guest-link.ts) justo antes de abrir la sesión: el controlador de la app
// suma entonces los datos del invitado a la cuenta, con su aviso de progreso,
// y lo termina aunque Frame se cierre a mitad. No se pierde nada.
// ============================================================

export default function GuestLinkDialog({
  open,
  onOpenChange,
  guest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: UserProfile;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-md">
        <DialogTitle className="sr-only">{tr('Vincular tu cuenta')}</DialogTitle>
        <DialogDescription className="sr-only">
          {tr('Entra con Google o con tu correo: todo lo que hiciste como invitado pasa a tu cuenta.')}
        </DialogDescription>
        {open && <AuthForm linkGuest={guest} />}
      </DialogContent>
    </Dialog>
  );
}
