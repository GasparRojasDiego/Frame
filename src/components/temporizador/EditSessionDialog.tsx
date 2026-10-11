import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Layers, Lock, NotebookPen, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NoteEditor from '@/components/temporizador/NoteEditor';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { SubjectCard } from '@/components/temporizador/SubjectPickCard';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import { formatHMS, sessionSeconds } from '@/lib/duration';
import { isSessionEditable } from '@/lib/session-edit';
import type { Course, StudySession } from '@/types';

// ============================================================
// Corregir una sesión YA registrada, el mismo día.
//
// Uno se equivoca al cerrar el reloj: marca el enfoque de memoria, olvida una
// asignatura, escribe la anotación con prisa. Reabrirlo unas horas después,
// con la cabeza fría, es lo que vuelve fiel al registro.
//
// Lo que NO se puede tocar y por qué:
//   · La DURACIÓN la mide el reloj. Es el único dato de la sesión que no
//     depende de la memoria de nadie; si se pudiera escribir a mano, las
//     métricas dejarían de medir y pasarían a ser un deseo.
//   · El AVANCE DE TAREAS que la sesión aplicó ya está sumado en cada tarea,
//     donde se corrige con su propio control. Deshacerlo desde aquí tendría
//     que adivinar qué parte de ese porcentaje vino de esta sesión.
//
// A partir del día siguiente no se abre: ver `isSessionEditable`.
//
// La estética es la del cierre de sesión —mismas tarjetas de asignatura,
// mismo carril único de scroll— porque es el mismo formulario visto una
// segunda vez.
// ============================================================

export default function EditSessionDialog({
  session,
  onClose,
}: {
  /** Sesión a corregir; `null` cierra el diálogo. */
  session: StudySession | null;
  onClose: () => void;
}) {
  const { courses, spaces, updateStudySession } = useCourse();

  const [perception, setPerception] = useState(0);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  const isRendimiento = session?.mode === 'rendimiento';

  // Cada apertura parte de lo que la sesión tiene guardado, no de un
  // formulario en blanco: corregir es retocar, no volver a rellenar.
  useEffect(() => {
    if (!session) return;
    setPerception(session.perception ?? 0);
    setNotes(session.notes ?? '');
    setCourseSearch('');
    // Las sesiones antiguas guardaban solo los NOMBRES de las asignaturas; se
    // reconstruyen los ids por nombre para que también se puedan corregir.
    const ids = session.subjectIds?.length
      ? session.subjectIds
      : (session.subjects ?? [])
          .map((name) => courses.find((c) => c.name === name)?.id)
          .filter((id): id is string => Boolean(id));
    setSelectedSubjectIds(ids);
    // Solo al cambiar de sesión: `courses` se recrea en cada sincronización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  /** Grupos visibles: colecciones con asignaturas + las independientes. Las
   *  ya marcadas nunca se ocultan al filtrar. */
  const groups = useMemo(() => {
    const search = courseSearch.trim().toLowerCase();
    const matches = (name: string, id: string) =>
      !search || name.toLowerCase().includes(search) || selectedSubjectIds.includes(id);

    const inSpaces = new Set(spaces.flatMap((s) => s.courseIds));
    const out: { id: string; name: string; courses: Course[] }[] = [];

    for (const space of spaces) {
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

  if (!session) return null;

  // Cinturón y tirantes: si el diálogo se quedó abierto al cruzar la
  // medianoche, deja de poder guardar.
  const editable = isSessionEditable(session);
  const needsFocus = isRendimiento && perception === 0;
  // Sin asignaturas creadas no hay nada que marcar: no se bloquea el registro.
  const needsSubject = (courses?.length ?? 0) > 0 && selectedSubjectIds.length === 0;
  const blocked = !editable || needsFocus || needsSubject;

  const toggleSubject = (courseId: string) =>
    setSelectedSubjectIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );

  const save = () => {
    if (blocked) return;
    const picked = courses.filter((c) => selectedSubjectIds.includes(c.id));
    const ok = updateStudySession(session.id, {
      perception,
      subjects: picked.map((c) => c.name),
      subjectIds: picked.map((c) => c.id),
      notes,
    });
    if (ok) onClose();
  };

  const started = (() => {
    try {
      return format(parseISO(session.startTime), 'HH:mm', { locale: es });
    } catch {
      return null;
    }
  })();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl [&>button]:h-5 [&>button]:w-5 [&>button]:text-foreground">
        {/* ---------- Cabecera fija ---------- */}
        <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-5">
          <DialogTitle className="text-center text-lg font-bold tracking-wider text-primary">
            Corregir sesión
          </DialogTitle>

          <div className={cn('grid items-center gap-4 pt-2', isRendimiento ? 'sm:grid-cols-2' : 'grid-cols-1')}>
            <div className="space-y-0.5 text-center">
              <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Tiempo estudiado
                <Lock className="h-3 w-3" />
              </p>
              <p className="font-headline text-2xl font-bold tabular-nums text-primary">
                {formatHMS(sessionSeconds(session))}
              </p>
              {started && (
                <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {session.sessionType} · {started}
                </p>
              )}
            </div>

            {isRendimiento && (
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-perception" className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
                  id="edit-perception"
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
                  Mueve la barra: sin enfoque no se puede guardar.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1 pt-3 text-left">
            <Label
              htmlFor="edit-session-notes"
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              <NotebookPen className="h-3.5 w-3.5 text-primary" />
              ¿Qué hiciste?
              <span className="normal-case tracking-normal text-muted-foreground/70">(opcional)</span>
            </Label>
            {/* Texto continuo o lista de avances, en el mismo campo. */}
            <NoteEditor
              id="edit-session-notes"
              value={notes}
              onChange={setNotes}
              placeholder="Resolví los ejercicios 12 al 20; me atasqué en la derivada de la cadena…"
              rows={3}
              dense
              hint="Lista: un avance por línea"
            />
          </div>
        </DialogHeader>

        {/* ---------- Cuerpo: ÚNICO carril de scroll ---------- */}
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

            {groups.length === 0 ? (
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

            <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
              El tiempo lo mide el reloj y no se edita. El avance que esta sesión aplicó a tus tareas
              se ajusta desde cada tarea, no desde aquí.
            </p>
          </div>
        </div>

        {/* ---------- Pie fijo ---------- */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-card/60 px-5 py-3">
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onClose}>
            Cancelar
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
            <Button type="button" size="sm" onClick={save} disabled={blocked} className="min-w-[9rem]">
              Guardar cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
