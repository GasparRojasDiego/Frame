import type { HelpEntry } from '../areas';

type Entry = Omit<HelpEntry, 'area'>;

// Asignaturas: cursos, colecciones y recursos.
// (Estilo de las respuestas: ver basico.ts.)
export const ASIGNATURAS: Entry[] = [
  {
    id: 'asig-intro',
    title: 'La interfaz Asignaturas',
    a: '**Asignaturas** es donde viven tus cursos. Lo encuentras en el menú de la izquierda, al inicio del segundo bloque.\n\nCada curso aparece como una **tarjeta con imagen**. Si tienes varios cursos parecidos, puedes agruparlos en **colecciones** (por ejemplo, «Ciencias» con Física, Química y Biología).\n\nAl pulsar una asignatura entras a su página, donde están sus **tareas** y sus **recursos**: anotaciones, enlaces, archivos y grabaciones.',
    go: '/knowledge',
    rel: ['asig-crear', 'asig-abrir', 'asig-recursos'],
  },
  {
    id: 'asig-crear',
    title: 'Crear una asignatura',
    a: 'Crear tus asignaturas es el primer paso para organizar todo en Frame.',
    steps: [
      'En el menú de la izquierda, entra en **Asignaturas** y pulsa **Añadir**, arriba a la derecha.',
      'Escribe el **nombre** de la asignatura y, si quieres, el de tu **profesor**.',
      'O, más rápido: debajo de la línea aparecen las áreas del Currículo Nacional (Matemática, Comunicación, Inglés…). **Pulsa una** y su nombre se escribe solo.',
      'Pulsa **Crear**. Si marcaste varias áreas, el botón dirá «Crear 3 asignaturas» (por ejemplo) y las creará todas de una vez.',
    ],
    tip: 'Las áreas que ya tienes aparecen más tenues. La imagen de la asignatura la eliges después, con el botón de la cámara de su tarjeta.',
    go: '/knowledge',
    rel: ['asig-imagen', 'asig-coleccion', 'asig-abrir'],
  },
  {
    id: 'asig-coleccion',
    title: 'Crear una colección de asignaturas',
    a: 'Una **colección** es como una carpeta que agrupa dos o más asignaturas parecidas, por ejemplo «Ciencias» con Física, Química y Biología. Así tu pantalla queda más ordenada.',
    steps: [
      'En **Asignaturas**, pulsa **Añadir**, arriba a la derecha.',
      'Usa la **flecha** del recuadro para pasar a **Colección nueva**.',
      'Escribe el nombre de la colección.',
      'Marca las **tarjetas** de las asignaturas que quieres incluir y pulsa **Crear**.',
    ],
    tip: 'Cada asignatura puede estar en una sola colección: si eliges una que ya está en otra, se mueve a la nueva.',
    go: '/knowledge',
    rel: ['asig-mover-coleccion', 'asig-crear'],
  },
  {
    id: 'asig-mover-coleccion',
    title: 'Mover una asignatura a otra colección',
    a: 'Pasa el ratón por la tarjeta de la asignatura: arriba a la derecha aparece el botón de las **capas** (Colección de esta asignatura). Púlsalo y elige la colección a la que quieres moverla, o **Sin colección** si prefieres dejarla suelta.',
    go: '/knowledge',
    rel: ['asig-coleccion'],
  },
  {
    id: 'asig-coleccion-renombrar',
    title: 'Abrir o renombrar una colección',
    a: '**Pulsa la tarjeta de la colección** para ver las asignaturas que tiene dentro.\n\nAhí, junto a su nombre, está el **lápiz** para cambiarle el nombre. Para salir, pulsa **Volver a Asignaturas**.',
    go: '/knowledge',
  },
  {
    id: 'asig-imagen',
    title: 'Poner una imagen a una asignatura o colección',
    a: 'Ponerle una imagen a cada asignatura hace que la reconozcas de un vistazo.\n\nPasa el ratón por su tarjeta y pulsa el botón de la **cámara**, arriba a la derecha (también está en la cabecera de la asignatura). Puedes elegir una de las **89 imágenes** de la galería de Frame (ciudades, monumentos, paisajes, espacio y otras) o **subir una tuya**. Después, la encuadras como quieras.',
    tip: 'Si no eliges imagen, la tarjeta muestra unas olas animadas. Si entraste con una cuenta, la imagen también aparece en tu celular.',
    go: '/knowledge',
    rel: ['encuadre-imagen'],
  },
  {
    // 1.6.4
    id: 'asig-alto-imagen',
    title: 'La proporción de la imagen de las tarjetas',
    a: '¿Quieres que las imágenes de tus asignaturas se vean más altas o más bajas? Puedes elegirlo tú.\n\nEn **Asignaturas**, pulsa el **engranaje**, arriba a la derecha. En **Alto de las imágenes**, mueve la barra: la parte de imagen de **todas** las tarjetas de colecciones y asignaturas cambia a la vez, también donde eliges una asignatura (al crear una tarea, una anotación o una grabación) y en tus sesiones de estudio.\n\nFrame guarda la **proporción** de la imagen, no su altura: si la ventana es más ancha o más estrecha, la tarjeta se ve igual de equilibrada.\n\nSi quieres volver a la proporción original, pulsa **Valor predeterminado**.',
    tip: 'Este ajuste se recuerda en este equipo.',
    go: '/knowledge',
    rel: ['asig-imagen', 'encuadre-imagen'],
  },
  {
    id: 'encuadre-imagen',
    title: 'Encuadrar una imagen',
    a: 'Cuando eliges una imagen, Frame te deja **encuadrarla** antes de guardarla, para que se vea justo la parte que quieres.\n\nVerás la **imagen completa** con un **recuadro** encima: lo de dentro es lo que se usará y lo de fuera queda más oscuro. **Arrastra el recuadro** para elegir la parte que quieres y **acerca** con la rueda del ratón o con la barra deslizante. Cuando te guste, pulsa **Guardar**.',
    tip: 'En la foto de perfil el recuadro es redondo, igual que se verá tu foto.',
    rel: ['asig-imagen', 'perfil-foto'],
  },
  {
    id: 'asig-abrir',
    title: 'Qué hay dentro de una asignatura',
    a: 'En **Asignaturas**, **pulsa la tarjeta** de un curso para entrar a su página.\n\nArriba verás su imagen y cuatro datos: tareas culminadas, tareas pendientes, tiempo de estudio y número de sesiones. A los lados están los botones para editarla, eliminarla, cambiar su imagen y ver sus archivados.\n\nDebajo, cambia entre **Tareas** y **Recursos** con las pestañas.',
    go: '/knowledge',
    rel: ['asig-recursos', 'asig-archivados'],
  },
  {
    id: 'asig-editar',
    title: 'Renombrar o eliminar una asignatura',
    a: 'Entra a la asignatura pulsando su tarjeta. En su cabecera encontrarás el **lápiz** (Editar asignatura) para cambiar su nombre o el de su profesor, y la **papelera** (Eliminar asignatura) para borrarla.',
    tip: 'Ojo: eliminar una asignatura borra también sus tareas y recursos. Si fue sin querer, presiona Ctrl + Z en los segundos siguientes.',
    go: '/knowledge',
    rel: ['deshacer'],
  },
  {
    id: 'asig-recursos',
    title: 'Los recursos de una asignatura',
    a: 'Cada asignatura guarda sus materiales en la pestaña **Recursos**. Ahí están ordenados en bloques: **Anotaciones**, **Enlaces**, **Archivos** y, al final, sus **grabaciones**.\n\nPara añadir uno, busca el recuadro **Nuevo recurso**, a la derecha. Puedes guardar un **texto** (una nota rápida), un **enlace** a una página web o un **archivo** (PDF, Word, Excel o una imagen).\n\nDentro de cada bloque puedes **arrastrar** las tarjetas para ordenarlas como prefieras.',
    tip: 'Para cambiar o borrar un recurso, usa «Editar o eliminar recursos». Los que borras se guardan en los archivados de la asignatura.',
    go: '/knowledge',
    rel: ['asig-archivados'],
  },
  {
    id: 'asig-archivados',
    title: 'Archivados de una asignatura',
    a: 'Dentro de cada asignatura, el botón de la **caja**, en su cabecera, abre su **registro de archivados**: las tareas que culminaste (con el tiempo que les dedicaste y si las entregaste a tiempo) y los recursos que eliminaste.',
    tip: 'Este registro no se puede vaciar, porque con él se arman tus informes de rendimiento.',
    go: '/knowledge',
    rel: ['tarea-archivadas'],
  },
  {
    id: 'asig-grabaciones',
    title: 'Grabaciones dentro de una asignatura',
    a: 'Cuando terminas una grabación, en el recuadro **Guardar grabación** verás las tarjetas de tus asignaturas. **Pulsa la de la asignatura** a la que pertenece el audio y guárdalo: aparecerá dentro de esa asignatura.\n\nSi no eliges ninguna, la grabación queda en **Inicio**. Si marcaste una por error, púlsala otra vez para desmarcarla.',
    tip: 'Más adelante puedes cambiarla de asignatura desde los detalles de la grabación.',
    rel: ['grabar-nota', 'grabacion-detalles'],
  },
];
