import { tr } from '@/lib/i18n';

// Guardar un archivo (1.7.0): aparte del motor de informes. «Guardar una
// copia» de un adjunto lo usa desde Inicio, y al importarlo de report-export
// arrastraba report-doc (~30 KB) al paquete de arranque.

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

/** Nombre de la carpeta donde quedó el archivo. No siempre es Descargas: si
 *  el equipo no la tiene, el núcleo nativo cae a Documentos. */
export function folderOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  const folder = parts.length >= 2 ? parts[parts.length - 2] : '';
  if (/^downloads$/i.test(folder)) return tr('Descargas');
  if (/^documents$/i.test(folder)) return tr('Documentos');
  return folder || tr('tu equipo');
}
