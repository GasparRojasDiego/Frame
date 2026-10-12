// ============================================================
// Más formas de preguntar cada respuesta del banco (1.6.0).
//
// El buscador compara la pregunta con CADA una de estas frases (además de
// las de su entrada), así que cuantas más estructuras distintas haya, mejor
// entiende: «¿cómo…?», «quiero…», «no sé…», «no encuentro…», «se puede…»,
// «dónde…», «para qué sirve…», frases cortas, coloquiales y con erratas.
//
// REGLA: no copiar aquí las frases de scripts/ayuda-casos.ts (son la prueba
// de que generaliza).
// ============================================================

export const VARIANTES: Record<string, string[]> = {
  // ---------------- Lo básico ----------------
  'que-es-frame': [
    'qué hace frame', 'para qué me sirve frame', 'de qué trata esta aplicación', 'qué puedo hacer con frame',
    'explícame frame', 'qué es esta app', 'en qué me ayuda frame', 'frame para qué es', 'qué funciones tiene frame',
    'resumen de frame', 'qué tiene esta aplicación',
  ],
  'primeros-pasos': [
    'cómo empiezo a usar frame', 'qué hago primero en frame', 'acabo de instalar frame', 'soy nueva en frame',
    'guía para empezar', 'tutorial de frame', 'primeros pasos', 'cómo configuro frame la primera vez', 'no sé por dónde comenzar',
    'cómo se usa frame', 'enséñame a usar la app', 'recién empiezo con frame',
  ],
  'menu-lateral': [
    'qué hay en el menú de la izquierda', 'para qué sirve cada botón del menú', 'el menú lateral', 'secciones de frame',
    'dónde están las interfaces', 'cómo me muevo entre pantallas', 'navegar por frame', 'barra de la izquierda',
  ],
  'menu-plegar': [
    'cómo hago más pequeño el menú', 'ocultar la barra lateral', 'contraer el menú', 'expandir el menú', 'quiero más espacio en la pantalla',
    'cerrar el menú de la izquierda', 'el menú desapareció cómo lo vuelvo a abrir', 'minimizar el menú',
  ],
  'sin-internet': [
    'frame funciona offline', 'puedo usar frame sin conexión', 'necesito internet para usar frame', 'qué pasa si me quedo sin internet',
    'se pierden mis cambios sin internet', 'usar la app sin datos', 'frame sin red', 'trabajar desconectado',
  ],
  'nube-que-se-guarda': [
    'qué datos se respaldan', 'mi música se guarda en la nube', 'qué se sincroniza', 'las grabaciones van a la nube', 'qué no se respalda',
    'se guarda todo en mi cuenta', 'qué cosas viajan entre dispositivos', 'qué se queda solo en mi equipo',
    'qué cosas se suben a la nube', 'qué datos suben a la nube', 'qué guarda la nube',
  ],
  deshacer: [
    'cómo deshago un borrado', 'borré algo por error', 'volver atrás lo que eliminé', 'cómo recupero lo último que borré',
    'me equivoqué al borrar', 'deshacer', 'control z no funciona', 'revertir un cambio',
  ],
  atajos: [
    'qué teclas tiene frame', 'combinaciones de teclas', 'atajos del teclado', 'qué hace ctrl shift f', 'shortcuts',
    'trucos de teclado', 'teclas para ir más rápido',
  ],
  'conoce-vt-asvent': [
    'quién creó frame', 'quién desarrolló esta app', 'de quién es frame', 'empresa detrás de frame', 'quiénes son vt asvent',
    'creador de frame', 'quién programó frame',
  ],
  'ayuda-barra': [
    'cómo uso esta barra', 'esta barra es una inteligencia artificial', 'eres una ia', 'cómo te pregunto algo', 'qué puedo preguntarte',
    'cómo funciona la ayuda', 'necesitas internet para responder', 'esto es chatgpt',
    'dónde encuentro la ayuda', 'cómo entro a la ayuda', 'abrir la pantalla de ayuda', 'botón de ayuda', 'dónde te pregunto',
    'cerrar la ayuda', 'para qué es el círculo de la esquina',
    'qué es descubrir', 'para qué sirve el botón descubrir', 'cómo funciona descubrir', 'quién es apex', 'la mascota de frame', 'el robot que aparece', 'guía paso a paso',
  ],
  'tema-claro-oscuro': [
    'cómo pongo frame en negro', 'activar el modo noche', 'cambiar los colores de la app', 'tema oscuro', 'tema claro',
    'la app está muy brillante', 'poner la app oscura', 'quiero fondo blanco', 'cambiar la apariencia', 'modo claro', 'dark mode',
  ],
  idioma: [
    'cambiar el idioma', 'frame está en otro idioma', 'se puede poner en inglés', 'idiomas disponibles', 'traducir la app',
  ],

  // ---------------- Inicio ----------------
  'inicio-que-muestra': [
    'para qué sirve la pantalla principal', 'qué significa cada cosa de inicio', 'explicame inicio', 'la página de inicio',
    'qué veo al abrir frame', 'pantalla principal', 'inicio',
    'qué hay en inicio', 'qué hay en la pantalla principal', 'partes de la pantalla de inicio',
  ],
  'clima-ubicacion': [
    'cómo cambio la ubicación del clima', 'el clima no es de mi ciudad', 'poner mi ciudad', 'elegir ubicación', 'clima de otra ciudad',
    'cómo pongo huancayo en el clima', 'usar el gps para el clima', 'el tiempo sale de otro lugar',
  ],
  'clima-pronostico': [
    'clima por horas', 'clima de los próximos días', 'va a llover mañana', 'temperatura de la semana', 'pronóstico del tiempo',
    'qué clima hará', 'ver el clima de mañana',
  ],
  'horario-subir': [
    'cómo pongo mi horario en inicio', 'subir imagen del horario', 'cambiar la foto del horario', 'mi horario de clases',
    'dónde pongo el horario', 'cargar el horario', 'quitar el horario de inicio',
  ],
  'horario-vistazo': [
    'ver el horario rápido', 'mostrar el horario encima de todo', 'el horario aparece al pasar el mouse por el borde', 'horario flotante',
    'echar un vistazo al horario',
  ],
  'inicio-rendimiento': [
    'qué es rendimiento académico', 'los cuadros de rendimiento', 'nota de ayer en inicio', 'promedio semanal', 'días de racha en inicio',
    'qué significan los números de inicio',
  ],
  'inicio-proxima-tarea': [
    'qué tarea me toca', 'próxima entrega', 'la tarea más cercana', 'qué tengo que entregar pronto', 'próxima tarea',
    'cuántos días faltan para mi siguiente entrega', 'casilla de arriba a la derecha en rendimiento',
  ],
  'semana-en-datos': [
    'resumen de mi semana', 'estadísticas de la semana', 'ritmo de estudio', 'constancia de la semana', 'cómo me fue esta semana',
    'comparar con la semana pasada',
  ],
  'matriz-competencias': [
    'qué es la matriz de competencias', 'el gráfico de araña', 'gráfico radar', 'dominio por asignatura', 'qué mide el radar',
    'competencias por curso',
  ],
  'matriz-elegir': [
    'cambiar las materias del radar', 'qué asignaturas aparecen en la matriz', 'quitar un curso del radar', 'elegir asignaturas del gráfico',
    'lápiz de nivel por asignatura', 'configurar la matriz de competencias', 'marcar las asignaturas del radar',
  ],
  'inicio-sin-asignatura': [
    'tareas sin asignatura', 'colocar una tarea en una asignatura', 'tareas que no tienen curso', 'qué es sin asignatura en inicio',
    'asignar una materia a una tarea suelta',
  ],
  'inicio-grabaciones': [
    'grabaciones en la pantalla de inicio', 'notas de voz en inicio', 'las grabaciones de abajo de inicio',
  ],
  'anotaciones-sueltas': [
    'anotaciones sin asignatura', 'anotaciones al final de inicio', 'colocar una anotación en una asignatura',
    'la anotación que apunté sin curso', 'borrar una anotación suelta', 'tarjetas de anotaciones en inicio',
  ],

  // ---------------- Barra superior ----------------
  'barra-superior': [
    'qué hay arriba en la barra', 'botones de arriba', 'la barra de la parte superior', 'iconos de arriba a la derecha',
    'iconos de arriba a la izquierda',
  ],
  'frase-personal': [
    'qué dice el texto de arriba', 'por qué cambia la frase de la barra', 'frases con mis datos', 'el texto del centro cambia solo',
    'detener la frase de arriba', 'mensaje de la barra superior', 'de dónde sale la frase de arriba',
  ],
  notificaciones: [
    'dónde veo las notificaciones', 'qué es la campana', 'centro de notificaciones', 'mis avisos de frame', 'notificaciones', 'alertas de la app',
    'ver avisos', 'mis avisos', 'dónde están los avisos', 'revisar las notificaciones',
  ],
  'sin-conexion-aviso': [
    'me sale sin conexión', 'aviso de sin conexión', 'por qué dice sin conexión', 'estoy offline en frame',
  ],
  'tarea-crear-rapida': [
    'crear rápido', 'botón más de la barra superior', 'apuntar algo rápido', 'anotación rápida', 'crear tarea desde cualquier pantalla',
    'el más de arriba a la izquierda', 'volver a elegir entre tarea y anotación',
  ],

  // ---------------- Enfoque ----------------
  'enfoque-intro': [
    'qué es enfoque', 'para qué sirve enfoque', 'la pantalla de estudio', 'pantalla del temporizador', 'interfaz de enfoque',
  ],
  'enfoque-iniciar': [
    'cómo inicio el temporizador', 'quiero ponerme a estudiar', 'iniciar una sesión', 'comenzar el pomodoro', 'cómo estudio con frame',
    'cómo pongo a correr el reloj', 'empezar sesión de estudio', 'arrancar a estudiar', 'botón iniciar', 'cómo uso el timer',
    'cómo cronometro mi estudio', 'estudiar con temporizador',
    'dónde pulso para empezar a estudiar', 'botón para arrancar el reloj', 'técnica pomodoro', 'pomodoro de 25 minutos', 'poner play al reloj de estudio',
  ],
  'enfoque-modos': [
    'qué es el cronómetro', 'cronómetro o temporizador', 'contar el tiempo sin límite', 'cambiar a cronómetro', 'modo cronómetro',
    'temporizador cuenta para atrás',
  ],
  'enfoque-duracion': [
    'cambiar la duración del temporizador', 'poner 30 minutos', 'fijar el tiempo de la sesión', 'cuánto dura el temporizador',
    'poner dos horas de estudio', 'elegir los minutos', 'configurar el tiempo',
    'sesión de dos horas', 'estudiar una hora exacta', 'poner 45 minutos', 'cambiar cuánto dura la sesión', 'minutos del temporizador', 'una hora y cuarto de estudio',
    'sesión de hora y media', 'estudiar noventa minutos', 'poner una hora en el temporizador',
  ],
  'enfoque-finalizar': [
    'terminar la sesión de estudio', 'registrar la sesión', 'botón finalizar', 'cómo acabo de estudiar', 'guardar la sesión',
    'qué pongo al finalizar', 'parar el temporizador y guardar',
    'registrar lo que estudié', 'guardar mi tiempo de estudio', 'cómo se guarda la sesión cuando termino', 'acabé la sesión',
    'guardar lo estudiado', 'guardar la sesión al terminar',
  ],
  'enfoque-descartar': [
    'descartar una sesión', 'cancelar la sesión', 'que no se registre la sesión', 'empecé sin querer', 'anular la sesión',
    'no guardar esta sesión',
    'no quiero que la sesión cuente', 'borrar la sesión en curso sin registrarla', 'eliminar la sesión actual sin guardar', 'que no se guarde esta sesión', 'tirar la sesión',
  ],
  'enfoque-avance-tareas': [
    'las sesiones avanzan las tareas', 'vincular una sesión a una tarea', 'el estudio sube el progreso de la tarea',
    'cómo se reparte el tiempo entre tareas',
  ],
  'enfoque-anotar': [
    'anotar avance', 'tomar notas en la sesión', 'escribir lo que hice durante la sesión', 'notas de la sesión',
    'enfoque opcional al anotar', 'anotar un avance de una tarea',
  ],
  'anotacion-formato': [
    'poner negrita', 'hacer una lista con viñetas', 'subrayar en la anotación', 'barra de formato de las notas',
    'escribir en cursiva', 'formato tipo word en estudio',
  ],
  'vista-flotante': [
    'reloj flotante', 'temporizador encima de otras ventanas', 'ver el tiempo mientras uso otro programa', 'mini temporizador',
    'vista compacta del reloj', 'ventana pequeña del timer',
  ],
  'enfoque-hoy': [
    'tiempo estudiado hoy', 'métricas de hoy', 'cuánto llevo estudiando', 'estudio de hoy por asignatura', 'resumen de hoy',
    'cuántos minutos estudié hoy', 'tiempo de estudio de hoy', 'horas estudiadas hoy',
    'tarjetas de mis sesiones de hoy', 'ver el detalle de una sesión',
  ],
  'enfoque-corregir': [
    'corregir una sesión', 'cambiar la duración de una sesión', 'borrar una sesión de estudio', 'editar una sesión de otro día',
    'me equivoqué de asignatura en una sesión', 'lápiz de la tarjeta de la sesión',
  ],
  'nota-diaria': [
    'cómo me ponen la nota', 'qué es la calificación del día', 'cómo saco a', 'por qué saqué c', 'qué significa ad a b c',
    'cómo se mide mi día', 'mi nota de hoy', 'escala de calificación', 'cómo funciona la nota',
    'qué es la nota del día', 'nota diaria', 'calificación diaria', 'la nota de cada día',
  ],
  'calendario-calificaciones': [
    'calendario de notas', 'ver mis notas diarias', 'calificaciones de cada día', 'calendario de enfoque',
    'notas de días pasados',
  ],
  'progreso-academico': [
    'progreso académico', 'evolución de mi estudio', 'gráfico de progreso', 'avance por semanas', 'estadísticas del mes',
  ],
  'videos-estudio': [
    'vídeos de estudio', 'ver un video en estudio', 'youtube en estudio', 'guardar videos para estudiar', 'lista de videos',
    'descargar un vídeo de estudio', 'ver videos sin internet',
  ],
  'sesion-interrumpida': [
    'se cerró la app con el temporizador corriendo', 'recuperar una sesión interrumpida', 'se fue la luz mientras estudiaba',
    'cerré frame sin finalizar', 'sesión en curso al abrir',
  ],
  'reloj-menu': [
    'el reloj que gira en el menú', 'icono que da vueltas en enfoque', 'por qué gira el reloj del menú',
  ],

  // ---------------- Tareas ----------------
  'tareas-intro': [
    'qué es la interfaz tareas', 'dónde veo todas mis tareas', 'mis pendientes', 'galería de tareas', 'lista de tareas',
  ],
  'tarea-crear': [
    'añadir una tarea', 'crear un pendiente', 'anotar un trabajo', 'agregar un examen', 'poner una tarea nueva', 'registrar una tarea',
    'cómo apunto lo que me dejó el profesor', 'nueva tarea', 'crear tarea', 'agendar una tarea', 'guardar una tarea',
  ],
  'tarea-editar': [
    'editar una tarea', 'cambiar la descripción de una tarea', 'corregir una tarea', 'cambiar la fecha de una tarea', 'modificar una tarea',
    'renombrar una tarea', 'lápiz de la tarea',
  ],
  'tarea-progreso': [
    'marcar el progreso de una tarea', 'cuánto llevo de una tarea', 'barra de avance de la tarea', 'avance de una tarea', 'tarea a medias',
  ],
  'tarea-culminar': [
    'culminar una tarea', 'terminar una tarea', 'marcar una tarea como hecha', 'tarea lista', 'check de la tarea', 'ya entregué la tarea',
    'completar tarea',
  ],
  'tarea-incompleta': [
    'marcar como incompleta', 'tarea que no hice', 'no terminé una tarea', 'tarea fallida', 'no la entregué',
    'se me pasó la fecha de entrega', 'no hice la tarea a tiempo', 'tarea que no alcancé a hacer', 'no la presenté',
  ],
  'tarea-eliminar': [
    'eliminar una tarea', 'borrar tarea', 'quitar una tarea de la lista', 'deshacerme de una tarea', 'suprimir una tarea',
  ],
  'tarea-archivadas': [
    'tareas archivadas', 'tareas culminadas', 'tareas terminadas', 'historial de tareas', 'retomar una tarea culminada',
    'ver tareas viejas', 'tiempo dedicado a una tarea',
    'tareas que ya terminé', 'las tareas hechas', 'ver lo que ya completé',
  ],
  'tarea-ordenar': [
    'ordenar mis tareas', 'cambiar el orden de las tareas', 'ordenar por proximidad', 'arrastrar tareas', 'tareas más cercanas primero',
  ],
  'tarea-filtros': [
    'filtrar tareas', 'buscar entre mis tareas', 'mostrar solo tareas importantes', 'filtro de tareas', 'ver solo proyectos',
  ],
  'tarea-importancia': [
    'importancia de una tarea', 'prioridad de la tarea', 'tipo de tarea', 'qué es la dificultad', 'tarea alta media baja',
    'cambiar la prioridad', 'marcar como examen o proyecto',
  ],
  'tarea-recordatorio': [
    'poner un recordatorio', 'que frame me recuerde una tarea', 'aviso de una tarea', 'recordatorio cada hora', 'notificación de tarea',
    'avisarme de una entrega',
  ],
  'tarea-estimado': [
    'tiempo estimado de una tarea', 'cuánto me tomará', 'estimar la duración de una tarea', 'reloj de arena de la tarea',
  ],
  'tarea-adjuntos': [
    'adjuntar archivos', 'añadir un enlace a una tarea', 'subir un documento a la tarea', 'poner un link en la tarea', 'archivo en la tarea',
  ],
  'tarea-adjunto-roto': [
    'no se pudo abrir el archivo', 'el adjunto no abre', 'archivo adjunto roto', 'moví el archivo y ya no abre',
  ],
  'tareas-vencidas': [
    'tareas vencidas', 'aviso de tareas atrasadas', 'tareas que pasaron su fecha', 'reprogramar una tarea vencida',
  ],
  'tareas-google-calendar': [
    'tareas en google calendar', 'pasar mis tareas al calendario de google', 'ver mis entregas en google calendar',
  ],

  // ---------------- Hábitos ----------------
  'habitos-intro': [
    'qué es hábitos', 'para qué sirven los hábitos', 'registro de hábitos', 'la interfaz hábitos',
  ],
  'habito-crear': [
    'crear un hábito', 'añadir un hábito', 'nuevo hábito', 'empezar un hábito', 'agregar rutina', 'hábito de leer', 'hábito diario',
  ],
  'habito-marcar': [
    'marcar un hábito', 'cumplí mi hábito', 'check del hábito', 'tachar un hábito', 'desmarcar un hábito',
  ],
  'habito-semanas': [
    'semana anterior de hábitos', 'ver otra semana', 'flechas de la semana', 'hábitos de semanas pasadas',
  ],
  'habito-fases': [
    'hábito de la mañana', 'hábito de la noche', 'momento del día del hábito', 'cambiar la fase de un hábito',
  ],
  'habito-frecuencia': [
    'días del hábito', 'hábito algunos días', 'frecuencia del hábito', 'hábito entre semana', 'cada cuánto toca el hábito',
  ],
  'habito-renombrar': [
    'cambiar el nombre de un hábito', 'editar un hábito', 'corregir el nombre del hábito',
  ],
  'habito-archivar': [
    'archivar un hábito', 'eliminar un hábito', 'borrar hábito', 'ya no quiero un hábito', 'ver hábitos archivados',
  ],
  'habito-analisis': [
    'análisis de hábitos', 'cumplimiento de hábitos', 'rachas de hábitos', 'qué hábito cumplo menos', 'mapa de constancia',
    'qué hábito estoy abandonando', 'hábito que estoy descuidando', 'hábitos que se apagan', 'qué hábito cumplo peor',
    'hábitos que voy dejando', 'qué hábito voy perdiendo',
    'qué día de la semana cumplo peor mis hábitos', 'en qué días fallo con mis hábitos',
  ],
  'habito-anillos': [
    'anillos de hábitos', 'círculos de hábitos', 'qué significan los anillos',
  ],

  // ---------------- Asignaturas ----------------
  'asig-intro': [
    'qué es asignaturas', 'mis materias', 'dónde están mis cursos', 'interfaz asignaturas',
  ],
  'asig-crear': [
    'crear una asignatura', 'añadir un curso', 'nueva materia', 'agregar asignatura', 'poner mis cursos', 'asignaturas del coar',
    'registrar mis materias', 'áreas del currículo nacional',
  ],
  'asig-coleccion': [
    'crear una colección', 'agrupar asignaturas', 'juntar varias materias', 'colección de cursos', 'organizar mis asignaturas en grupos',
  ],
  'asig-mover-coleccion': [
    'pasar una asignatura a otra colección', 'cambiar de colección', 'sacar un curso de una colección',
  ],
  'asig-coleccion-renombrar': [
    'renombrar una colección', 'abrir una colección', 'cambiar el nombre del grupo de asignaturas',
  ],
  'asig-imagen': [
    'imagen de una asignatura', 'cambiar la portada del curso', 'foto de la materia', 'poner fondo a una colección',
  ],
  'encuadre-imagen': [
    'encuadrar una imagen', 'recortar una foto', 'hacer zoom a la imagen', 'ajustar la imagen',
  ],
  'asig-abrir': [
    'abrir una asignatura', 'entrar a un curso', 'qué hay en una asignatura', 'tareas de una asignatura', 'ver una materia por dentro',
    'ver las tareas de un curso', 'tareas de una materia en específico', 'abrir una materia para ver sus tareas',
  ],
  'asig-editar': [
    'editar una asignatura', 'renombrar una asignatura', 'eliminar un curso', 'cambiar el profesor de una materia', 'borrar materia',
  ],
  'asig-recursos': [
    'recursos de una asignatura', 'guardar un enlace en un curso', 'notas de una materia', 'subir material', 'apuntes del curso',
  ],
  'asig-archivados': [
    'archivados de una asignatura', 'recursos eliminados', 'tareas culminadas de un curso', 'recuperar un recurso',
  ],
  'asig-horario-importar': [
    'importar el horario', 'horario del mes', 'convertir la imagen del horario en clases', 'cargar el horario mensual',
  ],
  'asig-clases': [
    'clases de una asignatura', 'mis clases del mes', 'temas de cada clase', 'qué vi en clase',
  ],
  'asig-grabaciones': [
    'grabaciones de una asignatura', 'audios de un curso',
  ],

  // ---------------- Calendario y Google ----------------
  'cal-intro': [
    'qué es el calendario', 'interfaz calendario', 'mi agenda', 'calendario', 'calendario de frame',
    'el calendario de frame', 'abrir el calendario', 'ver el calendario',
  ],
  'cal-local': [
    'calendario sin google', 'calendario de la app', 'calendario local', 'usar el calendario sin cuenta de google',
  ],
  'cal-evento-crear': [
    'crear un evento', 'agregar un feriado', 'anotar una fecha importante', 'poner un evento en el calendario', 'nuevo evento',
    'marcar un día libre',
  ],
  'cal-editar': [
    'editar un evento', 'eliminar un evento', 'cambiar un evento', 'mover un evento a otro día',
  ],
  'cal-varios-dias': [
    'seleccionar varios días', 'arrastrar sobre el calendario', 'elegir un rango de días', 'vaciar varios días del calendario',
    'mayús clic en el calendario',
  ],
  'cal-recordatorio': [
    'recordatorio del calendario', 'aviso de un evento', 'evento con hora y aviso', 'que me avise el día antes de un evento',
  ],
  'cal-color': [
    'pintar una casilla', 'color de la casilla', 'quitar el color de una casilla', 'teñir días del calendario',
    'pintar las vacaciones de un color',
  ],
  'cal-dia-lleno': [
    'más eventos en un día', 'ver todos los eventos de un día', 'el día dice más',
  ],
  'cal-tareas': [
    'tareas en el calendario', 'fechas de entrega en el calendario', 'ver entregas por día',
  ],
  'gcal-vincular': [
    'vincular google calendar', 'conectar mi calendario de google', 'usar google calendar en frame', 'cambiar la cuenta del calendario',
    'sincronizar google calendar con frame', 'enlazar google calendar', 'juntar frame con mi calendario de google',
  ],
  'gmail-usar': [
    'usar gmail', 'abrir gmail en frame', 'ver mis correos', 'correo dentro de frame', 'gmail',
  ],
  'classroom-usar': [
    'usar classroom', 'abrir classroom', 'google classroom en frame', 'ver mis clases de classroom', 'classroom',
  ],
  'youtube-usar': [
    'usar youtube', 'abrir youtube', 'youtube', 'ver videos en frame',
  ],

  // ---------------- Música ----------------
  'musica-intro': [
    'qué es música', 'la interfaz música', 'mi biblioteca de música', 'dónde está mi música', 'reproductor de música',
  ],
  'musica-anadir': [
    'añadir canciones', 'meter música a frame', 'agregar música', 'importar canciones', 'importar una carpeta de música',
    'subir mis mp3', 'traer mis canciones de la computadora', 'cómo consigo canciones', 'descargar canciones',
    'bajar canciones de youtube', 'pasar mi música de spotify', 'importar spotify', 'cargar mi música',
  ],
  'musica-reproducir': [
    'escuchar música', 'reproducir canciones', 'cómo suena una canción', 'poner play a una canción', 'canción al azar',
    'poner música para escuchar', 'poner una canción', 'pongo una canción y no sé cómo', 'darle play a una canción',
  ],
  'musica-repetir': [
    'repetir canción', 'bucle', 'repetir una sola canción', 'repetir todo', 'loop de una canción',
  ],
  'musica-favoritas': [
    'canciones favoritas', 'marcar como favorita', 'me gusta en una canción', 'mis favoritos', 'corazón de la canción',
  ],
  'musica-buscar': [
    'buscar canciones', 'buscador de música', 'encontrar una canción en mi biblioteca', 'número de canciones de mi biblioteca',
  ],
  'musica-eliminar': [
    'borrar una canción', 'quitar música', 'eliminar canciones de la biblioteca',
  ],
  'musica-reproduciendo': [
    'pantalla completa de la canción', 'vista reproduciendo', 'ver la portada grande', 'letra de la canción', 'karaoke en frame',
  ],
  'musica-letras': [
    'canciones sin letra', 'letras sin conexión', 'por qué no hay letra', 'poner letra a una canción', 'archivo lrc',
    'letra sincronizada de mis canciones', 'descargar letras',
  ],
  'playlist-crear': [
    'crear una playlist', 'nueva lista de reproducción', 'armar una playlist', 'añadir playlist', 'lista de canciones nueva',
  ],
  'playlist-editar': [
    'editar una playlist', 'añadir canciones a la playlist', 'quitar canciones de una playlist', 'eliminar una playlist',
    'cambiar la imagen de la playlist', 'renombrar playlist',
  ],
  'playlist-ordenar': [
    'ordenar playlists', 'mover una playlist', 'reordenar canciones de la playlist', 'arrastrar canciones',
  ],
  'musica-celular': [
    'exportar mi música', 'pasar canciones al celular', 'copiar mi música a android', 'llevar la música al teléfono',
    'la música no se sincroniza', 'música en la tablet',
  ],
  'musica-al-cerrar': [
    'música en segundo plano', 'se para la música al cerrar', 'escuchar música con la app cerrada',
  ],

  // ---------------- Grabaciones ----------------
  'grabar-nota': [
    'grabar una nota de voz', 'grabar audio', 'grabar la clase', 'usar el micrófono', 'grabadora', 'iniciar una grabación',
    'grabar lo que dice el profesor', 'ctrl shift f',
    'atajo de teclado para grabar', 'tecla para grabar', 'grabar mi voz', 'grabar un audio',
  ],
  'grabacion-donde': [
    'dónde están mis grabaciones', 'dónde se guardan los audios', 'encontrar una grabación', 'mis notas de voz',
  ],
  'grabacion-detalles': [
    'escuchar una grabación', 'renombrar una grabación', 'eliminar una grabación', 'velocidad de la grabación', 'editar grabación',
  ],
  'grabacion-duracion': [
    'duración máxima de la grabación', 'cuánto graba frame', 'grabación larga', 'grabar cuatro horas',
    'cambiar el máximo de la grabación', 'rueda de la grabación',
  ],
  'grabacion-microfono': [
    'micrófono no disponible', 'no graba el micrófono', 'permiso del micrófono', 'frame no escucha mi voz',
  ],

  // ---------------- Ajustes ----------------
  'ajustes-abrir': [
    'abrir ajustes', 'configuración de frame', 'dónde está la configuración', 'mi perfil', 'settings', 'preferencias',
  ],
  'perfil-foto': [
    'cambiar foto de perfil', 'poner avatar', 'subir mi foto', 'imagen de perfil', 'quitar mi foto',
  ],
  'perfil-nombre': [
    'cambiar mi nombre', 'cambiar nombre de usuario', 'poner mi nombre real', 'editar mi perfil', 'nombres y apellidos',
  ],
  'perfil-id': [
    'id de mi cuenta', 'copiar mi id', 'código de mi cuenta', 'número de cuenta de frame',
  ],
  'ajustes-metas': [
    'metas diarias', 'cambiar mis metas de estudio', 'cuántos minutos estudiar por día', 'meta del lunes', 'objetivo diario de estudio',
    'cuántas horas estudiar al día', 'cambiar las horas de estudio diarias', 'meta de minutos por día',
  ],
  'modo-rendimiento-tiempo': [
    'modo rendimiento', 'modo tiempo', 'cambiar el modo de medición', 'medir por nota o por minutos',
  ],
  'racha-que-es': [
    'qué es la racha', 'días de racha', 'meta de racha', 'cómo mantengo la racha', 'se reinició mi racha', 'mejor racha',
  ],
  expediente: [
    'tu expediente', 'estadísticas de mi perfil', 'mi historial de estudio', 'dónde va mi tiempo',
  ],
  'ajustes-cuenta-rueda': [
    'rueda de cuenta', 'ajustes de la cuenta', 'engranaje de cuenta', 'opciones de mi cuenta', 'menú de la rueda de ajustes',
  ],
  'docs-info': [
    'información de la app', 'qué versión tengo', 'términos de servicio', 'privacidad', 'novedades de la versión', 'reportar un error',
    'qué versión de frame uso', 'número de versión', 'versión instalada de frame',
  ],

  // ---------------- Informes ----------------
  'informes-centro': [
    'centro de informes', 'generar un informe', 'informes de frame', 'reporte de estudio', 'documento con mis estadísticas',
    'dónde quedaron los informes', 'botón de informes de arriba',
  ],
  'informe-pdf': [
    'informe en pdf', 'informe en word', 'imprimir un informe', 'guardar el reporte', 'exportar informe',
  ],
  'informe-general': [
    'informe general', 'informe completo', 'informe denso o síntesis', 'todo en un documento',
    'informe resumido', 'resumen en un informe', 'informe síntesis',
  ],
  'informe-rendimiento': [
    'informe de rendimiento', 'reporte de mis calificaciones', 'informe de mi semana', 'informe de mi mes de estudio',
    'reporte de notas', 'informe con mis calificaciones', 'mis notas en un informe',
  ],
  'informe-pendientes': [
    'informe de pendientes', 'reporte de tareas pendientes', 'imprimir mis pendientes',
    'imprimir la lista de pendientes', 'lista de pendientes en pdf', 'pendientes para imprimir',
  ],
  'informe-habitos': [
    'informe de hábitos', 'reporte de hábitos', 'imprimir mis hábitos',
  ],

  // ---------------- Cuenta ----------------
  'entrar-cuenta': [
    'iniciar sesión', 'entrar a frame', 'crear una cuenta', 'registrarme', 'login', 'entrar con google', 'loguearme',
  ],
  'invitado-que-es': [
    'qué es invitado', 'modo invitado', 'usar frame sin cuenta', 'entrar sin registrarme',
  ],
  'invitado-vincular': [
    'vincular mi cuenta de invitado', 'pasar de invitado a cuenta', 'la g junto a mi perfil', 'guardar mis datos de invitado en una cuenta',
  ],
  'sync-como-funciona': [
    'cómo funciona la sincronización', 'sincronizar entre dispositivos', 'usar la misma cuenta en dos equipos', 'se sincroniza solo',
    'cómo se sincronizan mis datos', 'cómo se sincroniza todo', 'cada cuánto se sincroniza',
    'cómo se sincroniza la información', 'sincronización de mi información',
  ],
  'cerrar-sesion': [
    'cerrar sesión', 'salir de frame', 'desconectarme', 'logout', 'cambiar de cuenta',
  ],
  'eliminar-cuenta': [
    'eliminar mi cuenta', 'borrar mi cuenta', 'darme de baja', 'borrar todos mis datos',
  ],
  'actualizar-frame': [
    'actualizar frame', 'nueva versión', 'cómo instalo la actualización', 'frame está desactualizada', 'buscar actualizaciones',
    'cuánto tarda la actualización', 'peso de la nueva versión',
  ],
  'instalar-frame': [
    'instalar frame', 'descargar frame', 'frame en el celular', 'frame en otra computadora', 'apk de frame', 'frame para tablet',
  ],

  // ---------------- Problemas ----------------
  'contrasena-olvidada': [
    'olvidé la contraseña', 'recuperar contraseña', 'cambiar contraseña', 'no recuerdo mi clave', 'restablecer contraseña',
  ],
  'problema-interfaz': [
    'esta interfaz no pudo abrirse', 'error en una pantalla', 'se rompió la pantalla', 'pantalla de error con reintentar',
  ],
  'problema-lento': [
    'frame lenta', 'la app se congela', 'se cuelga frame', 'frame no responde', 'la aplicación va lenta',
    'se trabó la app', 'frame se traba', 'la app está trabada', 'se pegó frame',
  ],
  'problema-espacio': [
    'sin espacio', 'disco lleno', 'no se pudo guardar por espacio',
  ],
  'problema-correo-confirmar': [
    'no llega el correo de confirmación', 'confirmar mi correo', 'activar mi cuenta', 'el correo de frame no llega',
  ],
  'problema-datos-no-aparecen': [
    'no aparecen mis datos en otro dispositivo', 'otra laptop vacía', 'el celular no tiene mis tareas', 'mis cosas no se pasaron',
  ],
  'musica-no-suena': [
    'no se reproduce mi canción', 'no se oye la canción', 'la canción se salta', 'música sin sonido', 'canción en cero segundos',
    'la música se salta sola', 'las canciones se pasan solas',
  ],
  'informe-no-abre': [
    'dónde está el informe', 'no encuentro mi informe', 'no se abre el informe', 'el informe no se guarda',
    'dónde queda el informe', 'en qué carpeta queda el informe', 'dónde se descargó el informe',
  ],
  'datos-perdidos': [
    'se eliminaron mis tareas solas', 'desaparecieron mis datos', 'perdí mis tareas', 'recuperar tareas borradas', 'se me borró todo',
  ],
  'notificaciones-no-llegan': [
    'no me llegan notificaciones', 'no salen las notificaciones', 'no me avisa', 'los recordatorios no suenan',
  ],
  'temporizador-aviso': [
    'aviso al terminar el temporizador', 'sonido al acabar la sesión', 'alarma del pomodoro', 'cómo me avisa que terminó',
  ],
  'frame-no-abre': [
    'la app no abre', 'no carga frame', 'pantalla en blanco', 'pantalla negra', 'frame no arranca',
  ],
  'clima-no-carga': [
    'el clima no se actualiza', 'el clima no aparece', 'no se ve el clima', 'el clima no funciona',
  ],
  'google-no-entra': [
    'no logro iniciar con google', 'falla el inicio de sesión con google', 'google no carga', 'error al entrar con google',
  ],

  // ---------------- Extensiones y conversaciones ----------------
  // (1.6.2) El «+» de la barra de la Ayuda ya no existe: estas formas siguen
  // aquí porque quien lo busca recibe la respuesta de dónde quedó Notion.
  'ext-que-son': [
    // «de la Ayuda» con artículo: así «Ayuda» cuenta como la pantalla y no se
    // pierde como palabra vacía (si no, sería «el más de la barra» a secas).
    'para qué son las extensiones', 'botón más de la barra de la ayuda', 'añadir extensiones',
    'para qué es el botón más de la ayuda',
    'el más que tenía la barra de abajo', 'ya no está el más de la ayuda',
  ],
  'ext-notion': [
    'importar desde notion', 'pasar mis tareas de notion', 'notion a frame', 'traer fechas de notion',
    'botón importar de notion', 'importar de notion desde ajustes',
  ],
  'ayuda-conversaciones': [
    'conversaciones guardadas', 'ver mis preguntas anteriores', 'historial de preguntas', 'borrar mis conversaciones',
    'dónde quedan mis respuestas anteriores', 'lo que pregunté antes', 'seguir la conversación con la ayuda',
    'una conversación por cada vez que abro frame',
  ],
  'sugerencias-enviar': [
    'enviar una sugerencia', 'reportar un error', 'contactar a frame', 'correo de soporte', 'proponer una mejora', 'encontré un fallo',
  ],

  // ---------------- 1.6.0 ----------------
  'tarea-mover-asignatura': [
    'mover una tarea a otra asignatura', 'cambiar el curso de una tarea', 'tarea en la asignatura equivocada', 'pasar tarea a otro curso',
  ],
  'musica-volumen': [
    'volumen de la música', 'bajar el volumen', 'silenciar canción', 'quitar el sonido', 'subir el sonido de la música',
  ],
  'musica-controles': [
    'siguiente canción', 'canción anterior', 'pausar canción', 'detener la música', 'saltar canción', 'adelantar la canción',
  ],
  'letra-ajustar': [
    'letra desfasada', 'ajustar la letra', 'letra adelantada', 'letra atrasada', 'la letra está equivocada',
    'la letra es de otra canción', 'letra incorrecta', 'la letra no corresponde',
    'la letra no es la correcta', 'la letra no coincide',
  ],
};
