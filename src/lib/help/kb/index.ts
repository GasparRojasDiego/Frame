import { buildIndex, type HelpAreaId, type HelpEntry, type HelpIndex } from '../search';
import { BASICO } from './basico';
import { BARRA, INICIO } from './inicio';
import { ENFOQUE } from './enfoque';
import { TAREAS } from './tareas';
import { HABITOS } from './habitos';
import { ASIGNATURAS } from './asignaturas';
import { CALENDARIO, GOOGLE } from './calendario';
import { MUSICA } from './musica';
import { AJUSTES, CUENTA, GRABACIONES, INFORMES, PROBLEMAS } from './cuenta';
import { EXTENSIONES, SUGERENCIAS } from './extensiones';
import { MAS } from './mas';
import { CURIOSIDADES } from './curiosidades';

export { CURIOSITY_IDS } from './curiosidades';
import { VARIANTES } from './variantes';

// ============================================================
// Banco de respuestas de la barra de ayuda: una entrada por función.
//
// Al añadir o cambiar una función de Frame, su respuesta se escribe o se
// corrige aquí en la misma versión. Reglas de redacción:
//   · La respuesta (`a`) va primero y se entiende sola.
//   · Los nombres de botones, entre «comillas», tal como se ven en pantalla.
//   · Varias formas de preguntar en `q`, como las escribiría un estudiante.
//   · Nada que la app no haga. Si algo es solo de Android, se dice.
// ============================================================

const SOURCES: [HelpAreaId, Omit<HelpEntry, 'area'>[]][] = [
  ['basico', BASICO],
  ['inicio', INICIO],
  ['barra', BARRA],
  ['enfoque', ENFOQUE],
  ['tareas', TAREAS],
  ['habitos', HABITOS],
  ['asignaturas', ASIGNATURAS],
  ['calendario', CALENDARIO],
  ['google', GOOGLE],
  ['musica', MUSICA],
  ['grabaciones', GRABACIONES],
  ['ajustes', AJUSTES],
  ['informes', INFORMES],
  ['cuenta', CUENTA],
  ['problemas', PROBLEMAS],
  ['extensiones', EXTENSIONES],
  ['curiosidades', CURIOSIDADES],
  ['sugerencias', SUGERENCIAS],
];

/**
 * Respuestas principales de cada tema: ganan los empates de preguntas vagas
 * («grabar», «calendario», «música»). Solo desempatan: no tapan a una
 * respuesta que encaje mejor.
 */
const PRIOR: Record<string, number> = {
  'grabar-nota': 0.05,
  'enfoque-iniciar': 0.04,
  'tarea-crear': 0.04,
  'habito-crear': 0.04,
  'asig-crear': 0.04,
  'musica-reproducir': 0.03,
  'playlist-crear': 0.03,
  'cal-evento-crear': 0.03,
  'informes-centro': 0.04,
  'ajustes-abrir': 0.03,
  'notificaciones': 0.03,
  'tareas-intro': 0.03,
  'habitos-intro': 0.03,
  'asig-intro': 0.03,
  'cal-intro': 0.03,
  'musica-intro': 0.03,
  'enfoque-intro': 0.03,
  'inicio-que-muestra': 0.03,
  'racha-que-es': 0.03,
  'nota-diaria': 0.03,
};

/** Cada respuesta con su área y TODAS sus formas de preguntar (las suyas y las de variantes.ts). */
export const HELP_ENTRIES: HelpEntry[] = [...SOURCES, ...MAS].flatMap(([area, list]) =>
  list.map((entry) => ({ ...entry, area, q: [...entry.q, ...(VARIANTES[entry.id] ?? [])], prior: PRIOR[entry.id] }))
);

let cached: HelpIndex | null = null;

/** El índice se construye una sola vez, al primer uso. */
export function helpIndex(): HelpIndex {
  if (!cached) cached = buildIndex(HELP_ENTRIES);
  return cached;
}

/** Preguntas de ejemplo bajo la barra cuando está vacía. */
export const STARTER_QUESTIONS = [
  '¿Cómo empiezo una sesión de estudio?',
  '¿Cómo se calcula mi nota del día?',
  '¿Cómo importo mi música?',
  '¿Cómo creo un hábito?',
  '¿Cómo importo el horario del mes?',
  '¿Cómo pongo un recordatorio a una tarea?',
  '¿Cómo saco un informe en PDF?',
  '¿Qué es la matriz de competencias?',
  '¿Cómo vinculo mi cuenta de invitado?',
  '¿Cómo pongo el reloj encima de otras ventanas?',
];
