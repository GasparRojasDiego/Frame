import { useMemo, useState } from 'react';
import { FileText, LoaderCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCourse } from '@/context/CourseContext';
import { useReportExport } from '@/hooks/use-report-export';
import { cn } from '@/lib/utils';
import { buildPendingReport, pendingReportFileBase } from '@/lib/pending-report';
import {
  buildHabitsDoc,
  buildHabitsReport,
  habitRange,
  habitsReportFileBase,
  type HabitScope,
} from '@/lib/habits-report';
import type { ReportFormat } from '@/lib/report-export';

// ============================================================
// Informes de tareas pendientes y de hábitos, en el centro de informes de
// Ajustes. Antes cada uno tenía su botón en su pantalla (Tareas y Hábitos):
// había que saber dónde estaba cada cual. Ahora todos los informes viven juntos
// y con la misma forma: qué es, sus opciones y los tres formatos.
// ============================================================

const FORMATS: { format: ReportFormat; label: string; icon: typeof FileText; title: string }[] = [
  { format: 'pdf', label: 'PDF', icon: Printer, title: 'Imprimir o guardar como PDF' },
  { format: 'docx', label: 'Word', icon: FileText, title: 'Documento de Word, editable' },
];

function FormatButtons({
  busy,
  disabled,
  onPick,
}: {
  busy: ReportFormat | null;
  disabled?: boolean;
  onPick: (format: ReportFormat) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {FORMATS.map(({ format, label, icon: Icon, title }) => (
        <Button
          key={format}
          data-tour={`informe-${format}`}
          variant={format === 'docx' ? 'default' : 'outline'}
          disabled={disabled || busy !== null}
          onClick={() => onPick(format)}
          title={title}
        >
          {busy === format ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
          {label}
        </Button>
      ))}
    </div>
  );
}

export function PendingReportCard() {
  const { tasks, courses, spaces, userProfile } = useCourse();
  const { run, busy } = useReportExport();
  const pendingCount = tasks?.length ?? 0;

  const buildDoc = useMemo(
    () => () =>
      buildPendingReport({
        studentName: userProfile?.username || 'Estudiante',
        tasks: tasks ?? [],
        courses: courses ?? [],
        spaces: spaces ?? [],
      }),
    [tasks, courses, spaces, userProfile]
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="p-4 pb-2 text-center">
        <CardTitle className="text-lg font-bold text-primary">Informe de tareas pendientes</CardTitle>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Todo lo que tienes por entregar, ordenado por urgencia y por asignatura, con su carga estimada.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end gap-3 p-4 pt-2">
        <p className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-center text-xs text-muted-foreground">
          {pendingCount === 0
            ? 'No tienes tareas pendientes ahora mismo.'
            : `${pendingCount} ${pendingCount === 1 ? 'tarea pendiente entrará' : 'tareas pendientes entrarán'} en el informe.`}
        </p>
        <FormatButtons
          busy={busy}
          disabled={pendingCount === 0}
          onPick={(format) => void run(buildDoc, pendingReportFileBase(), format)}
        />
      </CardContent>
    </Card>
  );
}

const SCOPES: { value: HabitScope; label: string }[] = [
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'anio', label: 'Año' },
];

export function HabitsReportCard() {
  const { habits, userProfile } = useCourse();
  const { run, busy } = useReportExport();
  // El trimestre es el que mejor enseña si un hábito se sostuvo; el mes es el
  // punto de partida más habitual.
  const [scope, setScope] = useState<HabitScope>('mes');
  const activeHabits = (habits ?? []).filter((habit) => !habit.isArchived).length;

  const buildDoc = useMemo(
    () => () =>
      buildHabitsDoc(
        buildHabitsReport({
          scope,
          reference: new Date(),
          studentName: userProfile?.username || 'Estudiante',
          habits: habits ?? [],
        })
      ),
    [scope, habits, userProfile]
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="p-4 pb-2 text-center">
        <CardTitle className="text-lg font-bold text-primary">Informe de hábitos</CardTitle>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Constancia de cada hábito en el periodo que elijas: rachas, días cumplidos y evolución.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end gap-3 p-4 pt-2">
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Periodo del informe">
          {SCOPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                'h-8 rounded-md border text-xs font-semibold transition-colors',
                scope === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <FormatButtons
          busy={busy}
          disabled={activeHabits === 0}
          onPick={(format) => {
            const { start } = habitRange(scope, new Date());
            void run(buildDoc, habitsReportFileBase(scope, start), format);
          }}
        />
        {activeHabits === 0 && (
          <p className="text-center text-[10px] text-muted-foreground">Crea al menos un hábito para generar este informe.</p>
        )}
      </CardContent>
    </Card>
  );
}
