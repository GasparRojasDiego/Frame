import type { HelpEntry } from '../areas';

type Entry = Omit<HelpEntry, 'area'>;

// Grabaciones de voz.
// (Estilo de las respuestas: ver basico.ts.)
export const GRABACIONES: Entry[] = [
  {
    id: 'grabar-nota',
    title: 'Grabar una nota de voz',
    a: 'Grabar una clase o una idea rápida es muy sencillo. Arriba a la derecha, junto a la campana, está el botón del **micrófono**: al pulsarlo se abre el recuadro **Grabación**.\n\nPulsa **Iniciar grabación** y empieza a hablar. Mientras grabas puedes **Pausar** y **Reanudar** las veces que quieras; cuando acabes, pulsa **Terminar**.\n\nEntonces aparece **Guardar grabación**. Ponle un **nombre**, elige su **importancia** y su **tipo** (tarea, recordatorio, explicación o personal), escribe una descripción si quieres y elige la **asignatura** a la que pertenece. Por último, pulsa **Guardar**.',
    tip: 'Con las teclas **Ctrl + Shift + F** la grabación empieza al instante, sin pasos previos. Y puedes cerrar el recuadro mientras grabas: el audio sigue grabándose y el micrófono de arriba brilla para recordártelo.',
    rel: ['grabacion-detalles', 'grabacion-donde', 'grabacion-duracion'],
  },
  {
    id: 'grabacion-donde',
    title: 'Dónde se guardan las grabaciones',
    a: 'Cada grabación se guarda en dos sitios a la vez: dentro de Frame, para escucharla desde la app, y como un archivo de audio normal (en formato M4A, que se abre con cualquier reproductor) en tu computadora, en la carpeta **Documentos**, dentro de **Frame** y luego **Grabaciones**.\n\nPara llegar a ese archivo sin buscarlo, abre la grabación en Frame (en **Inicio** o dentro de su asignatura), pulsa la **rueda** de arriba a la izquierda del recuadro y elige **Abrir ubicación del archivo**: se abrirá la carpeta con el audio ya señalado.',
    tip: 'Tus grabaciones no se suben a la nube: se quedan solo en tu computadora.',
    rel: ['grabacion-detalles'],
  },
  {
    id: 'grabacion-detalles',
    title: 'Escuchar, editar o eliminar una grabación',
    a: 'Busca la grabación: las que guardaste sin asignatura están al final de **Inicio**, y las demás, dentro de su asignatura. **Pulsa sobre ella** y se abrirán sus detalles.\n\nAhí tienes un **reproductor** para escucharla, con su volumen y su **velocidad** (puedes oírla hasta el doble de rápido). En el mismo recuadro puedes cambiarle el **nombre**, la descripción, la importancia y la **asignatura**.\n\nLa **rueda** de arriba a la izquierda del recuadro tiene el resto de opciones: **Abrir archivo**, **Abrir ubicación del archivo** y **Eliminar grabación**.',
    tip: 'Si le quitas la asignatura, la grabación vuelve a aparecer en Inicio.',
    rel: ['grabacion-donde', 'inicio-grabaciones'],
  },
  {
    id: 'grabacion-duracion',
    title: 'Duración máxima de una grabación',
    a: 'Cada grabación tiene un **límite de tiempo** que tú eliges, desde 1 minuto hasta 4 horas. Así, si olvidas detenerla, no se queda grabando para siempre.\n\nPara cambiarlo, abre el recuadro de grabación con el **micrófono** de arriba a la derecha y pulsa la pequeña **rueda** de su esquina superior izquierda. Ajusta las **horas** y los **minutos** con los botones **−** y **+**, o escribe el número directamente.\n\nAl llegar al límite, la grabación se detiene sola y pasa a guardarse: **no se pierde nada**. Si ves que te vas a quedar corto, puedes alargar el límite mientras grabas.',
    tip: 'Debajo del micrófono verás el límite que tienes («Máximo …»). Lo que elijas se recuerda para las próximas grabaciones.',
    rel: ['grabar-nota'],
  },
  {
    id: 'grabacion-microfono',
    title: '«Micrófono no disponible»',
    a: 'Este aviso significa que Frame no pudo usar tu micrófono. Casi siempre es un permiso de Windows, y se arregla en un minuto.\n\nAbre la **Configuración** de Windows, entra en **Privacidad y seguridad** y luego en **Micrófono**. Comprueba que esté activado el permiso para que **las aplicaciones de escritorio** usen el micrófono.\n\nRevisa también que el micrófono esté bien conectado y que ningún otro programa (una videollamada, por ejemplo) lo esté usando en ese momento.',
    rel: ['grabar-nota'],
  },
];

// Ajustes y perfil.
export const AJUSTES: Entry[] = [
  {
    id: 'ajustes-abrir',
    title: 'Abrir Ajustes',
    a: 'Para abrir **Ajustes**, pulsa **tu nombre**, abajo del todo en el menú de la izquierda.\n\nArriba verás tu perfil (tu foto, tu nombre y desde cuándo usas Frame) y, a la derecha, los botones del **tema** y la rueda de tu **Cuenta**. Más abajo están tus **metas diarias de estudio** y **tu expediente**. Al final, a la izquierda, el modo de medición y tu **racha**; a la derecha, los **informes**.',
    tip: 'Al pie de Ajustes encontrarás la versión de Frame y sus documentos: información, términos y reporte de errores.',
    go: '/settings',
    rel: ['ajustes-cuenta-rueda', 'ajustes-metas'],
  },
  {
    id: 'perfil-foto',
    title: 'Cambiar tu foto de perfil',
    a: 'Abre **Ajustes** (pulsa tu nombre, abajo del todo en el menú de la izquierda). Arriba a la izquierda está tu foto, con tu nombre de usuario al lado.\n\nPasa el ratón sobre tu nombre de usuario y pulsa el **lápiz** que aparece. Tu foto se rodeará de un **borde azul**: púlsala, elige una imagen de tu computadora y encuádrala a tu gusto arrastrándola y acercándola.',
    tip: 'Si entraste con Google y no habías puesto foto, Frame usa la de tu cuenta de Google. Y si tienes cuenta, tu foto también aparece en tu celular.',
    go: '/settings',
    rel: ['encuadre-imagen'],
  },
  {
    id: 'perfil-nombre',
    title: 'Cambiar tu nombre de usuario o tu nombre real',
    a: 'En **Ajustes**, arriba a la izquierda, junto a tu foto, está tu **nombre de usuario**. Pasa el ratón sobre él y pulsa el **lápiz** que aparece; escribe el nuevo (hasta 12 caracteres) y pulsa la tecla **Enter** para guardarlo.\n\nJusto debajo están tus **nombres y apellidos** reales, que se cambian igual: con el **lápiz** de su propia fila.',
    tip: 'Frame te saluda arriba, en la barra superior, por tu nombre.',
    go: '/settings',
  },
  {
    id: 'perfil-id',
    title: 'Ver o copiar el ID de tu cuenta',
    a: 'En **Ajustes**, arriba a la izquierda, debajo de tu nombre, aparece el **ID** de tu cuenta: un número que la identifica. **Púlsalo** y se copiará para que puedas pegarlo donde lo necesites.\n\nA su derecha, el recuadro **Miembro desde** te dice qué día empezaste a usar Frame y cuántos días llevas con ella.',
    go: '/settings',
  },
  {
    id: 'ajustes-metas',
    title: 'Fijar tus metas diarias de estudio',
    a: 'Tus metas te ayudan a saber si cada día estudiaste lo que querías. Puedes poner una distinta para cada día de la semana: por ejemplo, más minutos entre semana y menos el domingo.\n\nEn **Ajustes**, debajo de tu perfil, está **Metas diarias de estudio**, con una casilla para cada día. Pulsa el **lápiz** que está a la derecha del título, escribe los minutos de cada día y pulsa el **✓ verde** para guardar (o la **X** para cancelar).',
    tip: 'Si pones 0 minutos, ese día no se califica: es tu día libre. Las metas se usan para tu nota del día, tu racha y «Tu semana en datos».',
    go: '/settings',
    rel: ['nota-diaria', 'racha-que-es'],
  },
  {
    id: 'modo-rendimiento-tiempo',
    title: 'Modo «Rendimiento» o modo «Tiempo»',
    a: 'Frame puede medir tu estudio de dos maneras, y tú eliges cuál te sienta mejor. En **Ajustes**, debajo de **Tu expediente**, hay dos pestañas: **Rendimiento** y **Tiempo**.\n\n**Rendimiento**: al terminar cada sesión indicas cuánto te pudiste concentrar, y cada día recibe una **nota** (AD, A, B o C) según tus minutos y tu concentración.\n\n**Tiempo**: solo cuentan los **minutos** que estudias frente a tu meta. Sin notas y sin tener que calificar tu concentración.',
    tip: 'Puedes cambiar de modo cuando quieras; tus sesiones anteriores no se pierden.',
    go: '/settings',
    rel: ['nota-diaria', 'racha-que-es'],
  },
  {
    id: 'racha-que-es',
    title: 'La racha y la meta de racha',
    a: 'Tu **racha** cuenta cuántos **días seguidos** cumples tu meta de racha. Es una forma sencilla de ver tu constancia: si un día no la cumples, vuelve a empezar desde cero.\n\nLa meta la eliges tú. En **Ajustes**, debajo de las pestañas Rendimiento y Tiempo, está el recuadro **Meta de racha**: pasa el ratón por encima y pulsa el **lápiz** que aparece a la derecha. En modo Rendimiento eliges una **nota mínima** con las flechas; en modo Tiempo escribes los **minutos mínimos**. Luego pulsa el **✓ verde**.',
    tip: 'Justo debajo, el recuadro «Tu racha» te muestra los últimos días y tu mejor racha.',
    go: '/settings',
    rel: ['modo-rendimiento-tiempo', 'ajustes-metas'],
  },
  {
    id: 'expediente',
    title: '«Tu expediente»',
    a: '**Tu expediente** es el resumen de toda tu historia en Frame. Lo encuentras en **Ajustes**, debajo de tus metas diarias.\n\nAhí ves cuánto has estudiado en total, cuántas tareas terminaste (y cuántas a tiempo), tu **mejor racha**, tu sesión más larga y tu mejor día. También te muestra **en qué asignaturas se va tu tiempo**.',
    go: '/settings',
  },
  {
    id: 'ajustes-cuenta-rueda',
    title: 'El menú de la cuenta (la rueda)',
    a: 'En **Ajustes**, arriba a la derecha, debajo de la palabra **Cuenta**, hay un botón con forma de **rueda**. Al pulsarlo se abre un pequeño menú con las opciones de tu cuenta:\n\n**Vincular mi cuenta** (solo si entraste como invitado), **Cerrar sesión**, **Importar de Notion** y **Eliminar cuenta**.',
    tip: 'Solo la cuenta del responsable de Frame ve además «Panel de uso».',
    go: '/settings',
    rel: ['cerrar-sesion', 'ext-notion', 'eliminar-cuenta'],
  },
  {
    id: 'docs-info',
    title: 'Información de la app, términos y reportar un error',
    a: 'Baja hasta el final de **Ajustes**. Ahí verás la **versión** de Frame que tienes y tres documentos que se abren con un clic:\n\n**Información del sistema**: las novedades de cada versión y algunos detalles técnicos. **Términos de servicio**: los términos, condiciones y la política de privacidad. **Reportar un error**: cómo pedir ayuda si algo no funciona.',
    tip: 'Si una pantalla falla, Frame lo reporta sola, sin enviar tus datos. Para sugerencias u otros errores, escribe a vt.asvent@gmail.com.',
    go: '/settings',
  },
];

// Informes PDF y Word. Desde la 1.6.3 vuelven a Ajustes (recuadro «Informes»):
// rendimiento y pendientes, semanal, mensual o anual, con vista previa real.
export const INFORMES: Entry[] = [
  {
    id: 'informes-centro',
    title: 'Los informes',
    a: 'Frame puede preparar por ti un **documento formal** con tu estudio o con tus pendientes, listo para guardar, imprimir o enseñar a tu tutor.\n\nEn **Ajustes**, baja hasta el recuadro **Informes**, a la derecha de tu racha. Arriba tiene tres desplegables: qué informe quieres (**Rendimiento** o **Pendientes**), de qué periodo (**semanal**, **mensual** o **anual**) y cuál (esta semana, la anterior…).\n\nDebajo verás un resumen con sus cifras y la **vista previa** del documento. Si te gusta, pulsa **PDF** o **Word**, al final del recuadro.',
    tip: 'Lo que ves en la vista previa es exactamente lo que se guarda.',
    go: '/settings',
    rel: ['informe-pdf', 'informe-rendimiento', 'informe-pendientes'],
  },
  {
    id: 'informe-pdf',
    title: 'Guardar un informe en PDF o Word',
    a: 'Depende del formato que elijas al final del recuadro **Informes**, en Ajustes:\n\n**PDF**: se abre la ventana de impresión. En la impresora, elige **Guardar como PDF** y decide en qué carpeta guardarlo.\n\n**Word**: el documento se guarda solo en tu carpeta **Descargas**. Aparecerá el aviso **Informe generado** con un botón **Abrir** para verlo al momento.',
    rel: ['informes-centro'],
  },
  {
    id: 'informe-rendimiento',
    title: 'Informe de rendimiento',
    a: 'El informe de **rendimiento** es un documento formal con todo lo que estudiaste en una semana, un mes o un año: el **tiempo por asignatura**, tus sesiones, tus metas, tus calificaciones y tus tareas culminadas, pendientes o vencidas.\n\nPara sacarlo, ve a **Ajustes**, baja hasta **Informes** y elige **Rendimiento** en el primer desplegable. Luego escoge el periodo y cuál quieres.',
    go: '/settings',
    rel: ['informes-centro'],
  },
  {
    id: 'informe-pendientes',
    title: 'Informe de tareas pendientes',
    a: 'El informe de **pendientes** reúne todo lo que tienes por entregar en la semana, el mes o el año que elijas, ordenado por **urgencia** y por asignatura, con el tiempo que calculas que te llevará.\n\nPara sacarlo, ve a **Ajustes**, baja hasta **Informes** y elige **Pendientes** en el primer desplegable.',
    tip: 'Si eliges el periodo actual, también incluye lo que ya venció y las tareas sin fecha, para que nada se te escape.',
    go: '/settings',
  },
];

// Cuenta, nube, sincronización y actualizaciones.
export const CUENTA: Entry[] = [
  {
    id: 'entrar-cuenta',
    title: 'Entrar a Frame',
    a: 'Al abrir Frame por primera vez verás la pantalla de acceso. Tienes dos formas de entrar con una cuenta:\n\n**Continuar con Google**: entras con tu cuenta de Google en un par de clics.\n\n**Con tu correo**: en la pestaña **Registrarse** escribe tu correo, un nombre de usuario y una **contraseña nueva, solo para Frame**. Te llegará un correo con un enlace para activar tu cuenta (si no lo ves, mira en spam). Las siguientes veces entras desde la pestaña **Iniciar sesión**.',
    tip: 'No uses la contraseña de tu correo: Frame nunca la necesita.',
    rel: ['invitado-que-es', 'sync-como-funciona'],
  },
  {
    id: 'invitado-que-es',
    title: 'Entrar como invitado',
    a: 'Si prefieres probar Frame sin crear una cuenta, en la pantalla de acceso pulsa **Entrar como invitado**: entras al instante.\n\nTodo funciona igual, con una diferencia importante: tus datos se guardan **solo en ese equipo**. No tienen copia en la nube ni aparecen en tu celular.',
    tip: 'Cuando quieras, vincula una cuenta: todo lo que hiciste como invitado pasa a ella sin perder nada.',
    rel: ['invitado-vincular'],
  },
  {
    id: 'invitado-vincular',
    title: 'Pasar de invitado a una cuenta',
    a: 'Si entraste como invitado, abajo del todo en el menú de la izquierda, junto a tu nombre, verás una **G**. Púlsala y entra con **Google** o con tu **correo**.\n\nTodo lo que hiciste como invitado (tareas, sesiones, hábitos…) **pasa a tu cuenta**, queda respaldado en la nube y podrás verlo en tu celular.',
    tip: 'También puedes hacerlo desde Ajustes: la rueda de «Cuenta», arriba a la derecha, tiene la opción «Vincular mi cuenta».',
    rel: ['invitado-que-es', 'entrar-cuenta'],
  },
  {
    id: 'sync-como-funciona',
    title: 'Cómo se sincroniza entre dispositivos',
    a: 'Si entras con la **misma cuenta** en tu computadora y en tu celular, Frame mantiene los dos al día por sí sola. No tienes que pulsar nada.\n\nCada cambio que haces se sube al momento, y el otro dispositivo lo recibe en unos segundos. Si cambiaste lo mismo en los dos, se queda el cambio más reciente. Y nada se borra sin que tú lo hagas.',
    tip: 'Si un cambio no llega, revisa que ambos tengan internet y que en la campana no aparezca «Sin conexión con tu cuenta».',
    rel: ['nube-que-se-guarda', 'sin-conexion-aviso'],
  },
  {
    id: 'cerrar-sesion',
    title: 'Cerrar sesión',
    a: 'Abre **Ajustes** (pulsa tu nombre, abajo del todo en el menú de la izquierda). Arriba a la derecha, debajo de la palabra **Cuenta**, pulsa la **rueda** y elige **Cerrar sesión**.\n\nNo te preocupes por tus datos: siguen guardados en la nube y vuelven en cuanto entres de nuevo con tu cuenta.',
    go: '/settings',
    rel: ['eliminar-cuenta'],
  },
  {
    id: 'eliminar-cuenta',
    title: 'Eliminar tu cuenta',
    a: 'En **Ajustes**, arriba a la derecha, pulsa la **rueda** que está debajo de **Cuenta** y elige **Eliminar cuenta** (si eres invitado, se llama **Eliminar mis datos**).\n\nPara confirmar, escribe la palabra **ELIMINAR** y marca la casilla que dice que entiendes que se pierde todo. Se borrarán para siempre tus datos de este equipo, tu copia en la nube y tus estadísticas.',
    tip: 'No se puede deshacer. Los archivos que guardaste en carpetas de tu computadora (tus grabaciones o tu música original) siguen donde estaban.',
    go: '/settings',
  },
  {
    id: 'actualizar-frame',
    title: 'Actualizar Frame',
    a: 'Cuando hay una versión nueva de Frame, te enterarás por dos sitios: aparece un **botón con una flecha de descarga** junto a tu nombre, abajo del todo en el menú de la izquierda, y llega un aviso a la **campana**.\n\nAl pulsar ese botón se abre un recuadro con lo que **pesa** la actualización, el **tiempo** que tardará y sus pasos. Pulsa **Actualizar ahora**: verás el porcentaje y el tiempo que falta. Al terminar, Frame se reinicia sola, con todos tus datos intactos.',
    tip: 'Si estás en una sesión de estudio, con música sonando o en medio de una grabación, Frame espera a que termines para no interrumpirte. Y nunca se actualiza sin que tú lo confirmes.',
    rel: ['instalar-frame'],
  },
  {
    id: 'instalar-frame',
    title: 'Instalar Frame en otra computadora o en el celular',
    a: 'Frame se descarga gratis desde su página web. Allí encontrarás dos botones: **Descargar para Windows**, para tu computadora, y **Descargar para Android**, para tu celular o tablet.\n\nDespués de instalarla, **entra con la misma cuenta** que ya usas: tus asignaturas, tareas y sesiones aparecerán solas.',
    tip: 'En Android, para actualizar basta con descargar e instalar la versión nueva encima de la anterior: tus datos se conservan. Por ahora no hay versión para iPhone.',
    rel: ['sync-como-funciona'],
  },
];

// Problemas frecuentes.
export const PROBLEMAS: Entry[] = [
  {
    id: 'contrasena-olvidada',
    title: 'Olvidé mi contraseña',
    a: 'No pasa nada: puedes elegir una contraseña nueva en un par de minutos.',
    steps: [
      'En la pantalla para entrar a Frame, escribe el **correo** de tu cuenta.',
      'Pulsa **¿Olvidaste tu contraseña?**, debajo del cuadro de la contraseña.',
      'Abre el correo que te llega (mira también en spam) y pulsa su enlace: se abre una página de Frame en tu navegador.',
      'Escribe tu **contraseña nueva** dos veces y pulsa **Guardar contraseña**. Luego vuelve a Frame e inicia sesión con ella.',
    ],
    tip: 'El enlace caduca en una hora y solo sirve una vez. Si tu correo es de Gmail, también puedes entrar con **Continuar con Google** sin contraseña.',
    rel: ['entrar-cuenta', 'docs-info'],
  },
  {
    id: 'problema-interfaz',
    title: '«Esta interfaz no pudo abrirse»',
    a: 'Este mensaje aparece cuando una parte de esa pantalla falló. Lo importante: **tus datos no se perdieron**.\n\nPulsa **Reintentar** para volver a cargarla, o ve a otra sección desde el menú de la izquierda y sigue con lo tuyo.',
    tip: 'Frame nos avisa del fallo por su cuenta (sin enviar tus datos) para que podamos corregirlo.',
    rel: ['problema-lento'],
  },
  {
    id: 'problema-lento',
    title: 'Frame va lenta o se trabó',
    a: 'Cierra Frame y vuelve a abrirla: todo lo que hiciste está guardado.\n\nSi estabas en una sesión de estudio, al volver Frame te ofrecerá **retomarla** o **registrarla**, así que no perderás ese tiempo. Si el problema se repite, revisa que tengas la última versión de Frame.',
    rel: ['actualizar-frame', 'sesion-interrumpida'],
  },
  {
    id: 'problema-espacio',
    title: '«No hay espacio para guardar»',
    a: 'Este aviso significa que tu computadora se quedó **sin espacio** para guardar los datos de Frame.\n\nLibera espacio borrando archivos que ya no necesites, o elimina de Frame grabaciones y canciones que no uses. Mientras falte espacio, tus últimos cambios podrían no guardarse.',
  },
  {
    id: 'problema-correo-confirmar',
    title: 'No me llega el correo para activar la cuenta',
    a: 'A veces ese correo se esconde: busca en tu carpeta de **spam** o de **promociones**.\n\nSi después de unos minutos sigue sin aparecer, entra con **Continuar con Google**: no necesita confirmar el correo.',
    rel: ['entrar-cuenta'],
  },
  {
    id: 'problema-datos-no-aparecen',
    title: 'No veo mis datos en otro dispositivo',
    a: 'No te preocupes: lo más probable es que tus datos estén a salvo. Revisa dos cosas:\n\nQue entraste con **la misma cuenta** en los dos dispositivos, y que **ambos tienen internet**.\n\nSi en uno de ellos entraste como **invitado**, sus datos solo están en ese equipo. Para pasarlos a tu cuenta, pulsa la **G** que aparece junto a tu nombre, abajo del todo en el menú de la izquierda.',
    tip: 'Tu música, tus grabaciones y los archivos adjuntos de las tareas nunca viajan por la nube: se quedan en el equipo donde los guardaste.',
    rel: ['sync-como-funciona', 'invitado-vincular', 'nube-que-se-guarda'],
  },
];
