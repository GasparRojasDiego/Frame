import { useMemo, useState } from 'react';
import { FileText, Layers, LoaderCircle, Printer, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCourse } from '@/context/CourseContext';
import { useReportExport } from '@/hooks/use-report-export';
import { cn } from '@/lib/utils';
import { readStudyVideos } from '@/lib/study-videos';
import {
  buildGeneralReport,
  generalReportFileBase,
  type GeneralMode,
} from '@/lib/general-report';
import type { ReportFormat } from '@/lib/report-export';
import type { UserProfile } from '@/types';

// ============================================================
// Informe general (tras la rueda de Ajustes).
//
// Es el documento que reúne los otros tres —rendimiento, hábitos y
// pendientes— y añade lo que ninguno puede dar por separado: el mismo
// indicador medido hoy, esta semana, este mes y el mes pasado.
//
// Dos modos porque hay dos lecturas legítimas y opuestas: el denso, para
// revisarlo con calma o entregarlo; la síntesis, para mirarlo en dos minutos
// o mandarlo por correo.
// ============================================================

const MODES: { value: GeneralMode; label: string; hint: string; icon: typeof Layers }[] = [
  {
    value: 'denso',
    label: 'Denso',
    hint: 'Todo: cada sesión, cada pendiente, cada hábito',
    icon: Layers,
  },
  {
    value: 'sintesis',
    label: 'Síntesis',
    hint: 'Cuadro de mando y figuras, sin tablas largas',
    icon: Sparkles,
  },
];

const FORMATS: { format: ReportFormat; label: string; icon: typeof FileText; title: string }[] = [
  { format: 'pdf', label: 'PDF', icon: Printer, title: 'Imprimir o guardar como PDF' },
  { format: 'docx', label: 'Word', icon: FileText, title: 'Documento de Word, editable' },
];

export default function GeneralReportCard({ userProfile }: { userProfile: UserProfile | null }) {
  const {
    studySessions,
    tasks,
    archivedTasks,
    courses,
    spaces,
    dailyPerformances,
    studyGoals,
    habits,
    notes,
    songs,
    playlists,
    recordings,
  } = useCourse();
  const { run, busy } = useReportExport();
  const [mode, setMode] = useState<GeneralMode>('denso');

  const buildDoc = useMemo(
    () => () =>
      buildGeneralReport({
        studentName: userProfile?.username || 'Estudiante',
        mode,
        sessions: studySessions ?? [],
        tasks: tasks ?? [],
        archivedTasks: archivedTasks ?? [],
        courses: courses ?? [],
        spaces: spaces ?? [],
        performances: dailyPerformances ?? [],
        studyGoals,
        habits: habits ?? [],
        notes: notes ?? [],
        songCount: songs?.length ?? 0,
        playlistCount: playlists?.length ?? 0,
        recordingCount: recordings?.length ?? 0,
        studyVideoCount: readStudyVideos(userProfile?.id ?? null).length,
      }),
    [
      mode,
      userProfile,
      studySessions,
      tasks,
      archivedTasks,
      courses,
      spaces,
      dailyPerformances,
      studyGoals,
      habits,
      notes,
      songs,
      playlists,
      recordings,
    ]
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="p-4 pb-2 text-center">
        <CardTitle className="text-lg font-bold text-primary">Informe general</CardTitle>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Rendimiento, hábitos y pendientes en un solo documento, con las métricas de hoy, la
          semana, el mes y el mes anterior.
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-2">
        <div className="grid grid-cols-2 gap-2">
          {MODES.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors',
                mode === value
                  ? 'border-primary bg-primary/10'
                  : 'border-border/70 hover:border-primary/40 hover:bg-accent/40'
              )}
            >
              <Icon className={cn('h-5 w-5', mode === value ? 'text-primary' : 'text-muted-foreground')} />
              <span
                className={cn(
                  'text-sm font-semibold',
                  mode === value ? 'text-primary' : 'text-foreground'
                )}
              >
                {label}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map(({ format, label, icon: Icon, title }) => (
            <Button
              key={format}
              data-tour={`informe-${format}`}
              variant={format === 'docx' ? 'default' : 'outline'}
              disabled={busy !== null}
              onClick={() => void run(buildDoc, generalReportFileBase(mode), format)}
              title={title}
            >
              {busy === format ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icon className="mr-2 h-4 w-4" />
              )}
              {label}
            </Button>
          ))}
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          El documento incluye cuadro de mando comparado, embudos de tareas y hábitos, mapa de
          constancia, reparto por asignatura y colección, y el inventario completo de lo que Frame
          guarda de ti.
        </p>
      </CardContent>
    </Card>
  );
}
