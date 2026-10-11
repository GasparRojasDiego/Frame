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
    a: 'En Calendario, pulsa «Local» para ver el calendario de la app: funciona sin internet, muestra tus eventos y las tareas con fecha, y se sincroniza con tu cuenta.',
    go: '/calendario',
    rel: ['cal-evento-crear', 'cal-editar'],
  },
  {
    id: 'cal-evento-crear',
    title: 'Crear un evento en el calendario',
    q: ['cómo creo un evento', 'cómo pongo un feriado', 'cómo marco un examen en el calendario', 'cómo agrego un cumpleaños', 'cómo pongo mis vacaciones', 'marcar el aniversario del colegio', 'anotar una fecha importante', 'marcar un día especial'],
    k: ['evento', 'feriado', 'examen', 'cumpleanos', 'vacaciones', 'reunion', 'entrega', 'aniversario', 'colegio', 'marcar', 'fecha importante', 'dia especial'],
    a: 'En Calendario → «Local», pulsa «Evento». Escribe el título, elige el tipo (día libre, vacaciones, evento institucional, evaluación, entrega, reunión, salida de estudio, cumpleaños, personal o recordatorio), la fecha o un rango, el color y una descripción opcional.',
    tip: 'Como «Casilla» pinta el día entero (solo una por día); como «Actividad» es una etiqueta dentro del día (las que quieras). La vista previa muestra cómo quedará.',
    go: '/calendario',
    rel: ['cal-editar', 'cal-local'],
  },
  {
    id: 'cal-editar',
    title: 'Editar o borrar un evento',
    q: ['cómo edito un evento', 'cómo borro un evento del calendario', 'cómo cambio la fecha de un evento', 'eliminar feriado', 'cómo borro un evento del calendario', 'me equivoqué de fecha en un evento'],
    k: ['editar evento', 'eliminar evento', 'modo edicion', 'borrar evento'],
    a: 'En Calendario → «Local», activa el modo edición (el lápiz) y pulsa el día: se abren sus eventos, cada uno con botones para editarlo o eliminarlo, y uno para añadir otro a ese día.',
    go: '/calendario',
    rel: ['cal-evento-crear'],
  },
  {
    id: 'cal-dia-lleno',
    title: '«+N más» en un día del calendario',
    q: ['qué significa más en el calendario', 'no veo todos mis eventos de un día', 'día con muchos eventos'],
    k: ['mas', 'dia', 'eventos'],
    a: 'Cuando un día tiene más de tres elementos, el calendario muestra «+N más». Púlsalo para ver todos sus eventos, tareas y el tiempo estudiado ese día.',
    go: '/calendario',
  },
  {
    id: 'cal-tareas',
    title: 'Las tareas en el calendario',
    q: ['por qué mis tareas salen en el calendario', 'cómo veo mis entregas en el calendario'],
    k: ['tareas', 'entregas', 'fecha'],
    a: 'Toda tarea con fecha de entrega aparece sola en su día. Al pulsarla puedes ir a la galería de tareas o a su asignatura.',
    go: '/calendario',
    rel: ['tarea-crear'],
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
