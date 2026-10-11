import { trackEvent } from '@/lib/telemetry';

// ============================================================
// Reporte de errores.
//
// Cada fallo que llega aquí viaja como evento 'error' de la telemetría y, en
// el servidor, un disparador lo agrupa en `error_log` (migración 0008): misma
// huella, mismo error, con sus veces, versiones y estudiantes. Así nadie
// tiene que mirar una lista: el registro se ordena solo.
//
// Para que un error se pueda ARREGLAR sin pedir más datos a nadie, va con:
//   · la ruta donde ocurrió, sin identificadores (/cursos/:id);
//   · la pila compacta: solo «función (archivo:línea:col)», nunca contenido.
//     Con los mapas de fuente que guarda cada compilación
//     (scripts/guardar-mapas.mjs) se traduce a la línea real del código.
// ============================================================

/** Avisos del navegador que no rompen nada y solo hacen ruido. */
const BENIGN = [/ResizeObserver loop/i, /^Script error\.?$/i];

export function isBenignError(message: string | null | undefined): boolean {
  const text = (message ?? '').trim();
  return BENIGN.some((re) => re.test(text));
}

/** Ruta actual sin identificadores: `/cursos/9f2c…` → `/cursos/:id`. */
export function currentRoute(): string {
  try {
    const raw = (window.location.hash.replace(/^#/, '') || window.location.pathname || '/').split('?')[0];
    return raw
      .split('/')
      .map((part) => (part.length >= 8 && /\d/.test(part) ? ':id' : part))
      .join('/')
      .slice(0, 120);
  } catch {
    return '';
  }
}

/** Deja de cada marco solo la función y «archivo:línea:col». */
function frames(stack: string | null | undefined, max: number): string[] {
  if (!stack) return [];
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .slice(0, max)
    .map((line) => line.replace(/(?:https?|tauri|file):\/\/[^\s)]*\/([^/\s)]+:\d+:\d+)/g, '$1'));
}

/** Pila compacta (JS + componentes de React), con tope de 1 400 caracteres. */
export function compactStack(stack?: string | null, componentStack?: string | null): string | undefined {
  const js = frames(stack, 8);
  const react = frames(componentStack, 6);
  const text = [...js, ...(react.length ? ['— componentes —', ...react] : [])].join('\n');
  return text ? text.slice(0, 1400) : undefined;
}

interface ErrorInput {
  scope: 'root' | 'interface' | 'window' | 'promise';
  name?: string;
  message?: string;
  stack?: string | null;
  componentStack?: string | null;
}

/** Reporta un fallo. Nunca lanza; los avisos inofensivos se descartan. */
export function reportError({ scope, name, message, stack, componentStack }: ErrorInput) {
  try {
    // En desarrollo, la recarga en caliente provoca fallos que no existen en
    // la app instalada (un contexto recargado a medias): no se reportan.
    if (import.meta.env.DEV || isBenignError(message)) return;
    trackEvent('error', {
      scope,
      name: name || 'Error',
      message: message ?? '',
      route: currentRoute(),
      stack: compactStack(stack, componentStack),
    });
  } catch {
    /* el reporte jamás debe causar otro fallo */
  }
}
