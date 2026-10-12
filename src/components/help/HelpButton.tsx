import { useEffect } from 'react';
import { LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from '@/lib/navigation';
import { cn } from '@/lib/utils';

// ============================================================
// Botón del Centro de ayuda, en la barra superior (a la derecha de «Crear»).
//
// Abre la interfaz /ayuda, que ocupa todo el espacio entre el menú lateral
// y la cabecera. Como todos los botones de la barra es «fantasma» y pasa a
// sólido mientras su interfaz está abierta; pulsarlo dentro de la ayuda
// devuelve a la interfaz de la que se vino.
// ============================================================

const HELP_PATH = '/ayuda';
/** Interfaz desde la que se abrió la ayuda: a ella se vuelve al salir. */
let cameFrom = '/';

export function exitHelp(router: { push: (href: string) => void }) {
  router.push(cameFrom);
}

export default function HelpButton({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const inHelp = pathname === HELP_PATH;

  useEffect(() => {
    if (!inHelp) cameFrom = pathname;
  }, [inHelp, pathname]);

  return (
    <Button
      size="icon"
      variant={inHelp ? 'default' : 'fantasma'}
      className={cn(className)}
      data-tour="ayuda-boton"
      onClick={() => (inHelp ? exitHelp(router) : router.push(HELP_PATH))}
      title={inHelp ? 'Cerrar el Centro de ayuda' : 'Centro de ayuda'}
      aria-label={inHelp ? 'Cerrar el Centro de ayuda' : 'Abrir el Centro de ayuda'}
    >
      <LifeBuoy className="h-5 w-5" />
    </Button>
  );
}
