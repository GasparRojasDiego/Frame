import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import { Pencil, Check, X, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NotificationCenter from '@/components/layout/NotificationCenter';
import RecordingDialog from '@/components/recordings/RecordingDialog';
import QuickCreateButton from '@/components/layout/QuickCreateButton';
import { startQuickRecording } from '@/lib/quick-recording';
import type { RecorderState } from '@/components/recordings/RecordingDialog';
import type { UserProfile } from '@/types';

const QUOTE_KEY = 'headerQuote';
const HEADER_PLACEHOLDER = 'Escribe aquí tu frase';

/**
 * La frase viaja en el respaldo en la nube dentro del snapshot global, que la
 * reescribe serializada (`"frase"`). Se aceptan ambas formas al leerla para
 * que no reaparezca entrecomillada tras restaurar un respaldo.
 */
function readStoredQuote(): string {
  const raw = window.localStorage.getItem(QUOTE_KEY);
  if (!raw) return '';
  if (raw.length > 1 && raw.startsWith('"') && raw.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
    } catch {
      /* no era JSON: se usa el texto tal cual */
    }
  }
  return raw;
}

interface HeaderProps {
  /** Lo inyecta el layout. La frase es global al dispositivo (clave
   *  `headerQuote`, incluida en el respaldo en la nube), así que la cabecera
   *  todavía no necesita el perfil. */
  userProfile: UserProfile | null;
}

export default function Header(_props: HeaderProps) {
  // Sin frase por defecto: mientras el usuario no escriba la suya se muestra
  // un marcador atenuado que invita a hacerlo.
  const [headerText, setHeaderText] = useState(readStoredQuote);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(headerText);
  const [isTooLong, setIsTooLong] = useState(false);
  const [isRecordingOpen, setRecordingOpen] = useState(false);
  /** Lo que hace la grabadora aunque su recuadro esté cerrado. */
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');

  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo global de grabación: Ctrl+Shift+F abre la grabadora Y empieza a
  // grabar en el acto, sin pasos intermedios.
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setRecordingOpen(true);
        startQuickRecording();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setEditedText(headerText);
    }
  }, [isEditing, headerText]);

  useLayoutEffect(() => {
    if (isEditing && inputRef.current) {
      setIsTooLong(inputRef.current.scrollWidth > inputRef.current.clientWidth);
    } else {
      setIsTooLong(false);
    }
  }, [editedText, isEditing]);

  const handleEdit = () => {
    setEditedText(headerText);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (isTooLong) return;
    const newText = editedText.trim();
    setHeaderText(newText);
    // Guardar en blanco borra la frase y devuelve el marcador.
    if (newText) window.localStorage.setItem(QUOTE_KEY, newText);
    else window.localStorage.removeItem(QUOTE_KEY);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <header data-tour="barra-superior" className="group flex h-[60px] flex-shrink-0 items-center justify-between border-b bg-background px-4">
      {/* Los dos extremos miden lo mismo: así la frase queda centrada de verdad. */}
      <div className="flex w-36 items-center justify-start gap-1.5">
        {/* Crear una tarea o una anotación sin salir de donde estés. */}
        <QuickCreateButton />
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSave}
              title="Guardar frase"
              className="h-7 w-7 text-green-500 disabled:text-muted-foreground"
              disabled={isTooLong}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              title="Descartar cambios"
              className="h-7 w-7 text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleEdit}
            title="Editar tu frase"
            className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="relative min-w-0 flex-grow text-center">
        {isEditing ? (
          <>
            <Input
              ref={inputRef}
              type="text"
              value={editedText}
              placeholder={HEADER_PLACEHOLDER}
              onChange={(e) => setEditedText(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-center text-sm font-semibold uppercase tracking-widest text-primary placeholder:normal-case placeholder:italic placeholder:tracking-normal placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
            />
            {isTooLong && (
              <p className="absolute left-0 mt-1 w-full text-xs text-muted-foreground">
                Frase demasiado larga, por favor acórtala.
              </p>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={handleEdit}
            title="Editar tu frase"
            data-tour="frase"
            className="mx-auto block max-w-full truncate rounded px-2 py-1 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <h1
              className={cn(
                'truncate text-sm font-semibold',
                headerText ? 'uppercase tracking-widest text-primary' : 'italic text-muted-foreground/60'
              )}
            >
              {headerText || HEADER_PLACEHOLDER}
            </h1>
          </button>
        )}
      </div>

      <div className="flex w-36 items-center justify-end gap-2">
        {/* Grabación de voz (también con Ctrl+Shift+F). Mientras graba con
            el recuadro cerrado, el botón se rellena y respira con el mismo
            brillo del dial de Enfoque durante una sesión: así nunca se
            olvida que el micrófono sigue abierto. En pausa, relleno sin
            brillo. */}
        <Button
          size="icon"
          variant="ghost"
          title={
            recorderState === 'recording'
              ? 'Grabando… (pulsa para ver la grabación)'
              : recorderState === 'paused'
                ? 'Grabación en pausa (pulsa para verla)'
                : 'Grabación (Ctrl+Shift+F)'
          }
          className={cn(
            'h-9 w-9 rounded-md border border-primary transition-colors',
            recorderState === 'idle'
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
            recorderState === 'recording' && 'animate-session-glow'
          )}
          onClick={() => setRecordingOpen(true)}
          data-tour="grabar"
        >
          <Mic className="h-5 w-5" />
        </Button>

        <NotificationCenter />
      </div>

      {/* Grabadora global: montada siempre para no perder audio al cerrar */}
      <RecordingDialog
        open={isRecordingOpen}
        onOpenChange={setRecordingOpen}
        onStateChange={setRecorderState}
      />
    </header>
  );
}
