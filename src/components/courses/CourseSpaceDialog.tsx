import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCourse } from '@/context/CourseContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EchoHeader } from '@/components/shared/EchoWord';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SubjectMultiPicker } from '@/components/courses/SubjectPicker';
import { cn } from '@/lib/utils';
import { CATALOG_NAME, CATALOG_SUBJECTS } from '@/lib/subjects';

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

  /** Sugerencia del CNEB que coincide con el nombre escrito (si alguna). */
  const typedName = newCourseName.trim().toLowerCase();
  const typedSubject = CATALOG_SUBJECTS.find(
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
        <EchoHeader word={addDialogView === 'course' ? 'Asignatura' : 'Colección'}>
        <DialogHeader>
          <div className="flex items-center justify-center gap-4">
            <Button size="icon" variant="ghost" className="h-9 w-9 text-primary" onClick={() => setAddDialogView('course')} disabled={addDialogView === 'course'}>
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <DialogTitle className="text-xl text-primary font-bold text-center">
              {addDialogView === 'course' ? 'Asignatura nueva' : 'Colección nueva'}
            </DialogTitle>
            <Button size="icon" variant="ghost" className="h-9 w-9 text-primary" onClick={() => setAddDialogView('theme')} disabled={addDialogView === 'theme'} data-tour="asig-vista-coleccion" title="Crear una colección">
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        </DialogHeader>
        </EchoHeader>

        {addDialogView === 'course' ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="courseName" className="text-xs">Nombre de la asignatura</Label>
              {/* Con varias áreas marcadas, cada una se crea con su nombre. */}
              <Input
                id="courseName"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                disabled={batch}
                placeholder={batch ? `${marked.length} áreas del CNEB marcadas abajo` : 'Ej: Física Cuántica'}
                data-tour="asig-nombre"
                className="bg-card border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherName" className="text-xs">
                {batch ? 'Nombre del profesor (opcional, para todas)' : 'Nombre del profesor (opcional)'}
              </Label>
              <Input
                id="teacherName"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder="Ej: Sr. Pérez" data-tour="asig-profesor"
                className="bg-card border-primary"
              />
            </div>

            {/* Las áreas del CNEB ya no son un modo aparte: van debajo, tras
                una línea fina. Una marcada escribe el nombre; con varias se
                crean todas de una vez. Pulsar una marcada la quita. Las que ya
                tienes no se ofrecen. */}
            <div role="separator" className="mx-8 h-px bg-border/70" />
            <div className="space-y-2" data-tour="asig-cneb">
              <p className="text-center text-[11px] font-semibold text-muted-foreground">Del {CATALOG_NAME}</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {CATALOG_SUBJECTS.map((subject) => {
                  const owned = existingNames.has(subject.toLowerCase());
                  const chosen = !owned && marked.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      disabled={owned}
                      aria-pressed={chosen}
                      title={owned ? 'Ya tienes esta asignatura' : undefined}
                      onClick={() => toggleSubject(subject)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        chosen
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/70 bg-card text-foreground hover:border-primary/60 hover:bg-primary/10 hover:text-primary',
                        owned && 'cursor-not-allowed opacity-40 hover:border-border/70 hover:bg-card hover:text-foreground'
                      )}
                    >
                      {subject}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="spaceName" className="text-xs">Nombre de la colección</Label>
              <Input
                id="spaceName"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Ej: Primer Semestre" data-tour="coleccion-nombre"
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
                title="¿Qué asignaturas agrupa?"
              />
              <p className="text-center text-[10px] text-muted-foreground">
                Mínimo dos. Si una ya está en otra colección, pasa a esta.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="fantasmaRojo" onClick={() => setCreateCourseOpen(false)}>Cancelar</Button>
          <Button
            onClick={addDialogView === 'course' ? handleCreateCourse : handleCreateSpace}
            data-tour="asig-crear"
            disabled={
              addDialogView === 'course'
                ? batch
                  ? freshPicked.length === 0
                  : !newCourseName.trim()
                : !newSpaceName.trim() || selectedCourseIdsForSpace.length < 2
            }
          >
            {addDialogView === 'course' && batch && freshPicked.length >= 2 ? `Crear ${freshPicked.length} asignaturas` : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
