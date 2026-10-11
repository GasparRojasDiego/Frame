import { HELP_ENTRIES, helpIndex } from '../src/lib/help/kb/index';
import { VARIANTES } from '../src/lib/help/kb/variantes';
import { answer, normalize, suggest } from '../src/lib/help/search';
import { allTours } from '../src/lib/help/tours';
import { CASOS } from './ayuda-casos';

const index = helpIndex();
const ids = new Set<string>();
for (const e of HELP_ENTRIES) {
  if (ids.has(e.id)) console.log('DUPLICADO', e.id);
  ids.add(e.id);
}
for (const e of HELP_ENTRIES) for (const r of e.rel ?? []) if (!ids.has(r)) console.log('REL ROTO', e.id, '→', r);
console.log('Entradas:', HELP_ENTRIES.length);

/** Varios ids = cualquiera vale (pregunta ambigua o respuesta nueva igual de buena). */
const cases: [string, string | string[] | null][] = [
  ['como empiezo a estudiar', 'enfoque-iniciar'],
  ['como uso el pomodoro', 'enfoque-iniciar'],
  ['como pongo 45 minutos en el temporizador', 'enfoque-duracion'],
  ['como paso mi musica al celular', 'musica-celular'],
  ['cmo paso mis canciones al telefono', 'musica-celular'],
  ['como creo un habito', 'habito-crear'],
  ['como borro un habito', 'habito-archivar'],
  ['como se calcula mi nota', 'nota-diaria'],
  ['que significa AD', 'nota-diaria'],
  ['como creo una tarea', 'tarea-crear'],
  ['como elimino una tarea', 'tarea-eliminar'],
  ['donde estan mis tareas terminadas', 'tarea-archivadas'],
  ['como pongo un recordatorio', 'tarea-recordatorio'],
  ['como adjunto un archivo a una tarea', 'tarea-adjuntos'],
  ['como creo una asignatura', 'asig-crear'],
  ['como agrupo mis cursos', 'asig-coleccion'],
  ['como importo mi horario', 'asig-horario-importar'],
  ['como subo mi horario', 'horario-subir'],
  ['como pongo una imagen a mi curso', 'asig-imagen'],
  ['como creo un evento', 'cal-evento-crear'],
  ['como pongo un feriado en el calendario', 'cal-evento-crear'],
  ['como conecto google calendar', 'gcal-vincular'],
  ['como descargo una cancion', 'musica-anadir'],
  ['como importo mi spotify', 'musica-anadir'],
  ['como repito una cancion', 'musica-repetir'],
  ['como veo la letra', 'musica-reproduciendo'],
  ['como creo una playlist', 'playlist-crear'],
  ['como grabo la clase', 'grabar-nota'],
  ['donde se guardan mis audios', 'grabacion-donde'],
  ['como cambio mi foto de perfil', 'perfil-foto'],
  ['como pongo el modo oscuro', 'tema-claro-oscuro'],
  ['como cambio mi meta de estudio', 'ajustes-metas'],
  ['que es la racha', 'racha-que-es'],
  ['como saco un informe en pdf', 'informes-centro'],
  ['como cierro sesion', 'cerrar-sesion'],
  ['como borro mi cuenta', 'eliminar-cuenta'],
  ['como actualizo frame', 'actualizar-frame'],
  ['como vinculo mi cuenta de invitado', 'invitado-vincular'],
  ['funciona sin internet', 'sin-internet'],
  ['que es la matriz de competencias', 'matriz-competencias'],
  ['como pongo el reloj encima de otras ventanas', 'vista-flotante'],
  ['como anoto lo que avance', 'enfoque-anotar'],
  ['me equivoque de asignatura en la sesion', 'enfoque-corregir'],
  ['como cambio la ciudad del clima', 'clima-ubicacion'],
  ['que es la campana', 'notificaciones'],
  ['sin conexion', 'sin-conexion-aviso'],
  // Ronda ciega: redactadas sin mirar las preguntas del banco.
  ['quiero estudiar 25 minutos y descansar', 'enfoque-iniciar'],
  ['se puede ver el tiempo mientras uso word', 'vista-flotante'],
  ['olvide parar el cronometro anoche', 'enfoque-descartar'],
  ['por que me salio B si estudie bastante', 'nota-diaria'],
  ['donde veo cuanto estudie el martes pasado', 'calendario-calificaciones'],
  ['mi profe dejo un trabajo para el viernes como lo apunto', 'tarea-crear'],
  ['quiero que me avise a las 8 de la noche', 'tarea-recordatorio'],
  ['ya no voy a poder entregar ese trabajo', 'tarea-incompleta'],
  ['como veo solo los examenes', 'tarea-filtros'],
  ['quiero leer 20 minutos cada noche', 'habito-crear'],
  ['solo quiero hacer ejercicio lunes miercoles y viernes', 'habito-frecuencia'],
  ['como se cual dia fallo mas mis habitos', 'habito-analisis'],
  ['quiero juntar fisica quimica y biologia', 'asig-coleccion'],
  ['tengo la foto del horario que nos dio el tutor', 'asig-horario-importar'],
  ['donde guardo el link de la clase virtual', 'asig-recursos'],
  ['quiero marcar el aniversario del colegio', 'cal-evento-crear'],
  ['tengo mis playlists en spotify y las quiero aqui', 'musica-anadir'],
  ['quiero que una cancion suene una y otra vez', 'musica-repetir'],
  ['la letra va desfasada', 'letra-ajustar'],
  ['quiero llevarme mis mp3 al android', 'musica-celular'],
  ['grabar lo que explica el profesor', 'grabar-nota'],
  ['el audio no se escucha nada al grabar', 'grabacion-microfono'],
  ['quiero ponerle mas minutos a mi meta del lunes', 'ajustes-metas'],
  ['no quiero que me ponga notas solo contar minutos', 'modo-rendimiento-tiempo'],
  ['necesito un documento con mis horas para mi tutor', 'informes-centro'],
  ['el pdf no se guarda', ['informe-pdf', 'informe-no-abre']],
  ['entre sin cuenta y ahora quiero guardar todo', 'invitado-vincular'],
  ['instale en la laptop de mi hermano y no salen mis cosas', 'problema-datos-no-aparecen'],
  ['como se instala la nueva version', 'actualizar-frame'],
  ['me sale que no se pudo abrir esta interfaz', 'problema-interfaz'],
  ['como cambio mi username', 'perfil-nombre'],
  ['quiero la pantalla blanca', 'tema-claro-oscuro'],
  ['para que sirve el boton mas de arriba', 'tarea-crear-rapida'],
  ['como escribo una frase arriba', 'frase-personal'],
  ['que pasa si se va el internet', 'sin-internet'],
  ['borre una tarea sin querer', ['deshacer', 'datos-perdidos']],
  ['quien hizo esta app', 'conoce-vt-asvent'],
  ['escribeme un ensayo sobre la revolucion francesa', null],
  ['cuantos años tiene el universo', null],
  ['dame una receta de pollo', null],
  // Segunda ronda ciega (sin ajustar el banco después de escribirla).
  ['puedo pausar y seguir despues', 'enfoque-iniciar'],
  ['como se cuanto me falta para mi meta de hoy', 'enfoque-hoy'],
  ['quiero cambiar mi nota de enfoque de la sesion de hoy', 'enfoque-corregir'],
  ['donde veo mis estadisticas de la semana', ['progreso-academico', 'semana-en-datos']],
  ['quiero estudiar con musica de youtube', 'videos-estudio'],
  ['se me cerro frame mientras estudiaba', 'sesion-interrumpida'],
  ['como le pongo fecha a una tarea', 'tarea-editar'],
  ['como subo el porcentaje de una tarea', 'tarea-progreso'],
  ['tengo muchas tareas atrasadas', 'tareas-vencidas'],
  ['donde estan las tareas que no termine', 'tarea-incompleta'],
  ['quiero adjuntar un pdf a mi tarea', 'tarea-adjuntos'],
  ['como marco que hice mi rutina', 'habito-marcar'],
  ['puedo cambiar un habito de la manana a la tarde', 'habito-fases'],
  ['como borro una asignatura', 'asig-editar'],
  ['como guardo apuntes en un curso', 'asig-recursos'],
  ['como anoto el tema que vimos hoy en clase', 'asig-clases'],
  ['como borro un evento del calendario', 'cal-editar'],
  ['puedo ver mi correo aqui', 'gmail-usar'],
  ['como entro a classroom', 'classroom-usar'],
  ['como pongo una cancion en favoritos', 'musica-favoritas'],
  ['como cambio el orden de mis playlists', 'playlist-ordenar'],
  ['como le cambio la foto a una playlist', 'playlist-editar'],
  ['la musica se escucha sin internet', 'sin-internet'],
  ['donde quedan guardados los audios que grabo', 'grabacion-donde'],
  ['como escucho mas rapido una grabacion', 'grabacion-detalles'],
  ['donde cambio mi nombre', 'perfil-nombre'],
  ['que significa la racha', 'racha-que-es'],
  ['como saco un reporte de mis habitos', 'informe-habitos'],
  ['como uso frame en mi celular', 'instalar-frame'],
  ['olvide mi contrasena', 'contrasena-olvidada'],
  // 1.5.8
  ['como envio una sugerencia', 'sugerencias-enviar'],
  ['donde reporto un error', 'sugerencias-enviar'],
  ['como importo mis tareas de notion', 'ext-notion'],
  ['donde esta youtube', 'youtube-usar'],
  ['para que sirve el mas de la barra de abajo de la esfera', 'ext-que-son'],
  ['cuanto es 2 + 2', null],
  ['cual es la capital de francia', null],
  ['resuelve esta ecuacion x2 + 3 = 7', null],
  ['quien fue simon bolivar', null],
  ['hola', null],
  ['gracias', null],
  ['pizza', null],
  
  ['musica', 'musica-intro'],
  ['tareas', 'tareas-intro'],
];

let ok = 0;
for (const [q, expected] of cases) {
  const r = answer(index, q);
  const got = r.kind === 'answer' ? r.match.entry.id : null;
  const pass = Array.isArray(expected) ? expected.includes(got ?? '') : got === expected;
  if (pass) ok++;
  const extra = r.kind === 'answer' ? `${r.match.score.toFixed(2)}/${r.match.coverage.toFixed(2)}` : r.kind;
  console.log(`${pass ? 'OK ' : 'MAL'} ${q.padEnd(48)} → ${String(got).padEnd(26)} ${extra}${pass ? '' : `   (esperado ${expected})`}`);
}
console.log(`\n${ok}/${cases.length} correctas`);

// --- 1.6.0: preguntas de prueba escritas aparte del banco (scripts/ayuda-casos.ts) ---
const tests = new Set(CASOS.map(([q]) => normalize(q)));
for (const [id, list] of Object.entries(VARIANTES)) {
  if (!ids.has(id)) console.log('VARIANTE DE UN ID QUE NO EXISTE', id);
  for (const v of list) if (tests.has(normalize(v))) console.log('VARIANTE COPIADA DE LA PRUEBA', id, '|', v);
}
for (const tour of allTours()) if (!ids.has(tour.id)) console.log('RECORRIDO DE UN ID QUE NO EXISTE', tour.id);
let held = 0;
for (const [q, expected] of CASOS) {
  for (const one of [expected].flat()) if (one && !ids.has(one)) console.log('CASO CON ID INEXISTENTE', one);
  const r = answer(index, q);
  const got = r.kind === 'answer' ? r.match.entry.id : null;
  const pass = Array.isArray(expected) ? expected.includes(got ?? '') : got === expected;
  if (pass) held++;
  else console.log(`MAL ${q.padEnd(48)} → ${String(got).padEnd(26)} (esperado ${expected})`);
}
console.log(`Preguntas nuevas: ${held}/${CASOS.length} correctas · ${HELP_ENTRIES.reduce((a, e) => a + e.q.length, 0)} formas de preguntar · ${allTours().length} recorridos`);
console.log('sugerencias «grab»:', suggest(index, 'grab').map((e) => e.id));
console.log('sugerencias «como paso»:', suggest(index, 'como paso mi mus').map((e) => e.id));
