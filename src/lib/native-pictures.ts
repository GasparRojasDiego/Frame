import { tr } from '@/lib/i18n';

// ============================================================
// Galería de imágenes NATIVA de Frame (89 imágenes desde la 1.6.4): WebP de
// hasta 1280 px en `public/native_pictures/<categoría>/`, empaquetadas con la
// app. Este manifiesto es la única fuente de verdad de qué hay en cada
// categoría — si se agregan imágenes, se registran aquí.
// ============================================================

export interface NativePicture {
  /** ruta pública del asset (funciona en dev, escritorio y móvil) */
  src: string;
  /** nombre legible que se muestra bajo la miniatura */
  label: string;
}

export interface NativePictureCategory {
  id: 'ciudades' | 'monumentos' | 'paisajes' | 'espacio' | 'otros';
  label: string;
  pictures: NativePicture[];
}

const base = '/native_pictures';

export const NATIVE_PICTURE_CATEGORIES: NativePictureCategory[] = [
  {
    id: 'ciudades',
    get label() { return tr('Ciudades'); },
    pictures: [
      { src: `${base}/ciudades/avenida-de-palmeras.webp`, get label() { return tr('Avenida de palmeras'); } },
      { src: `${base}/ciudades/bajo-manhattan.webp`, get label() { return tr('Bajo Manhattan'); } },
      { src: `${base}/ciudades/calle-46.webp`, get label() { return tr('Calle 46'); } },
      { src: `${base}/ciudades/casa-de-brooklyn.webp`, get label() { return tr('Casa de Brooklyn'); } },
      { src: `${base}/ciudades/central-park.webp`, get label() { return tr('Central Park'); } },
      { src: `${base}/ciudades/cielo-de-nueva-york.webp`, get label() { return tr('Cielo de Nueva York'); } },
      { src: `${base}/ciudades/costa-de-california.webp`, get label() { return tr('Costa de California'); } },
      { src: `${base}/ciudades/empire-state.webp`, get label() { return tr('Empire State'); } },
      { src: `${base}/ciudades/empire-state-de-noche.webp`, get label() { return tr('Empire State de noche'); } },
      { src: `${base}/ciudades/hudson-al-anochecer.webp`, get label() { return tr('Hudson al anochecer'); } },
      { src: `${base}/ciudades/londres.webp`, get label() { return tr('Londres'); } },
      { src: `${base}/ciudades/manhattan-al-atardecer.webp`, get label() { return tr('Manhattan al atardecer'); } },
      { src: `${base}/ciudades/manhattan-de-noche.webp`, get label() { return tr('Manhattan de noche'); } },
      { src: `${base}/ciudades/manhattan-desde-el-aire.webp`, get label() { return tr('Manhattan desde el aire'); } },
      { src: `${base}/ciudades/manhattan-violeta.webp`, get label() { return tr('Manhattan violeta'); } },
      { src: `${base}/ciudades/navidad-en-nueva-york.webp`, get label() { return tr('Navidad en Nueva York'); } },
      { src: `${base}/ciudades/new-york.webp`, get label() { return tr('New York'); } },
      { src: `${base}/ciudades/nueva-york-de-noche.webp`, get label() { return tr('Nueva York de noche'); } },
      { src: `${base}/ciudades/ocaso-en-manhattan.webp`, get label() { return tr('Ocaso en Manhattan'); } },
      { src: `${base}/ciudades/otono-en-manhattan.webp`, get label() { return tr('Otoño en Manhattan'); } },
      { src: `${base}/ciudades/paris.webp`, get label() { return tr('París'); } },
      { src: `${base}/ciudades/paris-desde-el-balcon.webp`, get label() { return tr('París desde el balcón'); } },
      { src: `${base}/ciudades/paseo-del-puente.webp`, get label() { return tr('Paseo del puente'); } },
      { src: `${base}/ciudades/puente-al-ocaso.webp`, get label() { return tr('Puente al ocaso'); } },
      { src: `${base}/ciudades/puente-de-brooklyn.webp`, get label() { return tr('Puente de Brooklyn'); } },
      { src: `${base}/ciudades/skyline-de-nueva-york.webp`, get label() { return tr('Skyline de Nueva York'); } },
      { src: `${base}/ciudades/sobre-la-ciudad.webp`, get label() { return tr('Sobre la ciudad'); } },
      { src: `${base}/ciudades/toronto.webp`, label: 'Toronto' },
      { src: `${base}/ciudades/ventana-a-nueva-york.webp`, get label() { return tr('Ventana a Nueva York'); } },
      { src: `${base}/ciudades/vista-al-empire-state.webp`, get label() { return tr('Vista al Empire State'); } },
      { src: `${base}/ciudades/atico.webp`, get label() { return tr('Ático'); } },
    ],
  },
  {
    id: 'monumentos',
    get label() { return tr('Monumentos'); },
    pictures: [
      { src: `${base}/monumentos/claustro-en-otono.webp`, get label() { return tr('Claustro en otoño'); } },
      { src: `${base}/monumentos/coliseo-de-noche.webp`, get label() { return tr('Coliseo de noche'); } },
      { src: `${base}/monumentos/coliseo-en-flor.webp`, get label() { return tr('Coliseo en flor'); } },
      { src: `${base}/monumentos/cristo-redentor.webp`, get label() { return tr('Cristo Redentor'); } },
      { src: `${base}/monumentos/cupula.webp`, get label() { return tr('Cúpula'); } },
      { src: `${base}/monumentos/eiffel-sobre-el-sena.webp`, get label() { return tr('Eiffel sobre el Sena'); } },
      { src: `${base}/monumentos/estatua-de-la-libertad.webp`, get label() { return tr('Estatua de la Libertad'); } },
      { src: `${base}/monumentos/fontana-di-trevi.webp`, get label() { return tr('Fontana di Trevi'); } },
      { src: `${base}/monumentos/isla-de-la-libertad.webp`, get label() { return tr('Isla de la Libertad'); } },
      { src: `${base}/monumentos/libertad-y-puente.webp`, get label() { return tr('Libertad y puente'); } },
      { src: `${base}/monumentos/machu-picchu.webp`, get label() { return tr('Machu Picchu'); } },
      { src: `${base}/monumentos/ponte-sant-angelo.webp`, get label() { return tr('Ponte Sant\'Angelo'); } },
      { src: `${base}/monumentos/san-pedro-al-anochecer.webp`, get label() { return tr('San Pedro al anochecer'); } },
      { src: `${base}/monumentos/techos-de-roma.webp`, get label() { return tr('Techos de Roma'); } },
      { src: `${base}/monumentos/torre-eiffel.webp`, get label() { return tr('Torre Eiffel'); } },
    ],
  },
  {
    id: 'paisajes',
    get label() { return tr('Paisajes'); },
    pictures: [
      { src: `${base}/paisajes/acantilado.webp`, get label() { return tr('Acantilado'); } },
      { src: `${base}/paisajes/arco-de-cabo.webp`, get label() { return tr('Arco de Cabo'); } },
      { src: `${base}/paisajes/bosque-de-otono.webp`, get label() { return tr('Bosque de otoño'); } },
      { src: `${base}/paisajes/bosque-en-niebla.webp`, get label() { return tr('Bosque en niebla'); } },
      { src: `${base}/paisajes/colinas-al-atardecer.webp`, get label() { return tr('Colinas al atardecer'); } },
      { src: `${base}/paisajes/colinas-de-palmeras.webp`, get label() { return tr('Colinas de palmeras'); } },
      { src: `${base}/paisajes/cordillera.webp`, get label() { return tr('Cordillera'); } },
      { src: `${base}/paisajes/costa-en-flor.webp`, get label() { return tr('Costa en flor'); } },
      { src: `${base}/paisajes/cueva-marina.webp`, get label() { return tr('Cueva marina'); } },
      { src: `${base}/paisajes/flores-de-montana.webp`, get label() { return tr('Flores de montaña'); } },
      { src: `${base}/paisajes/himalaya.webp`, label: 'Himalaya' },
      { src: `${base}/paisajes/lago-de-como.webp`, get label() { return tr('Lago de Como'); } },
      { src: `${base}/paisajes/lago-violeta.webp`, get label() { return tr('Lago violeta'); } },
      { src: `${base}/paisajes/mar-al-atardecer.webp`, get label() { return tr('Mar al atardecer'); } },
      { src: `${base}/paisajes/montanas-reflejadas.webp`, get label() { return tr('Montañas reflejadas'); } },
      { src: `${base}/paisajes/montanas-rosadas.webp`, get label() { return tr('Montañas rosadas'); } },
      { src: `${base}/paisajes/muelle-en-el-lago.webp`, get label() { return tr('Muelle en el lago'); } },
      { src: `${base}/paisajes/pico-dorado.webp`, get label() { return tr('Pico dorado'); } },
      { src: `${base}/paisajes/prado-al-atardecer.webp`, get label() { return tr('Prado al atardecer'); } },
      { src: `${base}/paisajes/santorini.webp`, label: 'Santorini' },
      { src: `${base}/paisajes/terraza-mediterranea.webp`, get label() { return tr('Terraza mediterránea'); } },
      { src: `${base}/paisajes/valle-al-amanecer.webp`, get label() { return tr('Valle al amanecer'); } },
      { src: `${base}/paisajes/valle-florido.webp`, get label() { return tr('Valle florido'); } },
    ],
  },
  {
    id: 'espacio',
    get label() { return tr('Espacio'); },
    pictures: [
      { src: `${base}/espacio/agujero-negro.webp`, get label() { return tr('Agujero negro'); } },
      { src: `${base}/espacio/amanecer-orbital.webp`, get label() { return tr('Amanecer orbital'); } },
      { src: `${base}/espacio/anillos.webp`, get label() { return tr('Anillos'); } },
      { src: `${base}/espacio/cumbre-estrellada.webp`, get label() { return tr('Cumbre estrellada'); } },
      { src: `${base}/espacio/despegue.webp`, get label() { return tr('Despegue'); } },
      { src: `${base}/espacio/disco-de-acrecion.webp`, get label() { return tr('Disco de acreción'); } },
      { src: `${base}/espacio/galaxia.webp`, get label() { return tr('Galaxia'); } },
      { src: `${base}/espacio/gargantua.webp`, get label() { return tr('Gargantúa'); } },
      { src: `${base}/espacio/horizonte-de-sucesos.webp`, get label() { return tr('Horizonte de sucesos'); } },
      { src: `${base}/espacio/la-tierra-de-noche.webp`, get label() { return tr('La Tierra de noche'); } },
      { src: `${base}/espacio/lago-bajo-las-estrellas.webp`, get label() { return tr('Lago bajo las estrellas'); } },
      { src: `${base}/espacio/mundo-lejano.webp`, get label() { return tr('Mundo lejano'); } },
      { src: `${base}/espacio/nebulosa.webp`, get label() { return tr('Nebulosa'); } },
      { src: `${base}/espacio/nebulosa-violeta.webp`, get label() { return tr('Nebulosa violeta'); } },
      { src: `${base}/espacio/nubes-violetas.webp`, get label() { return tr('Nubes violetas'); } },
      { src: `${base}/espacio/nubes-y-estrellas.webp`, get label() { return tr('Nubes y estrellas'); } },
      { src: `${base}/espacio/saturno.webp`, get label() { return tr('Saturno'); } },
      { src: `${base}/espacio/via-lactea.webp`, get label() { return tr('Vía Láctea'); } },
    ],
  },
  {
    id: 'otros',
    get label() { return tr('Otros'); },
    pictures: [
      { src: `${base}/otros/abu-dabi.webp`, get label() { return tr('Abu Dabi'); } },
      { src: `${base}/otros/velocidad.webp`, get label() { return tr('Velocidad'); } },
    ],
  },
];

/** Convierte un asset nativo a data-URL: así la imagen elegida se guarda
 *  igual que una subida por el usuario (IndexedDB) y sobrevive a respaldos. */
export async function nativePictureToDataUrl(src: string): Promise<string> {
  const response = await fetch(src);
  // Sin esta comprobación, una ruta inexistente guardaba como "imagen" la
  // página de error del servidor.
  if (!response.ok) throw new Error(tr('La imagen no está disponible.'));
  const blob = await response.blob();
  if (blob.type && !blob.type.startsWith('image/')) throw new Error(tr('El archivo no es una imagen.'));
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
