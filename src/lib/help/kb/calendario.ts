import type { HelpEntry } from '../areas';

type Entry = Omit<HelpEntry, 'area'>;

// Calendario: el propio de Frame, local. Google Calendar dejó de integrarse en 1.6.3.
// (Estilo de las respuestas: ver basico.ts.)
export const CALENDARIO: Entry[] = [
  {
    id: 'cal-intro',
    title: 'La interfaz Calendario',
    a: '**Calendario** es tu agenda dentro de Frame. Lo encuentras en el menú de la izquierda, en el segundo bloque, debajo de Tareas.\n\nAhí ves el mes completo con tus **eventos** (exámenes, feriados, cumpleaños, vacaciones…), tus **recordatorios**, los **colores** que le das a cada día y, además, todas tus **tareas con fecha de entrega**, que aparecen solas en su día.\n\nFunciona sin internet.',
    go: '/calendario',
    rel: ['cal-evento-crear', 'cal-varios-dias', 'cal-local'],
  },
  {
    id: 'cal-local',
    title: 'Un calendario sin internet',
    a: 'El Calendario de Frame es **tuyo y funciona sin internet**: todo lo que anotas se guarda en tu equipo. Si entraste con una cuenta, además se sincroniza con tus otros dispositivos.\n\nMuestra tus eventos, los colores de cada día y tus tareas con fecha de entrega.',
    tip: 'Frame ya no se conecta con Google Calendar: ahora todo está en este calendario.',
    go: '/calendario',
    rel: ['cal-evento-crear', 'cal-varios-dias', 'cal-editar'],
  },
  {
    id: 'cal-evento-crear',
    title: 'Crear un evento en el calendario',
    a: 'Puedes anotar en el calendario cualquier fecha importante: un examen, un feriado, un cumpleaños o tus vacaciones.',
    steps: [
      'En **Calendario**, pulsa **Evento**, arriba a la derecha. (También puedes pulsar un día del calendario y elegir **Evento**).',
      'Escribe el **título** y elige el **tipo**: día libre, vacaciones, evento del colegio, evaluación, entrega, reunión, salida de estudio, cumpleaños, personal o recordatorio.',
      'Elige las fechas **Desde** y **Hasta**, y si dura todo el día o es a una hora concreta.',
      'Si quieres, elige un **color** y escribe una nota. Luego pulsa **Crear evento**.',
    ],
    tip: 'Para un evento de varios días, como unas vacaciones, arrastra el ratón sobre esos días en el calendario y pulsa «Evento» en la barra que aparece abajo. Si dejas el título vacío, se usa el nombre del tipo.',
    go: '/calendario',
    rel: ['cal-editar', 'cal-varios-dias', 'cal-recordatorio'],
  },
  {
    id: 'cal-editar',
    title: 'Editar o borrar un evento',
    a: 'En **Calendario**, **pulsa el evento** directamente en la cuadrícula: se abre para que cambies lo que necesites. Para borrarlo, pulsa **Eliminar**, abajo.\n\nTambién puedes pulsar el **día**: verás todos sus eventos, cada uno con su papelera.',
    tip: 'Un evento de varios días se borra en todos sus días. Si quieres quitarlo solo de algunos, selecciona esos días arrastrando el ratón y pulsa la papelera de la barra que aparece abajo.',
    go: '/calendario',
    rel: ['cal-evento-crear', 'cal-varios-dias'],
  },
  {
    id: 'cal-dia-lleno',
    title: '«+N más» en un día del calendario',
    a: 'Cuando un día tiene más eventos o tareas de los que caben en su casilla, aparece el texto **+N más** (por ejemplo, «+2 más»).\n\n**Púlsalo** y verás todo lo de ese día: sus eventos y sus tareas.',
    tip: 'Cuantos más elementos quepan en cada casilla depende del tamaño de la ventana: si la agrandas, verás más.',
    go: '/calendario',
  },
  {
    id: 'cal-tareas',
    title: 'Las tareas en el calendario',
    a: 'Toda tarea que tenga **fecha de entrega** aparece sola en el **Calendario**, en el día que vence. Así ves tus entregas junto a tus eventos.\n\nSi pulsas ese día, en el bloque **Tareas que vencen** puedes usar **Ver en Tareas** o **Ir a la asignatura** para ir directo a ella.',
    tip: 'Desde el calendario las tareas no se cambian ni se borran: eso se hace en la sección Tareas.',
    go: '/calendario',
    rel: ['tarea-crear'],
  },
  // 1.6.2: el calendario local se rediseñó (selección de varios días,
  // recordatorios con aviso y color de casilla aparte de los eventos).
  {
    id: 'cal-varios-dias',
    title: 'Elegir varios días del calendario',
    a: 'En **Calendario** puedes hacer algo en varios días a la vez, por ejemplo marcar una semana de vacaciones.\n\n**Arrastra el ratón** sobre los días que quieres (o pulsa el primero y luego, con la tecla **Mayús** presionada, el último). Abajo aparecerá una barra con opciones: crear un **evento** o un **recordatorio** para todos esos días, **pintarlos** de un color, quitarles el color o **vaciarlos** con la papelera.\n\nPara quitar la selección, pulsa **Esc**.',
    tip: 'Vaciar quita los eventos y colores solo de esos días, después de que lo confirmes. Tus tareas nunca se tocan.',
    go: '/calendario',
    rel: ['cal-evento-crear', 'cal-color', 'cal-recordatorio'],
  },
  {
    id: 'cal-recordatorio',
    title: 'Un recordatorio en el calendario',
    a: 'Un **recordatorio** es un evento con hora que te avisa con una notificación, para que no se te pase.',
    steps: [
      'En **Calendario**, pulsa el día y elige **Recordatorio**. (O selecciona varios días arrastrando y elige **Recordatorio** en la barra de abajo).',
      'Elige la **hora** girando las ruedas.',
      'Elige cuándo quieres el aviso: a la hora exacta, 10 minutos antes, 30 minutos antes, 1 hora antes o el día anterior.',
      'Pulsa **Crear recordatorio**.',
    ],
    tip: 'El aviso llega como notificación de Frame, aunque la tengas minimizada. Si lo pusiste en varios días, te avisará cada día.',
    go: '/calendario',
    rel: ['cal-evento-crear', 'tarea-recordatorio', 'notificaciones-no-llegan'],
  },
  {
    id: 'cal-color',
    title: 'Dar color a las casillas del calendario',
    a: 'Darle color a un día te ayuda a distinguirlo de un vistazo, por ejemplo los días de exámenes.\n\nEn **Calendario**, **pulsa el día** y elige un color en **Color de la casilla**. Para pintar varios días a la vez, arrástralos con el ratón y elige el color en la barra que aparece abajo.\n\nPara quitar el color, elige el **círculo tachado**.',
    tip: 'Un evento también puede pintar sus días: actívale la opción «Pintar las casillas» al crearlo.',
    go: '/calendario',
    rel: ['cal-varios-dias', 'cal-evento-crear'],
  },
  {
    id: 'gcal-vincular',
    title: 'Google Calendar',
    a: 'Frame ya no se conecta con Google Calendar. Ahora usa su **propio calendario**, que funciona sin internet y guarda todo en tu equipo.\n\nTus eventos de Google siguen disponibles en calendar.google.com. Si quieres tener algo también en Frame, créalo en el **Calendario** con el botón **Evento**.',
    go: '/calendario',
    rel: ['cal-local', 'cal-evento-crear'],
  },
];

// Gmail y Classroom integrados.
export const GOOGLE: Entry[] = [
  {
    id: 'gmail-usar',
    title: 'Usar Gmail dentro de Frame',
    a: 'Puedes revisar tu correo sin salir de Frame.\n\nEn el menú de la izquierda, en el bloque de Google, pulsa **Gmail**: tu correo aparece dentro de la ventana de Frame. La primera vez, inicia sesión igual que en el navegador.\n\nSi además pulsas **Vincular cuenta**, abajo, Frame podrá contarte cuántos correos sin leer tienes y te lo mostrará en el menú.',
    tip: 'Gmail necesita internet.',
    go: '/gmail',
  },
  {
    id: 'classroom-usar',
    title: 'Usar Google Classroom dentro de Frame',
    a: 'Si tu colegio usa Google Classroom, puedes abrirlo dentro de Frame.\n\nEn el menú de la izquierda, en el bloque de Google, pulsa **Classroom**: aparecerá dentro de la ventana. Entra con la **cuenta de Google de tu colegio** y verás tus clases y trabajos como siempre.',
    tip: 'Classroom necesita internet.',
    go: '/classroom',
  },
];

// YouTube vuelve a la barra lateral (1.5.8).
GOOGLE.push({
  id: 'youtube-usar',
  title: 'Usar YouTube dentro de Frame',
  a: 'En el menú de la izquierda, en el bloque de Google, pulsa **YouTube**: el YouTube de siempre aparece dentro de Frame, con tu sesión iniciada.\n\nSi quieres guardar vídeos para estudiar con ellos, usa los **Vídeos de estudio** de la sección Estudio.',
  tip: 'YouTube necesita internet.',
  go: '/youtube',
  rel: ['videos-estudio', 'musica-anadir'],
});
