import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Play, Pause, StopCircle, RefreshCcw, PictureInPicture2, Minimize2, EyeOff, NotebookPen } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import FinishSessionForm from './finish-session-form';
import type { StudySession } from '@/types';
import { useCourse } from '@/context/CourseContext';
import { useTimerTime } from '@/lib/timer-clock';
import SessionNoteDialog from '@/components/temporizador/SessionNoteDialog';
import FocusTimePicker from '@/components/temporizador/FocusTimePicker';
import { useToast } from '@/hooks/use-toast';


const MIN_TIME = 0; // 0 minutes
// Tope del dial. Se sube de 3 h a 6 h: cubre cualquier bloque de estudio real
// sin quitarle precisión al arrastre (el círculo completo sigue siendo manejable).
// No se deja sin límite a propósito: un dial sin tope no se puede ajustar.
const MAX_TIME = 360 * 60; // 360 minutes
// El ARRASTRE del dial va de 5 en 5 minutos (con el círculo entero repartido en
// 6 h, afinar al minuto con el ratón sería imposible). El minuto exacto se pone
// con el selector de debajo: botones −/+ de un minuto o tecleando la cifra.
const STEP = 5 * 60; // 5 minutes
const TIME_RANGE = MAX_TIME - MIN_TIME;

interface TimerDisplayProps {
  onSessionComplete: (
    sessionData: Omit<StudySession, 'id' | 'startTime' | 'endTime' | 'duration' | 'durationSec'> & { durationSec: number }
  ) => void;
  disabled?: boolean;
}


export default function TimerDisplay({ onSessionComplete, disabled = false }: TimerDisplayProps) {
  const {
    timerMode: mode,
    setTimerMode,
    setTimerTime,
    isTimerActive: isActive,
    setIsTimerActive,
    setIsTimerPaused,
    sessionStartTime,
    setSessionStartTime,
    resetTimerState,
    selectionMode,
    miniTimerView,
    setMiniTimerView,
    autoFinishPending,
    clearAutoFinish,
    finishRequested,
    clearFinishRequest,
    clearSessionNotes,
  } = useCourse();
  // El segundero va aparte del contexto: ver src/lib/timer-clock.ts.
  const time = useTimerTime();

  const { toast } = useToast();

  const circleRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastAngleRef = useRef(0);

  const [isFinishing, setIsFinishing] = useState(false);
  const [finishedDuration, setFinishedDuration] = useState(0);
  const [finishTrigger, setFinishTrigger] = useState<'manual' | 'auto'>('manual');
  
  const timeToAngle = useCallback((currentTime: number) => {
    if (mode !== 'focus') return 0;
    if (TIME_RANGE <= 0) return 0;
    const proportion = (currentTime - MIN_TIME) / TIME_RANGE;
    return Math.max(0, Math.min(proportion, 1)) * 360;
  }, [mode]);
  
  const [angle, setAngle] = useState(() => timeToAngle(time));

  const handleFinish = useCallback((duration: number, trigger: 'manual' | 'auto') => {
    setIsTimerActive(false);
    // Se registra cualquier duración: ya no hace falta estudiar un minuto.
    if (duration > 0) {
      setFinishedDuration(duration);
      setFinishTrigger(trigger);
      setIsFinishing(true);
    } else {
      resetTimerState();
      setAngle(timeToAngle(0));
    }
  }, [setIsTimerActive, resetTimerState, timeToAngle]);

  const handleFinishClick = () => {
    if (disabled) return;

    let sessionDuration = 0;
    if (mode === 'focus' && sessionStartTime > 0) {
      sessionDuration = sessionStartTime - time;
    } else if (mode === 'stopwatch' && time > 0) {
      sessionDuration = time;
    }
    
    handleFinish(sessionDuration, 'manual');
  };

  // El conteo vive en CourseContext (sigue corriendo en toda la app).
  // Aquí solo reaccionamos a los eventos globales del temporizador:

  // 1. El temporizador de enfoque llegó a cero (quizá en otra interfaz).
  useEffect(() => {
    if (autoFinishPending) {
      clearAutoFinish();
      handleFinish(sessionStartTime, 'auto');
    }
  }, [autoFinishPending, clearAutoFinish, handleFinish, sessionStartTime]);

  // 2. El usuario pidió finalizar desde la mini tarjeta flotante.
  useEffect(() => {
    if (finishRequested) {
      clearFinishRequest();
      let sessionDuration = 0;
      if (mode === 'focus' && sessionStartTime > 0) {
        sessionDuration = sessionStartTime - time;
      } else if (mode === 'stopwatch' && time > 0) {
        sessionDuration = time;
      }
      handleFinish(sessionDuration, 'manual');
    }
  }, [finishRequested, clearFinishRequest, handleFinish, mode, sessionStartTime, time]);

  const handleStartPause = () => {
    if (disabled || (mode === 'focus' && time === 0)) return;
    
    // Toggle active state
    const newIsActive = !isActive;
    setIsTimerActive(newIsActive);

    // If starting for the first time, set the start time
    if (newIsActive && sessionStartTime === 0) {
      setSessionStartTime(mode === 'focus' ? time : 1);
    }
    
    // If we are pausing, set the global pause state
    if (!newIsActive) {
      setIsTimerPaused(true);
    } else {
      // If we are starting or resuming, unset the global pause state
      setIsTimerPaused(false);
    }
  };
  
  
  const handleFormSubmit = (data: {
    perception: number;
    subjects: string[];
    subjectIds: string[];
    taskIds: string[];
    notes: string;
  }) => {
    onSessionComplete({
      durationSec: Math.max(0, Math.round(finishedDuration)), // finishedDuration ya está en segundos
      sessionType: mode === 'focus' ? 'Temporizador' : 'Cronómetro',
      mode: selectionMode,
      ...data
    });
    
    // Reset state after submitting
    setIsFinishing(false);
    setFinishedDuration(0);
    resetTimerState();
    setAngle(timeToAngle(0));
  }

  const handleFormCancel = () => {
    // Just close the form, keep the timer paused.
    setIsFinishing(false);
  }

  /**
   * Descartar: la sesión NO se registra. Cubre el despiste (dejar el
   * cronómetro corriendo, pulsar Iniciar sin querer) sin obligar a inventar
   * una asignatura para poder cerrar el diálogo.
   */
  const handleFormDiscard = () => {
    // Las anotaciones eran DE esta sesión. Si se quedaran, se pegarían a la
    // siguiente o reaparecerían como "sesión sin registrar" al abrir Frame.
    clearSessionNotes();
    setIsFinishing(false);
    setFinishedDuration(0);
    resetTimerState();
    setAngle(timeToAngle(0));
    toast({
      title: 'Sesión descartada',
      description: 'No se ha registrado tiempo de estudio ni avance de tareas.',
    });
  }


  const handleModeChange = (newMode: 'focus' | 'stopwatch') => {
    if (sessionStartTime !== 0) return;

    setTimerMode(newMode);
    const initialTime = 0;
    resetTimerState();
    setTimerTime(initialTime);
    setAngle(timeToAngle(initialTime));
  };

  // Pasada la hora, el dial enseña dos filas: las horas arriba y mm:ss debajo.
  const dialHours = Math.floor(time / 3600);
  const dialMinutes = Math.floor((time % 3600) / 60);
  const dialClock = `${String(dialMinutes).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;

  /** Minutos exactos del temporizador (0–360), sin atarse al múltiplo de 5. */
  const setExactMinutes = (minutes: number) => {
    if (mode !== 'focus' || sessionStartTime !== 0 || disabled) return;
    const safe = Number.isFinite(minutes) ? Math.round(minutes) : 0;
    setTimerTime(Math.max(MIN_TIME, Math.min(safe * 60, MAX_TIME)));
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging.current || !circleRef.current || isActive || mode !== 'focus') return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = circleRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const newAngle = (Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI + 90 + 360) % 360;

    // Detect wrap-around and ignore it. A jump of >180 degrees is likely a wrap-around.
    const diff = newAngle - lastAngleRef.current;
    if (Math.abs(diff) > 180) {
        return; 
    }
    lastAngleRef.current = newAngle;
    
    const proportion = newAngle / 360;
    const timeFromAngle = MIN_TIME + proportion * TIME_RANGE;
    
    const nearestStep = Math.round((timeFromAngle - MIN_TIME) / STEP);
    const newTime = MIN_TIME + nearestStep * STEP;

    const clampedTime = Math.max(MIN_TIME, Math.min(newTime, MAX_TIME));
    setTimerTime(clampedTime);

  }, [isActive, mode, setTimerTime]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('touchmove', handleMouseMove);
    document.removeEventListener('touchend', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'focus' || isActive || disabled) return;
    e.preventDefault();
    isDragging.current = true;
    lastAngleRef.current = angle;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove);
    document.addEventListener('touchend', handleMouseUp);
  };

  useEffect(() => {
    if (mode === 'focus' && !isActive) {
      setAngle(timeToAngle(time));
    }
  }, [time, mode, isActive, timeToAngle]);
  
  const progressAngle = timeToAngle(time);
  
  const getButtonText = () => {
    if (!isActive && sessionStartTime > 0) {
      return "Reanudar";
    }
    if (isActive) {
      return "Pausar";
    }
    return "Iniciar";
  };
  
  const [isNoteOpen, setNoteOpen] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const modeButtonsDisabled = sessionStartTime !== 0;
  const finishButtonDisabled = sessionStartTime === 0;

  return (
    <div className="flex flex-col items-center gap-8">
       <h1 className="text-2xl font-bold text-foreground font-headline text-center">Centro de enfoque</h1>
      <div className="flex gap-4">
        <Button
          variant={mode === 'focus' ? 'outline' : 'secondary'}
          onClick={() => handleModeChange('focus')}
          data-tour="modo-temporizador"
          className={cn(
            "text-xs disabled:opacity-100", 
            mode === 'focus' 
              ? "border border-primary bg-primary/20 text-primary hover:text-primary" 
              : modeButtonsDisabled ? "text-muted-foreground" : "text-foreground"
          )}
          disabled={modeButtonsDisabled}
        >
          Temporizador
        </Button>
        <Button
          variant={mode === 'stopwatch' ? 'outline' : 'secondary'}
          onClick={() => handleModeChange('stopwatch')}
          className={cn(
            "text-xs disabled:opacity-100", 
            mode === 'stopwatch' 
              ? "border border-primary bg-primary/20 text-primary hover:text-primary"
              : modeButtonsDisabled ? "text-muted-foreground" : "text-foreground"
          )}
          disabled={modeButtonsDisabled}
        >
          Cronómetro
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              title="Vista flotante" data-tour="vista-flotante"
              className={cn(
                miniTimerView !== 'hidden' &&
                  'border border-primary bg-primary/20 text-primary hover:text-primary'
              )}
            >
              <PictureInPicture2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Vista flotante
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setMiniTimerView('full')}
              className={cn(miniTimerView === 'full' && 'font-semibold text-primary')}
            >
              <PictureInPicture2 className="mr-2 h-4 w-4" />
              Mediana
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setMiniTimerView('compact')}
              className={cn(miniTimerView === 'compact' && 'font-semibold text-primary')}
            >
              <Minimize2 className="mr-2 h-4 w-4" />
              Compacta
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setMiniTimerView('hidden')}
              disabled={miniTimerView === 'hidden'}
            >
              <EyeOff className="mr-2 h-4 w-4" />
              Ocultar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Anotar sin cerrar la sesión: el mismo gesto que en la ventana
                flotante, para quien trabaja con la app delante. */}
            <DropdownMenuItem
              onSelect={() => setNoteOpen(true)}
              disabled={sessionStartTime === 0}
            >
              <NotebookPen className="mr-2 h-4 w-4" />
              Anotar avance
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Avance anotado en caliente; el reloj sigue corriendo detrás. */}
      <SessionNoteDialog
        open={isNoteOpen}
        onOpenChange={setNoteOpen}
        elapsedSec={mode === 'focus' && sessionStartTime > 0 ? sessionStartTime - time : time}
      />

      <div
        ref={circleRef}
        className={cn(
          "relative flex h-64 w-64 items-center justify-center rounded-full transition-shadow duration-300",
          disabled && "opacity-50"
        )}
        style={{
            boxShadow: isActive ? '0px 0px 35px hsl(var(--primary) / 0.5)' : 'none'
        }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="hsl(var(--secondary))"
            strokeWidth="6"
            fill="none"
          />
          {mode === 'focus' && (
            <circle
                cx="50"
                cy="50"
                r="45"
                stroke="hsl(var(--primary))"
                strokeWidth="6"
                fill="none"
                strokeDasharray="282.74"
                strokeDashoffset={282.74 - (progressAngle / 360) * 282.74}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
            />
          )}
        </svg>

        {/* El número del centro. Antes de empezar, pulsarlo abre el selector
            de duración exacta; el dial sigue arrastrándose de 5 en 5. */}
        {(() => {
          const editable = mode === 'focus' && sessionStartTime === 0 && !disabled;
          const face = (
            <>
              {dialHours > 0 && (
                <span className="mb-1.5 font-mono text-2xl font-bold text-primary">
                  {dialHours}{' '}
                  <span className="font-sans text-base font-semibold">{dialHours === 1 ? 'hora' : 'horas'}</span>
                </span>
              )}
              <span className="font-mono text-5xl font-bold text-foreground tabular-nums">{dialClock}</span>
              {dialHours > 0 && (
                <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  min : s
                </span>
              )}
            </>
          );
          return editable ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              title="Elegir la duración exacta" data-tour="enfoque-duracion"
              className="group/face relative z-10 flex h-[78%] w-[78%] flex-col items-center justify-center rounded-full leading-none outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {face}
              <span className="absolute bottom-[18%] text-[10px] font-medium text-primary opacity-0 transition-opacity group-hover/face:opacity-100">
                Pulsa para ajustar
              </span>
            </button>
          ) : (
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center rounded-full bg-transparent leading-none">
              {face}
            </div>
          );
        })()}

         {mode === 'focus' && sessionStartTime === 0 && (
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            className="absolute h-5 w-5 rounded-full bg-background border-2 border-primary cursor-pointer z-20"
            style={{
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-116px) rotate(-${angle}deg)`,
              transformOrigin: '0 0',
            }}
          />
        )}
      </div>

      <FocusTimePicker
        open={isPickerOpen}
        onOpenChange={setPickerOpen}
        initialMinutes={Math.round(time / 60)}
        maxMinutes={MAX_TIME / 60}
        onConfirm={setExactMinutes}
      />

      <div className="flex gap-4">
        <Button size="lg" onClick={handleStartPause} data-tour="enfoque-iniciar" className="text-xs w-28" disabled={disabled || (mode === 'focus' && time === 0)}>
          {isActive ? <Pause className="mr-2 h-5 w-5" /> : (getButtonText() === 'Reanudar' ? <RefreshCcw className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />)}
          {getButtonText()}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className={cn(
            'text-xs w-28 border border-transparent',
            !finishButtonDisabled && 'hover:border-destructive hover:bg-destructive/20 hover:text-destructive-foreground'
          )}
          disabled={finishButtonDisabled}
          onClick={handleFinishClick}
          data-tour="enfoque-finalizar"
        >
          <StopCircle className="mr-2 h-5 w-5" />
          Finalizar
        </Button>
      </div>

     <FinishSessionForm
        isOpen={isFinishing}
        onClose={handleFormCancel}
        onSubmit={handleFormSubmit}
        onDiscard={handleFormDiscard}
        studiedSeconds={Math.max(0, Math.round(finishedDuration))}
        trigger={finishTrigger}
     />
    </div>
  );
}
