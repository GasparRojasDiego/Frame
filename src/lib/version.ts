// Versión de la aplicación, inyectada en tiempo de compilación desde
// package.json (ver `define` en vite.config.ts). Cualquier sitio que muestre
// o reporte la versión debe leerla de aquí: escribirla a mano es cómo la
// pantalla de información y la telemetría acabaron ancladas en la 1.0.0.
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

declare const __BUILD_DATE__: string;

/** Momento de la compilación, en ISO. Base de las fechas de los documentos. */
export const BUILD_DATE: string =
  typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : new Date().toISOString();
