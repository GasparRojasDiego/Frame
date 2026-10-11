import type { HelpEntry } from '../search';

type Entry = Omit<HelpEntry, 'area'>;

// Extensiones de la barra de ayuda y sus conversaciones.
export const EXTENSIONES: Entry[] = [
  {
    id: 'ext-que-son',
    title: 'Qué son las extensiones',
    q: ['qué son las extensiones', 'para qué sirve el más de la barra', 'cómo añado una extensión', 'cómo quito una extensión', 'extensiones de frame'],
    k: ['extensiones', 'mas', 'notion'],
    a: 'Son herramientas que se suman a la barra de la Ayuda (el botón redondo de abajo a la derecha). Hoy hay una: Notion, para importar tus tareas y fechas.',
    steps: [
      'Abre la Ayuda con el botón redondo de abajo a la derecha y pulsa el «+» de la barra, a la izquierda del botón de enviar.',
      'Pulsa «Añadir» en la que quieras.',
      'Aparece como etiqueta dentro de la barra; para quitarla, vuelve al «+» y pulsa «Añadida».',
    ],
    tip: 'Atajo: /notion.',
    go: '/ayuda',
    rel: ['ext-notion'],
  },
  {
    id: 'ext-notion',
    title: 'Importar tareas y fechas de Notion',
    q: ['cómo importo mis tareas de notion', 'pasar mis tareas de notion a frame', 'importar notion', 'traer fechas de notion'],
    k: ['notion', 'importar', 'csv', 'zip', 'exportar'],
    a: 'Añade la extensión Notion y se abre su importador. En Notion, abre tu base de datos de tareas → ••• → Exportar → «Markdown y CSV»; elige en Frame el .zip descargado (o el .csv) y marca qué filas importar, como tareas o como fechas del calendario.',
    tip: 'Reconoce fechas, estado, prioridad, tipo y la asignatura (si coincide con una tuya). No se conecta a tu cuenta de Notion.',
    go: '/ayuda',
    rel: ['ext-que-son', 'tarea-crear'],
  },
  {
    id: 'ayuda-conversaciones',
    title: 'Tus conversaciones con la ayuda',
    q: ['dónde veo mis preguntas anteriores', 'historial de la ayuda', 'conversaciones anteriores', 'cómo borro mis preguntas', 'volver a ver una respuesta'],
    k: ['conversaciones', 'historial', 'anteriores', 'preguntas'],
    a: 'En la Ayuda, «Conversaciones» guarda cada pregunta con su respuesta: está arriba a la derecha antes de preguntar y, con una respuesta abierta, en la pestaña junto a «Respuesta». Pulsa una para volver a verla.',
    tip: 'Se guardan solo en este equipo, en tu perfil. Puedes borrarlas una a una o todas desde la propia lista.',
    go: '/ayuda',
    rel: ['ayuda-barra'],
  },
];

// Sugerencias y errores: por correo (desde la 1.5.9 no hay botón en la app).
export const SUGERENCIAS: Entry[] = [
  {
    id: 'sugerencias-enviar',
    title: 'Enviar una sugerencia o reportar un error',
    q: ['cómo envío una sugerencia', 'cómo propongo una mejora', 'dónde reporto un error', 'quiero dar mi opinión', 'cómo contacto a los creadores de frame'],
    k: ['sugerencias', 'mejora', 'opinion', 'error', 'correo', 'contacto'],
    a: 'Escríbenos a vt.asvent@gmail.com con tu propuesta o con el error que viste (qué hacías y qué pasó). Leemos todos los correos.',
    tip: 'Los errores que rompen una interfaz, además, se reportan solos, sin datos tuyos.',
    rel: ['docs-info'],
  },
];
