import type { HelpEntry } from '../areas';

type Entry = Omit<HelpEntry, 'area'>;

// Inicio: el resumen del día. (Estilo de las respuestas: ver basico.ts.)
export const INICIO: Entry[] = [
  {
    id: 'inicio-que-muestra',
    title: 'Qué muestra Inicio',
    a: '**Inicio** es la primera sección del menú de la izquierda y funciona como el resumen de tu día: de un vistazo sabes cómo vas.\n\nArriba verás el **clima** y la foto de **tu horario**. Debajo, el recuadro **Rendimiento académico** con tu nota de ayer, tu promedio de la semana, tu próxima tarea y tus días de racha. Más abajo, **Tu semana en datos** y la **matriz de competencias**, un gráfico con la carga de cada asignatura.\n\nAl final aparece lo que apuntaste sin elegir asignatura: tareas, grabaciones de voz y anotaciones, esperando a que las ordenes.',
    go: '/',
    rel: ['inicio-rendimiento', 'anotaciones-sueltas', 'clima-ubicacion'],
  },
  {
    id: 'clima-ubicacion',
    title: 'Cambiar la ciudad del clima',
    a: 'El clima de Inicio se puede ajustar a tu ciudad en un momento. Frame intenta adivinar dónde estás, pero si se equivoca, puedes elegirla tú:',
    steps: [
      'En **Inicio**, pulsa el **recuadro del clima**, arriba de todo.',
      'Escribe el nombre de tu ciudad, por ejemplo «Huancayo».',
      'Elige el resultado correcto de la lista. Desde ese momento, el clima será el de tu ciudad.',
    ],
    tip: 'El clima necesita internet. Sin conexión, verás los últimos datos que se descargaron.',
    go: '/',
    rel: ['clima-pronostico'],
  },
  {
    id: 'clima-pronostico',
    title: 'Pronóstico por horas y por días',
    a: 'El **recuadro del clima**, arriba de todo en **Inicio**, no solo muestra el tiempo de ahora: también trae el pronóstico de las **próximas horas** y de los **próximos días**, con la probabilidad de lluvia de cada uno.\n\nPasa el ratón por encima de cada hora o de cada día para ver su detalle.',
    go: '/',
    rel: ['clima-ubicacion'],
  },
  {
    id: 'horario-subir',
    title: 'Subir la foto de tu horario',
    a: '¿Tienes tu horario de clases en una foto o una captura? Puedes tenerlo siempre a mano en Frame.\n\nEn **Inicio**, pulsa el recuadro **Mi horario** y elige la imagen de tu horario desde tu computadora. Si más adelante cambia, vuelve a pulsar el recuadro y elige la nueva.',
    tip: 'Si entraste con una cuenta, la imagen de tu horario también aparece en tu celular.',
    go: '/',
    rel: ['horario-vistazo'],
  },
  {
    id: 'horario-vistazo',
    title: 'Ver tu horario encima de cualquier ventana',
    a: 'Este es uno de los trucos más útiles de Frame: puedes ver tu horario **sin salir de lo que estás haciendo**, aunque estés en otro programa.\n\nLleva el ratón al **borde izquierdo de la pantalla** y déjalo quieto un momento (casi un segundo): tu horario aparecerá flotando encima de todo. Cuando apartes el ratón, se esconde solo.',
    tip: 'Para que funcione, primero sube la foto de tu horario en Inicio, en «Mi horario», y deja Frame abierta (aunque sea minimizada).',
    rel: ['horario-subir'],
  },
  {
    id: 'inicio-rendimiento',
    title: 'Los recuadros de «Rendimiento académico»',
    a: 'En **Inicio**, el recuadro **Rendimiento académico** reúne cuatro casillas que te dicen cómo vas con tus estudios.\n\nA la izquierda están la **calificación de ayer** (con un medidor y las horas que estudiaste) y tu **promedio de la semana**, con la tendencia de los últimos 7 días. A la derecha, arriba, tu **próxima tarea** por entregar y, abajo, tus **días de racha**: cuántos días seguidos has cumplido tu meta.',
    tip: 'Si prefieres ver minutos en lugar de notas, cambia al modo «Tiempo» en tus Ajustes.',
    go: '/',
    rel: ['nota-diaria', 'racha-que-es', 'modo-rendimiento-tiempo'],
  },
  {
    id: 'inicio-proxima-tarea',
    title: 'La casilla «Próxima tarea»',
    a: 'La casilla **Próxima tarea**, arriba a la derecha del recuadro «Rendimiento académico» de **Inicio**, te muestra la tarea pendiente que **vence primero**, para que nunca se te pase.\n\nVerás su nombre y su avance, la asignatura, cuánto falta para entregarla (esa pequeña etiqueta se pone **roja** cuando la fecha se acerca), la fecha de entrega, su importancia y su dificultad.\n\nSi la pulsas, puedes ir a la **Galería de tareas** o a la **asignatura** de esa tarea.',
    go: '/',
    rel: ['tarea-crear', 'notificaciones'],
  },
  {
    id: 'semana-en-datos',
    title: '«Tu semana en datos»',
    a: 'En **Inicio**, debajo del rendimiento académico, está **Tu semana en datos**: un resumen de cómo te fue en los últimos días.\n\nAhí ves tu **ritmo de estudio** día a día comparado con tu meta, tu **constancia** dibujada como un anillo que se completa, las **tareas culminadas** comparadas con la semana pasada, cómo repartiste el tiempo entre tus **asignaturas** y hasta la **canción** que más escuchaste.',
    go: '/',
    rel: ['ajustes-metas'],
  },
  {
    id: 'matriz-competencias',
    title: 'La matriz de competencias (radar)',
    a: 'En **Inicio** hay un gráfico con forma de telaraña llamado **matriz de competencias**. Cada punta es una de tus asignaturas y te muestra, en la escala de 0 a 20, **cuánto tienes pendiente** en cada una.\n\nFunciona así: cada asignatura empieza en 20 y baja un punto por cada tarea pendiente. Por ejemplo, con 2 tareas pendientes queda en 18 (AD); con 6, en 14 (A); con 10, en 10 (C).\n\nAsí ves de un vistazo en qué curso se te está acumulando el trabajo.',
    tip: 'Mide lo que te falta por hacer, no cuánto sabes. Al culminar tareas, el área del gráfico vuelve a crecer.',
    go: '/',
    rel: ['matriz-elegir'],
  },
  {
    id: 'matriz-elegir',
    title: 'Elegir las asignaturas del radar',
    a: 'Tú decides qué asignaturas aparecen en la matriz de competencias de **Inicio**. Necesitas tener al menos **tres asignaturas** creadas.',
    steps: [
      'En **Inicio**, junto al gráfico, pulsa el **lápiz** de «Nivel por asignatura» (o el botón **Elegir asignaturas** si todavía no lo configuraste).',
      'En el recuadro que se abre verás todas tus asignaturas, agrupadas bajo el nombre de su colección. **Marca las tarjetas** de las que quieres ver.',
      'Elige entre 3 y 10 asignaturas y pulsa **Guardar**. El gráfico se actualiza al instante.',
    ],
    tip: 'Si guardas sin ninguna asignatura marcada, la matriz se quita de Inicio.',
    go: '/',
    rel: ['matriz-competencias'],
  },
  {
    id: 'inicio-sin-asignatura',
    title: 'Tareas «Sin asignatura» en Inicio',
    a: 'Cuando apuntas una tarea con el botón **+** de arriba sin elegir asignatura, no se pierde: queda guardada al final de **Inicio**, en el bloque de tareas **Sin asignatura**.\n\nAhí puedes editarla y, cuando sepas a qué curso pertenece, usar **Colocar en una asignatura** para moverla a su lugar.',
    go: '/',
    rel: ['tarea-crear-rapida'],
  },
  {
    id: 'inicio-grabaciones',
    title: 'Grabaciones en Inicio',
    a: 'Tus grabaciones de voz se guardan en dos lugares, según cómo las guardaste:\n\nLas que guardaste **sin asignatura** aparecen al final de **Inicio**, de la más reciente a la más antigua. Las que asignaste a un curso las encuentras **dentro de esa asignatura**, en la sección **Asignaturas**.',
    go: '/',
    rel: ['grabar-nota', 'grabacion-detalles'],
  },
  // 1.6.2: las anotaciones del «+» guardadas sin asignatura.
  {
    id: 'anotaciones-sueltas',
    title: 'Las anotaciones de Inicio',
    a: 'Las anotaciones que escribes con el botón **+** de arriba sin elegir asignatura se guardan al final de **Inicio**, en el bloque **Anotaciones**, junto a tus grabaciones.\n\nCada una aparece como una tarjeta con sus primeras líneas. **Pulsa una para leerla entera**. Desde ahí puedes:',
    steps: [
      'Usar **Colocar en una asignatura**: eliges la tarjeta del curso y pulsas **Colocar**.',
      'O pulsar **Borrar**, que te pide un segundo clic para confirmar.',
    ],
    tip: 'Al colocarla en una asignatura, la anotación pasa a sus **Recursos**, en el bloque Anotaciones.',
    go: '/',
    rel: ['tarea-crear-rapida', 'inicio-sin-asignatura', 'inicio-grabaciones'],
  },
];

// Barra superior y notificaciones.
export const BARRA: Entry[] = [
  {
    id: 'barra-superior',
    title: 'La barra superior',
    a: 'La barra de arriba te acompaña en todas las secciones de Frame. Tiene esto:\n\nA la **izquierda**, el botón **+** para apuntar una tarea o una anotación desde cualquier lugar, y a su lado el botón de las **dos estrellas**, que abre el Centro de ayuda.\n\nEn el **centro** aparecen frases con tus datos recientes, que cambian solas.\n\nA la **derecha**, el **micrófono** para grabar una nota de voz y la **campana** con tus notificaciones.',
    tip: 'Cada botón se pinta de azul entero mientras su recuadro está abierto.',
    rel: ['tarea-crear-rapida', 'ayuda-barra', 'frase-personal', 'grabar-nota'],
  },
  {
    // 1.6.2: ya no se escribe una frase propia; salen solas de los datos.
    id: 'frase-personal',
    title: 'Las frases de la barra superior',
    a: 'Las frases que ves en el **centro de la barra de arriba** salen de lo que haces en Frame: cuánto estudiaste hoy o ayer, tu meta del día, las tareas que culminaste, tu próxima entrega, tus hábitos, tus días de racha o tu asignatura de la semana.\n\nCambian solas cada minuto y medio. Si quieres leer una con calma, **pon el ratón encima** y se quedará quieta.',
    tip: 'No hace falta escribirlas ni editarlas: Frame las arma sola. Si todavía no tienes datos, simplemente te saluda.',
    rel: ['barra-superior', 'enfoque-hoy'],
  },
  {
    id: 'notificaciones',
    title: 'La campana de notificaciones',
    a: 'La **campana**, arriba a la derecha, guarda todas tus notificaciones con su hora: tareas vencidas o que vencen pronto, recordatorios, el fin de tus sesiones de estudio, actualizaciones de Frame y avisos de conexión. El **número** sobre la campana indica cuántas no has leído.',
    steps: [
      'Pulsa la **campana** para ver la lista. Pulsa una notificación para ir directo a lo que avisa.',
      'Pulsa **Marcar como leído** para que desaparezca el número.',
      'Con el **engranaje**, arriba a la izquierda de la lista, puedes quitar o poner el **sonido**, desactivar las notificaciones o **borrarlas todas**.',
    ],
    tip: 'Lo que ya no está vigente, como una tarea que ya culminaste, se queda en la lista con un color más tenue.',
  },
  {
    id: 'sin-conexion-aviso',
    title: 'El aviso «Sin conexión»',
    a: 'Cuando tu computadora se queda sin internet, Frame te avisa con un mensaje breve **Sin conexión**, abajo a la izquierda, que luego se guarda en la campana.\n\nNo pasa nada: puedes **seguir trabajando con normalidad**. Todo se guarda en tu equipo y se sincroniza solo cuando vuelve la conexión.',
    tip: 'Si en la campana dice «Sin conexión con tu cuenta», significa que tu sesión en la nube se cerró. Pulsa ese aviso para volver a entrar; tus datos siguen intactos.',
    rel: ['sin-internet', 'sync-como-funciona'],
  },
];
