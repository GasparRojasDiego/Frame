import type { HelpEntry } from '../areas';

type Entry = Omit<HelpEntry, 'area'>;

// Extensiones. Desde la 1.6.2 no se añaden con el «+» de la barra de la
// Ayuda (ya no existe): Notion, la única, viene incluida y se abre desde
// Ajustes → rueda → «Importar de Notion» o con /notion. Las conversaciones
// con la Ayuda pasaron a basico.ts, junto a la propia Ayuda.
// (Estilo de las respuestas: ver basico.ts.)
export const EXTENSIONES: Entry[] = [
  {
    id: 'ext-que-son',
    title: 'Las extensiones (Notion)',
    a: 'Ya no hace falta añadir extensiones: la única que había, la de **Notion**, ahora viene incluida en Frame.\n\nPara usarla, abre **Ajustes** (pulsa tu nombre, abajo del todo en el menú de la izquierda), pulsa la **rueda** que está arriba a la derecha, debajo de **Cuenta**, y elige **Importar de Notion**.',
    go: '/settings',
    rel: ['ext-notion'],
  },
  {
    id: 'ext-notion',
    title: 'Importar tareas y fechas de Notion',
    a: 'Si tenías tus tareas organizadas en **Notion**, puedes traerlas a Frame sin copiarlas una por una. Primero se descargan desde Notion y luego se abren en Frame:',
    steps: [
      'En **Notion**, abre la base de datos donde tienes tus tareas.',
      'Pulsa los **tres puntos** (•••), arriba a la derecha, y elige **Exportar**.',
      'Como formato, elige **Markdown y CSV** y pulsa **Exportar**: se descargará un archivo comprimido (.zip).',
      'En **Frame**, abre **Ajustes**, pulsa la **rueda** de **Cuenta** (arriba a la derecha) y elige **Importar de Notion**.',
      'Pulsa **Elegir el archivo de Notion** y selecciona el archivo que descargaste.',
      'Marca qué filas quieres traer y si se guardan **como tareas** o **como fechas del calendario**. Luego pulsa **Importar**.',
    ],
    tip: 'Frame reconoce las fechas, el estado, la prioridad, el tipo y la asignatura (si se llama igual que una tuya). Todo ocurre en tu computadora: Frame no se conecta a tu cuenta de Notion.',
    go: '/settings',
    rel: ['ext-que-son', 'tarea-crear'],
  },
];

// Sugerencias y errores: por correo (desde la 1.5.9 no hay botón en la app).
export const SUGERENCIAS: Entry[] = [
  {
    id: 'sugerencias-enviar',
    title: 'Enviar una sugerencia o reportar un error',
    a: '¡Nos encantará leerte! Escríbenos a **vt.asvent@gmail.com** con tu idea o con el error que encontraste.\n\nSi es un error, cuéntanos **qué estabas haciendo** y **qué pasó**: así podremos encontrarlo y corregirlo antes. Leemos todos los correos.',
    tip: 'Cuando una pantalla de Frame falla, el error también se nos reporta solo, sin enviar tus datos.',
    rel: ['docs-info'],
  },
];
