import type { Tour, TourStep } from '@/lib/help/tour';

// ============================================================
// Recorridos «Descubrir», uno por respuesta de la ayuda (la clave es el id
// de la respuesta en kb/). Cada paso señala un elemento por su `data-tour`.
//
// REGLA: al cambiar un botón de sitio o de interfaz, corregir aquí su paso
// en la misma versión (igual que la respuesta escrita). El recorrido que no
// encuentra su botón lo dice y deja saltar el paso, pero no debe pasar.
// ============================================================

type Def = Omit<Tour, 'id'>;

// Pasos que se repiten.
const toSettings: TourStep = { el: 'perfil', say: 'Entra a tu perfil: el botón con tu nombre, abajo del menú.' };
const toAccount: TourStep = { el: 'cuenta-rueda', go: '/settings', say: 'Abre los ajustes de cuenta con esta rueda.' };
const quickTask: TourStep[] = [
  { el: 'crear-rapido', say: 'Pulsa el «+» de la barra superior: funciona desde cualquier interfaz.' },
  { el: 'crear-tarea', say: 'Elige «Tarea».' },
];
const openFirstSubject: TourStep = {
  el: 'asignatura-tarjeta',
  go: '/knowledge',
  say: 'Abre una asignatura pulsando su tarjeta.',
};
const NEEDS_SUBJECT = 'Primero crea una asignatura en «Asignaturas» → «Añadir».';
const NEEDS_TASK = 'Primero crea una tarea: pregúntame «cómo creo una tarea» y pulsa «Descubrir».';
const NEEDS_SONG = 'Primero reproduce una canción en «Música».';

const TOURS: Record<string, Def> = {
  // --- Lo básico ---
  'primeros-pasos': {
    title: 'Primeros pasos',
    steps: [
      { el: 'menu', say: 'Este es el menú: desde aquí llegas a cada interfaz de Frame.', next: true, pose: 'saluda' },
      { el: 'nav-knowledge', say: 'Empieza por tus asignaturas: entra en «Asignaturas».' },
      { el: 'asig-anadir', go: '/knowledge', say: 'Con «Añadir» creas cada asignatura, o eliges las del CNEB.', next: true },
      { el: 'nav-temporizador', say: 'Después, «Estudio»: aquí estudias con el temporizador.' },
      { el: 'enfoque-iniciar', go: '/temporizador', say: 'Pulsas «Iniciar» para estudiar y «Finalizar» para registrar la sesión.', next: true },
      { el: 'crear-rapido', say: 'Y con este «+» apuntas una tarea desde cualquier sitio.', next: true },
    ],
    done: '¡Ya conoces lo esencial! Pregúntame lo que quieras con el botón redondo de abajo a la derecha.',
  },
  'menu-lateral': {
    title: 'El menú lateral',
    steps: [{ el: 'menu', say: 'Cada botón abre una interfaz. El que está resaltado es en la que estás.', next: true }],
  },
  'menu-plegar': {
    title: 'Plegar el menú',
    steps: [{ el: 'menu-plegar', say: 'Pulsa el logo de Frame: el menú se pliega (y con otro clic vuelve).' }],
  },
  'tema-claro-oscuro': {
    title: 'Tema claro u oscuro',
    steps: [toSettings, { el: 'tema', go: '/settings', say: 'Elige claro, oscuro o el del dispositivo. Cambia al instante.', next: true }],
  },
  'ayuda-barra': {
    title: 'La ayuda',
    steps: [{ el: 'ayuda-boton', say: 'Este botón redondo abre la Ayuda: escribe tu duda con tus palabras y te respondo al instante, sin internet.', next: true }],
  },

  // --- Inicio ---
  'inicio-que-muestra': {
    title: 'Lo que hay en Inicio',
    steps: [
      { el: 'clima', go: '/', say: 'El clima de tu ciudad, por horas y por días.', next: true, pose: 'saluda' },
      { el: 'horario', go: '/', say: 'Tu horario: sube su foto y lo tienes siempre a mano.', next: true },
      { el: 'rendimiento', go: '/', say: 'Tu rendimiento: la nota de ayer, el promedio de la semana, la racha y la próxima tarea.', next: true },
      { el: 'semana-datos', go: '/', say: '«Tu semana en datos»: ritmo de estudio, constancia y más.', next: true },
      { el: 'radar', go: '/', say: 'Y la matriz de competencias por asignatura.', next: true },
    ],
  },
  'clima-ubicacion': {
    title: 'Cambiar la ciudad del clima',
    steps: [
      { el: 'clima-ubicacion', go: '/', say: 'Pulsa el nombre de la ciudad (o «Elegir ubicación»).' },
      { el: 'clima-buscar', say: 'Escribe tu ciudad y elígela en la lista. También puedes usar el GPS.', next: true },
    ],
  },
  'clima-pronostico': {
    title: 'El pronóstico',
    steps: [{ el: 'clima', go: '/', say: 'A la izquierda, el clima de ahora; al centro, las próximas horas; a la derecha, los próximos días.', next: true }],
  },
  'horario-subir': {
    title: 'Subir tu horario',
    steps: [{ el: 'horario', go: '/', say: 'Pulsa aquí y elige la imagen de tu horario: queda guardada en Inicio.' }],
  },
  'inicio-rendimiento': {
    title: 'Rendimiento académico',
    steps: [{ el: 'rendimiento', go: '/', say: 'Aquí ves la nota de ayer, el promedio semanal, tus días de racha y la próxima tarea.', next: true }],
  },
  'inicio-proxima-tarea': {
    title: 'La próxima tarea',
    steps: [{ el: 'rendimiento', go: '/', say: 'Abajo a la derecha está «Próxima tarea»: la entrega más cercana que tienes pendiente.', next: true }],
  },
  'semana-en-datos': {
    title: 'Tu semana en datos',
    steps: [{ el: 'semana-datos', go: '/', say: 'Tu semana, comparada con la anterior: ritmo de estudio, constancia y tareas.', next: true }],
  },
  'matriz-competencias': {
    title: 'La matriz de competencias',
    steps: [{ el: 'radar', go: '/', say: 'El radar muestra tu dominio en cada asignatura, calculado con tus tareas y sesiones.', next: true }],
  },
  'matriz-elegir': {
    title: 'Elegir las asignaturas del radar',
    steps: [{ el: 'radar', go: '/', say: 'Desde aquí eliges qué asignaturas entran en el radar.', next: true }],
  },
  'inicio-sin-asignatura': {
    title: 'Tareas sin asignatura',
    needs: 'Esta sección aparece cuando apuntas una tarea sin asignatura con el «+».',
    steps: [{ el: 'sin-asignatura', go: '/', say: 'Aquí quedan las tareas que apuntaste sin asignatura: edítalas y colócalas con calma.', next: true }],
  },
  'inicio-grabaciones': {
    title: 'Grabaciones en Inicio',
    needs: 'Aparecen cuando grabas una nota de voz sin asignatura.',
    steps: [{ el: 'grabaciones-inicio', go: '/', say: 'Al final de Inicio están tus grabaciones de voz sin asignatura.', next: true }],
  },

  // --- Barra superior ---
  'barra-superior': {
    title: 'La barra superior',
    steps: [{ el: 'barra-superior', say: 'A la izquierda, crear (+); al centro, tu frase; a la derecha, grabar y las notificaciones.', next: true }],
  },
  'frase-personal': {
    title: 'Tu frase personal',
    steps: [{ el: 'frase', say: 'Pulsa la frase del centro, escribe la tuya y pulsa Enter para guardarla.' }],
  },
  notificaciones: {
    title: 'Las notificaciones',
    steps: [{ el: 'campana', say: 'Pulsa la campana: ahí están los avisos de Frame (tareas, sesiones, actualizaciones).' }],
  },
  'tarea-crear-rapida': {
    title: 'Crear rápido',
    steps: [
      ...quickTask,
      { el: 'tarea-nombre', say: 'Escribe el nombre. Arriba eliges la asignatura (o «Sin asignatura»).', next: true },
      { el: 'tarea-anadir', say: 'Pulsa «Añadir Tarea» y listo.', next: true },
    ],
  },

  // --- Estudio ---
  'enfoque-intro': {
    title: 'La interfaz Estudio',
    steps: [{ el: 'nav-temporizador', say: 'Entra en «Estudio»: aquí estudias con temporizador o cronómetro.' }],
  },
  'enfoque-iniciar': {
    title: 'Empezar a estudiar',
    steps: [
      { el: 'nav-temporizador', say: 'Entra en «Estudio».' },
      { el: 'enfoque-duracion', go: '/temporizador', say: 'Si quieres, pulsa el reloj para fijar la duración.', next: true },
      { el: 'enfoque-iniciar', go: '/temporizador', say: 'Pulsa «Iniciar». Al acabar, «Finalizar» registra la sesión.' },
    ],
    done: '¡A estudiar! Cuando termines, pulsa «Finalizar» para registrar la sesión.',
  },
  'enfoque-modos': {
    title: 'Temporizador o cronómetro',
    steps: [{ el: 'modo-temporizador', go: '/temporizador', say: 'Temporizador cuenta hacia atrás; Cronómetro cuenta hacia arriba, sin límite.', next: true }],
  },
  'enfoque-duracion': {
    title: 'La duración del temporizador',
    steps: [
      { el: 'enfoque-duracion', go: '/temporizador', say: 'Pulsa el reloj.' },
      { say: 'Elige las horas y los minutos y confirma. El temporizador queda listo para «Iniciar».', next: true },
    ],
  },
  'enfoque-finalizar': {
    title: 'Terminar una sesión',
    steps: [{ el: 'enfoque-finalizar', go: '/temporizador', say: 'Con una sesión en marcha, pulsa «Finalizar», elige la asignatura y cuenta qué hiciste.', next: true }],
  },
  'enfoque-descartar': {
    title: 'Descartar una sesión',
    steps: [{ el: 'enfoque-finalizar', go: '/temporizador', say: 'Pulsa «Finalizar» y, en el recuadro, «Descartar»: la sesión no se registra.', next: true }],
  },
  'enfoque-anotar': {
    title: 'Anotar avances',
    steps: [
      { el: 'vista-flotante', go: '/temporizador', say: 'Con la sesión en marcha, abre este menú…' },
      { say: '…y elige «Anotar avance». Lo que escribas se une al resumen de la sesión.', next: true },
    ],
  },
  'vista-flotante': {
    title: 'La vista flotante',
    steps: [{ el: 'vista-flotante', go: '/temporizador', say: 'Desde aquí eliges cómo ver el reloj flotante, encima de otras ventanas.' }],
  },
  'enfoque-hoy': {
    title: 'Métricas de hoy',
    steps: [{ el: 'enfoque-metricas', go: '/temporizador', say: 'Aquí ves cuánto estudiaste hoy y en qué.', next: true }],
  },
  'enfoque-corregir': {
    title: 'Corregir una sesión',
    steps: [{ el: 'enfoque-calendario', go: '/temporizador', say: 'Pulsa el día en este calendario: verás sus sesiones para corregirlas o borrarlas.', next: true }],
  },
  'nota-diaria': {
    title: 'La nota del día',
    steps: [{ el: 'enfoque-calendario', go: '/temporizador', say: 'Cada día tiene su nota (AD, A, B o C) según tus metas, tus sesiones y tus tareas. Pulsa un día para ver el detalle.', next: true }],
  },
  'calendario-calificaciones': {
    title: 'El calendario de calificaciones',
    steps: [{ el: 'enfoque-calendario', go: '/temporizador', say: 'Cada casilla es un día con su nota. Pulsa una para ver sus sesiones.', next: true }],
  },
  'progreso-academico': {
    title: 'Progreso académico',
    steps: [{ el: 'progreso-academico', go: '/temporizador', say: 'Al final de Estudio: tu progreso por semana o por mes.', next: true }],
  },
  'videos-estudio': {
    title: 'Vídeos de estudio',
    steps: [{ el: 'enfoque-videos', go: '/temporizador', say: 'Pulsa la flecha: el recuadro cambia a tus vídeos de estudio.' }],
  },

  // --- Tareas ---
  'tareas-intro': {
    title: 'La interfaz Tareas',
    steps: [{ el: 'nav-tareas', say: 'Entra en «Tareas»: todas tus tareas pendientes, de todas las asignaturas.' }],
  },
  'tarea-crear': {
    title: 'Crear una tarea',
    steps: [
      ...quickTask,
      { el: 'tarea-nombre', say: 'Escribe el nombre de la tarea (y arriba, su asignatura).', next: true },
      { el: 'tarea-fecha', say: 'Si tiene fecha de entrega, ponla aquí.', next: true },
      { el: 'tarea-anadir', say: 'Pulsa «Añadir Tarea».', next: true },
    ],
    done: '¡Hecho! La encontrarás en «Tareas» y en su asignatura.',
  },
  'tarea-editar': {
    title: 'Editar una tarea',
    needs: NEEDS_TASK,
    steps: [
      { el: 'tarea-editar', go: '/tareas', say: 'Pulsa el lápiz de la tarea.' },
      { say: 'Cambia lo que quieras y guarda con el visto (o Ctrl+Enter).', next: true },
    ],
  },
  'tarea-progreso': {
    title: 'El avance de una tarea',
    needs: NEEDS_TASK,
    steps: [{ el: 'tarea-progreso', go: '/tareas', say: 'Arrastra esta barra para marcar cuánto llevas.', next: true }],
  },
  'tarea-culminar': {
    title: 'Culminar una tarea',
    needs: NEEDS_TASK,
    steps: [{ el: 'tarea-culminar', go: '/tareas', say: 'Pulsa aquí cuando la termines: pasa a «Archivadas» y cuenta en tu nota.' }],
  },
  'tarea-incompleta': {
    title: 'Marcar como incompleta',
    needs: NEEDS_TASK,
    steps: [
      { el: 'tarea-opciones', go: '/tareas', say: 'Abre «Más opciones» de la tarea.' },
      { say: 'Elige «Marcar como incompleta».', next: true },
    ],
  },
  'tarea-eliminar': {
    title: 'Eliminar una tarea',
    needs: NEEDS_TASK,
    steps: [
      { el: 'tarea-opciones', go: '/tareas', say: 'Abre «Más opciones» de la tarea.' },
      { say: 'Elige «Eliminar tarea». Con Ctrl+Z lo deshaces.', next: true },
    ],
  },
  'tarea-archivadas': {
    title: 'Tareas archivadas',
    steps: [{ el: 'tareas-archivadas', go: '/tareas', say: 'Pulsa el archivador: ahí están las culminadas y las incompletas.' }],
  },
  'tarea-ordenar': {
    title: 'Ordenar las tareas',
    steps: [{ el: 'tareas-filtros', go: '/tareas', say: 'Pulsa el filtro y elige el orden (por ejemplo, por proximidad de entrega).' }],
  },
  'tarea-filtros': {
    title: 'Filtrar tareas',
    steps: [{ el: 'tareas-filtros', go: '/tareas', say: 'Pulsa el filtro: importancia, dificultad, tipo, entrega…' }],
  },
  'tarea-importancia': {
    title: 'Importancia, tipo y dificultad',
    steps: [
      ...quickTask,
      { el: 'tarea-importancia', say: 'Aquí, la importancia (baja, media o alta).', next: true },
      { el: 'tarea-tipo', say: 'Aquí, el tipo: tarea, examen, proyecto, actividad…', next: true },
      { el: 'tarea-dificultad', say: 'Y aquí, la dificultad.', next: true },
    ],
  },
  'tarea-recordatorio': {
    title: 'Un recordatorio',
    steps: [...quickTask, { el: 'tarea-recordatorio', say: 'Pulsa la campanita y elige cada cuánto te aviso.' }],
  },
  'tarea-estimado': {
    title: 'Tiempo estimado',
    steps: [...quickTask, { el: 'tarea-estimado', say: 'Pulsa el reloj de arena y pon cuánto crees que te tomará.' }],
  },

  // --- Hábitos ---
  'habitos-intro': {
    title: 'La interfaz Hábitos',
    steps: [{ el: 'nav-habitos', say: 'Entra en «Hábitos»: tu semana de hábitos, día por día.' }],
  },
  'habito-crear': {
    title: 'Crear un hábito',
    steps: [
      { el: 'habito-anadir', go: '/habitos', say: 'Pulsa «Añadir un hábito».' },
      { el: 'habito-nombre', say: 'Escribe el hábito, por ejemplo «leer veinte minutos».', next: true },
      { el: 'habito-momento', say: 'Elige en qué momento del día va: mañana, tarde o noche.', next: true },
      { el: 'habito-frecuencia', say: 'Y con qué frecuencia: cada día o solo los días que elijas.', next: true },
      { el: 'habito-crear', say: 'Pulsa «Crear hábito».', next: true },
    ],
  },
  'habito-marcar': {
    title: 'Marcar un hábito',
    needs: 'Primero crea un hábito.',
    steps: [{ el: 'habito-dia', go: '/habitos', say: 'Marca la casilla del día cuando lo cumplas.' }],
  },
  'habito-semanas': {
    title: 'Semanas anteriores',
    steps: [{ el: 'habitos-semana-anterior', go: '/habitos', say: 'Con estas flechas vas a la semana anterior (o a la siguiente).', next: true }],
  },
  'habito-fases': {
    title: 'Mañana, tarde o noche',
    steps: [
      { el: 'habitos-editar', go: '/habitos', say: 'Pulsa el lápiz para editar tus hábitos.' },
      { say: 'Junto a cada nombre aparece el sol, la luna o el atardecer: elige la parte del día.', next: true },
    ],
  },
  'habito-frecuencia': {
    title: 'Qué días toca',
    steps: [
      { el: 'habitos-editar', go: '/habitos', say: 'Pulsa el lápiz para editar tus hábitos.' },
      { say: 'Junto a cada hábito aparece el calendario: elige qué días le tocan.', next: true },
    ],
  },
  'habito-renombrar': {
    title: 'Renombrar un hábito',
    steps: [
      { el: 'habitos-editar', go: '/habitos', say: 'Pulsa el lápiz.' },
      { say: 'Escribe el nombre nuevo sobre el anterior.', next: true },
    ],
  },
  'habito-archivar': {
    title: 'Archivar un hábito',
    steps: [{ el: 'habitos-archivar', go: '/habitos', say: 'Pulsa el archivador y elige qué hábitos archivar. Con la flecha circular los ves y recuperas.' }],
  },
  'habito-analisis': {
    title: 'El análisis de tus hábitos',
    steps: [{ el: 'habitos-analisis', go: '/habitos', say: 'Aquí está el análisis: cumplimiento, rachas y qué hábito se está apagando.', next: true }],
  },
  'habito-anillos': {
    title: 'Los anillos',
    steps: [{ el: 'habitos-analisis', go: '/habitos', say: 'Cada anillo es un hábito: se llena con los días que lo cumples.', next: true }],
  },

  // --- Asignaturas ---
  'asig-intro': {
    title: 'La interfaz Asignaturas',
    steps: [{ el: 'nav-knowledge', say: 'Entra en «Asignaturas»: tus materias y colecciones.' }],
  },
  'asig-crear': {
    title: 'Crear una asignatura',
    steps: [
      { el: 'asig-anadir', go: '/knowledge', say: 'Pulsa «Añadir».' },
      { el: 'asig-nombre', say: 'Escribe su nombre (o pasa a «Del CNEB» y márcalas).', next: true, optional: true },
      { el: 'asig-crear', say: 'Pulsa «Crear».', next: true },
    ],
  },
  'asig-coleccion': {
    title: 'Crear una colección',
    needs: 'Una colección agrupa al menos dos asignaturas.',
    steps: [
      { el: 'asig-anadir', go: '/knowledge', say: 'Pulsa «Añadir».' },
      { el: 'asig-vista-coleccion', say: 'Pasa a «Colección» con esta flecha.' },
      { el: 'coleccion-nombre', say: 'Ponle nombre y marca al menos dos asignaturas.', next: true },
      { el: 'asig-crear', say: 'Pulsa «Crear».', next: true },
    ],
  },
  'asig-abrir': {
    title: 'Abrir una asignatura',
    needs: NEEDS_SUBJECT,
    steps: [openFirstSubject],
  },
  'asig-editar': {
    title: 'Renombrar o eliminar una asignatura',
    needs: NEEDS_SUBJECT,
    steps: [
      openFirstSubject,
      { el: 'asig-editar', say: 'El lápiz la renombra…', next: true },
      { el: 'asig-eliminar', say: '…y la papelera la elimina.', next: true },
    ],
  },
  'asig-recursos': {
    title: 'Recursos de una asignatura',
    needs: NEEDS_SUBJECT,
    steps: [openFirstSubject, { el: 'asig-recurso', say: 'Aquí guardas notas, enlaces y archivos de la asignatura.', next: true }],
  },
  'asig-archivados': {
    title: 'Archivados de una asignatura',
    needs: NEEDS_SUBJECT,
    steps: [openFirstSubject, { el: 'asig-archivados', say: 'Aquí están sus tareas culminadas y los recursos que eliminaste.' }],
  },
  'asig-horario-importar': {
    title: 'Importar el horario del mes',
    steps: [{ el: 'asig-horario', go: '/knowledge', say: 'Pulsa «Horario»: te guío en tres pasos para pasar la imagen a clases.' }],
  },

  // --- Calendario ---
  'cal-intro': {
    title: 'La interfaz Calendario',
    steps: [{ el: 'nav-calendario', say: 'Entra en «Calendario»: tus eventos y las fechas de entrega.' }],
  },
  'cal-local': {
    title: 'El calendario de la app',
    steps: [{ el: 'cal-local', go: '/calendario', say: 'Pulsa «Local»: el calendario propio de Frame, que funciona sin internet.' }],
  },
  'cal-evento-crear': {
    title: 'Crear un evento',
    steps: [
      { el: 'cal-local', go: '/calendario', say: 'Primero, el calendario «Local».', optional: true },
      { el: 'cal-crear', go: '/calendario', say: 'Pulsa «Evento».' },
      { say: 'Elige el tipo, la fecha y el nombre, y guarda.', next: true },
    ],
  },
  'cal-editar': {
    title: 'Editar un evento',
    steps: [{ el: 'cal-editar', go: '/calendario', say: 'Pulsa el lápiz y después el día del evento: ahí lo editas o lo borras.' }],
  },
  'gcal-vincular': {
    title: 'Vincular Google Calendar',
    steps: [{ el: 'cal-google', go: '/calendario', say: 'Pulsa «Vincular cuenta» y entra con tu cuenta de Google.' }],
  },
  'gmail-usar': { title: 'Gmail', steps: [{ el: 'nav-gmail', say: 'Pulsa «Gmail»: tu correo, dentro de Frame.' }] },
  'classroom-usar': { title: 'Classroom', steps: [{ el: 'nav-classroom', say: 'Pulsa «Classroom»: tus clases, dentro de Frame.' }] },
  'youtube-usar': { title: 'YouTube', steps: [{ el: 'nav-youtube', say: 'Pulsa «YouTube».' }] },

  // --- Música ---
  'musica-intro': {
    title: 'La interfaz Música',
    steps: [{ el: 'nav-music', say: 'Entra en «Música»: tu biblioteca, con portadas y letras.' }],
  },
  'musica-anadir': {
    title: 'Importar tus canciones',
    steps: [
      { el: 'musica-importar', go: '/music', say: 'Pulsa «Importar».' },
      { el: 'importar-menu', say: 'Elige «Canciones…» o «Una carpeta…»: se abre el explorador de archivos de Windows.', pose: 'apunta' },
    ],
  },
  'musica-reproducir': {
    title: 'Reproducir',
    needs: 'Primero añade canciones.',
    steps: [{ el: 'cancion', go: '/music', say: 'Pulsa una canción para que suene.' }],
  },
  'musica-repetir': {
    title: 'Repetir',
    needs: NEEDS_SONG,
    steps: [{ el: 'player-repetir', say: 'Pulsa repetir: una vez repite la lista; mantenlo pulsado para repetir la canción.', next: true }],
  },
  'musica-favoritas': {
    title: 'Favoritas',
    steps: [
      { el: 'player-favorita', say: 'El corazón del reproductor la marca como favorita.', next: true, optional: true },
      { el: 'musica-favoritas', go: '/music', say: 'Y este botón muestra solo tus favoritas.', next: true },
    ],
  },
  'musica-buscar': {
    title: 'Buscar en tu biblioteca',
    steps: [{ el: 'musica-buscar', go: '/music', say: 'Escribe aquí el título o el artista.', next: true }],
  },
  'musica-eliminar': {
    title: 'Eliminar una canción',
    needs: 'Primero añade canciones.',
    steps: [{ el: 'cancion', go: '/music', say: 'En la tarjeta de la canción, el icono de la papelera la elimina.', next: true }],
  },
  'musica-reproduciendo': {
    title: 'Reproduciendo',
    needs: NEEDS_SONG,
    steps: [{ el: 'player-reproduciendo', say: 'Pulsa aquí: la canción a pantalla completa, con su letra.' }],
  },
  'musica-letras': {
    title: 'Letras',
    needs: NEEDS_SONG,
    steps: [{ el: 'player-reproduciendo', say: 'Abre «Reproduciendo»: ahí está la letra, que avanza con la canción.' }],
  },
  'musica-volumen': {
    title: 'El volumen',
    needs: NEEDS_SONG,
    steps: [{ el: 'player-volumen', say: 'Arrastra la barra para subir o bajar el volumen; el altavoz lo silencia.', next: true }],
  },
  'musica-controles': {
    title: 'Pausar, pasar o volver',
    needs: NEEDS_SONG,
    steps: [{ el: 'player-controles', say: 'El botón grande pausa y reanuda; las flechas pasan a la siguiente o vuelven a la anterior.', next: true }],
  },
  'letra-ajustar': {
    title: 'Ajustar la letra',
    needs: NEEDS_SONG,
    steps: [
      { el: 'player-reproduciendo', say: 'Abre «Reproduciendo».' },
      { say: 'Junto a la letra están los botones para adelantarla o atrasarla medio segundo.', next: true },
    ],
  },
  'musica-no-suena': {
    title: 'Si una canción no suena',
    needs: NEEDS_SONG,
    steps: [{ el: 'player-volumen', say: 'Primero, el volumen de Frame: que la barra no esté al mínimo ni el altavoz silenciado.', next: true }],
  },
  'playlist-crear': {
    title: 'Crear una playlist',
    steps: [
      { el: 'playlist-anadir', say: 'Pulsa «Añadir playlist» en el menú.' },
      { el: 'playlist-nombre', say: 'Ponle nombre y añade canciones desde la lista.', next: true },
      { el: 'playlist-crear', say: 'Pulsa «Crear playlist».', next: true },
    ],
  },

  // --- Grabaciones ---
  'grabar-nota': {
    title: 'Grabar una nota de voz',
    steps: [
      { el: 'grabar', say: 'Pulsa el micrófono (o Ctrl+Shift+F).' },
      { el: 'grabar-iniciar', say: 'Elige la asignatura si quieres y pulsa «Iniciar grabación».', next: true },
    ],
  },
  'grabacion-donde': {
    title: 'Dónde están tus grabaciones',
    needs: 'Aparecen aquí cuando grabas una nota sin asignatura; las demás, dentro de su asignatura.',
    steps: [{ el: 'grabaciones-inicio', go: '/', say: 'Las grabaciones sin asignatura están al final de Inicio; las demás, en su asignatura.', next: true }],
  },

  // --- Ajustes ---
  'ajustes-abrir': { title: 'Abrir Ajustes', steps: [toSettings] },
  'perfil-foto': {
    title: 'Tu foto de perfil',
    steps: [
      toSettings,
      { el: 'perfil-nombre', go: '/settings', say: 'Pulsa el lápiz junto a tu nombre: se activa la edición.' },
      { el: 'perfil-avatar', go: '/settings', say: 'Ahora pulsa tu foto y elige la imagen.' },
    ],
  },
  'perfil-nombre': {
    title: 'Tu nombre',
    steps: [toSettings, { el: 'perfil-nombre', go: '/settings', say: 'Pulsa el lápiz, escribe el nombre y pulsa Enter.' }],
  },
  'perfil-id': {
    title: 'El ID de tu cuenta',
    steps: [toSettings, { el: 'perfil-id', go: '/settings', say: 'Pulsa el ID para copiarlo.' }],
  },
  'ajustes-metas': {
    title: 'Tus metas de estudio',
    steps: [toSettings, { el: 'metas-editar', go: '/settings', say: 'Pulsa el lápiz, cambia los minutos de cada día y guarda con el visto.' }],
  },
  'modo-rendimiento-tiempo': {
    title: 'Rendimiento o Tiempo',
    steps: [toSettings, { el: 'modo-medicion', go: '/settings', say: '«Rendimiento» mide por nota; «Tiempo», por minutos estudiados.', next: true }],
  },
  'racha-que-es': {
    title: 'La racha',
    steps: [
      toSettings,
      { el: 'racha', go: '/settings', say: 'Tu racha: días seguidos cumpliendo tu meta.', next: true },
      { el: 'racha-editar', go: '/settings', say: 'Con este lápiz cambias la meta de racha.', next: true },
    ],
  },
  expediente: {
    title: 'Tu expediente',
    steps: [toSettings, { el: 'expediente', go: '/settings', say: 'Tu expediente: tiempo de estudio, tareas, rachas y más.', next: true }],
  },
  'ajustes-cuenta-rueda': { title: 'Ajustes de cuenta', steps: [toSettings, toAccount] },
  'docs-info': {
    title: 'Información de la app',
    steps: [toSettings, { el: 'doc-info', go: '/settings', say: 'Al final: información, términos y cómo reportar un error.', next: true }],
  },
  'informes-centro': {
    title: 'El centro de informes',
    steps: [toSettings, { el: 'informes', go: '/settings', say: 'Aquí generas tus informes: general, rendimiento, pendientes y hábitos.', next: true }],
  },
  'informe-pdf': {
    title: 'Guardar un informe',
    steps: [
      toSettings,
      { el: 'informes-tipos', go: '/settings', say: 'Elige el informe.', next: true },
      { el: 'informe-pdf', go: '/settings', say: '«PDF» lo imprime o guarda como PDF; «Word» lo deja editable.', next: true },
    ],
  },
  'informe-general': {
    title: 'Informe general',
    steps: [toSettings, { el: 'informes', go: '/settings', say: 'Pestaña «General»: elige denso o síntesis y pulsa PDF o Word.', next: true }],
  },
  'informe-rendimiento': {
    title: 'Informe de rendimiento',
    steps: [toSettings, { el: 'informes-tipos', go: '/settings', say: 'Elige «Rendimiento», el periodo, y pulsa PDF o Word.', next: true }],
  },
  'informe-pendientes': {
    title: 'Informe de pendientes',
    steps: [toSettings, { el: 'informes-tipos', go: '/settings', say: 'Elige «Pendientes» y pulsa PDF o Word.', next: true }],
  },
  'informe-habitos': {
    title: 'Informe de hábitos',
    steps: [toSettings, { el: 'informes-tipos', go: '/settings', say: 'Elige «Hábitos», el periodo, y pulsa PDF o Word.', next: true }],
  },

  'informe-no-abre': {
    title: 'Dónde queda el informe',
    steps: [toSettings, { el: 'informes', go: '/settings', say: 'El Word va a Descargas; el PDF se guarda desde el diálogo de impresión, donde eliges la carpeta.', next: true }],
  },
  'clima-no-carga': {
    title: 'Si el clima no carga',
    steps: [{ el: 'clima-ubicacion', go: '/', say: 'Pulsa aquí y busca tu ciudad a mano: queda guardada.' }],
  },
  'datos-perdidos': {
    title: 'Recuperar lo borrado',
    steps: [{ el: 'tareas-archivadas', go: '/tareas', say: 'Las culminadas e incompletas están aquí, en «Archivadas». Lo recién borrado vuelve con Ctrl + Z.' }],
  },
  'tarea-mover-asignatura': {
    title: 'Tareas sin asignatura',
    needs: 'Esta sección aparece cuando apuntas una tarea sin asignatura con el «+».',
    steps: [{ el: 'sin-asignatura', go: '/', say: 'Las tareas sin asignatura se colocan desde aquí, con «Colocar en una asignatura».', next: true }],
  },

  // --- Cuenta ---
  'cerrar-sesion': {
    title: 'Cerrar sesión',
    steps: [toSettings, toAccount, { el: 'cerrar-sesion', say: 'Este botón cierra la sesión (te pregunta antes).', next: true }],
  },
  'eliminar-cuenta': {
    title: 'Eliminar tu cuenta',
    steps: [
      toSettings,
      toAccount,
      { el: 'eliminar-cuenta', say: 'Este botón elimina tu cuenta o tus datos. Ojo: no se puede deshacer, y te lo pregunta antes.', next: true, pose: 'mira' },
    ],
  },
  'invitado-vincular': {
    title: 'Vincular tu cuenta',
    needs: 'La «G» solo aparece si estás como invitado.',
    steps: [{ el: 'vincular-g', say: 'Pulsa la «G» junto a tu perfil y entra con Google o con tu correo: todo lo tuyo pasa a la cuenta.' }],
  },
  'actualizar-frame': {
    title: 'Actualizar Frame',
    needs: 'El botón aparece junto a tu perfil cuando hay una versión nueva.',
    steps: [{ el: 'actualizar', say: 'Pulsa el aviso de versión nueva y luego «Actualizar ahora».' }],
  },

  // --- Extensiones ---
  'ext-que-son': {
    title: 'Las extensiones',
    steps: [{ el: 'extensiones', go: '/ayuda', say: 'Pulsa el «+» de la barra de la Ayuda: ahí están las extensiones.' }],
  },
  'ext-notion': {
    title: 'Importar de Notion',
    steps: [
      { el: 'extensiones', go: '/ayuda', say: 'Pulsa el «+» de la barra de la Ayuda.' },
      { el: 'ext-notion', say: 'Añade «Notion» y elige el archivo que exportaste de Notion.', next: true },
    ],
  },
};

export function tourFor(entryId: string): Tour | null {
  const def = TOURS[entryId];
  return def ? { id: entryId, ...def } : null;
}

/** Para las pruebas: todos los recorridos con sus ids. */
export function allTours(): Tour[] {
  return Object.entries(TOURS).map(([id, def]) => ({ id, ...def }));
}
