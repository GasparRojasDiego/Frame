import { useState } from 'react';
import { LoaderCircle, GraduationCap, Plus, Table2 } from 'lucide-react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useCourse } from '@/context/CourseContext';
import { Button } from '@/components/ui/button';
import CoursesGrid from '@/components/courses/CoursesGrid';
import ScheduleImportDialog from '@/components/courses/ScheduleImportDialog';

// Interfaz "Asignaturas": las tarjetas de cursos y colecciones estilo aula.
// (Las pestañas Estudio y Classroom se retiraron en la Fase 16.)
export default function KnowledgePage() {
  const { ready } = useKnowledge();
  const { setCreateCourseOpen } = useCourse();
  const [isScheduleOpen, setScheduleOpen] = useState(false);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          {/* El horario del colegio cambia cada mes y llega como imagen: este
              botón es la puerta para convertirlo en clases dentro de Frame. */}
          <Button
            size="sm"
            variant="outline"
            className="border-primary bg-primary/10 text-xs text-primary hover:bg-primary/20 hover:text-primary"
            onClick={() => setScheduleOpen(true)}
            title="Importar el horario del mes a partir de la imagen que reparte el colegio" data-tour="asig-horario"
          >
            <Table2 className="mr-2 h-4 w-4" />
            Horario
          </Button>
          <Button size="sm" className="text-xs" onClick={() => setCreateCourseOpen(true)} data-tour="asig-anadir">
            <Plus className="mr-2 h-4 w-4" />
            Añadir
          </Button>
        </div>
      </div>

      <ScheduleImportDialog open={isScheduleOpen} onOpenChange={setScheduleOpen} />
      <CoursesGrid />
    </div>
  );
}
