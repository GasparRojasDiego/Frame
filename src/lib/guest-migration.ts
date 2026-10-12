// ============================================================
// De invitado a cuenta sin empezar de cero.
//
// Un estudiante prueba Frame como invitado (id local de 12 dígitos), acumula
// asignaturas y sesiones, y luego entra con su cuenta: el perfil pasa a usar
// el UUID de Supabase y todas sus claves `*_<idInvitado>` quedaban
// inalcanzables. Veía la app vacía y creía haberlo perdido todo.
//
// Lo normal es vincular desde dentro («Vincular con Google», guest-link.ts),
// que traslada solo. Esto cubre el otro camino: cerrar la sesión de invitado y
// entrar con Google desde la pantalla de acceso. Entonces se OFRECE sumar ese
// perfil (puede ser de otra persona que usó el mismo equipo) y, si se acepta,
// se fusiona con la misma lógica, que nunca borra ni duplica. El perfil de
// invitado sigue intacto en el equipo.
// ============================================================

import { guestLinkedTo } from '@/lib/guest-link';

// Basta con una para ofrecer la fusión. Incluye lo que no exige asignatura
// (anotaciones sueltas, grabaciones, el calendario y sus colores): un invitado
// puede tener solo eso, y el traslado ya lo lleva.
const DATA_KEYS = [
  'courses',
  'tasks',
  'studySessions',
  'habits',
  'notes',
  'archivedTasks',
  'looseNotes',
  'recordings',
  'localEvents',
  'dayColors',
];

const hasData = (uid: string): boolean =>
  DATA_KEYS.some((name) => {
    try {
      const raw = localStorage.getItem(`${name}_${uid}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  });

export interface GuestCandidate {
  id: string;
  username: string;
}

/** El perfil de invitado de este equipo que merece ofrecerse, o null. */
export function findGuestToAdopt(accountUid: string): GuestCandidate | null {
  try {
    if (localStorage.getItem(`guestAdoptionAnswered_${accountUid}`)) return null;
    const raw = localStorage.getItem('lastLocalProfile');
    if (!raw) return null;
    const guest = JSON.parse(raw) as { id?: string; username?: string; isGuest?: boolean };
    if (!guest?.id || guest.id === accountUid || !hasData(guest.id)) return null;
    // Ya vinculado a una cuenta: sus datos están donde deben.
    if (guestLinkedTo(guest.id)) return null;
    return { id: guest.id, username: guest.username ?? '' };
  } catch {
    return null;
  }
}

export function rememberAdoptionAnswer(accountUid: string): void {
  try {
    localStorage.setItem(`guestAdoptionAnswered_${accountUid}`, '1');
  } catch {
    /* se volverá a preguntar */
  }
}
