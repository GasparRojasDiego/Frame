import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { isTauri } from '@tauri-apps/api/core';
import { RootErrorBoundary } from '@/components/layout/InterfaceErrorBoundary';
import { initTheme } from '@/lib/theme';
import '@/app/globals.css';

// Cada ventana carga SOLO lo suyo: la flotante de Estudio y el vistazo al
// horario no necesitan la app entera (ni la nube, ni las interfaces), y la
// principal arranca leyendo lo justo para pintar Inicio.
const App = lazy(() => import('./App'));
const MiniTimerWindow = lazy(() => import('@/components/temporizador/MiniTimerWindow'));
const SchedulePeekWindow = lazy(() => import('@/components/schedule/SchedulePeekWindow'));

type ErrorInput = Parameters<typeof import('@/lib/error-report').reportError>[0];
const reportError = (input: ErrorInput) =>
  void import('@/lib/error-report').then(({ reportError: report }) => report(input)).catch(() => undefined);

// Tema (claro/oscuro/dispositivo) aplicado antes de montar la interfaz.
initTheme();

// El menú del clic derecho lo pone el motor web, y ofrece "Atrás",
// "Actualizar", "Imprimir", "Guardar como…": opciones de navegador que en una
// app de escritorio no significan nada y pueden dejar la ventana en un estado
// que el usuario no pidió. Se desactiva.
//
// Con UNA excepción: los campos de texto. Ahí el menú es el de cortar, copiar
// y pegar —útil y sin nada de navegación—, y quitarlo solo estorbaría.
document.addEventListener('contextmenu', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest?.('input, textarea, [contenteditable="true"]')) return;
  event.preventDefault();
});

// Archivos arrastrados desde el explorador (1.6.5). La ventana principal deja
// que el motor web reciba los soltados (`dragDropEnabled: false`) para que la
// zona de «Adjuntar archivo» los enlace; fuera de esa zona, soltar un archivo
// no debe hacer nada (el motor lo abriría y la app se iría de su página).
const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
window.addEventListener('dragover', (event) => {
  if (event.defaultPrevented || !carriesFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
});
window.addEventListener('drop', (event) => {
  if (event.defaultPrevented || !carriesFiles(event)) return;
  event.preventDefault();
});

// Las ventanas auxiliares (la flotante de Enfoque y el vistazo al horario)
// cargan este mismo bundle, pero solo montan su pieza: nada de router,
// contextos ni datos.
const windowLabel = (() => {
  try {
    if (!isTauri()) return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__TAURI_INTERNALS__?.metadata?.currentWebview?.label ?? '';
  } catch {
    return '';
  }
})();

const isMiniTimerWindow = windowLabel === 'minitimer';
const isSchedulePeekWindow = windowLabel === 'schedulepeek';

// Fallos que React no ve (promesas sin atender, errores en manejadores): se
// reportan con su mensaje para poder enterarse de que algo se rompe en el
// equipo de un estudiante. Solo en la ventana principal, y con tope por
// arranque (ver ERROR_BUDGET en telemetry.ts).
if (!isMiniTimerWindow && !isSchedulePeekWindow) {
  window.addEventListener('error', (event) => {
    reportError({
      scope: 'window',
      name: event.error?.name ?? 'Error',
      message: event.message,
      stack: event.error?.stack,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportError({
      scope: 'promise',
      name: reason?.name ?? 'UnhandledRejection',
      message: String(reason?.message ?? reason ?? ''),
      stack: reason?.stack,
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Última línea de defensa: envuelve TODO, contextos incluidos, para que
        ningún fallo pueda dejar la ventana en blanco y sin explicación. */}
    <RootErrorBoundary>
      <Suspense fallback={null}>
        {isMiniTimerWindow ? (
          <MiniTimerWindow />
        ) : isSchedulePeekWindow ? (
          <SchedulePeekWindow />
        ) : (
          <HashRouter>
            <App />
          </HashRouter>
        )}
      </Suspense>
    </RootErrorBoundary>
  </React.StrictMode>
);
