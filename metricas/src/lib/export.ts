import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { renderDocHtml, renderDocMarkdown, renderDocxBlobPacked, type DocModel } from '@/lib/report-doc';

// ============================================================
// El «Reporte» desde el navegador: Word y Markdown se descargan; el PDF sale
// del diálogo de impresión («Guardar como PDF»), como en la app. Sin
// telemetría: esta página no registra nada.
// ============================================================

export type ReportFormat = 'pdf' | 'docx' | 'md';

function download(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/** Imprime solo el reporte, en un iframe oculto. */
function print(doc: DocModel) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const inner = frame.contentDocument;
  if (!inner) {
    frame.remove();
    throw new Error('No se pudo preparar el documento para imprimir.');
  }
  inner.open();
  inner.write(renderDocHtml(doc));
  inner.close();
  // Un latido para que maquete; se retira tarde: antes, el diálogo se quedaba sin documento.
  setTimeout(() => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      setTimeout(() => frame.remove(), 60_000);
    }
  }, 250);
}

export function useExport() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<ReportFormat | null>(null);

  const run = useCallback(
    async (build: () => DocModel, fileBase: string, format: ReportFormat) => {
      setBusy(format);
      try {
        const doc = build();
        if (format === 'pdf') {
          print(doc);
          toast({ title: 'Reporte listo para imprimir', description: 'Elige «Guardar como PDF» en el diálogo de impresión.' });
          return;
        }
        const blob =
          format === 'md' ? new Blob([renderDocMarkdown(doc)], { type: 'text/markdown;charset=utf-8' }) : await renderDocxBlobPacked(doc);
        download(blob, `${fileBase}.${format}`);
        toast({ title: 'Reporte descargado', description: `${fileBase}.${format}` });
      } catch (error) {
        toast({ variant: 'destructive', title: 'No se pudo generar el reporte', description: String((error as Error)?.message ?? error) });
      } finally {
        setBusy(null);
      }
    },
    [toast]
  );

  return { run, busy };
}
