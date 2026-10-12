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
    label: 'Ciudades',
    pictures: [
      { src: `${base}/ciudades/avenida-de-palmeras.webp`, label: 'Avenida de palmeras' },
      { src: `${base}/ciudades/bajo-manhattan.webp`, label: 'Bajo Manhattan' },
      { src: `${base}/ciudades/calle-46.webp`, label: 'Calle 46' },
      { src: `${base}/ciudades/casa-de-brooklyn.webp`, label: 'Casa de Brooklyn' },
      { src: `${base}/ciudades/central-park.webp`, label: 'Central Park' },
      { src: `${base}/ciudades/cielo-de-nueva-york.webp`, label: 'Cielo de Nueva York' },
      { src: `${base}/ciudades/costa-de-california.webp`, label: 'Costa de California' },
      { src: `${base}/ciudades/empire-state.webp`, label: 'Empire State' },
      { src: `${base}/ciudades/empire-state-de-noche.webp`, label: 'Empire State de noche' },
      { src: `${base}/ciudades/hudson-al-anochecer.webp`, label: 'Hudson al anochecer' },
      { src: `${base}/ciudades/londres.webp`, label: 'Londres' },
      { src: `${base}/ciudades/manhattan-al-atardecer.webp`, label: 'Manhattan al atardecer' },
      { src: `${base}/ciudades/manhattan-de-noche.webp`, label: 'Manhattan de noche' },
      { src: `${base}/ciudades/manhattan-desde-el-aire.webp`, label: 'Manhattan desde el aire' },
      { src: `${base}/ciudades/manhattan-violeta.webp`, label: 'Manhattan violeta' },
      { src: `${base}/ciudades/navidad-en-nueva-york.webp`, label: 'Navidad en Nueva York' },
      { src: `${base}/ciudades/new-york.webp`, label: 'New York' },
      { src: `${base}/ciudades/nueva-york-de-noche.webp`, label: 'Nueva York de noche' },
      { src: `${base}/ciudades/ocaso-en-manhattan.webp`, label: 'Ocaso en Manhattan' },
      { src: `${base}/ciudades/otono-en-manhattan.webp`, label: 'Otoño en Manhattan' },
      { src: `${base}/ciudades/paris.webp`, label: 'París' },
      { src: `${base}/ciudades/paris-desde-el-balcon.webp`, label: 'París desde el balcón' },
      { src: `${base}/ciudades/paseo-del-puente.webp`, label: 'Paseo del puente' },
      { src: `${base}/ciudades/puente-al-ocaso.webp`, label: 'Puente al ocaso' },
      { src: `${base}/ciudades/puente-de-brooklyn.webp`, label: 'Puente de Brooklyn' },
      { src: `${base}/ciudades/skyline-de-nueva-york.webp`, label: 'Skyline de Nueva York' },
      { src: `${base}/ciudades/sobre-la-ciudad.webp`, label: 'Sobre la ciudad' },
      { src: `${base}/ciudades/toronto.webp`, label: 'Toronto' },
      { src: `${base}/ciudades/ventana-a-nueva-york.webp`, label: 'Ventana a Nueva York' },
      { src: `${base}/ciudades/vista-al-empire-state.webp`, label: 'Vista al Empire State' },
      { src: `${base}/ciudades/atico.webp`, label: 'Ático' },
    ],
  },
  {
    id: 'monumentos',
    label: 'Monumentos',
    pictures: [
      { src: `${base}/monumentos/claustro-en-otono.webp`, label: 'Claustro en otoño' },
      { src: `${base}/monumentos/coliseo-de-noche.webp`, label: 'Coliseo de noche' },
      { src: `${base}/monumentos/coliseo-en-flor.webp`, label: 'Coliseo en flor' },
      { src: `${base}/monumentos/cristo-redentor.webp`, label: 'Cristo Redentor' },
      { src: `${base}/monumentos/cupula.webp`, label: 'Cúpula' },
      { src: `${base}/monumentos/eiffel-sobre-el-sena.webp`, label: 'Eiffel sobre el Sena' },
      { src: `${base}/monumentos/estatua-de-la-libertad.webp`, label: 'Estatua de la Libertad' },
      { src: `${base}/monumentos/fontana-di-trevi.webp`, label: 'Fontana di Trevi' },
      { src: `${base}/monumentos/isla-de-la-libertad.webp`, label: 'Isla de la Libertad' },
      { src: `${base}/monumentos/libertad-y-puente.webp`, label: 'Libertad y puente' },
      { src: `${base}/monumentos/machu-picchu.webp`, label: 'Machu Picchu' },
      { src: `${base}/monumentos/ponte-sant-angelo.webp`, label: "Ponte Sant'Angelo" },
      { src: `${base}/monumentos/san-pedro-al-anochecer.webp`, label: 'San Pedro al anochecer' },
      { src: `${base}/monumentos/techos-de-roma.webp`, label: 'Techos de Roma' },
      { src: `${base}/monumentos/torre-eiffel.webp`, label: 'Torre Eiffel' },
    ],
  },
  {
    id: 'paisajes',
    label: 'Paisajes',
    pictures: [
      { src: `${base}/paisajes/acantilado.webp`, label: 'Acantilado' },
      { src: `${base}/paisajes/arco-de-cabo.webp`, label: 'Arco de Cabo' },
      { src: `${base}/paisajes/bosque-de-otono.webp`, label: 'Bosque de otoño' },
      { src: `${base}/paisajes/bosque-en-niebla.webp`, label: 'Bosque en niebla' },
      { src: `${base}/paisajes/colinas-al-atardecer.webp`, label: 'Colinas al atardecer' },
      { src: `${base}/paisajes/colinas-de-palmeras.webp`, label: 'Colinas de palmeras' },
      { src: `${base}/paisajes/cordillera.webp`, label: 'Cordillera' },
      { src: `${base}/paisajes/costa-en-flor.webp`, label: 'Costa en flor' },
      { src: `${base}/paisajes/cueva-marina.webp`, label: 'Cueva marina' },
      { src: `${base}/paisajes/flores-de-montana.webp`, label: 'Flores de montaña' },
      { src: `${base}/paisajes/himalaya.webp`, label: 'Himalaya' },
      { src: `${base}/paisajes/lago-de-como.webp`, label: 'Lago de Como' },
      { src: `${base}/paisajes/lago-violeta.webp`, label: 'Lago violeta' },
      { src: `${base}/paisajes/mar-al-atardecer.webp`, label: 'Mar al atardecer' },
      { src: `${base}/paisajes/montanas-reflejadas.webp`, label: 'Montañas reflejadas' },
      { src: `${base}/paisajes/montanas-rosadas.webp`, label: 'Montañas rosadas' },
      { src: `${base}/paisajes/muelle-en-el-lago.webp`, label: 'Muelle en el lago' },
      { src: `${base}/paisajes/pico-dorado.webp`, label: 'Pico dorado' },
      { src: `${base}/paisajes/prado-al-atardecer.webp`, label: 'Prado al atardecer' },
      { src: `${base}/paisajes/santorini.webp`, label: 'Santorini' },
      { src: `${base}/paisajes/terraza-mediterranea.webp`, label: 'Terraza mediterránea' },
      { src: `${base}/paisajes/valle-al-amanecer.webp`, label: 'Valle al amanecer' },
      { src: `${base}/paisajes/valle-florido.webp`, label: 'Valle florido' },
    ],
  },
  {
    id: 'espacio',
    label: 'Espacio',
    pictures: [
      { src: `${base}/espacio/agujero-negro.webp`, label: 'Agujero negro' },
      { src: `${base}/espacio/amanecer-orbital.webp`, label: 'Amanecer orbital' },
      { src: `${base}/espacio/anillos.webp`, label: 'Anillos' },
      { src: `${base}/espacio/cumbre-estrellada.webp`, label: 'Cumbre estrellada' },
      { src: `${base}/espacio/despegue.webp`, label: 'Despegue' },
      { src: `${base}/espacio/disco-de-acrecion.webp`, label: 'Disco de acreción' },
      { src: `${base}/espacio/galaxia.webp`, label: 'Galaxia' },
      { src: `${base}/espacio/gargantua.webp`, label: 'Gargantúa' },
      { src: `${base}/espacio/horizonte-de-sucesos.webp`, label: 'Horizonte de sucesos' },
      { src: `${base}/espacio/la-tierra-de-noche.webp`, label: 'La Tierra de noche' },
      { src: `${base}/espacio/lago-bajo-las-estrellas.webp`, label: 'Lago bajo las estrellas' },
      { src: `${base}/espacio/mundo-lejano.webp`, label: 'Mundo lejano' },
      { src: `${base}/espacio/nebulosa.webp`, label: 'Nebulosa' },
      { src: `${base}/espacio/nebulosa-violeta.webp`, label: 'Nebulosa violeta' },
      { src: `${base}/espacio/nubes-violetas.webp`, label: 'Nubes violetas' },
      { src: `${base}/espacio/nubes-y-estrellas.webp`, label: 'Nubes y estrellas' },
      { src: `${base}/espacio/saturno.webp`, label: 'Saturno' },
      { src: `${base}/espacio/via-lactea.webp`, label: 'Vía Láctea' },
    ],
  },
  {
    id: 'otros',
    label: 'Otros',
    pictures: [
      { src: `${base}/otros/abu-dabi.webp`, label: 'Abu Dabi' },
      { src: `${base}/otros/velocidad.webp`, label: 'Velocidad' },
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
