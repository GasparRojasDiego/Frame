import { tr } from '@/lib/i18n';

// ============================================================
// Portadas a su tamaño útil.
//
// Las carátulas de las canciones suelen medir 600 px o más y se guardaban tal
// cual, como texto base64 DENTRO de la ficha de cada canción: entre 80 y 160 KB
// por canción. Como la biblioteca entera se carga en memoria al arrancar y se
// reparte por el contexto, 900 canciones eran ~100 MB de cadenas para pintar
// miniaturas de 64 px. Eso es arranque lento, scroll pesado y memoria de más
// en los portátiles de los estudiantes.
//
// Aquí se reducen a 360 px en JPEG (unos 15-25 KB): sobra para la lista y para
// el reproductor, y la biblioteca pesa la sexta parte.
// ============================================================

const MAX_SIDE = 360;
const QUALITY = 0.82;
/** Por debajo de esto ya es pequeña: no merece la pena tocarla. */
export const COVER_HEAVY_CHARS = 90_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(tr('imagen ilegible')));
    img.src = src;
  });
}

/**
 * Devuelve la portada reducida, o la ORIGINAL si no es una imagen incrustada,
 * si ya es pequeña, si algo falla o si el resultado no sale más ligero. Nunca
 * lanza y nunca empeora lo que había.
 */
export async function shrinkCover(dataUrl: string): Promise<string> {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < COVER_HEAVY_CHARS) return dataUrl;
    const img = await loadImage(dataUrl);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (!longest) return dataUrl;
    const scale = Math.min(1, MAX_SIDE / longest);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    // Fondo oscuro por si la imagen trae transparencia (JPEG no la admite).
    ctx.fillStyle = '#111114';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const out = canvas.toDataURL('image/jpeg', QUALITY);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

/** Cede el hilo: la reducción de una biblioteca entera no debe notarse. */
export const idle = (): Promise<void> =>
  new Promise((resolve) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback;
    if (ric) ric(() => resolve(), { timeout: 1200 });
    else setTimeout(resolve, 60);
  });
