import type { HelpEntry } from '../areas';

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
    a: '¿Quieres más espacio en la pantalla mientras escuchas música? Puedes esconder la **barra de reproducción** sin que la música se detenga.\n\nPasa el ratón por encima de la barra: en su **esquina superior derecha** aparecerá una **flecha hacia abajo**. Púlsala y la barra se ocultará, pero la canción seguirá sonando.\n\nPara volver a verla, lleva el ratón al **borde inferior de la pantalla, en el centro**: aparecerá una pequeña pestaña con una **flecha hacia arriba**. Púlsala y la barra regresará.',
    go: '/music',
    rel: ['musica-reproducir', 'reproductor-ir-playlist'],
  },
  {
    id: 'reproductor-ir-playlist',
    title: 'Ir a la playlist que está sonando',
    a: 'Si te gusta lo que suena y quieres saber de qué playlist viene, la barra de reproducción te lleva directo a ella.\n\nEn la **parte derecha** de la barra, **debajo del volumen**, aparece el **nombre de la playlist** que está sonando (o «Música», si suena tu biblioteca). Púlsalo: Frame te llevará a esa playlist y la **canción que suena parpadeará** para que la encuentres al instante.',
    go: '/music',
    rel: ['reproductor-ocultar', 'musica-reproducir'],
  },
  {
    id: 'grabar-atajo',
    title: 'Grabar al instante con el teclado',
    a: '¡Sí! Presiona a la vez las teclas **Ctrl + Shift + F**, estés en la pantalla que estés.\n\nSe abrirá la grabadora y **empezará a grabar en el acto**, sin que tengas que pulsar nada más. Es ideal cuando el profesor empieza a explicar algo importante y no quieres perderte nada.',
    rel: ['grabar-nota', 'atajos'],
  },
  {
    id: 'figura-ayuda',
    title: 'La figura del Centro de ayuda',
    a: 'Es un **dodecaedro** dibujado con líneas: una figura de **doce caras**, y cada una es un **pentágono**.\n\nLa verás al abrir el **Centro de ayuda**, encima de los temas. Gira despacio de lado, un poco inclinada, con una de sus puntas justo en el centro.\n\nDebajo aparece una frase que cambia tres veces al día: a las **6 de la mañana**, a las **12 del mediodía** y a las **6 de la tarde**.',
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
