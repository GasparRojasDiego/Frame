import { useEffect } from 'react';
import { MessageCircleQuestion, X } from 'lucide-react';
import { usePathname, useRouter } from '@/lib/navigation';
import { cn } from '@/lib/utils';

// ============================================================
// Botón redondo de la ayuda, abajo a la derecha de la app.
//
// Abre la interfaz «Ayuda» (/ayuda), que ocupa todo el espacio entre el
// menú lateral y la cabecera. Dentro de ella, el mismo botón la cierra y
// devuelve a la interfaz de la que se vino.
// ============================================================

const HELP_PATH = '/ayuda';
/** Interfaz desde la que se abrió la ayuda: a ella se vuelve al salir. */
let cameFrom = '/';

export function exitHelp(router: { push: (href: string) => void }) {
  router.push(cameFrom);
}

export default function HelpButton() {
  const router = useRouter();
  const pathname = usePathname();
  const inHelp = pathname === HELP_PATH;

  useEffect(() => {
    if (!inHelp) cameFrom = pathname;
  }, [inHelp, pathname]);

  return (
    <button
      type="button"
      data-tour="ayuda-boton"
      onClick={() => (inHelp ? exitHelp(router) : router.push(HELP_PATH))}
      title={inHelp ? 'Cerrar la ayuda' : 'Ayuda: pregúntame cómo usar Frame'}
      aria-label={inHelp ? 'Cerrar la ayuda' : 'Abrir la ayuda'}
      className={cn(
        'absolute bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-1 ring-black/5 transition-[transform,background-color] duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        inHelp ? 'bg-card text-primary ring-primary/50' : 'bg-primary text-primary-foreground'
      )}
    >
      {inHelp ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}
    </button>
  );
}
