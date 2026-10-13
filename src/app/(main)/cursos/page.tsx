import { Suspense } from 'react';
import { useSearchParams } from '@/lib/navigation';
import CourseDetailsClient from './CourseDetailsClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { tr } from '@/lib/i18n';

function CourseContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('id');

  if (!courseId) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <h1 className="text-3xl font-bold text-primary font-headline">{tr('Mis asignaturas')}</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen />{' '}{tr('Selecciona una asignatura')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              {tr('Elige una asignatura en «Asignaturas» para ver su contenido y su progreso.')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CourseDetailsClient id={courseId} />;
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">{tr('Cargando la asignatura…')}</div>}>
      <CourseContent />
    </Suspense>
  );
}