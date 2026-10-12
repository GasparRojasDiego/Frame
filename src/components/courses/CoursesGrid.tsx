import { useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCourse } from '@/context/CourseContext';
import CourseSpaceDialog from './CourseSpaceDialog';
import ImagePickerDialog from '@/components/shared/ImagePickerDialog';
import { aspectOf } from '@/components/shared/ImageCropper';
import WaveBackdrop from '@/components/courses/WaveBackdrop';
import { saveImage } from '@/lib/music-db';
import { useStoredImage } from '@/hooks/use-stored-image';
import type { Course, Task, TaskPriority } from '@/types';
import {
  GraduationCap,
  BookOpen,
  StickyNote,
  CalendarClock,
  Camera,
  ChevronLeft,
  Check,
  Layers,
  Pencil,
  X,
} from 'lucide-react';
import CourseCollectionDialog from '@/components/courses/CourseCollectionDialog';
import type { Space } from '@/types';
import { useCardImageStyle, useReportReferenceWidth } from '@/lib/card-image-height';
import { cn } from '@/lib/utils';

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  Alta: 'text-red-400',
  Media: 'text-yellow-400',
  Baja: 'text-green-400',
};

// Tarjeta de asignatura: imagen (u olas animadas) arriba, nombre centrado en
// azul primario entre finas líneas divisorias, y abajo tareas pendientes,
// notas y la tarea más próxima con su nivel de relevancia.
function CourseCard({
  course,
  pendingTasks,
  noteCount,
  onOpen,
}: {
  course: Course;
  pendingTasks: Task[];
  noteCount: number;
  onOpen: () => void;
}) {
  // Se relee sola: también cuando la imagen llega de otro dispositivo.
  const [image, setImage] = useStoredImage(`courseImage_${course.id}`);
  const [isPickerOpen, setPickerOpen] = useState(false);
  // El encuadre usa la proporción real del hueco de la imagen en esta tarjeta.
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const imageStyle = useCardImageStyle();
  useReportReferenceWidth(imageBoxRef);
  const [pickerAspect, setPickerAspect] = useState<number>();
  const [isCollectionOpen, setCollectionOpen] = useState(false);


  // Guarda la imagen elegida (galería nativa o subida) igual que siempre.
  const handleSelectImage = async (dataUrl: string) => {
    await saveImage(`courseImage_${course.id}`, dataUrl);
    setImage(dataUrl);
    window.dispatchEvent(new StorageEvent('storage', { key: `courseImage_${course.id}` }));
  };

  const nextTask = useMemo(() => {
    const dated = pendingTasks.filter((t) => t.dueDate);
    if (dated.length === 0) return null;
    return dated.reduce((a, b) =>
      new Date(a.dueDate!).getTime() <= new Date(b.dueDate!).getTime() ? a : b
    );
  }, [pendingTasks]);

  return (
    <Card
      data-tour="asignatura-tarjeta"
      className="group cursor-pointer overflow-hidden transition-all hover:border-primary/60 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
      onClick={onOpen}
    >
      {/* Imagen de la asignatura (u olas animadas sobre fondo transparente) */}
      <div ref={imageBoxRef} className="relative bg-transparent" style={imageStyle}>
        {image ? (
          <img src={image} alt={course.name} className="h-full w-full object-cover" />
        ) : (
          <WaveBackdrop />
        )}
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Mover de colección: sin esto, una asignatura creada después de la
              colección se quedaba fuera para siempre. */}
          <button
            className="rounded-full bg-background/70 p-1.5 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
            title="Colección de esta asignatura"
            onClick={(e) => {
              e.stopPropagation();
              setCollectionOpen(true);
            }}
          >
            <Layers className="h-4 w-4" />
          </button>
          <button
            className="rounded-full bg-background/70 p-1.5 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
            title={image ? 'Cambiar imagen' : 'Elegir imagen'}
            onClick={(e) => {
              e.stopPropagation();
              setPickerAspect(aspectOf(imageBoxRef.current));
              setPickerOpen(true);
            }}
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>
        {isCollectionOpen && (
          <div onClick={(e) => e.stopPropagation()}>
            <CourseCollectionDialog
              course={course}
              open={isCollectionOpen}
              onOpenChange={setCollectionOpen}
            />
          </div>
        )}
        {/* Galería nativa + subida propia (se monta solo al abrirse) */}
        {isPickerOpen && (
          <ImagePickerDialog
            open={isPickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={handleSelectImage}
            aspect={pickerAspect}
            title={`Imagen de ${course.name}`}
          />
        )}
      </div>

      {/* Fina línea divisoria + nombre centrado en el azul primario */}
      <div className="border-t border-border/60 px-4 py-2.5">
        <h3 className="truncate text-center text-base font-bold text-primary">{course.name}</h3>
        {course.teacherName && (
          <p className="truncate text-center text-[11px] text-muted-foreground">{course.teacherName}</p>
        )}
      </div>

      {/* Divisoria fina que NO llega de extremo a extremo */}
      <div className="mx-8 h-px bg-border/60" />

      {/* Tareas pendientes · notas · tarea más próxima con su relevancia */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          {pendingTasks.length} {pendingTasks.length === 1 ? 'tarea' : 'tareas'}
        </span>
        <span className="flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5 text-primary" />
          {noteCount} {noteCount === 1 ? 'nota' : 'notas'}
        </span>
        {nextTask && (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            {new Date(nextTask.dueDate!).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
            <span className={cn('font-semibold', PRIORITY_COLOR[nextTask.priority])}>
              · {nextTask.priority}
            </span>
          </span>
        )}
      </div>
    </Card>
  );
}

// Tarjeta de COLECCIÓN: mismo estilo que la de asignatura (imagen u olas,
// nombre centrado) pero mostrando nº de asignaturas y tareas pendientes.
function SpaceCard({
  space,
  courseCount,
  pendingCount,
  onOpen,
}: {
  space: Space;
  courseCount: number;
  pendingCount: number;
  onOpen: () => void;
}) {
  const [image, setImage] = useStoredImage(`spaceImage_${space.id}`);
  const [isPickerOpen, setPickerOpen] = useState(false);
  // El encuadre usa la proporción real del hueco de la imagen en esta tarjeta.
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const imageStyle = useCardImageStyle();
  useReportReferenceWidth(imageBoxRef);
  const [pickerAspect, setPickerAspect] = useState<number>();


  const handleSelectImage = async (dataUrl: string) => {
    await saveImage(`spaceImage_${space.id}`, dataUrl);
    setImage(dataUrl);
  };

  return (
    <Card
      data-tour="coleccion-tarjeta"
      className="group cursor-pointer overflow-hidden transition-all hover:border-primary/60 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
      onClick={onOpen}
    >
      <div ref={imageBoxRef} className="relative bg-transparent" style={imageStyle}>
        {image ? (
          <img src={image} alt={space.name} className="h-full w-full object-cover" />
        ) : (
          <WaveBackdrop />
        )}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-primary backdrop-blur">
          <Layers className="h-3 w-3" /> Colección
        </span>
        <button
          className="absolute right-2 top-2 rounded-full bg-background/70 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-primary group-hover:opacity-100"
          title={image ? 'Cambiar imagen' : 'Elegir imagen'}
          onClick={(e) => {
            e.stopPropagation();
            setPickerAspect(aspectOf(imageBoxRef.current));
            setPickerOpen(true);
          }}
        >
          <Camera className="h-4 w-4" />
        </button>
        {isPickerOpen && (
          <ImagePickerDialog
            open={isPickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={handleSelectImage}
            aspect={pickerAspect}
            title={`Imagen de ${space.name}`}
          />
        )}
      </div>

      <div className="border-t border-border/60 px-4 py-2.5">
        <h3 className="truncate text-center text-base font-bold text-primary">{space.name}</h3>
      </div>

      <div className="mx-8 h-px bg-border/60" />

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5 text-primary" />
          {courseCount} {courseCount === 1 ? 'asignatura' : 'asignaturas'}
        </span>
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          {pendingCount} {pendingCount === 1 ? 'tarea pendiente' : 'tareas pendientes'}
        </span>
      </div>
    </Card>
  );
}

// Rejilla de asignaturas estilo Google Classroom: al nivel superior conviven
// las COLECCIONES (tarjetas que agrupan 2+ asignaturas) y las asignaturas
// independientes; al abrir una colección se ven sus asignaturas.
export default function CoursesGrid() {
  const { courses, spaces, getTasksForCourse, getNotesForCourse, updateSpace } = useCourse();
  const router = useRouter();
  // La colección abierta vive en la URL (?space=<id>) además de en el estado:
  // así el botón de retroceso de una asignatura puede devolver AQUÍ dentro y
  // no a la raíz de Asignaturas.
  const searchParams = useSearchParams();
  const [openSpaceId, setOpenSpaceId] = useState<string | null>(
    () => searchParams.get('space')
  );
  // Renombrado en el sitio del nombre de la colección abierta.
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const allCourseIdsInSpaces = useMemo(
    () => new Set(spaces.flatMap((s) => s.courseIds)),
    [spaces]
  );
  const unassigned = useMemo(
    () => courses.filter((c) => !allCourseIdsInSpaces.has(c.id)),
    [courses, allCourseIdsInSpaces]
  );

  const openSpace = useMemo(
    () => spaces.find((s) => s.id === openSpaceId) ?? null,
    [spaces, openSpaceId]
  );
  const openSpaceCourses = useMemo(
    () =>
      (openSpace?.courseIds ?? [])
        .map((id) => courses.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => !!c),
    [openSpace, courses]
  );

  const pendingCountFor = (courseIds: string[]) =>
    courseIds.reduce(
      (acc, id) => acc + getTasksForCourse(id).filter((t) => t.progress < 100).length,
      0
    );

  const renderCourseCard = (course: (typeof courses)[number]) => (
    <CourseCard
      key={course.id}
      course={course}
      pendingTasks={getTasksForCourse(course.id).filter((t) => t.progress < 100)}
      noteCount={getNotesForCourse(course.id).length}
      onOpen={() =>
        router.push(
          openSpaceId
            ? `/cursos/?id=${course.id}&from=${openSpaceId}`
            : `/cursos/?id=${course.id}`
        )
      }
    />
  );

  // --- Vista interna de una colección ---
  if (openSpace) {
    const commitRename = () => {
      const next = renameValue.trim();
      if (next && next !== openSpace.name) updateSpace(openSpace.id, { name: next });
      setRenaming(false);
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full border border-border/60"
            onClick={() => {
              setOpenSpaceId(null);
              router.replace('/knowledge', { scroll: false });
            }}
            title="Volver a Asignaturas"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Layers className="h-5 w-5 shrink-0 text-primary" />

          {/* El nombre se edita en el sitio: pulsar el lápiz lo convierte en
              campo, Enter guarda y Escape descarta. */}
          {renaming ? (
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              autoFocus
              className="h-8 max-w-xs border-primary text-lg font-bold text-primary"
            />
          ) : (
            <h2 className="truncate text-lg font-bold text-primary">{openSpace.name}</h2>
          )}

          <span className="shrink-0 text-xs text-muted-foreground">
            {openSpaceCourses.length} asignaturas
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {renaming ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-green-500 hover:text-green-600"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={commitRename}
                  title="Guardar el nombre"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setRenaming(false)}
                  title="Descartar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => {
                  setRenameValue(openSpace.name);
                  setRenaming(true);
                }}
                title="Cambiar el nombre de la colección"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {openSpaceCourses.map(renderCourseCard)}
        </div>
        <CourseSpaceDialog />
      </div>
    );
  }

  // --- Vista principal: colecciones + asignaturas independientes ---
  const isEmpty = spaces.length === 0 && unassigned.length === 0;

  return (
    <div className="space-y-6">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground">No hay asignaturas todavía</h3>
          <p className="text-xs text-muted-foreground">
            Usa el botón "Añadir" para crear tu primera asignatura o colección.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {spaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              courseCount={space.courseIds.filter((id) => courses.some((c) => c.id === id)).length}
              pendingCount={pendingCountFor(space.courseIds)}
              onOpen={() => {
              setOpenSpaceId(space.id);
              router.replace(`/knowledge?space=${space.id}`, { scroll: false });
            }}
            />
          ))}
          {unassigned.map(renderCourseCard)}
        </div>
      )}

      <CourseSpaceDialog />
    </div>
  );
}
