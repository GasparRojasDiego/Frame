import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isTauri } from '@tauri-apps/api/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatHMS } from '@/lib/duration';
import { useCourse } from '@/context/CourseContext';
import { useTimerTime } from '@/lib/timer-clock';
import { isRichNoteEmpty } from '@/lib/rich-note';
import { useToast } from '@/hooks/use-toast';
import NoteEditor from './NoteEditor';
import { Play, Pause, StopCircle, X, Minimize2, Maximize2, Timer, Clock, NotebookPen } from 'lucide-react';
import { intlLocale, tr } from '@/lib/i18n';

// ============================================================
// Hora oficial de Perú (America/Lima) con máxima precisión: al activarse se
// sincroniza una vez contra un servidor de hora (corrige el desfase del
// reloj del equipo) y de ahí avanza con el reloj local, segundo a segundo.
// ============================================================
const PERU_CLOCK_KEY = 'miniTimerShowPeruClock';
let peruOffsetMs = 0; // corrección servidor − equipo (0 si no se pudo sincronizar)
let peruOffsetSynced = false;

async function syncPeruOffset() {
  if (peruOffsetSynced || !navigator.onLine) return;
  try {
    const t0 = Date.now();
    const resp = await fetch('https://worldtimeapi.org/api/timezone/America/Lima');
    if (!resp.ok) return;
    const data = await resp.json();
    const t1 = Date.now();
    // Compensa la latencia de red asumiendo ida y vuelta simétricas.
    const serverNow = new Date(data.utc_datetime).getTime() + (t1 - t0) / 2;
    peruOffsetMs = serverNow - t1;
    peruOffsetSynced = true;
  } catch {
    /* sin sincronización externa se usa el reloj del sistema */
  }
}

/** Bandera del Perú (franjas rojo-blanco-rojo), para acompañar a su hora. */
export function PeruFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={cn('shrink-0 rounded-[1.5px] ring-1 ring-border/70', className)} aria-hidden>
      <rect width="10" height="20" fill="#D91023" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#D91023" />
    </svg>
  );
}

export function PeruClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void syncPeruOffset();
    // Tick alineado al segundo para que el cambio de dígito sea exacto.
    let interval: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(() => {
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), 1000);
    }, 1000 - ((Date.now() + peruOffsetMs) % 1000));
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, []);

  const time = new Date(now + peruOffsetMs).toLocaleTimeString(intlLocale(), {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  if (compact) {
    return (
      <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
        {time}
      </span>
    );
  }
  return (
    <div className="mt-2 flex items-center justify-center gap-1.5 text-muted-foreground">
      <PeruFlag className="h-2.5 w-[15px]" />
      <span className="text-[10px] font-semibold">{tr('Perú')}</span>
      <span className="font-mono text-sm font-bold text-foreground tabular-nums">{time}</span>
    </div>
  );
}

// Mini tarjeta flotante del temporizador/cronómetro. Visible en toda la app
// con tres estados: detallada, compacta y cerrada (la X pausa la sesión).
export default function MiniTimerCard() {
  const {
    miniTimerView,
    setMiniTimerView,
    timerMode,
    isTimerActive,
    setIsTimerActive,
    setIsTimerPaused,
    sessionStartTime,
    setSessionStartTime,
    requestFinish,
    addSessionNote,
  } = useCourse();
  const timerTime = useTimerTime();
  const { toast } = useToast();

  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Anotar un avance desde la propia tarjeta, como en la ventana nativa: el
  // mismo editor (siempre texto, con su barra de formato) en pequeño.
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Opción persistente: mostrar también la hora en tiempo real de Perú.
  const [showPeruClock, setShowPeruClock] = useState(
    () => localStorage.getItem(PERU_CLOCK_KEY) === '1'
  );
  const togglePeruClock = () => {
    setShowPeruClock((prev) => {
      localStorage.setItem(PERU_CLOCK_KEY, prev ? '0' : '1');
      return !prev;
    });
  };

  // --- Arrastre libre: la tarjeta se puede mover a cualquier parte y queda
  // siempre dentro de la pantalla (posición recordada entre sesiones). ---
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('miniTimerPos') ?? 'null');
    } catch {
      return null;
    }
  });

  const clampToViewport = useCallback((x: number, y: number) => {
    const el = wrapRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8)),
    };
  }, []);

  // Reencuadra al cambiar el tamaño de la ventana o el estado de la tarjeta
  // (la vista detallada y la compacta miden distinto).
  useEffect(() => {
    const reclamp = () =>
      setPos((p) => {
        if (!p || !wrapRef.current) return p;
        const c = clampToViewport(p.x, p.y);
        if (c.x === p.x && c.y === p.y) return p;
        localStorage.setItem('miniTimerPos', JSON.stringify(c));
        return c;
      });
    reclamp();
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [miniTimerView, clampToViewport]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Los controles siguen siendo clics normales: solo arrastra el "cuerpo".
    if ((e.target as HTMLElement).closest('button, input, a, [contenteditable="true"]')) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragState.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    el.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const { dx, dy } = dragState.current;
    setPos(clampToViewport(e.clientX - dx, e.clientY - dy));
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    dragState.current = null;
    wrapRef.current?.releasePointerCapture(e.pointerId);
    setPos((p) => {
      if (p) localStorage.setItem('miniTimerPos', JSON.stringify(p));
      return p;
    });
  };

  const wrapperProps = {
    ref: wrapRef,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    style: pos ? { left: pos.x, top: pos.y } : undefined,
    className: cn(
      'fixed z-50 animate-in fade-in-0 slide-in-from-bottom-2 cursor-grab active:cursor-grabbing touch-none select-none',
      !pos && 'bottom-24 right-6'
    ),
  };

  // En la app de escritorio la vista flotante es una VENTANA NATIVA
  // siempre-encima-de-todo (MiniTimerWindow); esta tarjeta en-app solo se
  // usa en el navegador (desarrollo).
  if (isTauri()) return null;

  if (miniTimerView === 'hidden') return null;

  const canStart = !(timerMode === 'focus' && timerTime === 0);

  const handleStartPause = () => {
    if (!canStart) return;
    const next = !isTimerActive;
    setIsTimerActive(next);
    setIsTimerPaused(!next);
    if (next && sessionStartTime === 0) {
      setSessionStartTime(timerMode === 'focus' ? timerTime : 1);
    }
  };

  const handleFinish = () => {
    if (sessionStartTime === 0) return;
    requestFinish();
    if (pathname !== '/temporizador') navigate('/temporizador');
  };

  const handleClose = () => {
    // La X oculta la tarjeta y pausa la sesión en curso.
    if (isTimerActive) {
      setIsTimerActive(false);
      setIsTimerPaused(true);
    }
    setMiniTimerView('hidden');
  };

  const progress =
    timerMode === 'focus' && sessionStartTime > 0
      ? Math.max(0, Math.min(1, (sessionStartTime - timerTime) / sessionStartTime))
      : 0;

  const hasSession = sessionStartTime > 0;
  const elapsedSec = Math.max(0, Math.round(timerMode === 'focus' ? sessionStartTime - timerTime : timerTime));

  const closeNote = () => {
    setNoteOpen(false);
    setNoteText('');
  };

  const submitNote = () => {
    const clean = noteText.trim();
    if (!hasSession || isRichNoteEmpty(clean)) return;
    addSessionNote({ text: clean, elapsedSec });
    toast({ title: tr('Avance anotado'), description: tr('Minuto {hMS} de la sesión.', { hMS: formatHMS(elapsedSec) }) });
    closeNote();
  };

  if (miniTimerView === 'compact') {
    return (
      <div {...wrapperProps}>
        <Card className="flex items-center gap-3 rounded-full border-primary/40 bg-card/95 py-2 pl-5 pr-3 shadow-2xl backdrop-blur">
          <span className="font-mono text-lg font-bold text-foreground tabular-nums">
            {formatHMS(timerTime)}
          </span>
          {showPeruClock && <PeruClock compact />}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleStartPause}
              disabled={!canStart}
            >
              {isTimerActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive"
              onClick={handleFinish}
              disabled={sessionStartTime === 0}
            >
              <StopCircle className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-muted-foreground"
              onClick={() => setMiniTimerView('full')}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div {...wrapperProps}>
      <Card className="w-72 border-primary/40 bg-card/95 p-4 shadow-2xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Timer className="h-4 w-4 text-primary" />
            {timerMode === 'focus' ? tr('Temporizador') : tr('Cronómetro')}
            {isTimerActive && (
              <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Anotar el avance sin ir a Estudio ni cerrar la sesión. */}
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                'h-7 w-7',
                noteOpen ? 'text-primary hover:text-primary' : 'text-muted-foreground'
              )}
              onClick={() => (noteOpen ? closeNote() : setNoteOpen(true))}
              disabled={!hasSession}
              title={hasSession ? tr('Anotar un avance') : tr('Inicia la sesión para anotar avances')}
            >
              <NotebookPen className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                'h-7 w-7',
                showPeruClock ? 'text-primary hover:text-primary' : 'text-muted-foreground'
              )}
              onClick={togglePeruClock}
              title={showPeruClock ? tr('Ocultar la hora de Perú') : tr('Mostrar la hora de Perú')}
            >
              <Clock className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setMiniTimerView('compact')}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {noteOpen && hasSession ? (
          /* Anotación en caliente: el reloj queda arriba, pequeño. */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground">
                {tr('Anotar avance')}
              </span>
              <span className="font-mono text-xs font-bold tabular-nums text-primary">
                {formatHMS(timerTime)}
              </span>
            </div>
            <NoteEditor
              ariaLabel={tr('Avance de la sesión')}
              value={noteText}
              onChange={setNoteText}
              onSubmit={submitNote}
              onCancel={closeNote}
              placeholder={tr('Escribe tu avance…')}
              rows={4}
              autoFocus
              dense
            />
            <div className="flex justify-end gap-1.5">
              <Button variant="gris" className="h-7 px-2.5 py-0 text-[11px] font-semibold" onClick={closeNote}>
                {tr('Cancelar')}
              </Button>
              <Button
                className="h-7 px-3 py-0 text-[11px] font-semibold"
                onClick={submitNote}
                disabled={isRichNoteEmpty(noteText)}
              >
                {tr('Anotar')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-center font-mono text-4xl font-bold text-foreground tabular-nums">
              {formatHMS(timerTime)}
            </p>

            {showPeruClock && <PeruClock />}

            {timerMode === 'focus' && sessionStartTime > 0 && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button className="flex-1 text-xs" onClick={handleStartPause} disabled={!canStart}>
                {isTimerActive ? (
                  <Pause className="mr-2 h-4 w-4" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {isTimerActive ? tr('Pausar') : sessionStartTime > 0 ? tr('Reanudar') : tr('Iniciar')}
              </Button>
              <Button
                variant="secondary"
                className={cn(
                  'flex-1 text-xs border border-transparent',
                  sessionStartTime > 0 &&
                    'hover:border-destructive hover:bg-destructive/20 hover:text-destructive-foreground'
                )}
                onClick={handleFinish}
                disabled={sessionStartTime === 0}
              >
                <StopCircle className="mr-2 h-4 w-4" />
                {tr('Finalizar')}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
