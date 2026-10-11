import React from 'react';
import { AlertTriangle, RotateCcw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname } from '@/lib/navigation';

// ============================================================
// Red de seguridad. Frame no vuelve a quedarse en blanco.
//
// Sin esto, un solo dato mal formado (una sesión de estudio sin fecha, un
// respaldo antiguo, una fusión de sincronización que trae algo inesperado)
// tumba el árbol de React entero y deja la ventana EN BLANCO, sin un solo
// mensaje y sin nada que pulsar.
//
// Se protege en DOS niveles, porque cubren fallos distintos:
//
//   · Frontera de INTERFAZ: rodea el contenido de la página, dentro del
//     armazón. Si Inicio revienta, el sidebar y la cabecera siguen en pie y
//     el usuario se va a otra interfaz. Se remonta al cambiar de ruta.
//   · Frontera RAÍZ: rodea la aplicación completa en main.tsx. Cubre lo que
//     la otra no puede — los contextos y el propio armazón, que están por
//     encima de ella. Es la última línea: si algo llega aquí, al menos hay
//     una pantalla que explica qué pasó y un botón para reintentar.
// ============================================================

interface State {
  error: Error | null;
  /** Detalle técnico desplegado. Cerrado por defecto: al usuario le importa
   *  la salida, no la traza. */
  showDetail: boolean;
}

interface Props {
  children: React.ReactNode;
  /** 'root' ocupa la ventana entera; 'interface' vive dentro del armazón. */
  scope: 'root' | 'interface';
}

class Boundary extends React.Component<Props, State> {
  state: State = { error: null, showDetail: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`Frame falló (${this.props.scope}):`, error, info.componentStack);
    // Nombre, mensaje, ruta y pila compacta (solo posiciones del código):
    // lo justo para arreglarlo, nada de datos del usuario.
    // Se carga al fallar: el reporte (y la nube) no pesan en el arranque.
    const report = {
      scope: this.props.scope,
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    };
    void import('@/lib/error-report').then(({ reportError }) => reportError(report)).catch(() => undefined);
  }

  render() {
    const { error, showDetail } = this.state;
    const isRoot = this.props.scope === 'root';
    if (!error) return this.props.children;

    return (
      <div
        className={
          isRoot
            ? 'flex h-screen items-center justify-center bg-background p-6 text-foreground'
            : 'flex h-full items-center justify-center p-6'
        }
      >
        <div className="w-full max-w-md space-y-4 rounded-xl border border-destructive/30 bg-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>

          <div className="space-y-1.5">
            <h2 className="font-headline text-lg font-bold">
              {isRoot ? 'Frame no pudo abrirse' : 'Esta interfaz no pudo abrirse'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isRoot
                ? 'Algo falló al arrancar. '
                : 'El resto de Frame sigue funcionando: puedes cambiar de interfaz desde el menú lateral. '}
              <strong className="text-foreground">Tus datos no se han perdido</strong> — nada se ha
              borrado ni modificado.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() =>
                isRoot
                  ? window.location.reload()
                  : this.setState({ error: null, showDetail: false })
              }
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => this.setState({ showDetail: !showDetail })}
            >
              <ChevronDown
                className={`mr-1 h-3 w-3 transition-transform ${showDetail ? 'rotate-180' : ''}`}
              />
              Detalle técnico
            </Button>
          </div>

          {showDetail && (
            <pre className="max-h-40 overflow-auto rounded-md bg-secondary/60 p-3 text-left text-[11px] leading-relaxed text-muted-foreground">
              {error.stack || error.message || String(error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

/**
 * Frontera de interfaz. Lleva la ruta como `key`: cambiar de interfaz remonta
 * la frontera y limpia el error, que es justo lo que el usuario espera al
 * navegar a otro sitio después de un fallo.
 */
export default function InterfaceErrorBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Boundary key={pathname} scope="interface">
      {children}
    </Boundary>
  );
}

/** Frontera raíz. Va en main.tsx, fuera del router y de todo contexto. */
export function RootErrorBoundary({ children }: { children: React.ReactNode }) {
  return <Boundary scope="root">{children}</Boundary>;
}
