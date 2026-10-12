import type { HelpEntry } from '../search';

type Entry = Omit<HelpEntry, 'area'>;

// Extensiones. Desde la 1.6.2 no se añaden con el «+» de la barra de la
// Ayuda (ya no existe): Notion, la única, viene incluida y se abre desde
// Ajustes → rueda → «Importar de Notion» o con /notion. Las conversaciones
// con la Ayuda pasaron a basico.ts, junto a la propia Ayuda.
export const EXTENSIONES: Entry[] = [
  {
    id: 'ext-que-son',
    title: 'Las extensiones (Notion)',
    q: ['qué son las extensiones', 'dónde quedó el más de la barra de la ayuda', 'cómo añado una extensión', 'extensiones de frame'],
    k: ['extensiones', 'extension', 'notion', 'mas'],
    a: 'Ya no hay extensiones que añadir: la única, Notion, viene incluida. Su importador se abre desde Ajustes → rueda → «Importar de Notion», o escribiendo /notion en la barra de la Ayuda.',
    tip: 'El «+» que tenía la barra de la Ayuda (la del botón redondo de abajo a la derecha) para añadirlas ya no existe.',
    go: '/settings',
    rel: ['ext-notion', 'ayuda-barra'],
  },
  {
    id: 'ext-notion',
    title: 'Importar tareas y fechas de Notion',
    q: ['cómo importo mis tareas de notion', 'pasar mis tareas de notion a frame', 'importar notion', 'traer fechas de notion'],
    k: ['notion', 'importar', 'csv', 'zip', 'exportar', 'importar de notion'],
    a: 'En Ajustes, pulsa la rueda de la cuenta y elige «Importar de Notion». En Notion, abre tu base de datos de tareas → ••• → Exportar → «Markdown y CSV»; elige en Frame el .zip descargado (o el .csv) y marca qué filas importar, como tareas o como fechas del calendario.',
    tip: 'Reconoce fechas, estado, prioridad, tipo y la asignatura (si coincide con una tuya). No se conecta a tu cuenta de Notion. Atajo: escribe /notion en la Ayuda.',
    go: '/settings',
    rel: ['ext-que-son', 'tarea-crear'],
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
