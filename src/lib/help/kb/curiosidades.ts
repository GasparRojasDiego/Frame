import type { HelpEntry } from '../search';

type Entry = Omit<HelpEntry, 'area'>;

// ============================================================
// «Curiosidades» (1.6.4): las funciones poco tradicionales de Frame, las que
// no se descubren mirando. El tema reúne estas respuestas propias y las de
// otras áreas que también lo son (CURIOSITY_IDS).
// (Estilo de las respuestas: ver basico.ts.)
// ============================================================

export const CURIOSIDADES: Entry[] = [
  {
    id: 'reproductor-ocultar',
    title: 'Ocultar y mostrar el reproductor de música',
    q: ['cómo oculto el reproductor de música', 'cómo escondo la barra de música', 'quitar la barra de abajo de la música', 'cómo vuelvo a mostrar el reproductor', 'desapareció la barra de música'],
    k: ['ocultar', 'esconder', 'reproductor', 'barra inferior', 'flecha', 'mostrar'],
    a: '¿Quieres más espacio en la pantalla mientras escuchas música? Puedes esconder la **barra de reproducción** sin que la música se detenga.\n\nPasa el ratón por encima de la barra: en su **esquina superior derecha** aparecerá una **flecha hacia abajo**. Púlsala y la barra se ocultará, pero la canción seguirá sonando.\n\nPara volver a verla, lleva el ratón al **borde inferior de la pantalla, en el centro**: aparecerá una pequeña pestaña con una **flecha hacia arriba**. Púlsala y la barra regresará.',
    go: '/music',
    rel: ['musica-reproducir', 'reproductor-ir-playlist'],
  },
  {
    id: 'reproductor-ir-playlist',
    title: 'Ir a la playlist que está sonando',
    q: ['cómo voy a la playlist que suena', 'el nombre de la playlist del reproductor', 'ir a la canción que suena', 'dónde está la canción que está sonando'],
    k: ['nombre de la playlist', 'reproductor', 'ir a', 'ubicar', 'cancion que suena'],
    a: 'Si te gusta lo que suena y quieres saber de qué playlist viene, la barra de reproducción te lleva directo a ella.\n\nEn la **parte derecha** de la barra, **debajo del volumen**, aparece el **nombre de la playlist** que está sonando (o «Música», si suena tu biblioteca). Púlsalo: Frame te llevará a esa playlist y la **canción que suena parpadeará** para que la encuentres al instante.',
    go: '/music',
    rel: ['reproductor-ocultar', 'musica-reproducir'],
  },
  {
    id: 'grabar-atajo',
    title: 'Grabar al instante con el teclado',
    q: ['hay un atajo para grabar', 'grabar rápido con el teclado', 'tecla para grabar'],
    k: ['ctrl shift f', 'atajo', 'grabar', 'teclado', 'al instante'],
    a: '¡Sí! Presiona a la vez las teclas **Ctrl + Shift + F**, estés en la pantalla que estés.\n\nSe abrirá la grabadora y **empezará a grabar en el acto**, sin que tengas que pulsar nada más. Es ideal cuando el profesor empieza a explicar algo importante y no quieres perderte nada.',
    rel: ['grabar-nota', 'atajos'],
  },
  {
    id: 'figura-ayuda',
    title: 'La figura del Centro de ayuda',
    q: ['qué es la figura que gira en la ayuda', 'por qué se mueve la figura de la ayuda', 'qué es el balón de la ayuda'],
    k: ['figura', 'balon', 'pelota', 'futbol', 'pentagonos', 'hexagonos', 'gira', 'respira'],
    a: 'Es un **balón de fútbol** dibujado con líneas: está hecho de **pentágonos y hexágonos**, como los balones clásicos.\n\nLo verás en el **Centro de ayuda** antes de hacer tu primera pregunta. Gira despacio y, mientras escribes, **«respira»** con cada tecla que pulsas. Desaparece cuando preguntas y vuelve al empezar una **Nueva conversación**.',
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
