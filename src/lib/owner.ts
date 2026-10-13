import type { UserProfile } from '@/types';

// ============================================================
// Quién es el responsable de Frame.
//
// El panel de uso (interfaz «Uso») solo tiene sentido para quien mantiene la
// app. La comprobación de verdad la hace Supabase con el correo del JWT
// (función `is_frame_owner`); esta es solo la réplica en el cliente para no
// dibujar accesos que van a acabar en «permiso denegado».
// ============================================================

// El correo llega desde `.env` (VITE_OWNER_EMAIL), que no se versiona.
const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL ?? '').trim().toLowerCase();

export function isFrameOwner(profile: UserProfile | null | undefined): boolean {
  if (!profile || profile.isGuest) return false;
  return OWNER_EMAIL !== '' && (profile.email ?? '').trim().toLowerCase() === OWNER_EMAIL;
}
