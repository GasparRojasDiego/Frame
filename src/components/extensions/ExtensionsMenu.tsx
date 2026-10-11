import { Check, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExtensionIcon } from '@/components/extensions/ExtensionIcons';
import { addExtension, EXTENSIONS, removeExtension, useExtensions } from '@/lib/extensions/registry';
import { cn } from '@/lib/utils';

/** El «+» de la barra de ayuda: añadir o quitar extensiones. */
export default function ExtensionsMenu() {
  const { installed } = useExtensions();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Extensiones" data-tour="extensiones"
          aria-label="Extensiones"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground data-[state=open]:border-primary data-[state=open]:text-primary"
        >
          <Plus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        // Cabe siempre: si falta alto, la lista se desplaza por dentro.
        className="flex max-h-[var(--radix-popover-content-available-height)] w-[380px] flex-col rounded-2xl p-0"
      >
        <div className="border-b border-border/60 px-4 py-3">
          <p className="font-headline text-sm font-bold text-foreground">Extensiones</p>
          <p className="text-xs text-muted-foreground">Herramientas que se suman a esta barra. Funcionan sin internet.</p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {EXTENSIONS.map((ext) => {
            const on = installed.includes(ext.id);
            return (
              <li key={ext.id} className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-secondary/40">
                <ExtensionIcon id={ext.id} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{ext.name}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{on ? ext.detail : ext.tagline}</p>
                </div>
                <button
                  type="button"
                  onClick={() => (on ? removeExtension(ext.id) : addExtension(ext.id))}
                  className={cn(
                    'mt-0.5 flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    on
                      ? 'bg-primary/15 text-primary hover:bg-destructive/10 hover:text-destructive'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                  title={on ? 'Quitar la extensión' : 'Añadir la extensión'} data-tour="ext-notion"
                >
                  {on ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Añadida
                    </>
                  ) : (
                    'Añadir'
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
          Atajo: <code className="text-foreground">/notion</code>
        </p>
      </PopoverContent>
    </Popover>
  );
}
