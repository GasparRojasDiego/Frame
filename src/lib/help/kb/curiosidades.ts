import type { HelpEntry } from '../search';

type Entry = Omit<HelpEntry, 'area'>;

// ============================================================
// «Curiosidades» (1.6.4): las funciones poco tradicionales de Frame, las que
// no se descubren mirando. El tema reúne estas respuestas propias y las de
// otras áreas que también lo son (CURIOSITY_IDS).
// ============================================================

export const CURIOSIDADES: Entry[] = [
  {
    id: 'reproductor-ocultar',
    title: 'Ocultar y mostrar el reproductor de música',
    q: ['cómo oculto el reproductor de música', 'cómo escondo la barra de música', 'quitar la barra de abajo de la música', 'cómo vuelvo a mostrar el reproductor', 'desapareció la barra de música'],
    k: ['ocultar', 'esconder', 'reproductor', 'barra inferior', 'flecha', 'mostrar'],
    a: 'Pasa el ratón por el reproductor de abajo: arriba a la derecha aparece una flecha hacia abajo que lo oculta (la música sigue sonando). Para volver a verlo, acerca el ratón al borde inferior, al centro: aparece una pestaña con una flecha hacia arriba.',
    go: '/music',
    rel: ['musica-reproducir', 'reproductor-ir-playlist'],
  },
  {
    id: 'reproductor-ir-playlist',
    title: 'Ir a la playlist que está sonando',
    q: ['cómo voy a la playlist que suena', 'el nombre de la playlist del reproductor', 'ir a la canción que suena', 'dónde está la canción que está sonando'],
    k: ['nombre de la playlist', 'reproductor', 'ir a', 'ubicar', 'cancion que suena'],
    a: 'En el reproductor, debajo del nombre de la canción, pulsa el nombre de la playlist (o «Música»): te lleva a ella y la tarjeta de la canción que suena se ubica y parpadea.',
    go: '/music',
    rel: ['reproductor-ocultar', 'musica-reproducir'],
  },
  {
    id: 'grabar-atajo',
    title: 'Grabar al instante con el teclado',
    q: ['hay un atajo para grabar', 'cómo empiezo a grabar sin abrir nada', 'grabar rápido con el teclado', 'tecla para grabar'],
    k: ['ctrl shift f', 'atajo', 'grabar', 'teclado', 'al instante'],
    a: 'Pulsa Ctrl + Shift + F en cualquier interfaz: se abre la grabadora y empieza a grabar en el acto, sin pulsar nada más.',
    rel: ['grabar-nota', 'atajos'],
  },
  {
    id: 'figura-ayuda',
    title: 'La figura del Centro de ayuda',
    q: ['qué es la figura que gira en la ayuda', 'por qué se mueve la figura de la ayuda'],
    k: ['figura', 'pentagonos', 'dodecaedro', 'gira', 'respira'],
    a: 'Antes de preguntar, el Centro de ayuda muestra una figura de pentágonos que gira despacio y «respira» con cada tecla que escribes. Desaparece al preguntar y vuelve con «Nueva conversación».',
    go: '/ayuda',
    rel: ['ayuda-barra'],
  },
];

/** Respuestas de otras áreas que también son curiosidades. */
export const CURIOSITY_IDS = [
  'musica-repetir',
  'reproductor-ocultar',
  'grabar-atajo',
  'horario-vistazo',
  'playlist-ordenar',
  'informes-centro',
  'musica-letras',
  'letra-ajustar',
  'reproductor-ir-playlist',
  'vista-flotante',
  'videos-estudio',
  'menu-plegar',
  'ext-notion',
  'deshacer',
  'frase-personal',
  'cal-varios-dias',
  'encuadre-imagen',
  'asig-alto-imagen',
  'atajos',
  'figura-ayuda',
];
