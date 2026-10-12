// ============================================================
// Bloque I — Pantalla «Información y novedades».
//
// El texto se guarda como Markdown y lo pinta <LegalDocument />. Los campos
// entre corchetes son los que solo el titular puede rellenar: se muestran
// resaltados en ámbar dentro de la app, a propósito, para que ninguno se
// publique por olvido.
//
// Versionado propio: al cambiar este texto se sube INFO_VERSION, no la de los
// otros documentos.
// ============================================================

import { TERMS_VERSION } from './terms';

export const INFO_VERSION = '4.5';

export function infoDocument({
  appVersion,
  installId,
  releaseDate,
}: {
  appVersion: string;
  installId: string;
  releaseDate: string;
}): string {
  return `# Frame

**Versión ${appVersion}** · Canal estable · Compilación ${appVersion} (NSIS x64) · ${releaseDate}
Sistema de productividad académica para Windows y Android
Desarrollado por **VT Asvent**, entidad de desarrollo de software en formación · Perú

Frame reúne en una sola aplicación lo que normalmente exige cinco: gestión de asignaturas y tareas, cronometraje del estudio con calificación diaria, seguimiento de hábitos, calendario, reproductor de tu propia música, grabación de voz y los servicios de Google. Su núcleo académico funciona sin conexión, toda tu información se guarda primero en tu propio equipo y, con una cuenta, se sincroniza en segundos con Frame para Android.

---

## 1 · Requisitos del sistema

**Sistema operativo.** Windows 10 versión 1809 (compilación 17763) o superior, o Windows 11, en equipos x64. Para tablets y teléfonos existe **Frame para Android** (Android 8.0 o superior), que se descarga desde la misma página y comparte cuenta y datos. No hay versión para macOS, Linux ni iOS.

**Componente requerido.** Frame utiliza el runtime **Microsoft Edge WebView2**, distribuido por Microsoft e incluido de fábrica en Windows 11 y en las instalaciones actualizadas de Windows 10. Si no está presente, el instalador lo detecta y solicita su instalación. Sin este componente la aplicación no arranca.

**Recursos.** 4 GB de memoria y 300 MB de espacio libre, más el espacio que ocupen tu biblioteca de música y tus grabaciones, que crece sin límite fijado por la aplicación.

**Conexión a internet.** No es necesaria para el núcleo académico —asignaturas, tareas, sesiones de estudio, hábitos, calendario local, tu música, grabaciones y la ayuda—. Sí lo es para crear tu cuenta e iniciar sesión —una vez dentro, lo anterior sigue funcionando sin ella—, para la sincronización en la nube, las interfaces de YouTube, Gmail y Classroom, los vídeos de estudio, la tarjeta de clima y la comprobación de actualizaciones.

**Permisos del sistema.** Frame solicita acceso al micrófono para la grabación de voz, al sistema de archivos para adjuntos, portadas, informes y la biblioteca musical, y permiso para mostrar notificaciones nativas y una ventana siempre visible sobre las demás aplicaciones (la vista flotante del reloj). Estos permisos se emplean únicamente para las funciones descritas.

---

## 2 · Tu identificador de cuenta

**${installId}**

Es un identificador **seudónimo** de doce cifras, el mismo que los Términos llaman «identificador de instalación». Se obtiene del código interno, aleatorio, que el servicio de cuentas asignó a tu cuenta al crearla; en los perfiles locales anteriores a la versión 1.4.9 se generó al azar al crear el perfil. No se deriva de tu nombre, tu correo, tu hardware ni de ningún dato de tu equipo, y por sí solo no permite identificarte.

Cumple una sola función: que un reporte de soporte o una solicitud sobre tus datos se asocie a la cuenta correcta sin que tengas que dar tu correo. Lo ves también en Ajustes, junto a tu perfil, y se copia con un clic. Inclúyelo siempre que escribas a soporte. No lo publiques en foros ni redes: aunque no te identifica, sí identifica de forma única a tu cuenta.

Como pertenece a tu cuenta, es el mismo en todos los equipos donde inicies sesión y no cambia aunque desinstales y vuelvas a instalar Frame.

---

## 3 · Dónde vive cada dato

Frame distingue tres lugares de almacenamiento. Conocer la diferencia es lo que evita una pérdida irreversible.

**En tu equipo, siempre.** Todo lo que registras se escribe primero en tu disco: asignaturas, colecciones, tareas, adjuntos, sesiones de estudio, calificaciones, hábitos, eventos del calendario local, horarios importados, recursos, imágenes, grabaciones de voz y biblioteca de música. Las grabaciones se conservan además como archivos de audio (M4A) en \`Documentos\\Frame\\Grabaciones\`, accesibles fuera de la aplicación.

**En tu cuenta, si iniciaste sesión.** Tu **estado académico** —asignaturas, tareas, sesiones, calificaciones, hábitos, eventos, horarios y configuración— se replica en la nube y se fusiona entre equipos en segundos. Esta réplica es la que te permite cambiar de máquina, o usar el celular, sin perder nada. Tu **foto de perfil**, la **imagen del horario** y las imágenes de tus **playlists, asignaturas y colecciones** viajan también, en una carpeta privada de tu cuenta.

**En ningún sitio salvo tu equipo, siempre.** La **música** (con sus portadas y letras), las **grabaciones de voz** y los **adjuntos** quedan excluidos de la nube por su tamaño. Para tener tu música en otro dispositivo, copia allí tus archivos e impórtalos.

**Un perfil de invitado no tiene nada en la nube.** «Entrar como invitado» crea un perfil local para probar Frame al instante: toda su información vive únicamente en este equipo. Para ponerla a salvo, vincula tu cuenta con Google o con tu correo (la «G» junto a tu perfil, abajo en el menú, o Ajustes → rueda → «Vincular mi cuenta»): todo pasa a tu cuenta, se suma a lo que ya tuviera sin borrar nada y queda respaldado.

---

## 4 · Qué incluye esta versión

### 4.1 Ayuda

El **botón redondo** de abajo a la derecha abre la **Ayuda**, que ocupa todo el espacio entre el menú y la barra superior. Su barra responde cómo usar Frame con tus palabras. No es una inteligencia artificial: responde desde una guía escrita función por función, al instante, sin internet y sin inventar. Lo que no es sobre la app lo dice.

Cada vez que abres Frame empieza una conversación: tus preguntas de esa apertura quedan juntas y, al cerrar Frame, se guardan en **«Conversaciones»** —solo en este equipo y en tu perfil—. Cuando hay algo que pulsar, **«Descubrir»** lo enseña paso a paso: la pantalla se oscurece, solo queda iluminado el botón correcto y **Apex**, la mascota de VT Asvent, acompaña cada paso.

**Importar de Notion** (Ajustes → rueda de la cuenta) trae tus tareas y fechas desde la exportación de una base de datos de Notion (el .zip o el .csv), sin conectarse a tu cuenta.

### 4.2 Núcleo académico

Asignaturas con imagen de portada, agrupables en colecciones, con profesor y estadísticas propias; clases del mes generadas desde tu horario, con el tema visto en cada una; recursos (notas, enlaces y archivos) y un registro permanente de lo culminado.

El botón **«+»** de la barra superior crea una tarea o una anotación sin ir hasta la asignatura; una anotación sin asignatura queda como tarjeta al final de Inicio. Tareas con descripción, asignatura, fecha de entrega, importancia, tipo, dificultad, tiempo estimado y porcentaje de avance, que puedes ajustar a mano o que sube solo con tus sesiones de estudio en proporción al tiempo estimado. Recordatorios tarea por tarea, con días, hora y repetición. Adjuntos enlazados al archivo original de tu disco: si sigues editándolo, Frame ve siempre la versión actual.

Archivo de tareas culminadas e incompletas, con tiempo dedicado y puntualidad; aviso diario de tareas vencidas para reprogramarlas, culminarlas o descartarlas.

### 4.3 Estudio y medición del estudio

Temporizador o cronómetro, con **vista flotante** siempre visible en dos tamaños. En **modo rendimiento** valoras tu concentración de 1 a 20 y Frame calcula la nota del día (AD, A, B, C); en **modo tiempo** solo cuentan los minutos frente a tu meta.

Al terminar, el formulario recoge el tiempo exacto, tu enfoque, las asignaturas y tareas trabajadas y **lo que hiciste, con un editor de texto con negrita, cursiva, subrayado y listas**; las asignaturas y sus tareas se eligen con tarjetas. Durante la sesión puedes anotar avances con su minuto. Si Frame se cierra con una sesión en marcha, al volver el mismo día puedes retomarla.

Cada sesión es una tarjeta con su asignatura, su tiempo y su rendimiento, y se abre con todo su detalle. Calendario de calificaciones con el detalle de cada jornada (tiempo frente a la meta, sesiones, enfoque medio, nota y cuándo estudiaste: mañana, tarde o noche), progreso académico semanal o mensual y vídeos de estudio de YouTube, que se ven con su reproductor.

### 4.4 Análisis e informes

La barra superior muestra frases con tus datos recientes que cambian solas. Inicio resume tu día: clima, horario, nota de ayer, racha, promedio semanal, próxima tarea, «Tu semana en datos» y la matriz de competencias (carga pendiente por asignatura, no una medida de conocimiento). Hábitos con fases del día, anillos, semana tipo y mapa de constancia. **Informes** de rendimiento y de pendientes en PDF y Word —semanales, mensuales o anuales—, en Ajustes, con un resumen y la vista previa real del documento.

### 4.5 Calendario, Google y música

Calendario local sin conexión: eventos de uno o varios días, recordatorios con aviso, colores en las casillas y selección de varios días a la vez arrastrando; **YouTube, Gmail y Classroom** integrados en la barra lateral. Biblioteca con **tu propia música**: «Importar» trae canciones sueltas o carpetas enteras de tu equipo, con su portada y su letra (etiquetas del archivo o un .lrc con el mismo nombre), y se reproduce con letras sincronizadas, playlists y favoritas; al pulsar el nombre de la playlist en el reproductor se ubica la canción que suena. Grabación de voz desde cualquier pantalla (\`Ctrl+Shift+F\`), con el límite que elijas, hasta 4 horas. Las actualizaciones muestran su peso, el tiempo estimado y el avance real antes y durante la instalación.

---

## 5 · Límites conocidos y comportamiento esperado

Se documentan aquí para que ninguno te sorprenda. No son fallos.

Frame avisa de cada versión nueva (botón «Actualizar ahora» y campana) y **no se instala sin tu confirmación**.

Cerrar la ventana cierra Frame. Si hay una sesión de estudio en marcha, antes te ofrece pausarla, registrarla o seguir estudiando. Los recordatorios suenan mientras Frame está abierta.

Los adjuntos de tipo documento dejan de resolver si el archivo original se mueve, se renombra o se elimina: vuelve a adjuntarlo.

El radar de competencias y las calificaciones diarias se calculan exclusivamente sobre los datos que tú registras. No provienen de ninguna institución y no tienen validez académica.

La música, las grabaciones y los adjuntos no se respaldan en la nube.

Frame muestra la letra que trae cada archivo: una canción sin letra en sus etiquetas ni .lrc al lado se queda sin letra. Frame no descarga música ni vídeos.

Las interfaces de Google requieren conexión y sesión iniciada en Google, y su funcionamiento depende íntegramente de Google. La importación de horarios usa un asistente de inteligencia artificial externo al que tú entregas la imagen; Frame no la envía a ningún servicio.

---

## 6 · Componentes y servicios de terceros

Frame está construida sobre software de terceros distribuido bajo licencias abiertas, cuya relación completa figura en la sección **Avisos de terceros** de los Términos y Condiciones.

Los servicios de Google —Gmail, YouTube y Classroom— son operados por Google LLC; su disponibilidad, contenido y condiciones dependen de Google. La copia en la nube y la autenticación se ejecutan sobre la infraestructura de **Supabase**.

El pronóstico del clima procede de **Open-Meteo**.

Notion es una marca de Notion Labs, Inc.; la extensión solo lee los archivos que exportas tú y no se conecta a su servicio.

Frame **reproduce archivos de audio presentes en tu equipo**. La aplicación no provee catálogo musical ni licencia alguna sobre obras protegidas: eres responsable de contar con los derechos necesarios sobre los archivos que incorpores a tu biblioteca.

---

## 7 · Canal de versiones y ciclo de actualización

Frame se distribuye en un único canal, **estable**. La numeración sigue el esquema \`MAYOR.MENOR.PARCHE\`. Cuando una actualización modifique el formato de los datos, Frame realizará la migración de forma automática al primer arranque.

Se ofrece soporte para la versión estable vigente y para la inmediatamente anterior. Las versiones más antiguas pueden dejar de sincronizar con el servicio de copia de seguridad sin aviso individual.

---

## 8 · Historial de versiones

**${appVersion} — ${releaseDate}**

*1.6.3:* **Centro de ayuda renovado**: una conversación como en un chat, temas en tarjetas en lugar de adivinar la pregunta, «Mostrar cómo» y «Nueva conversación», con su botón en la barra superior · **Informes en Ajustes**: rendimiento y pendientes, semanal, mensual o anual, con resumen y **vista previa real** del documento · **menú lateral** en tres bloques · **Calendario** solo local y con la cuadrícula del calendario de Estudio: Frame deja de conectarse con Google Calendar · botones de cancelar y descartar en gris; el rojo, solo para confirmar un borrado · el temporizador de Estudio, centrado · «Crear» respeta el tema oscuro.

*1.6.2:* **la barra superior habla de ti**: frases con tus datos recientes que cambian solas · **Centro de informes** en la barra superior · **anotaciones sin asignatura** en Inicio · **Estudio**: tarjetas de sesión con su detalle, editor de texto tipo Word, asignaturas y tareas elegidas con tarjetas · **calendario local rediseñado**: varios días a la vez, recordatorios y colores de casilla · grabaciones con el límite que elijas (hasta 4 h) · **actualizar** muestra peso, tiempo estimado y avance real · Ajustes con un menú de cuenta pequeño e «Importar de Notion» · la Ayuda guarda una conversación por cada vez que abres Frame · **corregido**: «Importar» de Música no abría el explorador («current webview is not a WebviewWindow»).

*1.6.1:* **la Ayuda tiene su propia pantalla**: un botón redondo abajo a la derecha la abre a pantalla completa, con el menú y la barra superior a la vista, y Apex junto a la barra; tus preguntas quedan en «Conversaciones» · **Inicio, más ligero**: fuera la esfera · **«Enfoque» pasa a llamarse «Estudio»** en el menú · **tu música, desde tu equipo**: el botón «Importar» de Música abre el explorador de archivos para traer canciones sueltas o carpetas enteras, con su portada y su letra; Frame deja de descargar canciones, vídeos, portadas y letras · Música empieza siempre arriba de la primera carpeta de 100 al abrir Frame · Asignaturas ofrece las diez áreas del **CNEB** · las grabaciones de voz se guardan en M4A · **Frame pesa mucho menos y gasta menos procesador**: el instalador baja a una fracción del anterior y las animaciones se detienen cuando no se ven · fuera la pantalla de presentación y «Exportar música».

*1.6.0:* la ayuda respondía a toda pantalla y guardaba tus conversaciones · **«Descubrir»**: tras la respuesta, un recorrido guiado oscurece la pantalla, ilumina solo el botón que toca y avanza contigo hasta completar la acción, con **Apex**, la mascota de VT Asvent, cambiando de pose a tu lado · **la ayuda entiende muchas más preguntas**: erratas, frases coloquiales y averías («no carga», «no suena») incluidas · respuestas nuevas: volumen y controles de la música, letra desfasada, tareas en la asignatura equivocada y los problemas más frecuentes.

*1.5.9:* **código más simple**: un 17 % menos de líneas, sin las funciones que ya no se usaban · **fuera la calculadora, el diccionario y el traductor**: las extensiones se quedan con el importador de Notion · **fuera «Sugerencias» e «Institución Educativa»**: los errores y las propuestas se envían por correo a vt.asvent@gmail.com.

*1.5.8:* **Inicio estrena ayuda**: una barra para preguntar cómo usar cualquier función de Frame con tus palabras; responde al instante y sin internet desde una guía escrita función por función · al terminar una sesión, «¿Qué hiciste?» admite **lista de avances** además de texto continuo · el nombre de la playlist en el reproductor **te lleva a la canción que suena** · **YouTube** vuelve a la barra lateral · **corregido**: las imágenes de la cuenta no llegaban a subirse a la nube por un nombre de archivo que el servicio rechazaba; ahora sí viajan · los fallos que rompen una pantalla se reportan solos, con su ubicación en el código y nunca con contenido tuyo.

*1.5.6:* **vincular tu cuenta, más a mano**: quien está como invitado tiene una «G» pequeña junto a su perfil, abajo en el menú; abre el mismo recuadro de acceso, con Google o con correo y contraseña, y todo lo suyo pasa a la cuenta sin perder nada · **«Sin conexión»**: un aviso breve abajo a la izquierda que sube a la campana y queda allí como notificación; si se cerró la sesión, desde ella vuelves a entrar.

*1.5.5:* **las imágenes viajan entre tus dispositivos**: la foto de perfil, la imagen del horario y las de tus playlists, asignaturas y colecciones aparecen solas en el celular o la tablet, y al revés, en segundos · al encuadrar una imagen también se puede acercar pellizcando en una pantalla táctil.

*1.5.4:* **sincronización en vivo**: lo que cambias en el celular o la tablet aparece en la laptop en unos segundos, y al revés · **la sesión ya no se pierde**: si la nube cierra tu sesión por su cuenta, sigues en Frame con tus datos y una franja te ofrece volver a entrar · **encuadrar las imágenes** con zoom, en un marco con la forma exacta del hueco · el día del calendario de calificaciones muestra **cuándo estudiaste** (mañana, tarde o noche).

*1.5.3:* **vuelve «Entrar como invitado»**: se entra al instante, sin cuenta ni formularios, para probar Frame · **vincular con Google sin perder nada**: todo lo que hizo el invitado pasa a su cuenta, se suma a lo que ya tuviera sin borrar ni duplicar y queda respaldado en la nube.

Historial completo: en la página de descarga de Frame.

---

## 9 · Documentos aplicables

Términos y Condiciones de Uso y Política de Privacidad, versión ${TERMS_VERSION}, vigentes desde el ${releaseDate} · pantalla «Términos de servicio»
Política de Uso Aceptable · Anexo C de los Términos
Avisos de software de terceros · Anexo E de los Términos

Contacto: vt.asvent@gmail.com · VT Asvent`;
}
