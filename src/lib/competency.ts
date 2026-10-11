// Matriz de competencias: escala, cálculo y persistencia de la selección.
// Módulo puro (sin React) para que la regla de negocio sea única y testeable.
import type { Course, Task } from '@/types';

/** Escala del dominio: 0 a 20, como el sistema de calificación peruano.
 *  Es el número que ve el usuario y el domino del eje radial. */
export const COMPETENCY_MAX = 20;

/** Anillos DIBUJADOS en el radar. Son 5 aunque la escala llegue a 20: más
 *  anillos convertirían la telaraña en una mancha. Cada anillo vale 4 puntos. */
export const COMPETENCY_RINGS = 5;

/** Un polígono necesita 3 vértices; con 2 degenera en un segmento. */
export const MIN_COMPETENCY_COURSES = 3;

/** Tope por LEGIBILIDAD: con más de 10 vértices las etiquetas se solapan en el
 *  ancho disponible de la tarjeta y el polígono se lee como un círculo. */
export const MAX_COMPETENCY_COURSES = 10;

/** Radio mínimo DIBUJADO: impide que un nivel 0 colapse el área al centro.
 *  Solo afecta al trazo; el valor mostrado al usuario es siempre `level`. */
export const COMPETENCY_PLOT_FLOOR = 0.5;

/** Umbrales oficiales del sistema peruano, reutilizados aquí para que el
 *  número del radar se lea igual que una nota del colegio. */
export function competencyGrade(level: number): 'AD' | 'A' | 'B' | 'C' {
  if (level >= 18) return 'AD';
  if (level >= 14) return 'A';
  if (level >= 11) return 'B';
  return 'C';
}

/** Cuántas asignaturas se siembran la primera vez que se abre Inicio. */
export const COMPETENCY_SEED_COURSES = 6;

export const competencyStorageKey = (uid: string) => `competencyCourseIds_${uid}`;

/** Claves de la matriz MANUAL legada (hexágono fijo de 6 vértices con sliders). */
export const legacyCompetencyKeys = (uid: string) => [
  `hexagonData_${uid}`,
  `categoryNames_${uid}`,
];

export interface CompetencyVertex {
  courseId: string;
  /** Nombre completo (lista y tooltip). */
  name: string;
  /** Etiqueta corta y ÚNICA para el vértice del radar. */
  axisLabel: string;
  pending: number;
  /** 0..COMPETENCY_MAX (escala peruana de 20) */
  level: number;
  /** `level` con piso visual: es el dataKey que dibuja el <Radar>. */
  plotted: number;
  /** 0..100, para las barras de logro. */
  percent: number;
}

/** Lo que descuenta cada tarea pendiente del dominio de la asignatura. */
export const COMPETENCY_PENALTY = 1;

/**
 * Escala oficial sobre 20: sin pendientes se tiene el dominio máximo y cada
 * tarea pendiente cuesta 1 punto; con 20 o más pendientes se llega a 0.
 *   0 → 20 (AD) | 2 → 18 (AD) | 6 → 14 (A) | 9 → 11 (B)
 *   10 → 10 (C) | …           | ≥20 → 0 (C)
 */
export function competencyLevel(pending: number): number {
  const raw = COMPETENCY_MAX - COMPETENCY_PENALTY * Math.max(0, pending);
  return Math.max(0, Math.min(COMPETENCY_MAX, raw));
}

export function shortenCourseName(name: string, max = 14): string {
  const clean = name.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Pendientes por asignatura en UNA sola pasada. Una tarea está pendiente
 *  mientras su progreso sea < 100 (misma regla que la cuadrícula de cursos). */
export function countPendingByCourse(tasks: Task[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const task of tasks) {
    if (task.progress >= 100) continue;
    map.set(task.courseId, (map.get(task.courseId) ?? 0) + 1);
  }
  return map;
}

export function buildCompetencyData(
  courses: Course[],
  tasks: Task[],
  selectedIds: string[]
): CompetencyVertex[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const pendingByCourse = countPendingByCourse(tasks);
  // Dos asignaturas pueden compartir los primeros caracteres: se desambigua.
  const usedLabels = new Map<string, number>();

  return selectedIds
    .map((id) => byId.get(id))
    .filter((c): c is Course => !!c)
    .slice(0, MAX_COMPETENCY_COURSES)
    .map((course) => {
      const pending = pendingByCourse.get(course.id) ?? 0;
      const level = competencyLevel(pending);
      const short = shortenCourseName(course.name);
      const seen = usedLabels.get(short) ?? 0;
      usedLabels.set(short, seen + 1);
      return {
        courseId: course.id,
        name: course.name,
        axisLabel: seen === 0 ? short : `${short} (${seen + 1})`,
        pending,
        level,
        plotted: Math.max(level, COMPETENCY_PLOT_FLOOR),
        percent: (level / COMPETENCY_MAX) * 100,
      };
    });
}

export function averageLevel(vertices: CompetencyVertex[]): number {
  if (vertices.length === 0) return 0;
  return vertices.reduce((acc, v) => acc + v.level, 0) / vertices.length;
}

/** Lee la selección persistida. `null` = nunca configurada (procede sembrar). */
export function readCompetencySelection(uid: string): string[] | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(competencyStorageKey(uid));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    // Devolver [] significaba "el usuario eligió no tener ninguna": la siembra
    // automática no volvía a ejecutarse y el radar quedaba vacío para siempre.
    // Un JSON ilegible no es una elección: se borra y se vuelve a sembrar.
    try {
      window.localStorage.removeItem(competencyStorageKey(uid));
    } catch {
      /* almacenamiento vetado */
    }
    return null;
  }
}
