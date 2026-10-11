import { useMemo, useState } from 'react';
import { isToday, parseISO } from 'date-fns';
import { Layers, NotebookPen, Play, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import NoteEditor from '@/components/temporizador/NoteEditor';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { SubjectCard } from '@/components/temporizador/SubjectPickCard';
import SessionNotesList, { SessionNotesHeading } from '@/components/temporizador/SessionNotesList';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import { formatHMS } from '@/lib/duration';
import { useRouter } from '@/lib/navigation';
import type { Course, InterruptedSession } from '@/types';

// ============================================================
// Rescate de una sesión de estudio que se quedó a medias.
//
// Aparece al abrir Frame cuando la sesión anterior no llegó a registrarse:
// porque se aparcó a propósito, porque la app se cerró de golpe (una
// actualización, un cierre forzado, un corte de luz) o porque quedaron
// anotaciones sin sesión a la que pertenecer.
//
// Tres salidas, siempre: retomarla donde estaba, registrarla, o tirarla.
// Nunca una cuarta puerta cerrada — el fallo que arreglaba esto era
// exactamente ese: anotaciones huérfanas que no se podían ni registrar ni
// borrar, ahí clavadas para siempre.
//
// Descartar ARRASTRA las anotaciones. Antes se quedaban, y al no pertenecer
// ya a ninguna sesión no había manera de deshacerse de ellas.
//
// Es el mismo formulario que el cierre de sesión —mismas tarjetas de
// asignatura, mismo enfoque que arranca en 0 y bloquea— porque registrar una
// sesión rescatada y registrar una recién terminada son el mismo acto.
// ============================================================

interface InterruptedSessionManagerProps {
  session: InterruptedSession;
  onDone: () => void;
}

/** Qué se le cuenta al usuario según cómo se perdió la sesión. */
const EXPLANATION: Record<NonNullable<InterruptedSession['origin']> | 'default', string> = {
  suspend:
    'Aparcaste esta sesión al cerrar Frame. Sigue tal cual la dejaste.',
  live:
    'Frame se cerró con una sesión en marcha —una actualización, un cierre forzado, un apagón—. Este es el tiempo que había estudiado hasta el último segundo que se pudo guardar.',
  unload:
    'La última vez cerraste Frame sin registrar tu sesión de estudio.',
  notes:
    'Quedaron anotaciones de una sesión que nunca llegó a registrarse. No se guardó su reloj, así que el tiempo sale del minuto de la última anotación: la sesión duró al menos eso.',
  default: 'La última vez culminaste tu sesión de estudio sin registrarla.',
};

export default function InterruptedSessionManager({ session, onDone }: InterruptedSessionManagerProps) {
  const {
    addStudySession,
    clearSessionNotes,
    courses,
    spaces,
    sessionNotes,
    resumeInterruptedSession,
  } = useCourse();
  const router = useRouter();

  const [view, setView] = useState<'initial' | 'registering'>('initial');
  const [isDialogOpen, setIsDialogOpen] = useState(true);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);

  const [perception, setPerception] = useState(0);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  /** `InterruptedSession.duration` ya viene en segundos. */
  const studiedSeconds = Math.max(0, Math.round(session.duration));
  const isRendimiento = session.selectionMode === 'rendimiento';
  const origin = session.origin ?? 'default';

  // Retomar exige tres cosas: que haya reloj guardado, que la sesión no sea
  // un puñado de anotaciones sueltas y que siga siendo el MISMO día. Una
  // sesión de ayer ya no es la misma jornada de estudio.
  const canResume = useMemo(() => {
    if (origin === 'notes' || session.timerTime === undefined) return false;
    const stamp = session.suspendedAt ?? session.updatedAt;
    if (!stamp) return false;
    try {
      const when = parseISO(stamp);
      return !Number.isNaN(when.getTime()) && isToday(when);
    } catch {
      return false;
    }
  }, [origin, session]);

  /** Grupos visibles: colecciones con asignaturas + las independientes. */
  const groups = useMemo(() => {
    const search = courseSearch.trim().toLowerCase();
    const matches = (name: string, id: string) =>
      !search || name.toLowerCase().includes(search) || selectedSubjectIds.includes(id);

    const inSpaces = new Set((spaces ?? []).flatMap((s) => s.courseIds));
    const out: { id: string; name: string; courses: Course[] }[] = [];

    for (const space of spaces ?? []) {
      const list = space.courseIds
        .map((id) => courses.find((c) => c.id === id))
        .filter((c): c is Course => !!c)
        .filter((c) => matches(c.name, c.id));
      if (list.length > 0) out.push({ id: space.id, name: space.name, courses: list });
    }

    const loose = courses.filter((c) => !inSpaces.has(c.id)).filter((c) => matches(c.name, c.id));
    if (loose.length > 0) {
      out.push({ id: '__loose__', name: 'Asignaturas independientes', courses: loose });
    }

    return out;
  }, [courseSearch, courses, spaces, selectedSubjectIds]);

  const needsFocus = isRendimiento && perception === 0;
  // Sin asignaturas creadas no hay nada que marcar: no se bloquea el registro.
  const needsSubject = (courses?.length ?? 0) > 0 && selectedSubjectIds.length === 0;
  const hasAnyCourses = courses && courses.length > 0;

  const close = () => {
    setIsDialogOpen(false);
    onDone();
  };

  const handleResume = () => {
    resumeInterruptedSession(session);
    close();
    router.push('/temporizador');
  };

  /** Tirar la sesión se lleva también sus anotaciones: si se quedaran, no
   *  pertenecerían ya a nada y no habría forma de quitarlas. */
  const handleConfirmDiscard = () => {
    setShowConfirmDiscard(false);
    clearSessionNotes();
    close();
  };

  const toggleSubject = (courseId: string) =>
    setSelectedSubjectIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );

  const handleSubmit = () => {
    if (needsSubject || needsFocus) return;
    const picked = courses.filter((c) => selectedSubjectIds.includes(c.id));
    // `addStudySession` se lleva consigo las anotaciones de la sesión: es
    // justamente lo que rescata el caso de las anotaciones huérfanas.
    addStudySession({
      durationSec: studiedSeconds,
      sessionType: session.timerMode === 'focus' ? 'Temporizador' : 'Cronómetro',
      perception: isRendimiento ? perception : 0,
      subjects: picked.map((c) => c.name),
      subjectIds: picked.map((c) => c.id),
      mode: session.selectionMode,
      notes: notes.trim() || undefined,
      // Cuándo ocurrió de verdad, no cuándo se rescata: así cuenta para el día
      // en que se estudió y no para hoy.
      endedAt: session.suspendedAt ?? session.updatedAt,
    });
    close();
  };

  if (!isDialogOpen) return null;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && setShowConfirmDiscard(true)}>
        <DialogContent
          className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
          hideCloseButton
        >
          {/* ---------- Cabecera fija ---------- */}
          <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-5">
            <DialogTitle className="text-center text-lg font-bold tracking-wider text-primary">
              {canResume ? 'Tu sesión sigue en pie' : 'Una sesión sin registrar'}
            </DialogTitle>
            <DialogDescription className="text-center text-xs leading-relaxed">
              {EXPLANATION[origin]}
            </DialogDescription>

            <div
              className={cn(
                'grid items-center gap-4 pt-2',
                view === 'registering' && isRendimiento ? 'sm:grid-cols-2' : 'grid-cols-1'
              )}
            >
              <div className="space-y-0.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {origin === 'notes' ? 'Al menos' : 'Tiempo estudiado'}
                </p>
                <p className="font-headline text-2xl font-bold tabular-nums text-primary">
                  {formatHMS(studiedSeconds)}
                </p>
              </div>

              {view === 'registering' && isRendimiento && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="recovered-perception"
                      className="text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      Nivel de enfoque
                    </Label>
                    <span
                      className={cn(
                        'w-8 rounded-md text-center text-xs font-semibold tabular-nums transition-colors',
                        needsFocus
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-primary/20 text-primary'
                      )}
                    >
                      {perception}
                    </span>
                  </div>
                  <Slider
                    id="recovered-perception"
                    min={0}
                    max={20}
                    step={1}
                    value={[perception]}
                    onValueChange={(value) => setPerception(value[0])}
                    className="mt-2"
                  />
                  <p
                    className={cn(
                      'mt-1.5 text-[10px] leading-tight transition-colors',
                      needsFocus ? 'text-amber-600 dark:text-amber-400' : 'text-transparent'
                    )}
                  >
                    Mueve la barra: sin enfoque no se puede registrar.
                  </p>
                </div>
              )}
            </div>

            {/* Lo que se anotó durante la sesión perdida. Es lo que devuelve
                la memoria de qué se estaba haciendo. */}
            {sessionNotes.length > 0 && (
              <div className="space-y-1.5 pt-3 text-left">
                <SessionNotesHeading count={sessionNotes.length} />
                <div className="max-h-24 overflow-y-auto pr-1">
                  <SessionNotesList notes={sessionNotes} />
                </div>
              </div>
            )}

            {view === 'registering' && (
              <div className="space-y-1 pt-3 text-left">
                <Label
                  htmlFor="recovered-notes"
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  <NotebookPen className="h-3.5 w-3.5 text-primary" />
                  ¿Qué hiciste?
                  <span className="normal-case tracking-normal text-muted-foreground/70">(opcional)</span>
                </Label>
                {/* Texto continuo o lista de avances, en el mismo campo. */}
                <NoteEditor
                  id="recovered-notes"
                  value={notes}
                  onChange={setNotes}
                  placeholder="Resolví los ejercicios 12 al 20; me atasqué en la derivada de la cadena…"
                  rows={3}
                  dense
                  hint="Lista: un avance por línea"
                />
              </div>
            )}
          </DialogHeader>

          {/* ---------- Cuerpo ---------- */}
          {view === 'initial' ? (
            <div className="flex flex-col gap-2 px-5 py-5">
              {canResume && (
                <Button onClick={handleResume}>
                  <Play className="mr-2 h-4 w-4 fill-current" />
                  Retomar donde la dejaste
                </Button>
              )}
              <Button
                variant={canResume ? 'outline' : 'default'}
                onClick={() => setView('registering')}
              >
                {canResume ? 'Finalizarla y registrarla' : 'Registrar esta sesión'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowConfirmDiscard(true)}
                className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              >
                Descartarla
              </Button>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-sm font-semibold text-foreground">
                      ¿Qué estudiaste?
                      {selectedSubjectIds.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-primary">
                          {selectedSubjectIds.length}{' '}
                          {selectedSubjectIds.length === 1 ? 'seleccionada' : 'seleccionadas'}
                        </span>
                      )}
                    </Label>
                    <div className="relative w-full sm:w-48">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar…"
                        value={courseSearch}
                        onChange={(e) => setCourseSearch(e.target.value)}
                        className="h-8 border-primary/60 bg-card pl-8 text-xs"
                      />
                    </div>
                  </div>

                  {!hasAnyCourses ? (
                    <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                      No has creado ninguna asignatura.
                    </p>
                  ) : groups.length === 0 ? (
                    <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                      Ninguna asignatura coincide con la búsqueda.
                    </p>
                  ) : (
                    groups.map((group) => (
                      <div key={group.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {group.name}
                          </span>
                          <span className="h-px flex-1 bg-border" />
                        </div>
                        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2">
                          {group.courses.map((course) => (
                            <SubjectCard
                              key={course.id}
                              course={course}
                              selected={selectedSubjectIds.includes(course.id)}
                              onToggle={() => toggleSubject(course.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ---------- Pie fijo ---------- */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-card/60 px-5 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setView('initial')}
                >
                  Atrás
                </Button>

                <div className="flex items-center gap-3">
                  {(needsFocus || needsSubject) && (
                    <span className="text-right text-[10px] leading-tight text-amber-600 dark:text-amber-400">
                      {needsFocus && needsSubject
                        ? 'Falta el enfoque y la asignatura'
                        : needsFocus
                          ? 'Falta marcar tu enfoque'
                          : 'Falta marcar la asignatura'}
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={needsSubject || needsFocus}
                    className="min-w-[9rem]"
                  >
                    Registrar sesión
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDiscard} onOpenChange={setShowConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Se tirarán los {formatHMS(studiedSeconds)}
              {sessionNotes.length > 0 &&
                ` y ${
                  sessionNotes.length === 1
                    ? 'la anotación que dejaste'
                    : `las ${sessionNotes.length} anotaciones que dejaste`
                }`}
              . No contarán en tu tiempo de estudio ni en la calificación del día. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmDiscard}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
