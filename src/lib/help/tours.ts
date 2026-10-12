import type { Tour, TourStep } from '@/lib/help/tour';

// ============================================================
// Recorridos «Mostrar cómo», uno por respuesta de la ayuda (la clave es el id
// de la respuesta en kb/). Cada paso señala un elemento por su `data-tour`.
//
// REGLA: al cambiar un botón de sitio o de interfaz, corregir aquí su paso
// en la misma versión (igual que la respuesta escrita). El recorrido que no
// encuentra su botón lo dice y deja saltar el paso, pero no debe pasar.
// ============================================================

type Def = Omit<Tour, 'id'>;

// Pasos que se repiten.
const toSettings: TourStep = { el: 'perfil', say: 'Entra a tu perfil: el botón con tu nombre, abajo del menú.' };
// 1.6.2: la rueda abre un menú pequeño (no un recuadro): sus botones se
// señalan con el menú abierto.
const toAccount: TourStep = { el: 'cuenta-rueda', go: '/settings', say: 'Abre el menú de tu cuenta con esta rueda.' };
// 1.6.3: los informes vuelven a Ajustes, en su propio recuadro.
const toReports: TourStep = { el: 'informes', go: '/settings', say: 'En Ajustes, el recuadro «Informes».', next: true };
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
const NEEDS_TASK = 'Primero crea una tarea: pregúntame «cómo creo una tarea» y pulsa «Mostrar cómo».';
const NEEDS_SONG = 'Primero reproduce una canción en «Música».';

const TOURS: Record<string, Def> = {
  // --- Lo básico ---
  'primeros-pasos': {
    title: 'Primeros pasos',
    steps: [
      { el: 'menu', say: 'Este es el menú: desde aquí llegas a cada interfaz de Frame.', next: true, pose: 'saluda' },
      { el: 'nav-knowledge', say: 'Empieza por tus asignaturas: entra en «Asignaturas».' },
      { el: 'asig-anadir', go: '/knowledge', say: 'Con «Añadir» creas cada asignatura (o la eliges entre las áreas del CNEB).', next: true },
      { el: 'nav-temporizador', say: 'Después, «Estudio»: aquí estudias con el temporizador.' },
      { el: 'enfoque-iniciar', go: '/temporizador', say: 'Pulsas «Iniciar» para estudiar y «Finalizar» para registrar la sesión.', next: true },
      { el: 'crear-rapido', say: 'Y con este «+» apuntas una tarea desde cualquier sitio.', next: true },
    ],
    done: '¡Ya conoces lo esencial! Si te surge una duda, abre el Centro de ayuda desde la barra superior.',
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
    steps: [{ el: 'ayuda-boton', say: 'Este botón abre el Centro de ayuda: escribe tu duda o elige un tema. Funciona sin internet.', next: true }],
  },

  // --- Inicio ---
  'inicio-que-muestra': {
    title: 'Lo que hay en Inicio',
    steps: [
      { el: 'clima', go: '/', say: 'El clima de tu ciudad, por horas y por días.', next: true, pose: 'saluda' },
      { el: 'horario', go: '/', say: 'Tu horario: sube su foto y lo tienes siempre a mano.', next: true },
      { el: 'rendimiento', go: '/', say: 'Tu rendimiento: la nota de ayer y el promedio de la semana; a la derecha, la próxima tarea y los días de racha.', next: true },
      { el: 'semana-datos', go: '/', say: '«Tu semana en datos»: ritmo de estudio, constancia y más.', next: true },
      { el: 'radar', go: '/', say: 'La matriz de competencias por asignatura.', next: true },
      // Solo existe si guardaste alguna anotación sin asignatura: si no, se salta.
      { el: 'anotaciones-inicio', go: '/', say: 'Y al final, las anotaciones que guardaste sin asignatura.', next: true, optional: true },
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
    steps: [{ el: 'rendimiento', go: '/', say: 'A la izquierda, la nota de ayer y el promedio semanal; a la derecha, la próxima tarea arriba y tus días de racha abajo.', next: true }],
  },
  'inicio-proxima-tarea': {
    title: 'La próxima tarea',
    steps: [
      {
        el: 'proxima-tarea',
        go: '/',
        say: 'Arriba a la derecha está «Próxima tarea»: la entrega más cercana, con su avance, cuánto falta, su importancia y su dificultad. Púlsala para ir a la tarea o a su asignatura.',
        next: true,
      },
    ],
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
    steps: [
      // El lápiz siempre está (desactivado con menos de tres asignaturas): lo dice el paso.
      { el: 'matriz-elegir', go: '/', say: 'Pulsa el lápiz de «Nivel por asignatura» (se activa cuando tienes al menos tres asignaturas).' },
      { say: 'Abre una colección, marca entre 3 y 10 asignaturas en sus tarjetas y pulsa «Guardar».', next: true },
    ],
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
  'anotaciones-sueltas': {
    title: 'Anotaciones en Inicio',
    needs: 'Aparecen cuando guardas una anotación sin asignatura con el «+».',
    steps: [
      {
        el: 'anotaciones-inicio',
        go: '/',
        say: 'Al final de Inicio están tus anotaciones sin asignatura: pulsa una para leerla, colocarla en una asignatura o borrarla.',
        next: true,
      },
    ],
  },

  // --- Barra superior ---
  'barra-superior': {
    title: 'La barra superior',
    steps: [{ el: 'barra-superior', say: 'A la izquierda, crear (+) y el Centro de ayuda; al centro, frases con tus datos; a la derecha, grabar y las notificaciones.', next: true }],
  },
  'frase-personal': {
    title: 'Las frases de la barra',
    steps: [{ el: 'frase', say: 'Estas frases salen de tus datos recientes y cambian solas; pasa el ratón por encima para detener una.', next: true }],
  },
  notificaciones: {
    title: 'Las notificaciones',
    steps: [{ el: 'campana', say: 'Pulsa la campana: ahí están los avisos de Frame (tareas, sesiones, actualizaciones).' }],
  },
  'tarea-crear-rapida': {
    title: 'Crear rápido',
    steps: [
      ...quickTask,
      { el: 'crear-atras', say: 'Con esta flecha vuelves a elegir entre «Tarea» y «Anotación».', next: true },
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
      { say: '…y elige «Anotar avance». Escribe; arriba a la derecha está «Enfoque (opcional)» y debajo, la asignatura y la tarea.', next: true },
    ],
  },
  'vista-flotante': {
    title: 'La vista flotante',
    steps: [{ el: 'vista-flotante', go: '/temporizador', say: 'Desde aquí eliges cómo ver el reloj flotante, encima de otras ventanas. «Ocultar» sale cuando ya está abierto.' }],
  },
  'enfoque-hoy': {
    title: 'Métricas de hoy',
    steps: [
      { el: 'enfoque-metricas', go: '/temporizador', say: 'Aquí ves cada sesión de hoy como una tarjeta: su asignatura, el tiempo y el rendimiento.', next: true },
      { el: 'enfoque-sesion', go: '/temporizador', say: 'Pulsa una tarjeta para ver su detalle: horario, tareas avanzadas, nota del día y anotaciones.', next: true, optional: true },
    ],
  },
  'enfoque-corregir': {
    title: 'Corregir una sesión',
    needs: 'Solo las sesiones de hoy se corrigen: registra una sesión y vuelve a intentarlo.',
    steps: [
      { el: 'enfoque-sesion-corregir', go: '/temporizador', say: 'Pulsa el lápiz de la sesión de hoy que quieras corregir.' },
      { say: 'Cambia el enfoque, las asignaturas o lo que hiciste y guarda. Para eliminarla, abre su tarjeta y pulsa «Eliminar».', next: true },
    ],
  },
  'nota-diaria': {
    title: 'La nota del día',
    steps: [{ el: 'enfoque-calendario', go: '/temporizador', say: 'Cada día tiene su nota (AD, A, B o C) según tus metas, tus sesiones y tus tareas. Pulsa un día para ver el detalle.', next: true }],
  },
  'calendario-calificaciones': {
    title: 'El calendario de calificaciones',
    steps: [
      {
        el: 'enfoque-calendario',
        go: '/temporizador',
        say: 'Cada casilla es un día con su nota. Pulsa una: verás sus sesiones como tarjetas; ábrelas para ver el detalle, corregirlas o borrarlas (solo las de hoy).',
        next: true,
      },
    ],
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
      { el: 'asig-nombre', say: 'Escribe su nombre, o pulsa una del CNEB, aquí debajo.', next: true, optional: true },
      { el: 'asig-cneb', say: 'Estas son las áreas del CNEB: pulsar una escribe su nombre.', next: true, optional: true },
      { el: 'asig-crear', say: 'Pulsa «Crear».', next: true },
    ],
  },
  'asig-coleccion': {
    title: 'Crear una colección',
    needs: 'Una colección agrupa al menos dos asignaturas.',
    steps: [
      { el: 'asig-anadir', go: '/knowledge', say: 'Pulsa «Añadir».' },
      { el: 'asig-vista-coleccion', say: 'Pasa a «Colección» con esta flecha.' },
      { el: 'coleccion-nombre', say: 'Ponle nombre y elige al menos dos asignaturas en las tarjetas.', next: true },
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
    steps: [{ el: 'nav-calendario', say: 'Entra en «Calendario»: el calendario propio de Frame, que funciona sin internet.' }],
  },
  'cal-evento-crear': {
    title: 'Crear un evento',
    steps: [
      { el: 'cal-crear', go: '/calendario', say: 'Pulsa «Evento».' },
      { say: 'Escribe el título, elige el tipo, las fechas y el color, y pulsa «Crear evento».', next: true },
    ],
  },
  // 1.6.2: el lápiz del modo edición ya no existe; la marca está en la cuadrícula.
  'cal-editar': {
    title: 'Editar un evento',
    steps: [
      { el: 'cal-editar', go: '/calendario', say: 'Pulsa el evento en el calendario para editarlo o borrarlo (o pulsa su día: ahí están todos).' },
    ],
  },
  'cal-varios-dias': {
    title: 'Elegir varios días',
    steps: [
      {
        el: 'cal-editar',
        go: '/calendario',
        say: 'Arrastra sobre los días (o mayús + clic): abajo aparece una barra para crear un evento o un recordatorio, darles color o vaciarlos. Esc suelta la selección.',
        next: true,
      },
    ],
  },
  'cal-recordatorio': {
    title: 'Un recordatorio',
    steps: [
      { el: 'cal-editar', go: '/calendario', say: 'Pulsa el día del recordatorio.' },
      { say: 'Pulsa «Recordatorio», elige la hora con las ruedas y el aviso, y pulsa «Crear recordatorio».', next: true },
    ],
  },
  'cal-color': {
    title: 'Dar color a una casilla',
    steps: [
      { el: 'cal-editar', go: '/calendario', say: 'Pulsa el día que quieres pintar.' },
      { say: 'En «Color de la casilla», elige el color. El círculo tachado lo quita.', next: true },
    ],
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
      { el: 'grabar-iniciar', say: 'Pulsa «Iniciar grabación». La asignatura se elige después, al guardarla.', next: true },
    ],
  },
  'grabacion-duracion': {
    title: 'El límite de grabación',
    steps: [
      { el: 'grabar', say: 'Pulsa el micrófono.' },
      { el: 'grabar-limite', say: 'Pulsa la rueda y elige las horas y los minutos del límite (de 1 minuto a 4 horas).' },
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
  'ajustes-cuenta-rueda': {
    title: 'El menú de la cuenta',
    steps: [
      toSettings,
      toAccount,
      { el: 'cuenta-menu', say: 'Aquí están vincular (si eres invitado), cerrar sesión, importar de Notion y eliminar la cuenta.', next: true },
    ],
  },
  'docs-info': {
    title: 'Información de la app',
    steps: [toSettings, { el: 'doc-info', go: '/settings', say: 'Al final: información, términos y cómo reportar un error.', next: true }],
  },
  // Informes: desde la 1.6.3, en Ajustes (recuadro «Informes»).
  'informes-centro': {
    title: 'Los informes',
    steps: [
      toReports,
      { el: 'informes-tipos', say: 'Elige el informe, el periodo y cuál.', next: true },
      { el: 'informe-vista', say: 'Así saldrá, página por página.', next: true },
    ],
  },
  'informe-pdf': {
    title: 'Guardar un informe',
    steps: [
      toReports,
      { el: 'informe-pdf', say: '«PDF» lo imprime o guarda como PDF; «Word» lo deja editable.', next: true },
    ],
  },
  'informe-rendimiento': {
    title: 'Informe de rendimiento',
    steps: [
      toReports,
      { el: 'informe-tipo', say: 'Elige «Rendimiento».', next: true },
      { el: 'informe-periodo', say: 'Semanal, mensual o anual.', next: true },
      { el: 'informe-cual', say: 'Y cuál: esta semana, la anterior…', next: true },
      { el: 'informe-resumen', say: 'Sus cifras principales; debajo, la vista previa.', next: true },
    ],
  },
  'informe-pendientes': {
    title: 'Informe de pendientes',
    steps: [
      toReports,
      { el: 'informe-tipo', say: 'Elige «Pendientes».', next: true },
      { el: 'informe-cual', say: 'El periodo: también puedes mirar lo que vence más adelante.', next: true },
    ],
  },

  'informe-no-abre': {
    title: 'Dónde queda el informe',
    steps: [toReports, { el: 'informe-pdf', say: 'El Word va a Descargas; el PDF se guarda desde el diálogo de impresión, donde eliges la carpeta.', next: true }],
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
    steps: [
      { el: 'actualizar', say: 'Pulsa el aviso de versión nueva: se abre un recuadro con el peso y el tiempo estimado.' },
      { el: 'actualizar-confirmar', say: 'Cuando quieras, pulsa «Actualizar ahora»: verás el porcentaje y el tiempo que falta.', next: true },
    ],
  },

  // --- Extensiones (1.6.2: sin el «+» de la Ayuda; Notion está en la rueda de Ajustes) ---
  'ext-que-son': {
    title: 'Dónde está Notion',
    steps: [
      toSettings,
      toAccount,
      { el: 'importar-notion', say: 'Notion, la única extensión, viene incluida: es «Importar de Notion».', next: true },
    ],
  },
  'ext-notion': {
    title: 'Importar de Notion',
    steps: [toSettings, toAccount, { el: 'importar-notion', say: 'Pulsa «Importar de Notion» y elige el archivo que exportaste de Notion.' }],
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
