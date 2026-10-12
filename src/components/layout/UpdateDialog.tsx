import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ElementType, type ReactNode } from 'react';
import {
  Check,
  CircleAlert,
  Download,
  HardDriveDownload,
  Hourglass,
  LoaderCircle,
  PackageOpen,
  RotateCw,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EchoWord from '@/components/shared/EchoWord';
import { useUpdateState } from '@/components/layout/UpdateBadge';
import { useCourse } from '@/context/CourseContext';
import { isRecorderBusy, subscribeRecorderBusy } from '@/lib/recordings';
import {
  closeUpdateDialog,
  estimateUpdate,
  formatBytes,
  formatDuration,
  formatSpeed,
  recordUpdateLanding,
  startUpdateInstall,
  UPDATE_STEPS,
  type SpeedSource,
  type UpdateStep,
} from '@/lib/updater';
import { APP_VERSION } from '@/lib/version';
import { cn } from '@/lib/utils';

// ============================================================
// Recuadro de actualización (desde la 1.6.2).
//
// Lo abren el testigo junto al perfil y la entrada de la campana. Antes de
// confirmar dice cuánto pesa la versión nueva y cuánto falta para poder
// usarla, paso a paso; al confirmar muestra el porcentaje real de la
// descarga, el paso en curso y el tiempo restante, que se recalcula en vivo
// con la velocidad medida (ver «Estimación» en lib/updater.ts).
//
// Con una sesión de estudio en marcha, música sonando o una grabación a medias
// no deja actualizar: el reinicio las cortaría. Lo dice y el botón vuelve en
// cuanto se liberan.
// ============================================================

const STEP_META: Record<UpdateStep, { label: string; icon: ElementType }> = {
  download: { label: 'Descargar', icon: Download },
  verify: { label: 'Verificar firma', icon: ShieldCheck },
  install: { label: 'Instalar', icon: PackageOpen },
  restart: { label: 'Reiniciar', icon: RotateCw },
};

type StepStatus = 'pending' | 'current' | 'waiting' | 'done';

const SPEED_CAPTION: Record<Exclude<SpeedSource, 'medida'>, (speed: string) => string> = {
  anterior: (speed) => `Según tu última descarga (${speed})`,
  conexion: (speed) => `Según tu conexión (≈ ${speed})`,
  supuesta: () => 'Aproximado: aún no hay medidas de este equipo',
};

/** Por qué no se puede actualizar ahora (o, si ya se descarga, a qué esperará
 *  para instalar: entonces queda «lista» y se instala con «Instalar ahora»). */
function busyMessage(studying: boolean, music: boolean, recording: boolean, downloading: boolean): string {
  // [lo que espera, lo que se pide]
  const parts: [string, string][] = [];
  if (studying) parts.push(['termines tu sesión de estudio', 'termina tu sesión de estudio']);
  if (recording) parts.push(['termines y guardes la grabación', 'termina y guarda la grabación']);
  if (music) parts.push(['pauses la música', 'pausa la música']);
  const list = (items: string[]) =>
    items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0] ?? '';
  const wait = list(parts.map(([w]) => w));
  const ask = list(parts.map(([, a]) => a));
  const cut = parts.length > 1 ? 'las cortaría' : 'la cortaría';
  return downloading
    ? `Al terminar la descarga esperará a que ${wait}: el reinicio ${cut}.`
    : `${ask.charAt(0).toUpperCase()}${ask.slice(1)} para actualizar: el reinicio ${cut}.`;
}

/**
 * Cuenta atrás suave: el tiempo restante baja solo con el reloj y se acerca
 * poco a poco a cada estimación nueva, en lugar de saltar con cada muestra.
 */
function useSmoothCountdown(target: number, active: boolean): number {
  const ref = useRef<{ value: number; at: number } | null>(null);
  const now = performance.now();
  if (!active || ref.current === null) {
    ref.current = active ? { value: target, at: now } : null;
    return target;
  }
  const dt = now - ref.current.at;
  const predicted = Math.max(0, ref.current.value - dt);
  const value = predicted + (target - predicted) * (1 - Math.exp(-dt / 1500));
  ref.current = { value, at: now };
  return value;
}

export default function UpdateDialog() {
  const update = useUpdateState();
  const { isTimerActive, isPlaying } = useCourse();
  const recording = useSyncExternalStore(subscribeRecorderBusy, isRecorderBusy, isRecorderBusy);
  const { phase, version, dialogOpen, error } = update;
  const [now, setNow] = useState(() => performance.now());

  // Primer arranque tras actualizar: aquí Frame ya se puede usar, así que es
  // el final del cronómetro de «instalar» y «reiniciar».
  useEffect(() => recordUpdateLanding(), []);

  // Con el recuadro abierto, la estimación se rehace cada medio segundo
  // aunque no lleguen datos (verificando o instalando, por ejemplo).
  useEffect(() => {
    if (!dialogOpen) return;
    const id = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(id);
  }, [dialogOpen]);

  const estimate = useMemo(() => estimateUpdate(now), [update, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const started = phase === 'downloading' || phase === 'verifying' || phase === 'ready' || phase === 'installing';
  const remaining = useSmoothCountdown(estimate.remainingMs, started && phase !== 'ready');
  const blocked = isTimerActive || isPlaying || recording;

  const statusOf = (step: UpdateStep): StepStatus => {
    if (!started || !estimate.current) return 'pending';
    const at = UPDATE_STEPS.indexOf(step);
    const current = UPDATE_STEPS.indexOf(estimate.current);
    if (at < current) return 'done';
    if (at > current) return 'pending';
    return phase === 'ready' ? 'waiting' : 'current';
  };

  const percent = update.progress !== null ? Math.round(update.progress * 100) : null;
  const sizeLabel = `${estimate.sizeKnown ? '' : '≈ '}${formatBytes(estimate.size)}`;

  return (
    <Dialog open={dialogOpen && !!version} onOpenChange={(open) => !open && closeUpdateDialog()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* Cabecera: «ACTUALIZAR» a la deriva detrás del título. */}
        <DialogHeader className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-transparent px-6 pb-4 pt-6">
          <EchoWord word="Actualizar" />
          <DialogTitle className="relative text-center text-xl font-bold text-primary">Frame {version}</DialogTitle>
          <DialogDescription className="relative text-center text-xs">Tienes la {APP_VERSION}</DialogDescription>
        </DialogHeader>
        <div className="mx-6 border-t border-border/70" />

        <div className="space-y-5 px-6 py-5">
          {!started ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Figure icon={HardDriveDownload} label="Peso" value={sizeLabel} hint="del instalador" />
                <Figure
                  icon={Timer}
                  label="Tiempo estimado"
                  value={`≈ ${formatDuration(estimate.remainingMs)}`}
                  hint="hasta poder usarla"
                />
              </div>
              <p className="-mt-2 text-center text-[11px] text-muted-foreground">
                {estimate.speedSource === 'medida'
                  ? formatSpeed(estimate.speed)
                  : SPEED_CAPTION[estimate.speedSource](formatSpeed(estimate.speed))}
              </p>
            </>
          ) : (
            <div className="space-y-3" aria-live="polite">
              <div className="text-center">
                <p className="font-headline text-5xl font-black tabular-nums leading-none text-foreground">
                  {percent ?? '—'}
                  <span className="ml-0.5 text-2xl font-bold text-muted-foreground">%</span>
                </p>
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                  {phase === 'downloading'
                    ? update.downloaded > 0
                      ? `${formatBytes(update.downloaded)} de ${sizeLabel}${update.speed ? ` · ${formatSpeed(update.speed)}` : ''}`
                      : 'Conectando…'
                    : phase === 'verifying'
                      ? `${sizeLabel} descargados · comprobando la firma`
                      : phase === 'ready'
                        ? 'Descargada y verificada: lista para instalar'
                        : 'Frame se cerrará y volverá a abrirse sola'}
                </p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
                  style={{ width: `${percent ?? 0}%` }}
                />
              </div>
              {phase !== 'ready' && (
                <p className="text-center text-sm text-foreground">
                  Quedan <span className="font-semibold tabular-nums">≈ {formatDuration(remaining)}</span>
                  <span className="text-muted-foreground"> hasta poder usarla</span>
                </p>
              )}
            </div>
          )}

          {/* Los pasos, con el que está en curso marcado. */}
          <ol className="space-y-1">
            {UPDATE_STEPS.map((step) => {
              const status = statusOf(step);
              const { label, icon: Icon } = STEP_META[step];
              return (
                <li
                  key={step}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    status === 'current' || status === 'waiting' ? 'bg-primary/10 text-foreground' : 'text-foreground/80',
                    status === 'done' && 'text-muted-foreground'
                  )}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                      status === 'done' && 'border-primary bg-primary text-primary-foreground',
                      status === 'current' && 'border-primary text-primary',
                      status === 'waiting' && 'border-primary/60 text-primary',
                      status === 'pending' && 'border-border text-muted-foreground'
                    )}
                  >
                    {status === 'done' ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : status === 'current' ? (
                      <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" />
                    ) : status === 'waiting' ? (
                      <Hourglass className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className={cn('flex-1', status === 'current' && 'font-semibold')}>{label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {status === 'done'
                      ? 'Hecho'
                      : status === 'waiting'
                        ? 'En espera'
                        : `≈ ${formatDuration(estimate.steps[step])}`}
                  </span>
                </li>
              );
            })}
          </ol>

          {blocked && phase !== 'installing' && (
            <Notice>
              {busyMessage(isTimerActive, isPlaying, recording, phase === 'downloading' || phase === 'verifying')}
            </Notice>
          )}
          {error && !started && <Notice>{error}</Notice>}
        </div>

        <div className="mx-6 border-t border-border/70" />
        <div className="flex justify-end gap-2 px-6 py-4">
          {!started ? (
            <>
              <Button variant="gris" onClick={closeUpdateDialog}>
                Cancelar
              </Button>
              <Button onClick={() => void startUpdateInstall()} disabled={blocked} data-tour="actualizar-confirmar">
                <Download />
                {error ? 'Reintentar' : 'Actualizar ahora'}
              </Button>
            </>
          ) : phase === 'ready' ? (
            <>
              <Button variant="fantasma" onClick={closeUpdateDialog}>
                Ocultar
              </Button>
              <Button onClick={() => void startUpdateInstall()} disabled={blocked}>
                <PackageOpen />
                Instalar ahora
              </Button>
            </>
          ) : phase === 'installing' ? (
            <Button disabled>
              <LoaderCircle className="motion-safe:animate-spin" />
              Instalando…
            </Button>
          ) : (
            // La descarga sigue aunque el recuadro se cierre; el anillo del
            // testigo muestra el avance y un clic lo vuelve a abrir.
            <Button variant="fantasma" onClick={closeUpdateDialog}>
              Ocultar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Una cifra grande con su etiqueta (peso, tiempo estimado). */
function Figure({ icon: Icon, label, value, hint }: { icon: ElementType; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/10 to-primary/5 px-4 py-3 text-center">
      <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </p>
      <p className="mt-1 font-headline text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Aviso en rojo suave (lo que impide actualizar, o el último fallo). */
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-destructive/60 bg-destructive/10 px-3.5 py-3 text-xs leading-relaxed text-foreground">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p>{children}</p>
    </div>
  );
}
