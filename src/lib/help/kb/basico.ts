import type { HelpEntry } from '../areas';

type Entry = Omit<HelpEntry, 'area'>;

// Lo básico: qué es Frame, cómo se mueve uno por ella y qué guarda dónde.
//
// Estilo de las respuestas (1.6.5): se escriben para quien abre Frame por
// primera vez. Cordiales y explicativas, en párrafos cortos separados por una
// línea en blanco, con **negrita** en los botones que hay que buscar y
// diciendo SIEMPRE dónde está cada cosa en la pantalla. Sin tecnicismos.
export const BASICO: Entry[] = [
  {
    id: 'que-es-frame',
    title: 'Qué es Frame',
    a: 'Frame es tu espacio de estudio en una sola app. En lugar de tener tus tareas en un cuaderno, tu horario en una foto y tu música en otro programa, aquí tienes **todo junto y ordenado**.\n\nCon Frame puedes llevar tus **asignaturas** con sus apuntes y recursos, anotar tus **tareas** con su fecha de entrega, medir tus **sesiones de estudio** con un temporizador que te da una nota del día, seguir tus **hábitos**, ver tu **calendario**, grabar notas de voz y escuchar **tu propia música** mientras estudias.\n\nTodo funciona aunque no tengas internet. Y si creas una cuenta, lo que hagas en tu laptop aparece también en tu celular.',
    tip: 'Frame la desarrolla VT Asvent, una entidad de desarrollo de software en formación.',
    rel: ['menu-lateral', 'primeros-pasos', 'sin-internet'],
  },
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos en Frame',
    a: '¡Te damos la bienvenida a Frame! Para empezar con buen pie, lo más útil es **preparar tus asignaturas y tus metas de estudio**. A partir de ahí, todo lo demás (tareas, sesiones, calendario) se ordena solo alrededor de ellas.\n\nTe recomiendo este orden:',
    steps: [
      'En el menú de la izquierda, entra en **Asignaturas** y pulsa **Añadir** (arriba a la derecha) para crear cada uno de tus cursos.',
      'Abre **Ajustes** pulsando tu nombre, abajo del todo en el menú de la izquierda, y fija tus **Metas diarias de estudio**: cuántos minutos quieres estudiar cada día de la semana.',
      'Apunta tus tareas con el botón **+** de la barra de arriba: funciona desde cualquier pantalla.',
      'Cuando te sientes a estudiar, entra en **Estudio** y pulsa **Iniciar**.',
      'Si quieres, sube una foto de tu horario en **Inicio**, en el recuadro **Mi horario**.',
    ],
    tip: 'No hace falta hacerlo todo hoy: puedes ir completando poco a poco.',
    rel: ['asig-crear', 'ajustes-metas', 'tarea-crear', 'enfoque-iniciar'],
  },
  {
    id: 'menu-lateral',
    title: 'El menú lateral',
    a: 'El menú de la izquierda es la forma de moverte por Frame: cada botón abre una sección distinta, y el que está pintado de azul es en la que estás.\n\nEstá ordenado en bloques, separados por una línea fina. Primero lo de cada día: **Inicio**, **Estudio** y **Hábitos**. Después lo académico: **Asignaturas**, **Tareas** y **Calendario**. Luego las herramientas de Google: **YouTube**, **Gmail** y **Classroom**. Y al final, **Música** con tus playlists.\n\nAbajo del todo aparece **tu nombre**: al pulsarlo se abren tus Ajustes.',
    tip: 'Mientras tienes una sesión de estudio en marcha, junto a «Estudio» gira un pequeño reloj, para que no la olvides.',
    rel: ['menu-plegar', 'ajustes-abrir', 'conoce-vt-asvent'],
  },
  {
    id: 'menu-plegar',
    title: 'Plegar o desplegar el menú lateral',
    a: 'Si quieres más espacio en la pantalla, puedes hacer más angosto el menú de la izquierda.\n\nPulsa el **logo de Frame**, arriba del todo en el menú: se pliega y quedan solo los iconos de cada sección. Para volver a verlo completo, pulsa el logo otra vez.',
    rel: ['menu-lateral'],
  },
  {
    id: 'sin-internet',
    title: 'Usar Frame sin internet',
    a: '¡Sí! Casi todo Frame funciona **sin conexión**, porque tus datos se guardan en tu propio equipo. Puedes crear tareas, estudiar con el temporizador, marcar hábitos o escuchar tu música aunque no tengas wifi.\n\nCuando vuelve internet, y si entraste con una cuenta, los cambios se suben solos a la nube. No tienes que hacer nada.',
    tip: 'Lo único que necesita internet es lo que viene de fuera: el clima, Gmail, Classroom, YouTube, los vídeos de estudio y buscar letras de canciones que no tienes guardadas.',
    rel: ['nube-que-se-guarda', 'sin-conexion-aviso'],
  },
  {
    id: 'nube-que-se-guarda',
    title: 'Qué se guarda en la nube y qué no',
    a: 'Si entras con una cuenta, Frame guarda una copia de tus datos en la nube para que los veas en cualquier equipo.\n\n**Se sincroniza:** tus asignaturas y colecciones, tareas, sesiones de estudio, notas del día, hábitos, eventos del calendario, horario, metas y ajustes. También tu foto de perfil y las imágenes de tus asignaturas, colecciones, playlists y horario.\n\n**Se queda solo en este equipo:** tu música, tus grabaciones de voz y los archivos que adjuntas a las tareas, porque suelen pesar mucho.',
    tip: 'Si cambias de computadora, vuelve a importar tu música en la nueva.',
    rel: ['sync-como-funciona', 'musica-celular', 'invitado-que-es'],
  },
  {
    id: 'deshacer',
    title: 'Deshacer un borrado',
    a: 'No te preocupes: si borraste algo sin querer, tienes unos segundos para recuperarlo.\n\nPresiona las teclas **Ctrl + Z** en los **7 segundos** siguientes a eliminar o culminar una tarea, un recurso, una asignatura u otro elemento, y volverá a su lugar.',
    tip: 'Si estás escribiendo dentro de un cuadro de texto, Ctrl + Z deshace lo que tecleaste, no el borrado. Y las tareas culminadas nunca se pierden: quedan en «Archivadas», dentro de Tareas.',
    rel: ['tarea-archivadas'],
  },
  {
    id: 'atajos',
    title: 'Atajos de teclado y gestos',
    a: 'Frame tiene algunos atajos que te ahorran clics. Estos son todos:',
    steps: [
      '**Ctrl + Shift + F**: abre la grabadora y empieza a grabar al instante.',
      '**Ctrl + Z**: deshace el último borrado (si no estás escribiendo en un cuadro de texto).',
      '**Ctrl + Enter**: guarda la tarea que estás editando o la anotación que estás escribiendo.',
      '**Ctrl + B** y **Ctrl + I**: negrita y cursiva en las anotaciones.',
      '**Esc**: descarta la edición de una tarea o cierra la pantalla de la letra de una canción.',
      'En el Calendario, **Supr** vacía los días que seleccionaste y **Esc** quita la selección.',
      'Deja el ratón quieto **0,7 segundos en el borde izquierdo** de la pantalla: aparece tu horario encima de todo.',
      'Gira la **rueda del ratón** sobre un selector de hora o de tiempo para cambiar el número.',
    ],
    rel: ['grabar-nota', 'horario-vistazo'],
  },
  {
    id: 'conoce-vt-asvent',
    title: 'Quién desarrolla Frame',
    a: 'Frame es el primer producto de **VT Asvent**, una entidad de desarrollo de software en formación, emprendida en Huancayo, Perú.\n\nSi tienes una idea para mejorar Frame o encontraste un error, puedes escribir a vt.asvent@gmail.com.',
    rel: ['sugerencias-enviar'],
  },
  {
    id: 'ayuda-barra',
    title: 'Cómo funciona la ayuda',
    a: 'Estás en el **Centro de ayuda**, el lugar para resolver cualquier duda sobre cómo usar Frame. Se abre con el botón de las **dos estrellas**, en la barra de arriba, a la derecha del **+**.\n\nElige un **tema** en las tarjetas y luego la **pregunta** que te interesa: la respuesta aparece al instante. Para volver atrás, pulsa la **flecha** de arriba a la izquierda.\n\nNo es una inteligencia artificial: responde con explicaciones escritas a mano para cada función de Frame. Por eso funciona sin internet y nunca inventa nada.',
    tip: 'Debajo de cada respuesta, en «Relacionado», tienes otras preguntas del mismo tema. Para salir de la ayuda, pulsa otra vez el botón de las estrellas o la tecla Esc.',
    go: '/ayuda',
    rel: ['figura-ayuda', 'ext-notion'],
  },
  {
    id: 'tema-claro-oscuro',
    title: 'Cambiar a tema claro u oscuro',
    a: 'Puedes elegir cómo se ve Frame: con fondo oscuro o claro.\n\nAbre tus **Ajustes** pulsando tu nombre, abajo del todo en el menú de la izquierda. Junto a tu perfil verás la opción **Tema**, con tres botones: el **sol** pone el tema claro (un tono arena suave), la **luna** pone el oscuro y la **pantalla** sigue el modo que tengas en Windows. El cambio es inmediato.',
    go: '/settings',
  },
  {
    id: 'idioma',
    title: 'Idioma de Frame',
    a: 'Frame está hecha en castellano y, por ahora, no tiene otros idiomas. ¡Gracias por tu interés! Si te gustaría verla en otro idioma, puedes sugerirlo escribiendo a vt.asvent@gmail.com.',
  },
];
