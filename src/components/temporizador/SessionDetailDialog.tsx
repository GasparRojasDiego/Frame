import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, BookOpen, ListChecks, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
import EchoWord from '@/components/shared/EchoWord';
import { SubjectCover } from '@/components/courses/SubjectPicker';
import RichNoteView from '@/components/temporizador/RichNoteView';
import SessionNotesList, { SessionNotesHeading } from '@/components/temporizador/SessionNotesList';
import { sessionHasFocus, sessionRange, sessionSubjects } from '@/components/temporizador/session-info';
import { useCourse } from '@/context/CourseContext';
import { formatDurationLabel, sessionSeconds } from '@/lib/duration';
import { isSessionEditable } from '@/lib/session-edit';
import { isRichNoteEmpty } from '@/lib/rich-note';
import { cn } from '@/lib/utils';
import type { DailyPerformance, StudySession } from '@/types';

// ============================================================
// El detalle de UNA sesión de estudio: lo que la tarjeta resume, entero.
//
// Cuándo empezó y terminó, cuánto duró, qué lugar ocupó en el día y cuánto
// llevaba acumulado la jornada al cerrarla; sus asignaturas con su colección,
// las tareas que avanzó, la nota del día y las anotaciones completas, con
// los avances al minuto en que se escribieron.
//
// Se usa de dos formas: como ventana propia (Métricas de hoy) y como vista
// dentro del recuadro de un día del calendario, que la muestra en su lugar
// con la flecha de volver arriba a la izquierda: un solo recuadro cada vez.
// ============================================================

const dayKeyOf = (iso: string): string | null => {
  try {
    return format(parseISO(iso), 'yyyy-MM-dd');
  } catch {
    return null;
  }
};

/** Título de sección, con la forma de «Avances anotados». */
function SectionHeading({ icon: Icon, children }: { icon: typeof BookOpen; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {children}
    </p>
  );
}

/** Par etiqueta → dato, en una línea. */
function Pair({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-semibold tabular-nums', accent ? 'text-primary' : 'text-foreground')}>{value}</dd>
    </div>
  );
}

export function SessionDetailView({
  session,
  dayPerformance,
  onBack,
  onEdit,
  onDelete,
}: {
  session: StudySession;
  /** Calificación del día de la sesión, si la tiene. */
  dayPerformance?: DailyPerformance | null;
  /** Con él aparece la flecha de volver (al recuadro del día). */
  onBack?: () => void;
  onEdit?: (session: StudySession) => void;
  onDelete?: (id: string) => void;
}) {
  const { courses, spaces, tasks, archivedTasks, studySessions } = useCourse();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const seconds = sessionSeconds(session);
  const range = sessionRange(session);
  const hasFocus = sessionHasFocus(session);
  const editable = isSessionEditable(session);

  const subjects = useMemo(() => sessionSubjects(session, courses ?? []), [session, courses]);

  /** Colección de cada asignatura (la primera en la que aparece). */
  const collectionOf = (courseId: string | undefined): string | null =>
    courseId ? (spaces ?? []).find((space) => space.courseIds.includes(courseId))?.name ?? null : null;

  /** Tareas avanzadas, estén pendientes o ya archivadas. */
  const advanced = useMemo(() => {
    const names = new Map<string, string>();
    for (const task of tasks ?? []) names.set(task.id, task.name);
    for (const task of archivedTasks ?? []) names.set(task.id, task.name);
    return (session.taskIds ?? [])
      .map((id) => names.get(id))
      .filter((name): name is string => Boolean(name));
  }, [session.taskIds, tasks, archivedTasks]);

  /** Lugar de la sesión en su día y lo que la jornada llevaba al cerrarla. */
  const dayContext = useMemo(() => {
    const key = dayKeyOf(session.startTime);
    if (!key) return null;
    const sameDay = (studySessions ?? [])
      .filter((s) => dayKeyOf(s.startTime) === key)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const index = sameDay.findIndex((s) => s.id === session.id);
    if (index < 0) return null;
    const running = sameDay.slice(0, index + 1).reduce((acc, s) => acc + sessionSeconds(s), 0);
    return { order: index + 1, total: sameDay.length, running };
  }, [studySessions, session.id, session.startTime]);

  const dateLabel = (() => {
    try {
      // Solo la fecha: el horario va en las cifras, sin repetirlo aquí.
      return format(parseISO(session.startTime), "EEEE d 'de' MMMM", { locale: es });
    } catch {
      return '';
    }
  })();

  // Una anotación con solo una viñeta vacía o marcas sueltas no dice nada.
  const notes = isRichNoteEmpty(session.notes ?? '') ? '' : session.notes ?? '';
  const progress = session.progressNotes ?? [];
  const canEdit = editable && Boolean(onEdit);
  const canDelete = editable && Boolean(onDelete);

  return (
    <>
      {/* ---------- Cabecera: eco, flecha de volver y fecha ---------- */}
      <div className="relative shrink-0 overflow-hidden px-6 pb-4 pt-6">
        <EchoWord word="Sesión" />
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-2.5 top-2.5 h-7 w-7 text-foreground hover:text-primary"
            onClick={onBack}
            // La tarjeta pulsada desaparece al cambiar de vista: el foco
            // pasa aquí en lugar de perderse.
            autoFocus
            title="Volver al día"
            aria-label="Volver al día"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <DialogTitle className="relative text-center text-lg font-bold text-primary">Sesión de estudio</DialogTitle>
        <DialogDescription className="relative mt-1 text-center text-xs text-muted-foreground first-letter:uppercase">
          {dateLabel}
        </DialogDescription>
      </div>
      <div className="mx-6 h-px shrink-0 bg-border" />

      {/* ---------- Cuerpo: único carril de scroll ---------- */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
        {/* Duración a la izquierda; el resto de cifras, etiqueta → dato. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="text-center">
            <p className="font-headline text-2xl font-bold tabular-nums text-primary">
              {formatDurationLabel(seconds)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {dayContext && dayContext.total > 1
                ? `Sesión ${dayContext.order} de ${dayContext.total} del día`
                : 'Duración'}
            </p>
          </div>
          <span className="w-px self-stretch bg-border" />
          <dl className="mx-auto w-full max-w-[14rem] space-y-1 text-xs">
            {range && (
              <Pair label="Horario" value={`${format(range.start, 'HH:mm')} – ${format(range.end, 'HH:mm')}`} />
            )}
            {hasFocus && (
              <Pair
                label="Rendimiento"
                accent
                value={
                  <>
                    {session.perception}
                    <span className="text-[10px] text-muted-foreground">/20</span>
                  </>
                }
              />
            )}
            <Pair label="Reloj" value={session.sessionType} />
            {dayContext && dayContext.total > 1 && (
              <Pair label="Acumulado del día" value={formatDurationLabel(dayContext.running)} />
            )}
            {dayPerformance && (
              <Pair
                label="Nota del día"
                accent
                value={`${dayPerformance.score.toFixed(1)} ${dayPerformance.grade}`}
              />
            )}
          </dl>
        </div>

        {/* Asignaturas, con la estética de sus tarjetas. */}
        <div className="space-y-2">
          <SectionHeading icon={BookOpen}>
            {subjects.length === 1 ? 'Asignatura' : 'Asignaturas'}
          </SectionHeading>
          {subjects.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">Sin asignatura declarada</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {subjects.map((subject) => {
                const collection = collectionOf(subject.course?.id);
                return (
                  <div key={subject.key} className="overflow-hidden rounded-lg border border-border/70 bg-card">
                    <SubjectCover
                      imageKeys={subject.course ? [`courseImage_${subject.course.id}`] : []}
                      className="h-12 w-full"
                    />
                    <div className="border-t border-border/60 px-2 py-1">
                      <p className="truncate text-center text-xs font-bold text-primary" title={subject.name}>
                        {subject.name}
                      </p>
                      {collection && (
                        <p className="truncate text-center text-[10px] text-muted-foreground">{collection}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {advanced.length > 0 && (
          <div className="space-y-1.5">
            <SectionHeading icon={ListChecks}>Tareas avanzadas</SectionHeading>
            <ul className="space-y-1 text-xs text-foreground">
              {advanced.map((name, index) => (
                <li key={`${name}-${index}`} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {notes && (
          <div className="space-y-1.5">
            <SectionHeading icon={NotebookPen}>Anotaciones</SectionHeading>
            <RichNoteView text={notes} className="text-sm leading-relaxed text-foreground" />
          </div>
        )}

        {/* Lo anotado DURANTE la sesión, con el minuto en que se escribió. */}
        {progress.length > 0 && (
          <div className="space-y-1.5">
            <SessionNotesHeading count={progress.length} />
            <SessionNotesList notes={progress} />
          </div>
        )}

        {!notes && progress.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">Sin anotaciones en esta sesión.</p>
        )}
      </div>

      {/* ---------- Pie: solo mientras la sesión es corregible (hoy) ---------- */}
      {(canEdit || canDelete) && (
        <>
          <div className="mx-6 h-px shrink-0 bg-border" />
          <div className={cn('flex shrink-0 items-center gap-3 px-6 py-3', canDelete ? 'justify-between' : 'justify-end')}>
            {canDelete && (
              <Button type="button" variant="gris" size="sm" className="gap-1.5" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            )}
            {canEdit && (
              <Button type="button" variant="fantasma" size="sm" className="gap-1.5" onClick={() => onEdit?.(session)}>
                <Pencil className="h-3.5 w-3.5" />
                Corregir
              </Button>
            )}
          </div>
        </>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta sesión de estudio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará la sesión de {formatDurationLabel(seconds)}
              {subjects.length > 0 ? ` en ${subjects.map((subject) => subject.name).join(', ')}` : ''}. La
              calificación de ese día se recalculará. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDelete(false);
                onDelete?.(session.id);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** La misma vista, como ventana propia. `session = null` la cierra. */
export default function SessionDetailDialog({
  session,
  onClose,
  dayPerformance,
  onEdit,
  onDelete,
}: {
  session: StudySession | null;
  onClose: () => void;
  dayPerformance?: DailyPerformance | null;
  onEdit?: (session: StudySession) => void;
  onDelete?: (id: string) => void;
}) {
  // La última sesión mostrada sigue pintándose mientras la ventana se cierra:
  // sin esto el recuadro se vaciaría en plena animación de salida.
  const [lastShown, setLastShown] = useState<StudySession | null>(session);
  if (session && session !== lastShown) setLastShown(session);
  const shown = session ?? lastShown;

  return (
    <Dialog open={Boolean(session)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {shown && (
          <SessionDetailView
            session={shown}
            dayPerformance={dayPerformance}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
