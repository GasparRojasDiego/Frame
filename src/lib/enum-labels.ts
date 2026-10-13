import { tr, trc } from '@/lib/i18n';

// ============================================================
// Cómo se LEEN los valores que Frame guarda en español (1.6.7).
//
// La importancia («Alta»), la dificultad («Fácil»), el tipo de pendiente
// («Examen») o el reloj de una sesión («Cronómetro») son DATOS: se guardan,
// se comparan y se sincronizan tal cual, en cualquier idioma. Traducirlos al
// guardar los rompería; por eso se traducen solo aquí, al mostrarlos.
//
// Llevan contexto porque «Media» es *Medium* como importancia o dificultad
// y *Mean* en una tabla de cifras; y «Tarea», *Homework* como tipo y *Task*
// en el resto de la app.
// ============================================================

export const priorityLabel = (priority: string): string => trc('importancia', priority);

export const difficultyLabel = (difficulty: string): string => trc('dificultad', difficulty);

export const taskKindLabel = (kind: string): string => trc('tipo de tarea', kind);

export const sessionTypeLabel = (type: string): string => tr(type);

/** Artista que Frame guarda cuando una canción no trae ninguno. */
export const UNKNOWN_ARTIST = 'Desconocido';

/** Nombre con el que nace un perfil de invitado. */
export const GUEST_NAME = 'Invitado';

/** El artista tal como se lee: el que Frame puso por defecto se traduce; el
 *  que escribió alguien, nunca. */
export const artistLabel = (artist?: string | null): string => {
  const value = artist?.trim();
  if (!value) return tr('Artista desconocido');
  return value === UNKNOWN_ARTIST ? tr('Desconocido') : value;
};

/** El nombre del perfil tal como se lee: «Invitado» se traduce; un nombre
 *  elegido por la persona, no. */
export const usernameLabel = (username?: string | null): string =>
  !username || username === GUEST_NAME ? tr('Invitado') : username;

/** De dónde suena la música: «Música» y «Favoritos» son de Frame y se
 *  traducen; el nombre de una playlist es de quien la creó y no. */
export const playbackContextLabel = (context: string): string =>
  context === 'Música' || context === 'Favoritos' ? tr(context) : context;
