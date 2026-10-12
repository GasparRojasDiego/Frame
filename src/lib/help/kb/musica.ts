import type { HelpEntry } from '../areas';

type Entry = Omit<HelpEntry, 'area'>;

// Música: biblioteca, importación, reproductor, letras y playlists.
// (Estilo de las respuestas: ver basico.ts.)
export const MUSICA: Entry[] = [
  {
    id: 'musica-intro',
    title: 'La interfaz Música',
    a: 'Frame tiene su propio reproductor de música, para que estudies con tus canciones favoritas sin abrir otro programa.\n\nEn el menú de la izquierda, pulsa **Música**: ahí está tu **biblioteca**, con las canciones que traes desde tu computadora, cada una con su portada y su letra. Puedes marcar **favoritas** y armar **playlists**, que aparecen debajo de Música en el menú.\n\nCuando pones una canción, aparece un **reproductor** en la parte de abajo de la pantalla, y la música sigue sonando mientras usas el resto de Frame.',
    go: '/music',
    rel: ['musica-anadir', 'musica-reproducir', 'playlist-crear'],
  },
  {
    id: 'musica-anadir',
    title: 'Añadir tus canciones («Importar»)',
    a: 'Frame reproduce **tu propia música**: las canciones que ya tienes guardadas en tu computadora. Para traerlas:',
    steps: [
      'En el menú de la izquierda, entra en **Música** y pulsa **Importar**, arriba.',
      'Elige **Canciones…** para traer una o varias canciones sueltas, o **Una carpeta…** para traer una carpeta entera (con todo lo que tenga dentro).',
      'Se abre el explorador de archivos de Windows: busca y elige tu música.',
      'Frame te dirá cuántas canciones nuevas encontró. Pulsa **Importar** y listo: aparecerán en tu biblioteca con su título, artista, portada y letra.',
    ],
    tip: 'Frame no descarga música de internet ni puede traer tus playlists de Spotify u otras apps: reproduce las canciones que tienes como archivos. Acepta los formatos más comunes (como MP3, M4A o WAV) y nunca duplica una canción que ya tenías.',
    go: '/music',
    rel: ['musica-letras', 'musica-celular'],
  },
  {
    id: 'musica-reproducir',
    title: 'Reproducir música',
    a: 'En **Música** (o dentro de una playlist), **pulsa cualquier canción** y empezará a sonar. Abajo de la pantalla aparecerá el **reproductor**.\n\nEn el centro del reproductor están los controles: aleatorio, anterior, reproducir o pausar, siguiente y repetir, con la barra para adelantar o retroceder. A la derecha está el **volumen** y el **corazón** para marcarla como favorita.',
    tip: 'La música sigue sonando aunque cambies de sección. Si quieres escuchar algo al azar, usa el botón de aleatorio que está junto al buscador de la biblioteca.',
    go: '/music',
    rel: ['musica-repetir', 'musica-reproduciendo', 'musica-favoritas'],
  },
  {
    id: 'musica-repetir',
    title: 'Repetir una canción',
    a: 'El botón de **repetir**, en el centro del reproductor de abajo, tiene un truco curioso:\n\n**Cada clic seguido suma una repetición**: si lo pulsas tres veces, la canción se repetirá 3 veces. Y si lo **mantienes pulsado** casi un segundo, la canción se repetirá sin fin.\n\nPara quitar la repetición, pulsa el botón una vez más cuando ya esté activo.',
    go: '/music',
    rel: ['musica-reproducir'],
  },
  {
    id: 'musica-favoritas',
    title: 'Canciones favoritas',
    a: 'Mientras suena una canción que te encanta, pulsa el **corazón** del reproductor, a la derecha, junto al volumen: quedará guardada como favorita.\n\nPara ver solo tus favoritas, en la biblioteca de **Música** pulsa el botón del **corazón**: alterna entre ver todas las canciones o solo tus favoritas.',
    go: '/music',
  },
  {
    id: 'musica-buscar',
    title: 'Buscar en tu biblioteca',
    a: 'En **Música**, arriba, está la barra de la **lupa** («Buscar canciones o artistas…»). Escribe el nombre de la canción o del artista y la lista se filtra al instante; no importan las tildes ni el orden de las palabras.\n\nDentro de la barra, a la derecha, verás **cuántas canciones** tienes (o cuántas coinciden con tu búsqueda).',
    tip: 'Si tienes muchas canciones, la biblioteca se divide en grupos de 100: usa las flechas para pasar de un grupo a otro.',
    go: '/music',
  },
  {
    id: 'musica-eliminar',
    title: 'Eliminar una canción',
    a: 'En la biblioteca de **Música**, pasa el ratón por la canción: en su esquina aparecerá una **papelera**. Púlsala y confirma.\n\nLa canción se borra de Frame y de todas tus playlists (el archivo original de tu computadora no se toca).',
    tip: 'Si solo quieres quitarla de una playlist, hazlo desde dentro de esa playlist.',
    go: '/music',
    rel: ['playlist-editar'],
  },
  {
    id: 'musica-reproduciendo',
    title: 'La vista «Reproduciendo» con la letra',
    a: 'Frame te permite ver la **letra de tus canciones sincronizada**, como en Spotify: los versos se van iluminando al ritmo de la música.\n\nCon una canción sonando, mira el reproductor de abajo: en su **esquina inferior derecha** hay un icono pequeño de **dos flechas**. Púlsalo y se abrirá una pantalla con la portada grande y la letra. Si pulsas un verso, la canción salta a ese momento.\n\nPara cerrarla, pulsa la **flecha hacia abajo** de su esquina superior derecha (o la tecla **Esc**).',
    tip: 'Si la letra va un poco adelantada o atrasada, puedes ajustarla desde esa misma pantalla.',
    go: '/music',
    rel: ['musica-letras'],
  },
  {
    id: 'musica-letras',
    title: 'Las letras de tus canciones',
    a: 'Frame te permite ver la letra de tus canciones favoritas de forma **sincronizada**, al igual que plataformas como Spotify o Deezer.\n\nPara verla, pon una canción de tu biblioteca: abajo aparecerá la **barra de reproducción**. En su **esquina inferior derecha** encontrarás un icono pequeño de **dos flechas**: púlsalo y verás una pantalla con la letra, que avanza junto con la música.\n\nSi la canción no traía su letra, Frame la **busca sola en internet** la primera vez que abres esa pantalla, y la guarda para que después la veas aunque no tengas conexión.',
    tip: 'Es posible que algunas canciones no tengan letra disponible. Si no la encuentra, Frame lo volverá a intentar más adelante.',
    go: '/music',
    rel: ['musica-reproduciendo', 'musica-anadir'],
  },
  {
    id: 'playlist-crear',
    title: 'Crear una playlist',
    a: 'Una **playlist** es una lista con las canciones que tú elijas, por ejemplo «Para estudiar» o «Para concentrarme».\n\nEn el menú de la izquierda, debajo de **Música**, pulsa **Añadir playlist**. Escribe su nombre y pulsa el **+** de cada canción que quieras incluir: se añade al instante.',
    tip: 'Si no recuerdas una canción, pulsa su portada en ese recuadro y sonará para que la reconozcas.',
    rel: ['playlist-editar', 'playlist-ordenar'],
  },
  {
    id: 'playlist-editar',
    title: 'Editar una playlist',
    a: 'Abre la playlist pulsándola en el menú de la izquierda, debajo de Música. Dentro puedes:\n\nPulsar **Añadir canciones** para sumar más, cambiarle el **nombre** o la **imagen** de cabecera, **buscar** dentro de ella, reproducirla en orden **aleatorio**, **quitar** canciones o **eliminar** la playlist entera.',
    rel: ['playlist-ordenar', 'playlist-crear'],
  },
  {
    id: 'playlist-ordenar',
    title: 'Ordenar playlists y canciones',
    a: 'Puedes poner tus playlists y tus canciones en el orden que prefieras:\n\nEn el menú de la izquierda, **mantén pulsada una playlist** y arrástrala a su nuevo lugar.\n\nDentro de una playlist, **arrastra las tarjetas de las canciones** para cambiar el orden en que suenan.',
    rel: ['playlist-editar'],
  },
  {
    id: 'musica-celular',
    title: 'Tu música en el celular',
    a: 'Tu música **no viaja por la nube**: vive en cada equipo, porque las canciones pesan mucho.\n\nPara tenerla en tu celular o tablet, primero copia tus archivos de música al dispositivo (por ejemplo, con un cable USB). Después, en Frame para Android, entra en **Música** y toca **Importar**: elige tus canciones o la carpeta donde las copiaste.',
    tip: 'Lo demás (tareas, hábitos, asignaturas…) sí se sincroniza solo con tu cuenta.',
    rel: ['musica-anadir', 'nube-que-se-guarda'],
  },
  {
    id: 'musica-al-cerrar',
    title: 'La música al cerrar Frame',
    a: 'Si cierras la ventana de Frame, la app se cierra y la música se detiene.\n\nPara seguir escuchando mientras usas otros programas, deja Frame abierta: puedes **minimizarla** con el botón de la raya, arriba a la derecha de la ventana, y la música seguirá sonando.',
  },
];
