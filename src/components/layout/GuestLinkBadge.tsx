import { useState } from 'react';
import GoogleGlyph from '@/components/auth/GoogleGlyph';
import GuestLinkDialog from '@/components/auth/GuestLinkDialog';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types';
import { tr } from '@/lib/i18n';

/**
 * Botón pequeño con la «G» de Google al borde derecho del perfil, solo para
 * quien está como invitado: abre el recuadro de acceso para vincular su
 * cuenta (Google o correo) sin perder nada. Sustituye a la franja «Estás como
 * invitado…».
 *
 * Ocupa el sitio del testigo de actualización: si hay una versión nueva, se
 * muestra aquel y este se oculta (lo decide SidebarContent). Va FUERA del
 * enlace a Ajustes, como hermano: así pulsarlo abre el recuadro y no navega.
 */
export default function GuestLinkBadge({ userProfile, collapsed = false }: { userProfile: UserProfile; collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!userProfile.isGuest || !isSupabaseConfigured) return null;

  return (
    <>
      <button
        type="button"
        aria-label={tr('Vincular tu cuenta (Google o correo)')}
        title={tr('Vincula tu cuenta para no perder tu progreso')}
        onClick={(event) => {
          // Por si algún día queda dentro de un enlace: nunca abrir Ajustes.
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background',
          'shadow-sm transition-colors hover:border-primary hover:bg-primary/10',
          collapsed && 'h-5 w-5'
        )}
      >
        <GoogleGlyph className={collapsed ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
      </button>
      <GuestLinkDialog open={open} onOpenChange={setOpen} guest={userProfile} />
    </>
  );
}
