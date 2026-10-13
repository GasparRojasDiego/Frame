import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCourse } from '@/context/CourseContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EchoHeader } from '@/components/shared/EchoWord';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SubjectMultiPicker } from '@/components/courses/SubjectPicker';
import { cn } from '@/lib/utils';
import { CATALOG_SUBJECTS } from '@/lib/subjects';
import { tr } from '@/lib/i18n';

// Diálogo unificado "Asignatura nueva / Categoría nueva".
// Antes vivía en el sidebar; ahora se abre desde la interfaz Asignaturas.
export default function CourseSpaceDialog() {
  const {
    isCreateCourseOpen,
    setCreateCourseOpen,
    newCourseName,
    setNewCourseName,
    newTeacherName,
    setNewTeacherName,
    addCourse,
    courses,
    addSpace,
  } = useCourse();

  const [addDialogView, setAddDialogView] = useState<'course' | 'theme'>('course');
  const existingNames = useMemo(() => new Set(courses.map((course) => course.name.trim().toLowerCase())), [courses]);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [selectedCourseIdsForSpace, setSelectedCourseIdsForSpace] = useState<string[]>([]);
  /** Áreas del CNEB marcadas cuando son dos o más (con una, manda el nombre escrito). */
  const [pickedSubjects, setPickedSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (!isCreateCourseOpen) {
      setNewCourseName('');
      setNewTeacherName('');
      setNewSpaceName('');
      setSelectedCourseIdsForSpace([]);
      setPickedSubjects([]);
      setAddDialogView('course');
    }
  }, [isCreateCourseOpen, setNewCourseName, setNewTeacherName]);

  // El catálogo en el idioma de la interfaz: en inglés se marca y se crea
  // «Mathematics», no «Matemática».
  const catalog: string[] = CATALOG_SUBJECTS.map((subject) => tr(subject));
  /** Sugerencia del CNEB que coincide con el nombre escrito (si alguna). */
  const typedName = newCourseName.trim().toLowerCase();
  const typedSubject = catalog.find(
    (subject) => subject.toLowerCase() === typedName && !existingNames.has(typedName)
  );
  // Con una sola marcada, la marca sale del nombre (como al escribirlo); con
  // varias, de la lista, y se crean todas de una vez.
  const batch = pickedSubjects.length >= 2;
  const marked = batch ? pickedSubjects : typedSubject ? [typedSubject] : [];
  const freshPicked = pickedSubjects.filter((subject) => !existingNames.has(subject.toLowerCase()));

  const toggleSubject = (subject: string) => {
    const next = marked.includes(subject) ? marked.filter((entry) => entry !== subject) : [...marked, subject];
    if (next.length >= 2) {
      setPickedSubjects(next);
      setNewCourseName('');
      return;
    }
    // Una o ninguna: se comporta como siempre, escribiendo (o borrando) el nombre.
    setPickedSubjects([]);
    setNewCourseName(next[0] ?? '');
  };

  const handleCreateCourse = () => {
    if (batch) {
      if (freshPicked.length === 0) return;
      freshPicked.forEach((subject) => addCourse(subject, newTeacherName));
      setCreateCourseOpen(false);
      return;
    }
    if (newCourseName.trim()) {
      addCourse(newCourseName, newTeacherName);
      setCreateCourseOpen(false);
    }
  };

  const handleCreateSpace = () => {
    // Una colección requiere 2 o más asignaturas.
    if (newSpaceName.trim() && selectedCourseIdsForSpace.length >= 2) {
      addSpace(newSpaceName, selectedCourseIdsForSpace);
      setCreateCourseOpen(false);
    }
  };

  return (
    <Dialog open={isCreateCourseOpen} onOpenChange={setCreateCourseOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <EchoHeader word={addDialogView === 'course' ? tr('Asignatura') : tr('Colección')}>
        <DialogHeader>
          <div className="flex items-center justify-center gap-4">
            <Button size="icon" variant="ghost" className="h-9 w-9 text-primary" onClick={() => setAddDialogView('course')} disabled={addDialogView === 'course'}>
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <DialogTitle className="text-xl text-primary font-bold text-center">
              {addDialogView === 'course' ? tr('Asignatura nueva') : tr('Colección nueva')}
            </DialogTitle>
            <Button size="icon" variant="ghost" className="h-9 w-9 text-primary" onClick={() => setAddDialogView('theme')} disabled={addDialogView === 'theme'} title={tr('Crear una colección')}>
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        </DialogHeader>
        </EchoHeader>

        {addDialogView === 'course' ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="courseName" className="text-xs">{tr('Nombre de la asignatura')}</Label>
              {/* Con varias áreas marcadas, cada una se crea con su nombre. */}
              <Input
                id="courseName"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                disabled={batch}
                placeholder={batch ? tr('{length} predeterminadas marcadas abajo', { length: marked.length }) : tr('Ej: Física Cuántica')}
                className="bg-card border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherName" className="text-xs">
                {batch ? tr('Nombre del profesor (opcional, para todas)') : tr('Nombre del profesor (opcional)')}
              </Label>
              <Input
                id="teacherName"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder={tr('Ej: Sr. Pérez')}
                className="bg-card border-primary"
              />
            </div>

            {/* Las predeterminadas (áreas del CNEB) van debajo, tras una línea
                fina con su nombre al centro: lista de marcar en 2 columnas; las
                marcadas, en azul fantasma (1.6.7, Diego). Una marcada escribe
                el nombre; con varias se crean todas de una vez. Las que ya
                tienes se ven, pero no se pueden marcar. */}
            <div role="separator" className="flex items-center gap-3 px-2 pt-3">
              <span aria-hidden className="h-px flex-1 bg-border/70" />
              <span className="text-[11px] font-semibold text-muted-foreground">{tr('Predeterminadas')}</span>
              <span aria-hidden className="h-px flex-1 bg-border/70" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {catalog.map((subject) => {
                const owned = existingNames.has(subject.toLowerCase());
                const chosen = !owned && marked.includes(subject);
                return (
                  <button
                    key={subject}
                    type="button"
                    role="checkbox"
                    disabled={owned}
                    aria-checked={chosen}
                    title={owned ? tr('Ya tienes esta asignatura') : undefined}
                    onClick={() => toggleSubject(subject)}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      chosen
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/70 bg-card text-foreground hover:border-primary/60 hover:text-primary',
                      owned && 'cursor-not-allowed opacity-40 hover:border-border/70 hover:text-foreground'
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
                        chosen ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'
                      )}
                    >
                      {chosen && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{subject}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="spaceName" className="text-xs">{tr('Nombre de la colección')}</Label>
              <Input
                id="spaceName"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder={tr('Ej: Primer Semestre')}
                className="bg-card border-primary"
              />
            </div>
            <div role="separator" className="mx-8 h-px bg-border/70" />
            {/* Tarjetas, como en todo Frame: colección → asignaturas. Elegir una
                que ya está en otra colección la mueve a esta (cada asignatura
                pertenece como mucho a UNA). */}
            <div className="space-y-2">
              <SubjectMultiPicker
                values={selectedCourseIdsForSpace}
                onChange={setSelectedCourseIdsForSpace}
                title={tr('¿Qué asignaturas agrupa?')}
              />
              <p className="text-center text-[10px] text-muted-foreground">
                {tr('Mínimo dos. Si una ya está en otra colección, pasa a esta.')}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="gris" onClick={() => setCreateCourseOpen(false)}>{tr('Cancelar')}</Button>
          <Button
            onClick={addDialogView === 'course' ? handleCreateCourse : handleCreateSpace}
            disabled={
              addDialogView === 'course'
                ? batch
                  ? freshPicked.length === 0
                  : !newCourseName.trim()
                : !newSpaceName.trim() || selectedCourseIdsForSpace.length < 2
            }
          >
            {addDialogView === 'course' && batch && freshPicked.length >= 2 ? tr('Crear {length} asignaturas', { length: freshPicked.length }) : tr('Crear')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
