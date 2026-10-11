// ============================================================
// Galería de imágenes NATIVA de Frame: las imágenes de la carpeta
// `native_pictures/` de la raíz del proyecto se copian a `public/`
// (nombres saneados, aptos para URL) y se empaquetan con la app.
// Este manifiesto es la única fuente de verdad de qué hay en cada
// categoría — si se agregan imágenes, se registran aquí.
// ============================================================

export interface NativePicture {
  /** ruta pública del asset (funciona en dev, escritorio y móvil) */
  src: string;
  /** nombre legible que se muestra bajo la miniatura */
  label: string;
}

export interface NativePictureCategory {
  id: 'arquitectura' | 'paisajes' | 'otros';
  label: string;
  pictures: NativePicture[];
}

const base = '/native_pictures';

export const NATIVE_PICTURE_CATEGORIES: NativePictureCategory[] = [
  {
    id: 'arquitectura',
    label: 'Arquitectura',
    pictures: [
      { src: `${base}/arquitectura/civics-environments.webp`, label: 'Civics & Environments' },
      { src: `${base}/arquitectura/english-wallpaper.webp`, label: 'English' },
      { src: `${base}/arquitectura/history-wallpaper.webp`, label: 'History' },
      { src: `${base}/arquitectura/arquitectura-historica.webp`, label: 'Arquitectura histórica' },
      { src: `${base}/arquitectura/arquitectura-imperial.webp`, label: 'Arquitectura imperial' },
      { src: `${base}/arquitectura/arquitectura-mexico.webp`, label: 'Arquitectura México' },
      { src: `${base}/arquitectura/arquitectura-semiurbana.webp`, label: 'Arquitectura semiurbana' },
      { src: `${base}/arquitectura/castillo-japones.avif`, label: 'Castillo japonés' },
      { src: `${base}/arquitectura/central-park.webp`, label: 'Central Park' },
      { src: `${base}/arquitectura/edificio-historico.webp`, label: 'Edificio histórico' },
      { src: `${base}/arquitectura/jardin-japones.webp`, label: 'Jardín japonés' },
      { src: `${base}/arquitectura/san-salvador.webp`, label: 'San Salvador' },
    ],
  },
  {
    id: 'paisajes',
    label: 'Paisajes',
    pictures: [
      { src: `${base}/paisajes/cas-wallpaper.webp`, label: 'CAS' },
      { src: `${base}/paisajes/ess-wallpaper.webp`, label: 'ESS I' },
      { src: `${base}/paisajes/ess.webp`, label: 'ESS II' },
      { src: `${base}/paisajes/landscape.webp`, label: 'Landscape' },
      { src: `${base}/paisajes/snowy-landscape.webp`, label: 'Paisaje nevado' },
      { src: `${base}/paisajes/arte-japones.webp`, label: 'Arte japonés' },
      { src: `${base}/paisajes/campo-al-atardecer.webp`, label: 'Campo al atardecer' },
      { src: `${base}/paisajes/gran-ola-de-kanagawa.webp`, label: 'Gran ola de Kanagawa' },
      { src: `${base}/paisajes/paisaje-1.webp`, label: 'Paisaje I' },
      { src: `${base}/paisajes/paisaje-2.webp`, label: 'Paisaje II' },
    ],
  },
  {
    id: 'otros',
    label: 'Otros',
    pictures: [
      { src: `${base}/otros/fisica.webp`, label: 'Física' },
      { src: `${base}/otros/literature-hl.webp`, label: 'Literature HL' },
      { src: `${base}/otros/literature.webp`, label: 'Literature' },
      { src: `${base}/otros/max-verstappen-1.webp`, label: 'Max Verstappen I' },
      { src: `${base}/otros/max-verstappen-2.webp`, label: 'Max Verstappen II' },
      { src: `${base}/otros/physical-education.webp`, label: 'Physical Education' },
      { src: `${base}/otros/tok-wallpaper.webp`, label: 'TOK' },
    ],
  },
];

/** Convierte un asset nativo a data-URL: así la imagen elegida se guarda
 *  igual que una subida por el usuario (IndexedDB) y sobrevive a respaldos. */
export async function nativePictureToDataUrl(src: string): Promise<string> {
  const response = await fetch(src);
  // Sin esta comprobación, una ruta inexistente guardaba como "imagen" la
  // página de error del servidor.
  if (!response.ok) throw new Error('La imagen no está disponible.');
  const blob = await response.blob();
  if (blob.type && !blob.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
