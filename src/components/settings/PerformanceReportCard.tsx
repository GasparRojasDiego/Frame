import { useMemo, useState } from 'react';
import { addDays, addMonths, addWeeks, addYears, format } from 'date-fns';
import { ChevronLeft, ChevronRight, FileText, LoaderCircle, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCourse } from '@/context/CourseContext';
import { useReportExport } from '@/hooks/use-report-export';
import type { ReportFormat } from '@/lib/report-export';
import type { UserProfile } from '@/types';
import {
  buildPerformanceDoc,
  buildReport,
  hm,
  rangeLabel,
  reportRange,
  SCOPE_LABEL,
  type ReportScope,
} from '@/lib/performance-report';

// ============================================================
// Generador del informe de rendimiento (Perfil).
//
// Existe por una razón concreta: la auxiliar académica pide un registro del
// estudio y de las tareas. Este recuadro lo convierte en un documento formal
// listo para entregar, sin copiar nada a mano.
//
// El documento se arma como `DocModel` y sale en los tres formatos por el
// mismo maquetador que los demás informes (src/lib/report-doc.ts): por eso el
// PDF y el Word son el mismo documento, no dos parecidos.
// ============================================================

const SCOPE_STEP: Record<ReportScope, (d: Date, n: number) => Date> = {
  dia: addDays,
  semana: addWeeks,
  mes: addMonths,
  anio: addYears,
};

const FORMATS: { format: ReportFormat; label: string; icon: typeof FileText; title: string }[] = [
  { format: 'pdf', label: 'PDF', icon: Printer, title: 'Imprimir o guardar como PDF' },
  { format: 'docx', label: 'Word', icon: FileText, title: 'Documento de Word, editable' },
];

export default function PerformanceReportCard({ userProfile }: { userProfile: UserProfile | null }) {
  const {
    studySessions,
    tasks,
    archivedTasks,
    courses,
    spaces,
    dailyPerformances,
    studyGoals,
  } = useCourse();
  const { run, busy } = useReportExport();

  const [scope, setScope] = useState<ReportScope>('mes');
  /** Cuántos periodos hacia atrás respecto del actual (0 = el de ahora). */
  const [offset, setOffset] = useState(0);

  const reference = useMemo(() => SCOPE_STEP[scope](new Date(), -offset), [scope, offset]);

  const report = useMemo(
    () =>
      buildReport({
        scope,
        reference,
        studentName: userProfile?.username || 'Estudiante',
        sessions: studySessions ?? [],
        tasks: tasks ?? [],
        archivedTasks: archivedTasks ?? [],
        courses: courses ?? [],
        spaces: spaces ?? [],
        performances: dailyPerformances ?? [],
        studyGoals,
      }),
    [scope, reference, userProfile, studySessions, tasks, archivedTasks, courses, spaces, dailyPerformances, studyGoals]
  );

  const { start, end } = reportRange(scope, reference);
  const label = rangeLabel(scope, start, end);
  const isEmpty = report.sessionCount === 0 && report.tasksDone === 0;

  /** Nombre de archivo sin acentos ni espacios: viaja mejor por correo. */
  const fileBase = useMemo(() => {
    const stamp =
      scope === 'anio'
        ? format(start, 'yyyy')
        : scope === 'mes'
          ? format(start, 'yyyy-MM')
          : scope === 'dia'
            ? format(start, 'yyyy-MM-dd')
            : format(start, "RRRR-'S'II");
    return `Frame-Rendimiento-${scope}-${stamp}`;
  }, [scope, start]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-center text-lg font-bold text-primary">
          Informe de rendimiento
        </CardTitle>
        <p className="text-center text-[11px] text-muted-foreground">
          Un documento formal con tu estudio y tus tareas, listo para entregar.
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-2">
        <Tabs value={scope} onValueChange={(v) => { setScope(v as ReportScope); setOffset(0); }}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dia" className="px-1 text-[11px]">Diario</TabsTrigger>
            <TabsTrigger value="semana" className="px-1 text-[11px]">Semanal</TabsTrigger>
            <TabsTrigger value="mes" className="px-1 text-[11px]">Mensual</TabsTrigger>
            <TabsTrigger value="anio" className="px-1 text-[11px]">Anual</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Navegación entre periodos: nunca hacia el futuro. */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setOffset((p) => p + 1)}
            title="Periodo anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-foreground first-letter:uppercase">
            {label}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setOffset((p) => Math.max(0, p - 1))}
            disabled={offset === 0}
            title="Periodo siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Adelanto de lo que llevará el documento. */}
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Estudio</p>
            <p className="text-sm font-bold tabular-nums text-primary">{hm(report.totalMinutes)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Tareas</p>
            <p className="text-sm font-bold tabular-nums text-foreground">{report.tasksDone}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Sesiones</p>
            <p className="text-sm font-bold tabular-nums text-foreground">{report.sessionCount}</p>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Incluye panorama con lectura escrita, {scope === 'dia' ? 'reparto por franja horaria' : 'ritmo día a día frente a tu meta'},
          composición del tiempo por asignatura y colección, embudo de entregas, calificación media y
          el detalle de cada sesión.
        </p>

        <div className="mt-auto space-y-2">
          {isEmpty && (
            <p className="rounded-md border border-dashed px-3 py-2 text-center text-[10px] text-muted-foreground">
              {scope === 'dia' ? 'Este día' : 'Este periodo'} no tiene sesiones ni tareas
              culminadas: el informe saldrá vacío.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map(({ format: fmt, label: name, icon: Icon, title }) => (
              <Button
                key={fmt}
                data-tour={`informe-${fmt}`}
                variant={fmt === 'docx' ? 'default' : 'outline'}
                disabled={busy !== null}
                onClick={() => void run(() => buildPerformanceDoc(report), fileBase, fmt)}
                title={`${title} · ${SCOPE_LABEL[scope]}`}
              >
                {busy === fmt ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="mr-2 h-4 w-4" />
                )}
                {name}
              </Button>
            ))}
          </div>
          <p className="text-center text-[10px] text-muted-foreground/80">
            En PDF, elige <strong className="text-foreground">Guardar como PDF</strong> en el
            diálogo de impresión. Word y MD se guardan en Descargas y el aviso los abre.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
