import { useCallback, useState } from 'react';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import type { DocModel } from '@/lib/report-doc';
import { exportReport, openReportFile, type ReportFormat } from '@/lib/report-export';
import { trackEvent } from '@/lib/telemetry';

// ============================================================
// Generar un informe y avisar de que está listo.
//
// El aviso no es decorativo: lleva el botón «Abrir», que abre el archivo
// recién escrito con el programa asociado. Antes había que ir al explorador,
// encontrar la carpeta de descargas y buscarlo a mano, que es justo el trabajo
// que la aplicación existe para ahorrar.
//
// El documento se arma de forma perezosa (`build()`) porque construirlo cuesta
// —recorre sesiones, tareas y hábitos— y no tiene sentido hacerlo hasta que el
// usuario elige el formato.
// ============================================================

const FORMAT_NOTE: Record<ReportFormat, string> = {
  pdf: 'Elige «Guardar como PDF» en el diálogo de impresión.',
  docx: 'Documento de Word, editable.',
};

/** Nombre de la carpeta donde quedó el archivo. No siempre es Descargas: si
 *  el equipo no la tiene, el núcleo nativo cae a Documentos. */
function folderOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  const folder = parts.length >= 2 ? parts[parts.length - 2] : '';
  if (/^downloads$/i.test(folder)) return 'Descargas';
  if (/^documents$/i.test(folder)) return 'Documentos';
  return folder || 'tu equipo';
}

export function useReportExport() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<ReportFormat | null>(null);

  const run = useCallback(
    async (build: () => DocModel, fileBase: string, format: ReportFormat) => {
      setBusy(format);
      try {
        const result = await exportReport(build(), fileBase, format);
        trackEvent('report_generated', { format, report: fileBase.slice(0, 48) });

        if (result.viaPrintDialog) {
          toast({
            title: 'Informe listo para imprimir',
            description: FORMAT_NOTE.pdf,
          });
          return;
        }

        // El nombre real: si ya existía uno igual, el nuevo lleva «(2)», «(3)»…
        const savedName = result.path ? result.path.split(/[\\/]/).pop() || result.fileName : result.fileName;
        toast({
          title: 'Informe generado',
          description: result.path
            ? `${savedName} · guardado en ${folderOf(result.path)}`
            : `${result.fileName} — ${FORMAT_NOTE[format]}`,
          // Un aviso con botón necesita más tiempo que uno de solo lectura:
          // hay que verlo, entenderlo y llegar a pulsarlo.
          duration: result.path ? 12000 : undefined,
          action: result.path ? (
            <ToastAction
              altText="Abrir el informe"
              onClick={() => {
                void openReportFile(result.path as string).catch(() => {
                  toast({
                    variant: 'destructive',
                    title: 'No se pudo abrir el archivo',
                    description: result.path ?? '',
                  });
                });
              }}
            >
              Abrir
            </ToastAction>
          ) : undefined,
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'No se pudo generar el informe',
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setBusy(null);
      }
    },
    [toast]
  );

  return { run, busy };
}
