import type { HelpAreaId, HelpEntry } from '../areas';
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

// ============================================================
// Banco de respuestas del Centro de ayuda: una entrada por función.
//
// Al añadir o cambiar una función de Frame, su respuesta se escribe o se
// corrige aquí en la misma versión. Reglas de redacción en kb/basico.ts.
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

/** Las respuestas principales de cada tema van primero en su lista. */
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

/** Cada respuesta con su área. */
export const HELP_ENTRIES: HelpEntry[] = [...SOURCES, ...MAS].flatMap(([area, list]) =>
  list.map((entry) => ({ ...entry, area, prior: PRIOR[entry.id] }))
);

export const HELP_BY_ID = new Map(HELP_ENTRIES.map((entry) => [entry.id, entry]));

/** Las relacionadas de una respuesta (las que nombra en `rel`). */
export function relatedOf(entry: HelpEntry, limit = 4): HelpEntry[] {
  return (entry.rel ?? [])
    .map((id) => HELP_BY_ID.get(id))
    .filter((e): e is HelpEntry => !!e && e.id !== entry.id)
    .slice(0, limit);
}
