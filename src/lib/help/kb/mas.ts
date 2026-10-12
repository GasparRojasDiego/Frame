import type { HelpAreaId, HelpEntry } from '../areas';

// ============================================================
// Respuestas añadidas en la 1.6.0: funciones que no tenían respuesta propia
// y los problemas más frecuentes, con lo que de verdad hace la app.
// (Estilo de las respuestas: ver basico.ts.)
// ============================================================

type Entry = Omit<HelpEntry, 'area'>;

const TAREAS_MAS: Entry[] = [
  {
    id: 'tarea-mover-asignatura',
    title: 'Pasar una tarea a otra asignatura',
    a: 'Por ahora, una tarea que ya está dentro de una asignatura no se puede pasar a otra. La solución es sencilla: **créala de nuevo** en la asignatura correcta y **elimina** la equivocada.\n\nSi apuntaste la tarea con el botón **+** de la barra de arriba sin elegir asignatura, entonces sí puedes colocarla después: búscala en **Inicio** y pulsa **Colocar en una asignatura**.',
    tip: 'Si eliminas algo por error, presiona Ctrl + Z en los segundos siguientes y volverá.',
    rel: ['tarea-crear', 'tarea-eliminar', 'inicio-sin-asignatura'],
  },
];

const MUSICA_MAS: Entry[] = [
  {
    id: 'musica-volumen',
    title: 'El volumen de la música',
    a: 'Mientras suena una canción, abajo de la pantalla está la **barra de reproducción**. En su parte derecha verás un **altavoz** con una barra a su lado: arrastra esa barra para **subir o bajar** el volumen.\n\nSi quieres silenciar la música de golpe, pulsa el **altavoz**. Púlsalo otra vez y volverá a sonar.',
    tip: 'Ese volumen es solo el de Frame. Si no oyes nada, revisa también el volumen de tu computadora.',
    go: '/music',
    rel: ['musica-controles', 'musica-no-suena'],
  },
  {
    id: 'musica-controles',
    title: 'Pausar, pasar o volver a una canción',
    a: 'Los controles de la música están en el centro de la **barra de reproducción**, abajo de la pantalla.\n\nEl **botón redondo azul** pausa la canción y la vuelve a poner. Las **flechas** que tiene a cada lado pasan a la **siguiente** canción o vuelven a la **anterior**.\n\nJusto debajo está la **línea de tiempo** de la canción: pulsa en cualquier punto, o arrastra sobre ella, para ir a ese momento.',
    tip: 'En la pantalla «Reproduciendo» (el icono de dos flechas, en la esquina inferior derecha de la barra) también puedes pulsar cualquier verso de la letra para saltar a ese momento.',
    go: '/music',
    rel: ['musica-repetir', 'musica-volumen', 'musica-reproduciendo'],
  },
  {
    id: 'letra-ajustar',
    title: 'La letra va adelantada, atrasada o no es la correcta',
    a: 'Abre la pantalla **Reproduciendo** con el icono de **dos flechas**, en la esquina inferior derecha de la barra de reproducción.\n\nSi la letra va **adelantada o atrasada** respecto a la música, usa los botones **−** y **+** que están debajo de la letra, a la derecha: cada pulsación la mueve medio segundo. Frame recuerda ese ajuste para esa canción.\n\nSi la letra directamente **no es la de esa canción**, puedes darle tú la correcta: elimina la canción de Frame y vuelve a importarla junto con su archivo de letra (uno con el mismo nombre que la canción, terminado en .lrc).',
    go: '/music',
    rel: ['musica-reproduciendo', 'musica-letras'],
  },
];

const PROBLEMAS_MAS: Entry[] = [
  {
    id: 'musica-no-suena',
    title: 'Una canción no suena o se salta sola',
    a: 'Cuando el archivo de una canción está **dañado o incompleto**, Frame no puede reproducirlo. Para que la música no se detenga, la salta y pasa a la siguiente.\n\nPara arreglarla, **elimínala** de Frame y vuelve a importarla desde tu computadora.\n\nSi no suena **ninguna** canción, revisa el volumen de Frame (el altavoz, a la derecha de la barra de reproducción) y también el de tu computadora.',
    rel: ['musica-volumen', 'musica-anadir'],
  },
  {
    id: 'datos-perdidos',
    title: 'Se borraron mis tareas (o algo desapareció)',
    a: 'No te preocupes, casi siempre tiene arreglo.\n\nSi lo **acabas de borrar**, presiona **Ctrl + Z**: deshace el último borrado durante unos segundos.\n\nSi lo que falta son tareas que **culminaste** o marcaste como incompletas, no se perdieron: están en **Archivadas**. En la sección **Tareas**, pulsa el botón de la **caja**, arriba.\n\nY si entraste desde otro dispositivo, comprueba que sea **la misma cuenta**: tus datos vuelven solos desde la nube.',
    tip: 'Con cuenta, cada cambio queda respaldado en la nube. Como invitado, los datos viven solo en ese equipo.',
    rel: ['deshacer', 'tarea-archivadas', 'problema-datos-no-aparecen'],
  },
  {
    id: 'notificaciones-no-llegan',
    title: 'No me llegan las notificaciones',
    a: 'Frame te avisa con las **notificaciones de Windows**, así que lo primero es revisar que Windows se lo permita.\n\nAbre la **Configuración** de Windows, entra en **Sistema** y luego en **Notificaciones**. Comprueba que estén activadas para **Frame** y que el modo **No molestar** esté apagado.\n\nTen en cuenta también que Frame tiene que estar **abierta** para avisarte (puede estar minimizada).',
    rel: ['tarea-recordatorio', 'notificaciones', 'temporizador-aviso'],
  },
  {
    id: 'frame-no-abre',
    title: 'Frame no abre o se queda en blanco',
    a: 'Primero, **cierra Frame del todo** y vuelve a abrirla. Mira también los iconos que hay junto al reloj de Windows, abajo a la derecha: si ves el de Frame, ciérrala desde ahí.\n\nSi sigue igual, descarga la **última versión** desde la página de Frame e instálala encima de la que tienes. **Tus datos se conservan**, y el instalador repara lo que le haga falta a tu computadora para abrirla.',
    rel: ['problema-lento', 'actualizar-frame'],
  },
  {
    id: 'clima-no-carga',
    title: 'El clima no carga',
    a: 'El clima de **Inicio** necesita internet para cargarse, así que primero revisa tu conexión.\n\nSi aparece el mensaje de que no se pudo detectar tu ubicación, pulsa **Elegir ubicación** (o el nombre de la ciudad) y escribe la tuya. Frame la recordará para la próxima vez.',
    go: '/',
    rel: ['clima-ubicacion', 'clima-pronostico'],
  },
  {
    id: 'google-no-entra',
    title: 'No puedo entrar con Google',
    a: 'Al pulsar **Continuar con Google** se abre una ventana con la página de Google: el acceso se termina **en esa ventana**, eligiendo tu cuenta.\n\nSi la cerraste antes de tiempo o pasaron más de 5 minutos, vuelve a pulsar el botón. Comprueba también que tienes internet.\n\nSi aun así no funciona, puedes entrar con tu **correo** y tu contraseña de Frame.',
    rel: ['entrar-cuenta', 'contrasena-olvidada'],
  },
];

const INFORMES_MAS: Entry[] = [
  {
    id: 'informe-no-abre',
    title: 'Dónde queda el informe (o no se abre)',
    a: 'Depende del formato que elegiste:\n\n**Word**: se guarda solo en tu carpeta **Descargas**. Al terminar aparece el aviso **Informe generado** con un botón **Abrir** para verlo al momento.\n\n**PDF**: no se descarga directamente; se abre la ventana de impresión. Ahí, como impresora, elige **Guardar como PDF** (o **Microsoft Print to PDF**) y luego la carpeta donde quieres guardarlo.',
    tip: 'Para abrir el informe de Word necesitas un programa que lea documentos de Word, como Microsoft Word, LibreOffice o Google Docs.',
    rel: ['informe-pdf', 'informes-centro'],
  },
];

const ENFOQUE_MAS: Entry[] = [
  {
    id: 'temporizador-aviso',
    title: 'El aviso al terminar la sesión',
    a: 'Sí: cuando el temporizador llega a cero, Frame te avisa con una **notificación de Windows** y un **sonido**, aunque estés trabajando en otra ventana.\n\nSi no te llega, revisa que las notificaciones de Windows estén activadas para Frame y que el volumen de tu computadora no esté en silencio.',
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
