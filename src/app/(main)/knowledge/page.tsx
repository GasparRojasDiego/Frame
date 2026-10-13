import { GraduationCap, Plus } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import { Button } from '@/components/ui/button';
import CoursesGrid from '@/components/courses/CoursesGrid';
import CardImageSettings from '@/components/courses/CardImageSettings';

// Interfaz "Asignaturas": las tarjetas de cursos y colecciones estilo aula.
// (Las pestañas Estudio y Classroom se retiraron en la Fase 16; el botón
// «Horario», que convertía el horario del mes en clases, en la 1.6.6.)
export default function KnowledgePage() {
  const { setCreateCourseOpen } = useCourse();

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Título y acción en la MISMA fila: el botón colgaba solo en una
          franja aparte y dejaba un renglón muerto entre ambos. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-primary font-headline">Mis asignaturas</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="text-xs" onClick={() => setCreateCourseOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Añadir
          </Button>
          {/* Engranaje: el tamaño de la imagen de todas las tarjetas. */}
          <CardImageSettings />
        </div>
      </div>

      <CoursesGrid />
    </div>
  );
}
