// ============================================================
// Extensiones de Frame. Hoy hay una, Notion: el importador de tareas y fechas.
// Ya no se añade ni se quita (el «+» de la barra de la Ayuda se retiró en la
// 1.6.2) y, desde que la Ayuda se quitó (1.6.7), solo lo abre el botón
// «Importar de Notion» de Ajustes (menú de la rueda, con su propio recuadro).
// ============================================================

export type ExtensionId = 'notion';

// Hasta la 1.6.1 se recordaba aquí qué extensiones había «añadidas». Ya no
// significa nada: se borra lo que quedara guardado. No viaja en los respaldos.
try {
  if (typeof window !== 'undefined') window.localStorage.removeItem('frameExtensions');
} catch {
  /* almacenamiento vetado: no hay nada que limpiar */
}
