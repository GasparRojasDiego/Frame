import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCourse } from '@/context/CourseContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EchoHeader } from '@/components/shared/EchoWord';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CATALOG_NAME, CATALOG_SUBJECTS } from '@/lib/subjects';
import { useToast } from '@/hooks/use-toast';

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
    spaces,
  } = useCourse();

  const { toast } = useToast();
  const [addDialogView, setAddDialogView] = useState<'course' | 'theme'>('course');
  // Una asignatura se crea a mano o se elige (una o varias) de las áreas del
  // CNEB. Las portadas NO vienen puestas: cada quien elige las suyas.
  const [courseMode, setCourseMode] = useState<'custom' | 'catalog'>('custom');
  const [pickedSubjects, setPickedSubjects] = useState<string[]>([]);
  const existingNames = useMemo(() => new Set(courses.map((course) => course.name.trim().toLowerCase())), [courses]);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [selectedCourseIdsForSpace, setSelectedCourseIdsForSpace] = useState<string[]>([]);
  const [spaceCourseSearch, setSpaceCourseSearch] = useState('');
  const [isMoveMode, setIsMoveMode] = useState(false);

  const allCourseIdsInSpaces = useMemo(
    () => new Set(spaces.flatMap((space) => space.courseIds)),
    [spaces]
  );
  const unassignedCourses = useMemo(
    () => courses.filter((course) => !allCourseIdsInSpaces.has(course.id)),
    [courses, allCourseIdsInSpaces]
  );

  useEffect(() => {
    if (!isCreateCourseOpen) {
      setNewCourseName('');
      setNewTeacherName('');
      setNewSpaceName('');
      setSelectedCourseIdsForSpace([]);
      setSpaceCourseSearch('');
      setAddDialogView('course');
      setIsMoveMode(false);
      setCourseMode('custom');
      setPickedSubjects([]);
    }
  }, [isCreateCourseOpen, setNewCourseName, setNewTeacherName]);

  const handleCreateCourse = () => {
    if (newCourseName.trim()) {
      addCourse(newCourseName, newTeacherName);
      setCreateCourseOpen(false);
    }
  };

  const handleCreateFromCatalog = () => {
    const fresh = pickedSubjects.filter((subject) => !existingNames.has(subject.toLowerCase()));
    if (fresh.length === 0) return;
    fresh.forEach((subject) => addCourse(subject));
    toast({
      title: fresh.length === 1 ? 'Asignatura creada' : `${fresh.length} asignaturas creadas`,
      description: 'Elige la portada de cada una desde su tarjeta, con el botón de la cámara.',
    });
    setCreateCourseOpen(false);
  };

  const handleCreateSpace = () => {
    // Una colección requiere 2 o más asignaturas.
    if (newSpaceName.trim() && selectedCourseIdsForSpace.length >= 2) {
      addSpace(newSpaceName, selectedCourseIdsForSpace);
      setCreateCourseOpen(false);
    }
  };

  const handleToggleCourseForSpace = (courseId: string, checked: boolean) => {
    setSelectedCourseIdsForSpace((prev) =>
      checked ? [...prev, courseId] : prev.filter((id) => id !== courseId)
    );
  };

  const { unassignedFiltered, otherSpacesWithCourses } = useMemo(() => {
    const searchLower = spaceCourseSearch.toLowerCase();
    const unassigned = unassignedCourses.filter((c) => c.name.toLowerCase().includes(searchLower));
    const otherSpaces = spaces.map((s) => ({
      space: s,
      courses: s.courseIds
        .map((id) => courses.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .filter((c) => c.name.toLowerCase().includes(searchLower)),
    }));
    return { unassignedFiltered: unassigned, otherSpacesWithCourses: otherSpaces };
  }, [spaceCourseSearch, courses, spaces, unassignedCourses]);

  return (
    <Dialog open={isCreateCourseOpen} onOpenChange={setCreateCourseOpen}>
      <DialogContent>
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

        {addDialogView === 'course' && (
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border" role="radiogroup" aria-label="Cómo crear la asignatura">
            {(
              [
                ['custom', 'Asignatura propia'],
                ['catalog', `Del ${CATALOG_NAME}`],
              ] as const
            ).map(([value, label], index) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={courseMode === value}
                onClick={() => setCourseMode(value)}
                className={cn(
                  'py-2 text-xs font-semibold transition-colors',
                  index > 0 && 'border-l border-border',
                  courseMode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {addDialogView === 'course' && courseMode === 'catalog' ? (
          <div className="space-y-3 py-2">
            <p className="text-[11px] leading-snug text-muted-foreground">
              Marca las asignaturas que llevas. Se crean con su nombre oficial y la portada de cada una la eliges tú
              después.
            </p>
            <ScrollArea className="h-64 w-full rounded-md border">
              <div className="sticky top-0 z-10 bg-muted/80 p-2 text-center backdrop-blur">
                <h3 className="text-sm font-bold text-primary">Currículo Nacional (CNEB)</h3>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 p-4 sm:grid-cols-2">
                {CATALOG_SUBJECTS.map((subject) => {
                  const owned = existingNames.has(subject.toLowerCase());
                  const inputId = `catalog-${subject}`;
                  return (
                    <div key={subject} className="flex items-center gap-2.5">
                      <Checkbox
                        id={inputId}
                        disabled={owned}
                        checked={owned || pickedSubjects.includes(subject)}
                        onCheckedChange={(checked) =>
                          setPickedSubjects((prev) =>
                            checked ? [...prev, subject] : prev.filter((entry) => entry !== subject)
                          )
                        }
                      />
                      <Label htmlFor={inputId} className={cn('text-sm font-medium leading-tight', owned && 'text-muted-foreground')}>
                        {subject}
                        {owned && <span className="ml-1.5 text-[10px] font-normal">· ya la tienes</span>}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : addDialogView === 'course' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="courseName" className="text-xs">Nombre de la asignatura</Label>
              <Input
                id="courseName"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Ej: Física Cuántica" data-tour="asig-nombre"
                className="bg-card border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherName" className="text-xs">Nombre del profesor (opcional)</Label>
              <Input
                id="teacherName"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder="Ej: Sr. Pérez" data-tour="asig-profesor"
                className="bg-card border-primary"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="spaceName" className="text-xs">Nombre de la colección</Label>
              <Input
                id="spaceName"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Ej: Primer Semestre" data-tour="coleccion-nombre"
                className="bg-card border-primary"
              />
              <p className="text-[10px] text-muted-foreground">
                Una colección agrupa 2 o más asignaturas. Cada asignatura solo puede
                pertenecer a UNA colección (si eliges una de otra colección, se mueve).
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Seleccionar asignaturas</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  placeholder="Buscar asignaturas..."
                  value={spaceCourseSearch}
                  onChange={(e) => setSpaceCourseSearch(e.target.value)}
                  className="h-9 bg-card flex-grow"
                />
                <Button
                  variant={isMoveMode ? 'default' : 'outline'}
                  onClick={() => setIsMoveMode((prev) => !prev)}
                  className={cn(
                    'text-xs h-9 shrink-0',
                    !isMoveMode && 'border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'
                  )}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Mover
                </Button>
              </div>
              <ScrollArea className="h-48 w-full rounded-md border p-0 !mt-6">
                {isMoveMode ? (
                  <div className="space-y-3">
                    {otherSpacesWithCourses.map(({ space: otherSpace, courses: coursesInOtherSpace }) => (
                      <div key={otherSpace.id}>
                        <div className="bg-muted/50 p-2 text-center">
                          <h3 className="font-bold text-primary text-sm">{otherSpace.name}</h3>
                        </div>
                        <div className="p-4 space-y-3">
                          {coursesInOtherSpace.length > 0 ? (
                            coursesInOtherSpace.map((course, index) => (
                              <React.Fragment key={`move-${course.id}`}>
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    id={`course-for-space-${course.id}`}
                                    checked={selectedCourseIdsForSpace.includes(course.id)}
                                    onCheckedChange={(checked) => handleToggleCourseForSpace(course.id, !!checked)}
                                  />
                                  <Label
                                    htmlFor={`course-for-space-${course.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {course.name}
                                  </Label>
                                </div>
                                {index < coursesInOtherSpace.length - 1 && <Separator className="my-2" />}
                              </React.Fragment>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Esta sección está vacía</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="bg-muted/50 p-2 text-center">
                      <h3 className="font-bold text-primary text-sm">Asignaturas independientes</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {unassignedFiltered.length > 0 ? (
                        unassignedFiltered.map((course, index) => (
                          <React.Fragment key={`unassigned-${course.id}`}>
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`course-for-space-${course.id}`}
                                checked={selectedCourseIdsForSpace.includes(course.id)}
                                onCheckedChange={(checked) => handleToggleCourseForSpace(course.id, !!checked)}
                              />
                              <Label
                                htmlFor={`course-for-space-${course.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {course.name}
                              </Label>
                            </div>
                            {index < unassignedFiltered.length - 1 && <Separator className="my-2" />}
                          </React.Fragment>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Esta sección está vacía</p>
                      )}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateCourseOpen(false)}>Cancelar</Button>
          {addDialogView === 'course' && courseMode === 'catalog' ? (
            <Button onClick={handleCreateFromCatalog} disabled={pickedSubjects.length === 0} data-tour="asig-crear">
              {pickedSubjects.length <= 1 ? 'Crear asignatura' : `Crear ${pickedSubjects.length} asignaturas`}
            </Button>
          ) : (
            <Button
              onClick={addDialogView === 'course' ? handleCreateCourse : handleCreateSpace}
              data-tour="asig-crear"
              disabled={addDialogView === 'course' ? !newCourseName.trim() : (!newSpaceName.trim() || selectedCourseIdsForSpace.length < 2)}
            >
              Crear
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
