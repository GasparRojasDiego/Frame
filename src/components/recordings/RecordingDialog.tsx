import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Mic, Pause, Play, Square, LoaderCircle, Clock, Settings, Trash2, Flag, EyeOff } from 'lucide-react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SubjectPicker from '@/components/courses/SubjectPicker';
import EchoWord, { EchoHeader } from '@/components/shared/EchoWord';
import { useCourse } from '@/context/CourseContext';
import { deleteRecordingAudio, saveRecordingAudio } from '@/lib/music-db';
import { QUICK_RECORDING_EVENT } from '@/lib/quick-recording';
import { useToast } from '@/hooks/use-toast';
import type { Recording, RecordingImportance } from '@/types';
import { cn } from '@/lib/utils';
import {
  DEFAULT_RECORDING_SETTINGS,
  IMPORTANCE_IDLE,
  IMPORTANCE_LABEL,
  IMPORTANCE_STYLE,
  MAX_OPTIONS,
  formatDuration,
  loadRecordingSettings,
  minutesLabel,
  sanitizeRecordingSettings,
  saveRecordingSettings,
  type RecordingSettings,
} from '@/lib/recordings';

type Phase = 'confirm' | 'recording' | 'form' | 'saving';

const TIMESLICE_MS = 1000;
const TICK_MS = 250;
/** Una parte más corta que esto no llega a ser audio útil: se descarta. */
const MIN_PART_MS = 1000;

type StopReason = 'user' | 'max' | 'error';
type SegmentReason = StopReason | 'rotate' | 'rotate-fallback';

/** Contexto privado de cada grabadora: evita carreras entre el cierre de una
 *  parte y el arranque de la siguiente. */
interface SegmentCtx {
  startedAt: string;
  durationMs: number;
  reason: SegmentReason;
}

interface ActiveRecorder {
  recorder: MediaRecorder;
  ctx: SegmentCtx;
}

/** Parte ya cerrada, pendiente de convertirse en Recording. */
interface SegmentDraft {
  id: string;
  blob: Blob;
  /** Inicio real de esta parte concreta. */
  recordedAt: string;
  durationSec: number;
  audioPersisted: boolean;
  /** Pre-guardado en curso: descartar espera a que termine para no dejar restos. */
  persisting?: Promise<void>;
  saved: boolean;
}

interface PartSummary {
  id: string;
  recordedAt: string;
  durationSec: number;
}

// El MediaRecorder de WebView2 (Chromium) graba AAC en MP4 (.m4a, se abre en
// cualquier reproductor) y, si no puede, Opus en WebM. Frame guarda el archivo
// tal cual: no hace falta convertir nada.
const pickMimeType = (): string => {
  const candidates = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = reader.result as string;
      resolve(s.slice(s.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const autoNameFor = (iso: string) => {
  const date = iso ? new Date(iso) : new Date();
  return `Grabación ${format(Number.isNaN(date.getTime()) ? new Date() : date, 'd MMM HH:mm', { locale: es })}`;
};

/** Rueda de ajustes de la esquina superior izquierda del diálogo. Las medidas
 *  del botón son exactas para que el icono quede simétrico a la X de cierre,
 *  que DialogContent pinta en `absolute right-4 top-4`. */
function RecordingSettingsPopover({
  settings,
  onChange,
  disabled = false,
}: {
  settings: RecordingSettings;
  onChange: (patch: Partial<RecordingSettings>) => void;
  /** true durante la grabación: se muestra el estado pero no se edita. */
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Ajustes de grabación"
          title="Ajustes de grabación"
          className="absolute left-[13px] top-[13px] h-[22px] w-[22px] rounded-sm text-muted-foreground opacity-70 transition-opacity hover:bg-primary/10 hover:text-primary hover:opacity-100"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" sideOffset={8} className="w-80 space-y-4 p-4">
        <div>
          <p className="text-sm font-bold text-primary">Ajustes de grabación</p>
          <p className="text-[10px] text-muted-foreground">Se recuerdan para tu cuenta.</p>
        </div>

        <p className="rounded-md border border-border/60 bg-secondary/40 p-2 text-[11px] leading-snug text-muted-foreground">
          La grabación es continua: un solo audio, de principio a fin, hasta que pulses Terminar.
        </p>

        <div className="space-y-1.5">
          <Label className="text-xs">Duración máxima</Label>
          <div className="flex flex-wrap gap-1.5">
            {MAX_OPTIONS.map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                disabled={disabled}
                variant={settings.maxMinutes === m ? 'default' : 'outline'}
                className="h-7 px-2.5 text-[11px]"
                onClick={() => onChange({ maxMinutes: m })}
              >
                {minutesLabel(m)}
              </Button>
            ))}
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Tope de seguridad (máximo 2 h). Al alcanzarlo la grabación se detiene sola y pasa al
            formulario, sin perder nada.
          </p>
        </div>

        {disabled && (
          <p className="rounded-md bg-secondary/60 p-2 text-[10px] text-muted-foreground">
            Estás grabando: los cambios se aplicarán a la próxima grabación.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Grabadora de voz global (botón "Grabación" de la barra superior y atajo
 * Ctrl+Shift+F). Flujo: confirmación (Enter inicia) → recuadro mediano
 * centrado grabando automáticamente (pausar/reanudar/terminar) → formulario
 * con nombre, descripción, importancia y asignatura. Cerrar con la X en el
 * formulario guarda igual con el nombre automático: nada se pierde.
 *
 * En modo segmentado la sesión se parte en varias grabaciones correlativas:
 * cada corte abre la grabadora siguiente ANTES de cerrar la anterior, de modo
 * que la costura entre partes no deja hueco de audio.
 */
/**
 * Lo que hace la grabadora, para quien no ve su recuadro: la barra superior
 * lo usa para que el micrófono siga delatando una grabación en curso aunque
 * el recuadro esté cerrado.
 */
export type RecorderState = 'idle' | 'recording' | 'paused';

export default function RecordingDialog({
  open,
  onOpenChange,
  onStateChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStateChange?: (state: RecorderState) => void;
}) {
  const { courses, addRecording, userProfile } = useCourse();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>('confirm');
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [parts, setParts] = useState<PartSummary[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);
  const [settings, setSettings] = useState<RecordingSettings>(DEFAULT_RECORDING_SETTINGS);

  // Formulario post-grabación
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [importance, setImportance] = useState<RecordingImportance>('media');
  const [courseId, setCourseId] = useState<string>('none');

  const settingsRef = useRef(settings);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef<ActiveRecorder | null>(null);
  const mimeRef = useRef<string>('audio/webm');
  const segmentsRef = useRef<SegmentDraft[]>([]);
  const sessionStartedAtRef = useRef<string>('');

  // Cronómetro: solo cuenta el tiempo realmente grabado.
  const clockStartRef = useRef(0);
  const segAccumMsRef = useRef(0);
  const closedMsRef = useRef(0);

  // Guardas de concurrencia.
  const rotatingRef = useRef(false);
  const stoppingRef = useRef(false);
  const stopReasonRef = useRef<StopReason>('user');
  const finishedRef = useRef(false);
  const unmountedRef = useRef(false);
  const savingRef = useRef(false);

  // Único setTimeout del componente (aviso efímero de corte).
  const rotationNoticeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Indirecciones para romper los ciclos entre callbacks del motor.
  const beginSegmentRef = useRef<() => void>(() => {});
  const finalizeSegmentRef = useRef<(chunks: Blob[], ctx: SegmentCtx) => void>(() => {});
  const stopSessionRef = useRef<(reason: StopReason) => void>(() => {});

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Los ajustes se recargan al abrir. Sin perfil (invitado) se conservan en
  // memoria: no hay dónde persistirlos.
  useEffect(() => {
    if (!open || !userProfile?.id) return;
    const stored = loadRecordingSettings(userProfile.id);
    settingsRef.current = stored;
    setSettings(stored);
  }, [open, userProfile?.id]);

  const updateSettings = useCallback(
    (patch: Partial<RecordingSettings>) => {
      const next = sanitizeRecordingSettings({ ...settingsRef.current, ...patch });
      settingsRef.current = next;
      saveRecordingSettings(userProfile?.id, next);
      setSettings(next);
    },
    [userProfile?.id]
  );

  const clearRotationNotice = useCallback(() => {
    if (rotationNoticeRef.current) {
      clearTimeout(rotationNoticeRef.current);
      rotationNoticeRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    const active = activeRef.current;
    if (active) active.recorder.ondataavailable = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    activeRef.current = null;
  }, []);

  const resetAll = useCallback(() => {
    clearRotationNotice();
    setPhase('confirm');
    setElapsed(0);
    setIsPaused(false);
    setParts([]);
    setTotalDuration(0);
    setSaveProgress(null);
    setName('');
    setDescription('');
    setImportance('media');
    setCourseId('none');
    segmentsRef.current = [];
    closedMsRef.current = 0;
    segAccumMsRef.current = 0;
    rotatingRef.current = false;
    stoppingRef.current = false;
    finishedRef.current = false;
    savingRef.current = false;
  }, [clearRotationNotice]);

  // Cierre de la sesión completa: el micrófono se suelta AQUÍ, nunca antes de
  // que el último onstop haya volcado sus bytes.
  const finishSession = useCallback(
    (reason: StopReason) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      releaseStream();
      clearRotationNotice();
      stoppingRef.current = false;
      rotatingRef.current = false;
      segAccumMsRef.current = 0;

      const segments = segmentsRef.current;
      if (segments.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Grabación vacía',
          description: 'No se capturó audio suficiente. Inténtalo de nuevo.',
        });
        onOpenChange(false);
        resetAll();
        return;
      }

      setParts(segments.map((s) => ({ id: s.id, recordedAt: s.recordedAt, durationSec: s.durationSec })));
      setTotalDuration(segments.reduce((acc, s) => acc + s.durationSec, 0));
      setName((prev) => prev || autoNameFor(sessionStartedAtRef.current));
      setPhase('form');

      if (reason === 'max') {
        toast({
          title: 'Duración máxima alcanzada',
          description: `Se detuvo a las ${minutesLabel(settingsRef.current.maxMinutes)}. Ya puedes guardarla.`,
        });
      } else if (reason === 'error') {
        toast({
          variant: 'destructive',
          title: 'La grabación se interrumpió',
          description: 'Se conserva todo lo grabado hasta el fallo.',
        });
      }
    },
    [clearRotationNotice, onOpenChange, releaseStream, resetAll, toast]
  );

  const finalizeSegment = useCallback(
    (chunks: Blob[], ctx: SegmentCtx) => {
      const blob = new Blob(chunks, { type: mimeRef.current });

      // Parada imprevista: la duración sale del reloj del segmento, que sigue
      // siendo válido porque nadie lo ha reiniciado todavía.
      if (ctx.durationMs === 0 && blob.size > 0) {
        const live = clockStartRef.current > 0 ? Date.now() - clockStartRef.current : 0;
        ctx.durationMs = Math.max(0, segAccumMsRef.current + live);
        if (ctx.reason === 'user') ctx.reason = 'error';
      }

      if (blob.size > 0 && ctx.durationMs >= MIN_PART_MS) {
        const segment: SegmentDraft = {
          id: crypto.randomUUID(),
          blob,
          recordedAt: ctx.startedAt,
          durationSec: Math.max(1, Math.round(ctx.durationMs / 1000)),
          audioPersisted: false,
          saved: false,
        };
        segmentsRef.current.push(segment);
        // Los bytes quedan a salvo en IndexedDB en cuanto la parte cierra, sin
        // esperar al formulario (put es idempotente con el guardado final).
        segment.persisting = saveRecordingAudio(segment.id, segment.blob)
          .then(() => {
            segment.audioPersisted = true;
          })
          .catch((e) => console.error('No se pudo pre-guardar la parte', e));
      } else {
        // Parte descartada: sus ms no deben seguir contando en el cronómetro.
        closedMsRef.current = Math.max(0, closedMsRef.current - ctx.durationMs);
      }

      if (unmountedRef.current) return;

      if (ctx.reason === 'rotate') return; // la parte siguiente ya está grabando
      if (ctx.reason === 'rotate-fallback') {
        if (stoppingRef.current) finishSession(stopReasonRef.current);
        else beginSegmentRef.current();
        return;
      }
      finishSession(ctx.reason);
    },
    [finishSession]
  );

  // Cada parte necesita su PROPIA grabadora con chunks privados: en webm solo
  // el primer chunk lleva la cabecera EBML, así que trocear un array común
  // produciría partes irreproducibles.
  const buildRecorder = useCallback((stream: MediaStream): ActiveRecorder => {
    const mime = pickMimeType();
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    mimeRef.current = recorder.mimeType || 'audio/webm';

    const chunks: Blob[] = [];
    const ctx: SegmentCtx = { startedAt: new Date().toISOString(), durationMs: 0, reason: 'user' };

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = (e) => {
      console.error('Error del MediaRecorder', e);
      stopSessionRef.current('error');
    };
    recorder.onstop = () => finalizeSegmentRef.current(chunks, ctx);

    return { recorder, ctx };
  }, []);

  const adoptRecorder = useCallback((active: ActiveRecorder) => {
    activeRef.current = active;
    segAccumMsRef.current = 0;
    clockStartRef.current = Date.now();
    rotatingRef.current = false;
    setIsPaused(false);
  }, []);

  const beginSegment = useCallback(() => {
    if (unmountedRef.current) return;
    const stream = streamRef.current;
    if (!stream) {
      finishSession('error');
      return;
    }
    try {
      const active = buildRecorder(stream);
      active.recorder.start(TIMESLICE_MS);
      adoptRecorder(active);
    } catch (e) {
      console.error('No se pudo abrir una nueva parte', e);
      finishSession('error');
    }
  }, [adoptRecorder, buildRecorder, finishSession]);


  const stopSession = useCallback(
    (reason: StopReason) => {
      if (stoppingRef.current || finishedRef.current) return;
      stoppingRef.current = true;
      stopReasonRef.current = reason;

      const active = activeRef.current;
      if (!active || active.recorder.state === 'inactive') {
        // Con una rotación secuencial en vuelo, el onstop pendiente cerrará la
        // sesión en vez de abrir otra parte.
        if (!rotatingRef.current) finishSession(reason);
        return;
      }

      const live = active.recorder.state === 'recording' ? Date.now() - clockStartRef.current : 0;
      active.ctx.durationMs = segAccumMsRef.current + live;
      closedMsRef.current += active.ctx.durationMs;
      active.ctx.reason = reason;
      try {
        active.recorder.stop();
      } catch (e) {
        console.error('No se pudo detener la grabación', e);
        finishSession(reason);
      }
    },
    [finishSession]
  );

  useEffect(() => {
    beginSegmentRef.current = beginSegment;
  }, [beginSegment]);
  useEffect(() => {
    finalizeSegmentRef.current = finalizeSegment;
  }, [finalizeSegment]);
  useEffect(() => {
    stopSessionRef.current = stopSession;
  }, [stopSession]);

  // Tick único: cronómetro + los dos cortes automáticos. Se evalúan sobre el
  // tiempo REALMENTE grabado, así la pausa no necesita reprogramar nada y no
  // quedan temporizadores sueltos que limpiar.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      const active = activeRef.current;
      const live = active?.recorder.state === 'recording' ? Date.now() - clockStartRef.current : 0;
      const segMs = segAccumMsRef.current + live;
      // Al cortar, los ms de la parte cerrada ya están en closedMsRef: hasta
      // que la parte siguiente se adopta, el tramo vivo no se vuelve a sumar.
      const cutting = rotatingRef.current || stoppingRef.current;
      const totalMs = closedMsRef.current + (cutting ? 0 : segMs);

      setElapsed(Math.floor(totalMs / 1000));

      if (cutting) return;
      const s = settingsRef.current;
      if (totalMs >= s.maxMinutes * 60_000) {
        stopSessionRef.current('max');
        return;
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  // Al desmontar: ni micrófono abierto, ni temporizadores, ni handlers zombis.
  useEffect(() => {
    // En React.StrictMode el efecto se monta, desmonta y vuelve a montar: si
    // la guarda no se rearma, el segundo montaje nace ya marcado como muerto.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (rotationNoticeRef.current) {
        clearTimeout(rotationNoticeRef.current);
        rotationNoticeRef.current = null;
      }
      const active = activeRef.current;
      try {
        if (active && active.recorder.state !== 'inactive') active.recorder.stop();
      } catch (e) {
        console.error('No se pudo detener la grabación al desmontar', e);
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      activeRef.current = null;
    };
  }, []);

  const startingRef = useRef(false);
  const startRecording = useCallback(async () => {
    if (startingRef.current || streamRef.current) return;
    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true },
      });
      startingRef.current = false;
      if (streamRef.current) {
        // Llegó un segundo permiso mientras ya se grababa: se suelta sin usar.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      // Micrófono desenchufado a media clase: se cierra conservando lo grabado.
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => stopSessionRef.current('error');
      });
      streamRef.current = stream;
      segmentsRef.current = [];
      closedMsRef.current = 0;
      segAccumMsRef.current = 0;
      rotatingRef.current = false;
      stoppingRef.current = false;
      finishedRef.current = false;
      sessionStartedAtRef.current = new Date().toISOString();
      setElapsed(0);
      setParts([]);
      setTotalDuration(0);
      setIsPaused(false);
      setPhase('recording');
      beginSegment();
    } catch (e) {
      startingRef.current = false;
      console.error('No se pudo iniciar la grabación', e);
      toast({
        variant: 'destructive',
        title: 'Micrófono no disponible',
        description: 'Frame no pudo acceder al micrófono de tu laptop. Revisa los permisos de Windows.',
      });
      onOpenChange(false);
    }
  }, [beginSegment, onOpenChange, toast]);

  // Atajo Ctrl+Shift+F: la cabecera abre el diálogo y pide empezar YA, sin
  // pasar por la confirmación. Si ya se está grabando, no hace nada.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    const handleQuick = () => {
      if (phaseRef.current === 'confirm') void startRecording();
    };
    window.addEventListener(QUICK_RECORDING_EVENT, handleQuick);
    return () => window.removeEventListener(QUICK_RECORDING_EVENT, handleQuick);
  }, [startRecording]);

  // El estado real se lee del propio recorder, nunca de isPaused: así el tick
  // no depende del estado de React y el intervalo no se recrea al pausar.
  const togglePause = useCallback(() => {
    const active = activeRef.current;
    if (!active || rotatingRef.current || stoppingRef.current) return;
    if (active.recorder.state === 'recording') {
      active.recorder.pause();
      segAccumMsRef.current += Date.now() - clockStartRef.current;
      setIsPaused(true);
    } else if (active.recorder.state === 'paused') {
      active.recorder.resume();
      clockStartRef.current = Date.now();
      setIsPaused(false);
    }
  }, []);

  const doSave = useCallback(async () => {
    const segments = segmentsRef.current;
    if (segments.length === 0 || savingRef.current) return;
    savingRef.current = true;
    setPhase('saving');

    const total = segments.length;
    const sessionId = crypto.randomUUID();
    const base = name.trim() || autoNameFor(sessionStartedAtRef.current);

    try {
      // En serie a propósito: cada parte escribe su archivo en disco y en
      // paralelo competirían por él.
      for (let i = 0; i < total; i++) {
        const segment = segments[i];
        setSaveProgress({ current: i + 1, total });
        if (segment.saved) continue; // reintento tras un fallo: no duplicar

        const finalName = total > 1 ? `${base} (Parte ${i + 1})` : base;
        const recording: Recording = {
          id: segment.id,
          name: finalName,
          description: description.trim() || undefined,
          importance,
          recordedAt: segment.recordedAt,
          courseId: courseId === 'none' ? null : courseId,
          durationSec: segment.durationSec,
          mimeType: mimeRef.current,
          ...(total > 1 ? { sessionId, partIndex: i + 1, partCount: total } : {}),
        };

        // 1) Audio siempre disponible dentro de la app (IndexedDB).
        if (!segment.audioPersisted) {
          await saveRecordingAudio(segment.id, segment.blob);
          segment.audioPersisted = true;
        }

        // 2) Archivo permanente en disco (Documentos\Frame\Grabaciones).
        if (isTauri()) {
          try {
            const base64 = await blobToBase64(segment.blob);
            const saved = await invoke<{ path: string; format: string }>('save_recording', {
              fileName: finalName,
              dataBase64: base64,
              ext: mimeRef.current.startsWith('audio/mp4') ? 'm4a' : 'webm',
            });
            recording.filePath = saved.path;
            recording.fileFormat = saved.format;
          } catch (e) {
            console.error('save_recording falló (se conserva la copia interna)', e);
            // Antes solo iba a la consola: el estudiante creía tener el archivo en su
            // carpeta de Grabaciones y no estaba.
            toast({
              variant: 'destructive',
              title: 'No se pudo guardar el archivo en el disco',
              description: 'La grabación está a salvo dentro de Frame. Puedes descargarla desde su ficha.',
              duration: 10000,
            });
          }
        }

        addRecording(recording);
        segment.saved = true;
      }

      const courseName = courseId !== 'none' ? courses.find((c) => c.id === courseId)?.name : null;
      toast({
        title: total > 1 ? `Grabación guardada en ${total} partes` : 'Grabación guardada',
        description: courseName ? `"${base}" quedó en ${courseName}.` : `"${base}" quedó en Inicio.`,
      });
      onOpenChange(false);
      resetAll();
    } catch (e) {
      console.error('No se pudo guardar la grabación', e);
      savingRef.current = false;
      setSaveProgress(null);
      setPhase('form');
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: 'No se pudo guardar el audio. Inténtalo de nuevo.',
      });
    }
  }, [addRecording, courseId, courses, description, importance, name, onOpenChange, resetAll, toast]);

  // Descartar: el audio ya estaba pre-guardado en IndexedDB (por si la app se
  // cerraba de golpe), así que descartarlo es BORRARLO también de ahí. Nada en
  // disco todavía: el archivo solo se escribe al guardar.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const discardRecording = useCallback(async () => {
    const segments = segmentsRef.current;
    await Promise.all(
      segments.map(async (segment) => {
        await segment.persisting?.catch(() => undefined);
        await deleteRecordingAudio(segment.id).catch((e) => console.error('No se pudo borrar el audio descartado', e));
      })
    );
    setConfirmDiscard(false);
    toast({ title: 'Grabación descartada', description: 'El audio se eliminó definitivamente de tu equipo.' });
    onOpenChange(false);
    resetAll();
  }, [onOpenChange, resetAll, toast]);

  // El estado de la grabadora, hacia fuera (el micrófono de la barra).
  useEffect(() => {
    onStateChange?.(phase === 'recording' ? (isPaused ? 'paused' : 'recording') : 'idle');
  }, [isPaused, onStateChange, phase]);

  // Si la grabación termina sola (el tope de duración) mientras el recuadro
  // está cerrado, el formulario de guardar se abre sin esperar: el audio no
  // puede quedar pendiente sin que el usuario se entere.
  useEffect(() => {
    if (phase === 'form' && !open) onOpenChange(true);
  }, [onOpenChange, open, phase]);

  // Cerrar el recuadro ya no corta nada:
  //  · grabando → el recuadro se oculta y la grabación SIGUE; el micrófono
  //    de la barra superior avisa de que está en curso y la reabre;
  //  · en el formulario → guarda con lo que haya (nombre automático incluido).
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        // Reabrir durante una grabación (o con el formulario pendiente)
        // vuelve a ella; solo un recuadro nuevo empieza de cero.
        if (phase === 'confirm') resetAll();
        onOpenChange(true);
        return;
      }
      if (phase === 'recording') {
        onOpenChange(false);
        return;
      }
      if (phase === 'form') {
        void doSave();
        return; // doSave cierra al terminar
      }
      if (phase === 'saving') return; // no interrumpir la escritura
      onOpenChange(false);
      resetAll();
    },
    [doSave, onOpenChange, phase, resetAll, stopSession]
  );

  const recordedAtLabel = useMemo(() => {
    if (!sessionStartedAtRef.current || phase === 'confirm') return '';
    const date = new Date(sessionStartedAtRef.current);
    return Number.isNaN(date.getTime())
      ? ''
      : format(date, "EEEE d 'de' MMMM · HH:mm", { locale: es });
  }, [phase]);

  const isMultiPart = parts.length > 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* El formulario de guardar necesita más ancho que el de grabar: los
          mini-recuadros de asignaturas van en rejilla. */}
      <DialogContent
        className={cn(
          phase === 'form' || phase === 'saving' ? 'overflow-hidden sm:max-w-2xl' : 'sm:max-w-md'
        )}
      >
        {phase === 'confirm' && (
          <>
            <EchoHeader word="Grabar">
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold text-primary">Nueva grabación</DialogTitle>
                <DialogDescription className="text-center text-xs">
                  Se grabará audio con el micrófono de tu laptop. La grabación comienza
                  de inmediato al confirmar.
                </DialogDescription>
              </DialogHeader>
            </EchoHeader>
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/40">
                <Mic className="h-7 w-7 text-primary" />
              </div>
              <p className="text-center text-[10px] text-muted-foreground">
                Grabación continua · máximo {minutesLabel(settings.maxMinutes)}
              </p>
            </div>
            <DialogFooter className="sm:justify-center gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              {/* autoFocus: con Ctrl+Shift+F basta presionar Enter para empezar */}
              <Button autoFocus onClick={() => void startRecording()} data-tour="grabar-iniciar">
                <Mic className="mr-2 h-4 w-4" />
                Iniciar grabación
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'recording' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-bold text-primary">
                {isPaused ? 'Grabación en pausa' : 'Grabando…'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-3">
              <div className="relative flex h-20 w-20 items-center justify-center">
                {!isPaused && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/30" />
                )}
                <div
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-full border',
                    isPaused
                      ? 'bg-muted border-border text-muted-foreground'
                      : 'bg-red-500/15 border-red-500/50 text-red-500'
                  )}
                >
                  <Mic className="h-7 w-7" />
                </div>
              </div>
              <p className="font-headline text-4xl font-bold tabular-nums text-foreground">
                {formatDuration(elapsed)}
              </p>


              <div className="flex gap-3">
                <Button variant="outline" className="w-32" onClick={togglePause}>
                  {isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                  {isPaused ? 'Reanudar' : 'Pausar'}
                </Button>
                <Button
                  className="w-32 bg-red-600 text-white hover:bg-red-700"
                  onClick={() => stopSession('user')}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Terminar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Máximo {minutesLabel(settings.maxMinutes)}
              </p>
              <p className="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-[10px] text-muted-foreground">
                <EyeOff className="h-3 w-3" />
                Puedes cerrar este recuadro: la grabación sigue y el micrófono de arriba la muestra.
              </p>
            </div>
          </>
        )}

        {(phase === 'form' || phase === 'saving') && (
          <>
            {/* Cabecera: qué se grabó, cuándo y cuánto dura. */}
            <div className="relative -mx-6 -mt-6 mb-1 overflow-hidden rounded-t-lg border-b border-primary/20 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent px-6 pb-5 pt-6">
              <EchoWord word="Guardar" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.25)]">
                  <Mic className="h-7 w-7" />
                </div>
                <DialogHeader className="min-w-0 flex-1 space-y-0.5 text-left">
                  <DialogTitle className="text-xl font-bold">Guardar grabación</DialogTitle>
                  <DialogDescription className="flex items-center gap-1.5 text-xs">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate first-letter:uppercase">{recordedAtLabel}</span>
                  </DialogDescription>
                  {isMultiPart && (
                    <p className="text-[11px] font-semibold text-primary">
                      {parts.length} partes de la misma grabación
                    </p>
                  )}
                </DialogHeader>
                <div className="shrink-0 text-right">
                  <p className="font-headline text-3xl font-bold leading-none tabular-nums text-foreground">
                    {formatDuration(totalDuration)}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    duración
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="recName" className="text-xs">Nombre</Label>
                  <Input
                    id="recName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-primary bg-card"
                    disabled={phase === 'saving'}
                  />
                </div>
                {/* Importancia: cada opción lleva su color aunque no esté
                    elegida, así se reconoce antes de leer la etiqueta. */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <Flag className="h-3 w-3" /> Importancia
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Importancia">
                    {(['baja', 'media', 'alta'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={importance === level}
                        onClick={() => setImportance(level)}
                        disabled={phase === 'saving'}
                        className={cn(
                          'flex h-10 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-md border text-xs font-semibold transition-all',
                          importance === level
                            ? cn(IMPORTANCE_STYLE[level], 'scale-[1.03] shadow-sm')
                            : IMPORTANCE_IDLE[level]
                        )}
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            level === 'baja' ? 'bg-green-500' : level === 'media' ? 'bg-amber-500' : 'bg-red-500'
                          )}
                        />
                        {IMPORTANCE_LABEL[level]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {isMultiPart && (
                <p className="-mt-2 text-[10px] text-muted-foreground">
                  Cada parte se guardará como «{name.trim() || autoNameFor(sessionStartedAtRef.current)} (Parte N)».
                </p>
              )}
              {isMultiPart && (
                <div className="max-h-24 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-secondary/40 p-2">
                  {parts.map((part, i) => (
                    <div
                      key={part.id}
                      className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                    >
                      <span className="truncate">Parte {i + 1}</span>
                      <span className="shrink-0 tabular-nums">
                        {format(new Date(part.recordedAt), 'HH:mm', { locale: es })} ·{' '}
                        {formatDuration(part.durationSec)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="recDesc" className="text-xs">Descripción (opcional)</Label>
                <Textarea
                  id="recDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="¿De qué trata este audio?"
                  className="min-h-[56px] bg-card"
                  disabled={phase === 'saving'}
                />
              </div>

              {/* Asignatura: los mismos mini-recuadros con imagen de
                  colecciones y asignaturas que el «+» de la barra. */}
              <div
                className={cn(
                  'max-h-[17rem] overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-3',
                  phase === 'saving' && 'pointer-events-none opacity-60'
                )}
              >
                <SubjectPicker
                  value={courseId === 'none' ? null : courseId}
                  onChange={(id) => setCourseId(id ?? 'none')}
                  allowNone
                  noneLabel="Sin asignatura"
                  noneHint="Se guarda al final de Inicio"
                />
              </div>

              <p className="text-center text-[10px] text-muted-foreground">
                {isMultiPart
                  ? 'Si cierras con la X, se guardan todas las partes con el nombre automático y aparecen al final de Inicio.'
                  : 'Si cierras con la X, la grabación se guarda igual con el nombre automático y aparece al final de Inicio.'}
              </p>
            </div>
            <DialogFooter className="gap-2 sm:justify-center">
              <Button
                type="button"
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDiscard(true)}
                disabled={phase === 'saving'}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Descartar audio
              </Button>
              <Button onClick={() => void doSave()} disabled={phase === 'saving'} className="w-44">
                {phase === 'saving' ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    {saveProgress && saveProgress.total > 1
                      ? `Guardando parte ${saveProgress.current} de ${saveProgress.total}…`
                      : 'Guardando…'}
                  </>
                ) : isMultiPart ? (
                  `Guardar ${parts.length} partes`
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Último hijo a propósito: así "Iniciar grabación" (autoFocus) sigue
            siendo el primer tabbable y Enter arranca la grabación. */}
        {(phase === 'confirm' || phase === 'recording') && (
          <RecordingSettingsPopover
            settings={settings}
            onChange={updateSettings}
            disabled={phase === 'recording'}
          />
        )}

        <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Descartar esta grabación?</AlertDialogTitle>
              <AlertDialogDescription>
                El audio de {formatDuration(totalDuration)} se eliminará definitivamente de tu equipo y no podrá
                recuperarse.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Conservar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void discardRecording()}
              >
                Sí, descartar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
