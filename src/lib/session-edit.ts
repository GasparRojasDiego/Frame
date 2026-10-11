import { isToday, parseISO } from 'date-fns';
import type { StudySession } from '@/types';

// ============================================================
// La ventana de corrección de una sesión de estudio.
//
// Una sesión se puede arreglar el MISMO día: es cuando uno se acuerda de lo
// que hizo y cuando descubre que marcó mal el enfoque o se dejó una
// asignatura. Pasada la medianoche el día queda cerrado —su calificación ya
// está calculada y guardada— y el registro deja de tocarse: un historial que
// se puede reescribir hacia atrás no sirve para medir nada.
//
// Vive aquí, en una sola función, para que la interfaz y el almacén apliquen
// exactamente la misma regla y no puedan discrepar.
// ============================================================

export function isSessionEditable(
  session: Pick<StudySession, 'startTime'> & Partial<Pick<StudySession, 'endTime'>>
): boolean {
  try {
    // Una sesión de 23:00 a 00:30 EMPEZÓ ayer pero se acaba de registrar: es
    // de hoy a efectos de corregirla. Basta con que empiece o termine hoy.
    if (isToday(parseISO(session.startTime))) return true;
    return !!session.endTime && isToday(parseISO(session.endTime));
  } catch {
    // Fecha ilegible: se trata como registro cerrado, nunca como editable.
    return false;
  }
}
