import { invoke, isTauri } from '@tauri-apps/api/core';
import { renderDocHtml, renderDocMarkdown, renderDocxBlobPacked, type DocModel } from '@/lib/report-doc';
import { tr } from '@/lib/i18n';

// ============================================================
// Salida de los informes: un solo camino para los cuatro.
//
// Los cuatro informes de Frame (rendimiento, pendientes, hábitos y general)
// se exportan por aquí. Antes cada botón repetía su propio iframe de
// impresión y su propio enlace de descarga, y bastaba tocar uno para que los
// demás se quedaran atrás.
//
// DOCX y MD se guardan EN DISCO con un comando nativo y se devuelve la ruta:
// así el aviso de "informe listo" puede abrir el archivo directamente, sin
// pasar por el explorador. Fuera de la app de escritorio se cae al enlace de
// descarga del navegador, que no da ruta ninguna.
//
// El PDF sale del diálogo de impresión ("Guardar como PDF"): es lo único que
// produce un PDF real sin arrastrar una librería de varios megas al
// instalador. Ahí no hay ruta que devolver, porque el archivo lo escribe
// Windows donde el usuario le diga.
// ============================================================

export type ReportFormat = 'pdf' | 'docx' | 'md';

interface ExportResult {
  fileName: string;
  /** Ruta en disco si se pudo guardar (solo escritorio y solo DOCX/MD). */
  path: string | null;
  /** El PDF depende del diálogo de impresión: no hay archivo que abrir. */
  viaPrintDialog: boolean;
}

/** Base64 sin pasar por FileReader: el informe cabe de sobra en memoria. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000; // trocear evita reventar la pila en apply()
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function browserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Imprime SOLO el informe, en un iframe oculto: ni la app entera ni una
 * ventana suelta que el usuario tenga que cerrar después.
 */
function printDoc(doc: DocModel): boolean {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const inner = frame.contentDocument;
  if (!inner) {
    frame.remove();
    return false;
  }

  inner.open();
  inner.write(renderDocHtml(doc));
  inner.close();

  // Un latido para que el iframe termine de maquetar antes de imprimir.
  setTimeout(() => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      // Retirada diferida: quitar el iframe demasiado pronto deja el diálogo
      // de impresión sin documento que imprimir.
      setTimeout(() => frame.remove(), 60_000);
    }
  }, 250);

  return true;
}

/** Guarda el informe y devuelve dónde quedó. */
export async function exportReport(
  doc: DocModel,
  fileBase: string,
  format: ReportFormat
): Promise<ExportResult> {
  if (format === 'pdf') {
    const ok = printDoc(doc);
    if (!ok) throw new Error(tr('No se pudo preparar el documento para imprimir.'));
    return { fileName: `${fileBase}.pdf`, path: null, viaPrintDialog: true };
  }

  const blob = format === 'md' ? new Blob([renderDocMarkdown(doc)], { type: 'text/markdown;charset=utf-8' }) : await renderDocxBlobPacked(doc);
  const fileName = `${fileBase}.${format}`;

  if (isTauri()) {
    try {
      const path = await invoke<string>('save_report_file', {
        fileName,
        dataBase64: await blobToBase64(blob),
      });
      return { fileName, path, viaPrintDialog: false };
    } catch {
      // Si el guardado nativo falla (permisos, carpeta bloqueada), la
      // descarga del navegador sigue funcionando: el informe no se pierde.
    }
  }

  browserDownload(blob, fileName);
  return { fileName, path: null, viaPrintDialog: false };
}

/** Nombre de la carpeta donde quedó el archivo. No siempre es Descargas: si
 *  el equipo no la tiene, el núcleo nativo cae a Documentos. */
export function folderOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  const folder = parts.length >= 2 ? parts[parts.length - 2] : '';
  if (/^downloads$/i.test(folder)) return tr('Descargas');
  if (/^documents$/i.test(folder)) return tr('Documentos');
  return folder || tr('tu equipo');
}

/** Abre el archivo con el programa que el sistema tenga asociado. */
export async function openReportFile(path: string): Promise<void> {
  await invoke('open_local_file', { path });
}
