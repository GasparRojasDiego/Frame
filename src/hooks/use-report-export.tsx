import { useCallback, useState } from 'react';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import type { DocModel } from '@/lib/report-doc';
import { exportReport, folderOf, openReportFile, type ReportFormat } from '@/lib/report-export';
import { trackEvent } from '@/lib/telemetry';
import { errorText, tr } from '@/lib/i18n';

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
  get pdf() { return tr('Elige «Guardar como PDF» en el diálogo de impresión.'); },
  get docx() { return tr('Documento de Word, editable.'); },
};

export function useReportExport() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<ReportFormat | null>(null);

  const run = useCallback(
    async (build: () => DocModel, fileBase: string, format: ReportFormat, reportId = fileBase) => {
      setBusy(format);
      try {
        const result = await exportReport(build(), fileBase, format);
        trackEvent('report_generated', { format, report: reportId.slice(0, 48) });

        if (result.viaPrintDialog) {
          toast({
            title: tr('Informe listo para imprimir'),
            description: FORMAT_NOTE.pdf,
          });
          return;
        }

        // El nombre real: si ya existía uno igual, el nuevo lleva «(2)», «(3)»…
        const savedName = result.path ? result.path.split(/[\\/]/).pop() || result.fileName : result.fileName;
        toast({
          title: tr('Informe generado'),
          description: result.path
            ? tr('{savedName} · guardado en {folderOf}', { savedName, folderOf: folderOf(result.path) })
            : `${result.fileName} — ${FORMAT_NOTE[format]}`,
          // Un aviso con botón necesita más tiempo que uno de solo lectura:
          // hay que verlo, entenderlo y llegar a pulsarlo.
          duration: result.path ? 12000 : undefined,
          action: result.path ? (
            <ToastAction
              altText={tr('Abrir el informe')}
              onClick={() => {
                void openReportFile(result.path as string).catch(() => {
                  toast({
                    variant: 'destructive',
                    title: tr('No se pudo abrir el archivo'),
                    description: result.path ?? '',
                  });
                });
              }}
            >
              {tr('Abrir')}
            </ToastAction>
          ) : undefined,
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: tr('No se pudo generar el informe'),
          description: errorText(error),
        });
      } finally {
        setBusy(null);
      }
    },
    [toast]
  );

  return { run, busy };
}
