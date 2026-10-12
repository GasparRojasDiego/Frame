// ============================================================
// Banco de respuestas del Centro de ayuda: tipos y áreas.
//
// Desde la 1.6.6 no hay barra para preguntar (ni buscador, ni formas de
// preguntar, ni historial): el usuario elige un tema y, dentro, una pregunta.
// Cada respuesta está escrita a mano para quien abre Frame por primera vez
// (estilo en kb/basico.ts).
// ============================================================

export interface HelpEntry {
  id: string;
  /** Interfaz a la que pertenece (la pone kb/index.ts). */
  area: HelpAreaId;
  /** La pregunta tal como se ve en su tarjeta. */
  title: string;
  /** La respuesta: párrafos separados por una línea en blanco, con **negritas**. */
  a: string;
  /** Pasos numerados, si es un procedimiento. */
  steps?: string[];
  /** Matiz o advertencia final. */
  tip?: string;
  /** Ruta a la que lleva el botón «Ir a…». */
  go?: string;
  /** Ids de respuestas relacionadas. */
  rel?: string[];
  /** Orden dentro de su tema: las principales, primero. La pone kb/index.ts. */
  prior?: number;
}

export type HelpAreaId =
  | 'basico'
  | 'inicio'
  | 'barra'
  | 'enfoque'
  | 'tareas'
  | 'habitos'
  | 'asignaturas'
  | 'calendario'
  | 'google'
  | 'musica'
  | 'grabaciones'
  | 'ajustes'
  | 'informes'
  | 'cuenta'
  | 'problemas'
  | 'extensiones'
  | 'curiosidades'
  | 'sugerencias';

export const HELP_AREAS: Record<HelpAreaId, { label: string; route?: string }> = {
  basico: { label: 'Lo básico' },
  inicio: { label: 'Inicio', route: '/' },
  barra: { label: 'Barra superior' },
  enfoque: { label: 'Estudio', route: '/temporizador' },
  tareas: { label: 'Tareas', route: '/tareas' },
  habitos: { label: 'Hábitos', route: '/habitos' },
  asignaturas: { label: 'Asignaturas', route: '/knowledge' },
  calendario: { label: 'Calendario', route: '/calendario' },
  google: { label: 'Servicios de Google' },
  musica: { label: 'Música', route: '/music' },
  grabaciones: { label: 'Grabaciones' },
  ajustes: { label: 'Ajustes', route: '/settings' },
  informes: { label: 'Informes', route: '/settings' },
  cuenta: { label: 'Cuenta y nube' },
  problemas: { label: 'Problemas' },
  extensiones: { label: 'Extensiones' },
  curiosidades: { label: 'Curiosidades' },
  sugerencias: { label: 'Sugerencias' },
};
