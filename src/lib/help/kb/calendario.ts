import type { HelpEntry } from '../search';

type Entry = Omit<HelpEntry, 'area'>;

// Calendario: el de la app (Local) y Google Calendar.
export const CALENDARIO: Entry[] = [
  {
    id: 'cal-intro',
    title: 'La interfaz Calendario',
    q: ['qué es la interfaz calendario', 'para qué sirve el calendario', 'calendario'],
    k: ['google calendar', 'local'],
    a: 'Calendario muestra tu Google Calendar integrado (si lo vinculas) y, con el botón «Local», el calendario propio de Frame, que funciona sin internet, con tus eventos y tus tareas con fecha.',
    go: '/calendario',
    rel: ['cal-local', 'cal-evento-crear', 'gcal-vincular'],
  },
  {
    id: 'cal-local',
    title: 'El calendario de la app (Local)',
    q: ['cómo uso el calendario sin google', 'qué es el botón local', 'calendario sin internet', 'calendario propio de frame'],
    k: ['local', 'calendario', 'sin internet', 'mes'],
    a: 'En Calendario, pulsa «Local» (en el conmutador Google / Local) para ver el calendario de la app: funciona sin internet, muestra tus eventos, los colores de las casillas y las tareas con fecha, y se sincroniza con tu cuenta.',
    tip: 'Cada equipo recuerda el último calendario que elegiste.',
    go: '/calendario',
    rel: ['cal-evento-crear', 'cal-varios-dias', 'cal-editar'],
  },
  {
    id: 'cal-evento-crear',
    title: 'Crear un evento en el calendario',
    q: ['cómo creo un evento', 'cómo pongo un feriado', 'cómo marco un examen en el calendario', 'cómo agrego un cumpleaños', 'cómo pongo mis vacaciones', 'marcar el aniversario del colegio', 'anotar una fecha importante', 'marcar un día especial'],
    k: ['evento', 'feriado', 'examen', 'cumpleanos', 'vacaciones', 'reunion', 'entrega', 'aniversario', 'colegio', 'marcar', 'fecha importante', 'dia especial'],
    a: 'En Calendario → «Local», pulsa «Evento» (a la derecha de la fila del mes) o pulsa un día y elige «Evento». Escribe el título, elige el tipo (día libre, vacaciones, evento institucional, evaluación, entrega, reunión, salida de estudio, cumpleaños, personal o recordatorio), las fechas «Desde» y «Hasta», si es todo el día o a una hora, el color y una nota opcional.',
    tip: 'Para varios días (p. ej. vacaciones), arrástralos en la cuadrícula y pulsa «Evento» en la barra que aparece. «Pintar las casillas» tiñe sus días con el color del evento. Si dejas el título vacío se usa el nombre del tipo.',
    go: '/calendario',
    rel: ['cal-editar', 'cal-varios-dias', 'cal-recordatorio'],
  },
  {
    id: 'cal-editar',
    title: 'Editar o borrar un evento',
    q: ['cómo edito un evento', 'cómo borro un evento del calendario', 'cómo cambio la fecha de un evento', 'eliminar feriado', 'cómo borro un evento del calendario', 'me equivoqué de fecha en un evento'],
    k: ['editar evento', 'eliminar evento', 'borrar evento', 'papelera'],
    a: 'En Calendario → «Local», pulsa el evento en la cuadrícula: se abre para editarlo, con «Eliminar» abajo. También puedes pulsar su día: salen todos sus eventos, cada uno con su papelera.',
    tip: 'Un evento de varios días se borra en todos sus días. Para quitar solo algunos, selecciónalos y vacíalos (papelera de la barra o Supr).',
    go: '/calendario',
    rel: ['cal-evento-crear', 'cal-varios-dias'],
  },
  {
    id: 'cal-dia-lleno',
    title: '«+N más» en un día del calendario',
    q: ['qué significa más en el calendario', 'no veo todos mis eventos de un día', 'día con muchos eventos'],
    k: ['mas', 'dia', 'eventos'],
    a: 'Si un día tiene más de lo que cabe, se muestra «+N más»: púlsalo y verás todo lo de ese día, con sus eventos y sus tareas.',
    tip: 'Cuántos elementos se ven en cada casilla depende del alto de la ventana.',
    go: '/calendario',
  },
  {
    id: 'cal-tareas',
    title: 'Las tareas en el calendario',
    q: ['por qué mis tareas salen en el calendario', 'cómo veo mis entregas en el calendario'],
    k: ['tareas', 'entregas', 'fecha'],
    a: 'Toda tarea con fecha de entrega aparece sola en su día. Pulsa el día y, en «Tareas que vencen», usa «Ver en Tareas» o «Ir a la asignatura».',
    tip: 'Desde el calendario las tareas no se cambian ni se borran: eso se hace en Tareas.',
    go: '/calendario',
    rel: ['tarea-crear'],
  },
  // 1.6.2: el calendario local se rediseñó (selección de varios días,
  // recordatorios con aviso y color de casilla aparte de los eventos).
  {
    id: 'cal-varios-dias',
    title: 'Elegir varios días del calendario',
    q: ['cómo selecciono varios días en el calendario', 'marcar una semana entera en el calendario', 'cómo vacío unos días del calendario', 'aplicar algo a varios días a la vez'],
    k: ['seleccionar', 'varios dias', 'arrastrar', 'mayus', 'rango', 'vaciar', 'semana'],
    a: 'En Calendario → «Local», arrastra sobre los días (o mayús + clic) para elegir varios. En la barra que aparece abajo puedes crear un evento o un recordatorio para todos, pintarlos de un color, quitarles el color o vaciarlos (papelera o Supr). Esc suelta la selección.',
    tip: 'Vaciar quita sus eventos y colores solo en esos días, después de confirmarlo. Las tareas nunca se tocan.',
    go: '/calendario',
    rel: ['cal-evento-crear', 'cal-color', 'cal-recordatorio'],
  },
  {
    id: 'cal-recordatorio',
    title: 'Un recordatorio en el calendario',
    q: ['cómo pongo un recordatorio en el calendario', 'recordatorio con hora en el calendario local', 'que el calendario me avise de un evento', 'aviso antes de un evento del calendario'],
    k: ['recordatorio', 'aviso', 'hora', 'calendario', 'evento', 'dia antes'],
    a: 'Un recordatorio es un evento con hora y aviso. En Calendario → «Local», pulsa un día → «Recordatorio» (o selecciona varios días → «Recordatorio»), elige la hora con las ruedas y el aviso: a la hora, 10 min, 30 min, 1 h o el día antes. Llega como notificación de Frame aunque la ventana esté en la bandeja.',
    tip: 'En varios días avisa cada día. A cualquier evento le puedes poner hora y aviso con «A una hora».',
    go: '/calendario',
    rel: ['cal-evento-crear', 'tarea-recordatorio', 'notificaciones-no-llegan'],
  },
  {
    id: 'cal-color',
    title: 'Dar color a las casillas del calendario',
    q: ['cómo pinto un día del calendario', 'cómo cambio el color de una casilla', 'cómo quito el color de un día', 'pintar varios días de un color'],
    k: ['color', 'pintar', 'casilla', 'casillas', 'tenir', 'quitar color'],
    a: 'En Calendario → «Local», pulsa el día y elige el color en «Color de la casilla». Para varias, arrástralas y elige el color en la barra de abajo. El círculo tachado quita el color.',
    tip: 'Un evento también puede teñir sus días: actívale «Pintar las casillas».',
    go: '/calendario',
    rel: ['cal-varios-dias', 'cal-evento-crear'],
  },
  {
    id: 'gcal-vincular',
    title: 'Vincular Google Calendar',
    q: ['cómo conecto google calendar', 'cómo veo mi calendario de google en frame', 'vincular calendario de google', 'cambiar la cuenta de google calendar'],
    k: ['google calendar', 'vincular', 'cuenta', 'sincronizar'],
    a: 'En Calendario, usa «Vincular cuenta» en la barra del pie y elige tu cuenta de Google. Tu Google Calendar aparece integrado; «Sincronizar» lo actualiza y «Cambiar de cuenta» usa otra.',
    tip: 'Necesita internet. Sin conexión verás los últimos datos sincronizados.',
    go: '/calendario',
    rel: ['tareas-google-calendar', 'cal-local'],
  },
];

// Gmail y Classroom integrados.
export const GOOGLE: Entry[] = [
  {
    id: 'gmail-usar',
    title: 'Usar Gmail dentro de Frame',
    q: ['cómo abro mi correo en frame', 'cómo uso gmail en frame', 'cómo vinculo mi gmail', 'ver correos sin salir de frame', 'puedo ver mi correo aquí', 'revisar mis correos en frame'],
    k: ['gmail', 'correo', 'vincular', 'correos', 'bandeja'],
    a: 'Abre «Gmail» en el menú lateral (como Calendario, Classroom y YouTube): tu correo aparece integrado en la ventana. Inicia sesión en él como en el navegador. Con «Vincular cuenta» (al pie) Frame además cuenta tus correos sin leer y lo muestra en el menú.',
    tip: 'Necesita internet.',
    go: '/gmail',
  },
  {
    id: 'classroom-usar',
    title: 'Usar Google Classroom dentro de Frame',
    q: ['cómo abro classroom', 'cómo veo mis clases de classroom', 'classroom en frame', 'cómo entro a classroom con mi cuenta del colegio', 'cómo entro a classroom', 'ver mis trabajos de classroom'],
    k: ['classroom', 'google', 'clases', 'trabajos'],
    a: 'Abre «Classroom» en el menú lateral: Classroom aparece integrado en la ventana. Entra con la cuenta de Google que usa tu colegio.',
    tip: 'Necesita internet.',
    go: '/classroom',
  },
];

// YouTube vuelve a la barra lateral (1.5.8).
GOOGLE.push({
  id: 'youtube-usar',
  title: 'Usar YouTube dentro de Frame',
  q: ['cómo abro youtube en frame', 'dónde está youtube', 'ver youtube sin salir de frame'],
  k: ['youtube', 'videos'],
  a: 'Abre «YouTube» en el menú lateral: el YouTube de siempre aparece integrado en la ventana, con tu sesión. Para guardar vídeos de estudio, usa «Añadir vídeo» en Estudio.',
  tip: 'Necesita internet.',
  go: '/youtube',
  rel: ['videos-estudio', 'musica-anadir'],
});
