import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CloudOff, FileWarning, ImageOff, Music, RefreshCw, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EchoHeader } from '@/components/shared/EchoWord';
import { useRouter } from '@/lib/navigation';
import { OPEN_SYNC_ISSUES_EVENT, SYNC_NOW_EVENT, useSyncIssues, type SyncIssue } from '@/lib/sync-check';
import { useSyncStatus } from '@/lib/sync-status';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

// ============================================================
// Recuadro del verificador de sincronización (1.6.8, Diego): cada cosa que no
// está igual en los dispositivos de la cuenta, agrupada por interfaz, con el
// porqué. Se abre desde la campana («N elementos sin sincronizar»).
// ============================================================

const KIND_ICON: Record<SyncIssue['kind'], typeof CloudOff> = {
  pending: UploadCloud,
  error: CloudOff,
  image: ImageOff,
  song: Music,
  attachment: FileWarning,
};

function sinceLabel(at: number | null): string {
  if (!at) return tr('Aún no se sincronizó en esta sesión');
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return tr('Última sincronización: hace unos segundos');
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? tr('Última sincronización: hace 1 minuto') : tr('Última sincronización: hace {minutes} minutos', { minutes });
}

export default function SyncIssuesDialog() {
  const [open, setOpen] = useState(false);
  const issues = useSyncIssues();
  const status = useSyncStatus();
  const router = useRouter();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_SYNC_ISSUES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SYNC_ISSUES_EVENT, onOpen);
  }, []);

  // Agrupadas por interfaz, en el orden en que aparecen.
  const groups = useMemo(() => {
    const map = new Map<string, SyncIssue[]>();
    for (const issue of issues) {
      const list = map.get(issue.where) ?? [];
      list.push(issue);
      map.set(issue.where, list);
    }
    return [...map.entries()];
  }, [issues]);

  const go = (route?: string) => {
    if (!route) return;
    setOpen(false);
    router.push(route);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <EchoHeader word={tr('Sincronización')}>
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-primary">
              {issues.length === 0
                ? tr('Todo está sincronizado')
                : issues.length === 1
                  ? tr('1 elemento sin sincronizar')
                  : tr('{n} elementos sin sincronizar', { n: issues.length })}
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              {status.phase === 'offline' ? tr('Sin conexión: tus cambios se guardan aquí') : sinceLabel(status.lastOkAt)}
            </DialogDescription>
          </DialogHeader>
        </EchoHeader>

        {issues.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">{tr('Lo de esta cuenta es igual en todos tus dispositivos.')}</p>
          </div>
        ) : (
          <div className="max-h-[min(26rem,60vh)] space-y-4 overflow-y-auto pr-1">
            {groups.map(([where, list]) => (
              <section key={where} className="space-y-1.5">
                <h3 className="text-[11px] font-semibold text-muted-foreground">{where}</h3>
                <ul className="space-y-1">
                  {list.map((issue) => {
                    const Icon = KIND_ICON[issue.kind];
                    return (
                      <li key={issue.id}>
                        <button
                          type="button"
                          onClick={() => go(issue.route)}
                          disabled={!issue.route}
                          className={cn(
                            'flex w-full items-start gap-2.5 rounded-md border border-border/70 bg-card px-2.5 py-2 text-left transition-colors',
                            issue.route && 'hover:border-primary/50'
                          )}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">{issue.what}</span>
                            <span className="block text-[11px] leading-snug text-muted-foreground">{issue.why}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Button
            type="button"
            variant="fantasma"
            onClick={() => window.dispatchEvent(new Event(SYNC_NOW_EVENT))}
            disabled={status.phase === 'syncing'}
          >
            <RefreshCw className={cn('h-4 w-4', status.phase === 'syncing' && 'animate-spin')} />
            {tr('Sincronizar ahora')}
          </Button>
          <Button type="button" variant="gris" onClick={() => setOpen(false)}>
            {tr('Cerrar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
