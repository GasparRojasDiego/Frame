import type { HelpAreaId, HelpEntry } from '../search';

// ============================================================
// Respuestas añadidas en la 1.6.0: funciones que no tenían respuesta propia
// y los problemas más frecuentes, con lo que de verdad hace la app.
// ============================================================

type Entry = Omit<HelpEntry, 'area'>;

const TAREAS_MAS: Entry[] = [
  {
    id: 'tarea-mover-asignatura',
    title: 'Pasar una tarea a otra asignatura',
    q: [
      'cómo cambio la asignatura de una tarea',
      'cómo muevo una tarea a otro curso',
      'puse la tarea en la materia equivocada',
      'cambiar de curso una tarea',
    ],
    k: ['mover', 'cambiar', 'asignatura', 'equivocada', 'otra'],
    a: 'Una tarea que ya tiene asignatura no se puede pasar a otra: créala de nuevo en la correcta y elimina la equivocada (Ctrl + Z la recupera si te arrepientes). Las que apuntaste con «+» sin asignatura sí se colocan después, desde Inicio, con «Colocar en una asignatura».',
    rel: ['tarea-crear', 'tarea-eliminar', 'inicio-sin-asignatura'],
  },
];

const MUSICA_MAS: Entry[] = [
  {
    id: 'musica-volumen',
    title: 'El volumen de la música',
    q: ['cómo subo el volumen', 'cómo bajo el volumen de la música', 'cómo silencio la música', 'cómo quito el sonido de la canción', 'mute'],
    k: ['volumen', 'silenciar', 'mute', 'sonido', 'altavoz'],
    a: 'En el reproductor de abajo, a la derecha, arrastra la barra del volumen; el altavoz que está a su lado silencia la música y, pulsado otra vez, la devuelve.',
    tip: 'Ese volumen es solo el de Frame: si no oyes nada, revisa también el de Windows.',
    go: '/music',
    rel: ['musica-controles', 'musica-no-suena'],
  },
  {
    id: 'musica-controles',
    title: 'Pausar, pasar o volver a una canción',
    q: ['cómo paso a la siguiente canción', 'cómo vuelvo a la canción anterior', 'cómo pauso la música', 'cómo adelanto la canción', 'cómo salto una canción'],
    k: ['siguiente', 'anterior', 'pausa', 'pausar', 'saltar', 'adelantar', 'reproductor'],
    a: 'En el reproductor de abajo: el botón grande pausa y reanuda; las flechas de sus lados pasan a la siguiente o vuelven a la anterior. Para ir a otro momento de la canción, pulsa o arrastra la barra de tiempo.',
    tip: 'En «Reproduciendo» (pulsando la portada) también puedes tocar un verso de la letra para saltar a ese momento.',
    go: '/music',
    rel: ['musica-repetir', 'musica-volumen', 'musica-reproduciendo'],
  },
  {
    id: 'letra-ajustar',
    title: 'La letra va adelantada, atrasada o no es la correcta',
    q: ['la letra no coincide con la canción', 'la letra va atrasada', 'la letra está mal', 'cambiar la letra de una canción', 'la letra sale antes'],
    k: ['letra', 'desfasada', 'adelantada', 'atrasada', 'equivocada', 'fuente', 'sincronizar'],
    a: 'Abre «Reproduciendo» (pulsa la portada del reproductor). Si la letra va desfasada, muévela de medio segundo en medio segundo con los botones de ajuste: el cambio se guarda para esa canción. Si la letra no corresponde a la canción, vuelve a importarla con el .lrc correcto.',
    go: '/music',
    rel: ['musica-reproduciendo', 'musica-letras'],
  },
];

const PROBLEMAS_MAS: Entry[] = [
  {
    id: 'musica-no-suena',
    title: 'Una canción no suena o se salta sola',
    q: ['la canción no se reproduce', 'no se escucha la música', 'la música no suena', 'pasa a la siguiente canción sola', 'la canción se queda en cero'],
    k: ['no suena', 'reproducir', 'saltar', 'cancion', 'audio', 'silencio'],
    a: 'Si una canción no se puede leer (un archivo dañado o incompleto), Frame la salta y pasa a la siguiente para no quedarse parado. Bórrala y vuelve a importarla. Si ninguna suena, revisa el volumen del reproductor y el de Windows.',
    tip: 'En Frame para Android, las canciones grandes se quedaban en 0:00 hasta la 1.0.12: actualiza la app.',
    rel: ['musica-volumen', 'musica-anadir'],
  },
  {
    id: 'datos-perdidos',
    title: 'Se borraron mis tareas (o algo desapareció)',
    q: ['borré una tarea sin querer', 'mis tareas desaparecieron', 'perdí mis datos', 'se eliminó todo', 'recuperar algo que borré'],
    k: ['borrado', 'desaparecio', 'perdi', 'recuperar', 'eliminado', 'datos'],
    a: 'Si lo acabas de borrar, pulsa Ctrl + Z: deshace el último borrado. Las tareas culminadas o incompletas no se pierden: están en «Archivadas» (en Tareas, y dentro de cada asignatura). Si entraste en otro dispositivo, comprueba que sea la MISMA cuenta: tus datos vuelven solos desde la nube.',
    tip: 'Con cuenta, cada cambio se respalda en la nube. Como invitado, los datos viven solo en ese equipo.',
    rel: ['deshacer', 'tarea-archivadas', 'problema-datos-no-aparecen'],
  },
  {
    id: 'notificaciones-no-llegan',
    title: 'No me llegan las notificaciones',
    q: ['no me avisa de las tareas', 'no salen los recordatorios', 'frame no me notifica', 'no recibo avisos', 'no me suena el recordatorio'],
    k: ['notificaciones', 'windows', 'permiso', 'recordatorio', 'aviso'],
    a: 'Frame avisa con las notificaciones de Windows. Revisa en Configuración de Windows → Sistema → Notificaciones que estén activadas para Frame y que el modo «No molestar» (o «Asistente de concentración») esté apagado. Frame tiene que estar abierta (puede estar minimizada).',
    rel: ['tarea-recordatorio', 'notificaciones', 'temporizador-aviso'],
  },
  {
    id: 'frame-no-abre',
    title: 'Frame no abre o se queda en blanco',
    q: ['frame no inicia', 'la app no carga', 'se queda en negro', 'pantalla en blanco al abrir', 'abro frame y no pasa nada'],
    k: ['abrir', 'inicia', 'blanco', 'negro', 'carga', 'webview'],
    a: 'Cierra Frame del todo (también desde el icono junto al reloj de Windows, si está ahí) y vuelve a abrirla. Si sigue igual, instala encima la última versión desde la página oficial de Frame: tus datos se conservan. Frame usa el motor WebView2 de Windows, que el instalador repara si falta.',
    rel: ['problema-lento', 'actualizar-frame'],
  },
  {
    id: 'clima-no-carga',
    title: 'El clima no carga',
    q: ['no aparece el clima', 'dice que no pudo detectar mi ubicación', 'el clima sale vacío', 'el clima está mal'],
    k: ['clima', 'ubicacion', 'gps', 'carga', 'ciudad'],
    a: 'El clima necesita internet. Si dice que no pudo detectar tu ubicación, pulsa «Elegir ubicación» (o el nombre de la ciudad) y busca tu ciudad a mano: queda guardada.',
    go: '/',
    rel: ['clima-ubicacion', 'clima-pronostico'],
  },
  {
    id: 'google-no-entra',
    title: 'No puedo entrar con Google',
    q: ['falla continuar con google', 'no funciona el inicio con google', 'se queda cargando al entrar con google', 'google no me deja entrar'],
    k: ['google', 'entrar', 'ventana', 'cuenta', 'error'],
    a: 'Al pulsar «Continuar con Google» se abre una ventana con la página de Google: termina ahí el acceso. Si la cerraste o pasaron más de 5 minutos, pulsa el botón otra vez. Comprueba tu internet. También puedes entrar con tu correo y tu contraseña de Frame.',
    rel: ['entrar-cuenta', 'contrasena-olvidada'],
  },
];

const INFORMES_MAS: Entry[] = [
  {
    id: 'informe-no-abre',
    title: 'Dónde queda el informe (o no se abre)',
    q: ['dónde se guardó mi informe', 'no encuentro el informe que descargué', 'el informe no se abre', 'no se descarga el pdf', 'dónde está el word del informe'],
    k: ['informe', 'pdf', 'word', 'descargas', 'guardar', 'abrir'],
    a: 'El de Word se guarda en tu carpeta Descargas y el aviso de «informe listo» lo abre con un clic. El PDF no se descarga: se abre el diálogo de impresión, y ahí eliges «Guardar como PDF» (o «Microsoft Print to PDF») y la carpeta.',
    tip: 'Si el Word no abre, necesitas un programa que lea .docx (Word, LibreOffice o Google Docs).',
    go: '/settings',
    rel: ['informe-pdf', 'informes-centro'],
  },
];

const ENFOQUE_MAS: Entry[] = [
  {
    id: 'temporizador-aviso',
    title: 'El aviso al terminar la sesión',
    q: ['suena algo cuando acaba el temporizador', 'cómo sé que terminó mi sesión', 'no escuché el final del pomodoro', 'alarma del temporizador'],
    k: ['alarma', 'sonido', 'aviso', 'terminar', 'temporizador'],
    a: 'Cuando el temporizador llega a cero, Frame avisa con una notificación de Windows y un sonido, aunque estés en otra ventana. Si no llega, revisa las notificaciones de Windows para Frame y el volumen del equipo.',
    go: '/temporizador',
    rel: ['enfoque-finalizar', 'notificaciones-no-llegan'],
  },
];

export const MAS: [HelpAreaId, Entry[]][] = [
  ['enfoque', ENFOQUE_MAS],
  ['informes', INFORMES_MAS],
  ['tareas', TAREAS_MAS],
  ['musica', MUSICA_MAS],
  ['problemas', PROBLEMAS_MAS],
];
