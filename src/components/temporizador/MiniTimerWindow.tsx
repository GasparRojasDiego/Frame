import { useEffect, useRef, useState } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
  Play,
  Pause,
  StopCircle,
  X,
  Timer,
  Hourglass,
  LoaderCircle,
  Minimize2,
  Maximize2,
  NotebookPen,
  MoreHorizontal,
  ArrowLeft,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isRichNoteEmpty } from '@/lib/rich-note';
import { Button } from '@/components/ui/button';
import { PeruClock, PeruFlag } from './MiniTimerCard';
import NoteEditor from './NoteEditor';

// ============================================================
// Contenido de la ventana flotante NATIVA de Enfoque.
//
// Corre en su propia ventana Tauri ("minitimer"): sin bordes, siempre por
// encima de todo (incluso de otras aplicaciones) y viva aunque la ventana
// principal esté cerrada en la bandeja. No monta la app completa: pinta el
// estado que la ventana principal le envía y le devuelve órdenes.
//
// EL SEGUNDERO ES PROPIO. La ventana principal manda el reloj en cada tic, pero
// cuando está oculta o tapada Chromium estrangula sus temporizadores y esos
// tics llegan a trompicones: el tiempo «se estancaba» cada pocos segundos (con
// música sonando no pasaba, porque una página con audio no se estrangula).
// Aquí cada estado llega con su marca de tiempo (`anchorAt`) y esta ventana
// —que siempre está a la vista— calcula el reloj por su cuenta entre uno y otro.
// ============================================================

interface MiniState {
  time: number;
  mode: 'focus' | 'stopwatch';
  active: boolean;
  sessionStartTime: number;
  /** Tamaño elegido en la app: 'full' = mediana, 'compact' = pequeña. */
  view?: 'full' | 'compact';
  /** Instante (ms) en que `time` era exacto. */
  anchorAt?: number;
}

const PERU_CLOCK_KEY = 'miniTimerShowPeruClock';
/** La ventana principal guarda aquí el último tamaño elegido; ambas
 *  ventanas comparten origen, así que la maqueta correcta se pinta desde
 *  el primer fotograma, sin esperar al primer 'mini-timer-state'. */
const SIZE_KEY = 'miniTimerSize';

function formatTime(seconds: number) {
  const t = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** El reloj AHORA, extrapolado desde el último estado recibido. */
function liveSeconds(state: MiniState): number {
  if (!state.active || !state.anchorAt) return state.time;
  const elapsed = Math.max(0, Math.floor((Date.now() - state.anchorAt) / 1000));
  return state.mode === 'focus' ? Math.max(0, state.time - elapsed) : state.time + elapsed;
}

const iconButton =
  'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40';

export default function MiniTimerWindow() {
  const [state, setState] = useState<MiniState | null>(null);
  const [view, setView] = useState<'full' | 'compact'>(() =>
    localStorage.getItem(SIZE_KEY) === 'compact' ? 'compact' : 'full'
  );
  // Anotación de avance: la ventana solo recoge el texto; la ventana
  // principal es la que sabe en qué minuto de sesión va y lo guarda.
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  /** Vista compacta: la fila de opciones (⋯) sustituye a la del reloj. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setTick] = useState(0);
  const zeroAskedRef = useRef(false);

  const [showPeruClock, setShowPeruClock] = useState(
    () => localStorage.getItem(PERU_CLOCK_KEY) === '1'
  );

  useEffect(() => {
    // La ventana es transparente: solo se ve la tarjeta (sin sombra, que en
    // una ventana de este tamaño se recortaba a los lados).
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const unlisten = listen<MiniState>('mini-timer-state', (e) => {
      setState({ ...e.payload, anchorAt: e.payload.anchorAt ?? Date.now() });
      if (e.payload.view) setView(e.payload.view);
    });
    // La ventana principal emite el estado en cada tick, pero el reloj solo
    // corre mientras la sesión está activa: si nos abren en pausa hay que
    // pedirlo una vez, ya con el listener registrado.
    void unlisten.then(() => emit('mini-timer-cmd', { action: 'sync' })).catch(() => {});
    return () => {
      void unlisten.then((f) => f());
    };
  }, []);

  // Segundero propio: repinta cuatro veces por segundo mientras corre.
  useEffect(() => {
    if (!state?.active) return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [state?.active]);

  const time = state ? liveSeconds(state) : 0;

  // El temporizador llegó a cero AQUÍ antes de que la ventana principal (quizá
  // estrangulada) se entere: se la despierta para que cierre la sesión y avise.
  useEffect(() => {
    if (!state?.active || state.mode !== 'focus') {
      zeroAskedRef.current = false;
      return;
    }
    if (time === 0 && !zeroAskedRef.current) {
      zeroAskedRef.current = true;
      void emit('mini-timer-cmd', { action: 'sync' }).catch(() => {});
    }
  }, [time, state?.active, state?.mode]);

  // Con el editor de notas abierto la ventana mediana crece para que quepa.
  useEffect(() => {
    if (view !== 'full') return;
    void invoke('open_mini_timer', { compact: false, tall: noteOpen }).catch(() => {});
  }, [noteOpen, view]);

  const send = (action: 'toggle' | 'finish' | 'close' | 'mode') =>
    void emit('mini-timer-cmd', { action }).catch(() => {});

  // El cambio de tamaño lo aplica la app principal: redimensiona esta
  // ventana nativa y nos devuelve el nuevo `view` en 'mini-timer-state'.
  const sendSize = (size: 'full' | 'compact') =>
    void emit('mini-timer-cmd', { action: 'size', size }).catch(() => {});

  const submitNote = () => {
    const clean = noteText.trim();
    if (isRichNoteEmpty(clean)) return;
    void emit('mini-timer-cmd', { action: 'note', text: clean });
    setNoteText('');
    setNoteOpen(false);
  };

  /** «Anotar avance» abre SIEMPRE el recuadro mediano, venga de donde venga. */
  const openNote = () => {
    setMenuOpen(false);
    setNoteOpen(true);
    if (view !== 'full') sendSize('full');
  };

  const togglePeruClock = () => {
    setShowPeruClock((prev) => {
      localStorage.setItem(PERU_CLOCK_KEY, prev ? '0' : '1');
      return !prev;
    });
  };

  const hasSession = !!state && state.sessionStartTime > 0;
  const canStart = state ? !(state.mode === 'focus' && time === 0) : false;
  const canSwitchMode = !!state && !hasSession;
  const isStopwatch = state?.mode === 'stopwatch';
  const ModeIcon = isStopwatch ? Hourglass : Timer;
  const otherMode = isStopwatch ? 'temporizador' : 'cronómetro';
  const modeTitle = canSwitchMode
    ? `Cambiar a ${otherMode}`
    : 'El modo se cambia entre sesiones, no durante una';
  const progress =
    state && state.mode === 'focus' && state.sessionStartTime > 0
      ? Math.max(0, Math.min(1, (state.sessionStartTime - time) / state.sessionStartTime))
      : 0;

  // ------------------------------------------------------------
  // Maqueta COMPACTA: una sola fila en 280x74 px.
  // ------------------------------------------------------------
  if (view === 'compact') {
    const menuAction = (label: string, Icon: typeof Timer, onClick: () => void, disabled = false, danger = false) => (
      <button
        key={label}
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={cn(
          'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md py-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40',
          danger && 'hover:text-destructive'
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="w-full truncate text-center text-[8.5px] font-semibold leading-none">{label}</span>
      </button>
    );

    return (
      <div className="h-screen w-screen">
        <div
          data-tauri-drag-region
          className="relative flex h-full w-full cursor-grab items-center gap-1.5 overflow-hidden rounded-xl border border-primary/50 bg-card px-2.5"
        >
          {/* Avance del temporizador: una línea fina en la base. */}
          {state?.mode === 'focus' && hasSession && (
            <span
              className="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-primary transition-[width] duration-1000"
              style={{ width: `${progress * 100}%` }}
            />
          )}

          {menuOpen ? (
            <>
              <button className={iconButton} onClick={() => setMenuOpen(false)} title="Volver al reloj">
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              {menuAction('Anotar', NotebookPen, openNote, !hasSession)}
              {menuAction('Mediana', Maximize2, () => {
                setMenuOpen(false);
                sendSize('full');
              })}
              {menuAction(isStopwatch ? 'Temporiz.' : 'Cronóm.', ArrowLeftRight, () => send('mode'), !canSwitchMode)}
              {menuAction('Cerrar', X, () => send('close'), false, true)}
            </>
          ) : (
            <>
              {/* El icono del modo es también el interruptor: entre sesiones
                  pasa de temporizador a cronómetro y al revés de un toque. */}
              <button
                type="button"
                onClick={() => send('mode')}
                disabled={!canSwitchMode}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  state?.active
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border bg-secondary/60 text-muted-foreground',
                  canSwitchMode && 'hover:border-primary/60 hover:bg-primary/15 hover:text-primary',
                  'disabled:cursor-default'
                )}
                title={canSwitchMode ? `${isStopwatch ? 'Cronómetro' : 'Temporizador'} · pulsa para cambiar a ${otherMode}` : modeTitle}
              >
                <ModeIcon className="h-3.5 w-3.5" />
              </button>
              {state ? (
                // Centrado entre el botón del modo y los de la derecha.
                <span
                  data-tauri-drag-region
                  className="min-w-0 flex-1 truncate text-center font-mono text-xl font-bold tabular-nums text-foreground"
                >
                  {formatTime(time)}
                </span>
              ) : (
                <span data-tauri-drag-region className="flex flex-1 items-center justify-center gap-1.5 text-muted-foreground">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-[11px]">Conectando…</span>
                </span>
              )}
              <button
                className="rounded-lg bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
                onClick={() => send('toggle')}
                disabled={!canStart}
                title={state?.active ? 'Pausar' : hasSession ? 'Reanudar' : 'Iniciar'}
              >
                {state?.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button
                className="rounded-lg bg-secondary p-1.5 text-secondary-foreground transition-colors hover:bg-destructive/20 hover:text-destructive disabled:opacity-50"
                onClick={() => send('finish')}
                disabled={!hasSession}
                title="Finalizar"
              >
                <StopCircle className="h-3.5 w-3.5" />
              </button>
              <button className={iconButton} onClick={() => setMenuOpen(true)} title="Más opciones">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Maqueta MEDIANA: 300x190 px (300x300 mientras se anota).
  // ------------------------------------------------------------
  return (
    <div className="h-screen w-screen">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-primary/50 bg-card">
        {/* Cabecera: zona de arrastre de la ventana */}
        <div
          data-tauri-drag-region
          className="flex cursor-grab items-center justify-between border-b border-border/60 bg-secondary/30 py-1 pl-2 pr-1"
        >
          <button
            onClick={() => send('mode')}
            disabled={!canSwitchMode}
            title={modeTitle}
            className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors enabled:hover:bg-secondary enabled:hover:text-foreground disabled:cursor-default"
          >
            <ModeIcon className="h-3.5 w-3.5 text-primary" />
            {isStopwatch ? 'Cronómetro' : 'Temporizador'}
            {canSwitchMode && <ArrowLeftRight className="h-3 w-3 opacity-50 group-hover:opacity-100" />}
            {state?.active && <span className="ml-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
          </button>
          <div className="flex items-center">
            {/* Anotar el avance sin volver a la app ni cerrar la sesión. */}
            <button
              className={cn(iconButton, noteOpen && 'text-primary')}
              onClick={() => (noteOpen ? setNoteOpen(false) : openNote())}
              disabled={!hasSession}
              title={hasSession ? 'Anotar un avance' : 'Inicia la sesión para anotar avances'}
            >
              <NotebookPen className="h-3.5 w-3.5" />
            </button>
            <button
              className={cn(iconButton, 'flex items-center', showPeruClock && 'bg-primary/10')}
              onClick={togglePeruClock}
              title={showPeruClock ? 'Ocultar la hora de Perú' : 'Mostrar la hora de Perú'}
            >
              <PeruFlag className="h-2.5 w-[15px]" />
            </button>
            <button className={iconButton} onClick={() => sendSize('compact')} title="Vista compacta">
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <button
              className={cn(iconButton, 'hover:text-destructive')}
              onClick={() => send('close')}
              title="Cerrar (pausa la sesión)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {noteOpen ? (
          /* Anotación en caliente: la ventana crece y el reloj queda arriba,
             pequeño. El mismo editor que en la app (siempre texto, con su
             barra de formato), en versión compacta. */
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground">
                Anotar avance
              </span>
              <span className="font-mono text-xs font-bold tabular-nums text-primary">{formatTime(time)}</span>
            </div>
            <NoteEditor
              ariaLabel="Avance de la sesión"
              value={noteText}
              onChange={setNoteText}
              onSubmit={submitNote}
              onCancel={() => setNoteOpen(false)}
              placeholder="Escribe tu avance…"
              rows={4}
              autoFocus
              dense
              className="flex-1"
            />
            <div className="flex justify-end gap-1.5">
              <Button
                variant="gris"
                onClick={() => setNoteOpen(false)}
                className="h-6 px-2.5 py-0 text-[10.5px] font-semibold"
              >
                Cancelar
              </Button>
              <Button
                onClick={submitNote}
                disabled={isRichNoteEmpty(noteText)}
                className="h-6 px-3 py-0 text-[10.5px] font-semibold"
              >
                Anotar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div data-tauri-drag-region className="flex flex-1 cursor-grab flex-col items-center justify-center px-3">
              {state ? (
                <p
                  data-tauri-drag-region
                  className="text-center font-mono text-[40px] font-bold leading-none tabular-nums text-foreground"
                >
                  {formatTime(time)}
                </p>
              ) : (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs">Conectando…</span>
                </div>
              )}
              {showPeruClock && <PeruClock />}
            </div>

            {state && state.mode === 'focus' && hasSession && (
              <div className="mx-3 mb-2 h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-1000"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}

            <div className="flex gap-2 px-3 pb-3">
              <button
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
                onClick={() => send('toggle')}
                disabled={!canStart}
              >
                {state?.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {state?.active ? 'Pausar' : hasSession ? 'Reanudar' : 'Iniciar'}
              </button>
              <button
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-secondary/60 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
                onClick={() => send('finish')}
                disabled={!hasSession}
              >
                <StopCircle className="h-3.5 w-3.5" />
                Finalizar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
