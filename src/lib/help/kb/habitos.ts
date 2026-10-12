import type { HelpEntry } from '../areas';

type Entry = Omit<HelpEntry, 'area'>;

// Hábitos: crear, marcar, organizar por fases y leer su constancia.
// (Estilo de las respuestas: ver basico.ts.)
export const HABITOS: Entry[] = [
  {
    id: 'habitos-intro',
    title: 'La interfaz Hábitos',
    a: '**Hábitos** te ayuda a mantener tus rutinas: leer, hacer ejercicio, tomar agua, repasar… Lo encuentras en el menú de la izquierda, en el primer bloque.\n\nEs como una tabla semanal: cada **fila** es un hábito y cada **casilla** es un día. Los hábitos se agrupan según el momento del día en que los haces: **mañana**, **tarde** o **noche**.\n\nDebajo de la tabla verás unos **anillos de colores** y un análisis de tu constancia, para que veas cómo vas.',
    go: '/habitos',
    rel: ['habito-crear', 'habito-marcar', 'habito-analisis'],
  },
  {
    id: 'habito-crear',
    title: 'Crear un hábito',
    a: '¡Qué buena idea empezar un hábito nuevo! Hacerlo en Frame es muy fácil:',
    steps: [
      'En el menú de la izquierda, entra en **Hábitos**.',
      'Pulsa **Añadir un hábito**.',
      'Escribe su nombre, por ejemplo «Leer 20 minutos».',
      'Elige en qué momento del día lo harás: **mañana**, **tarde** o **noche**.',
      'Elige con qué frecuencia: cada día, entre semana, fin de semana, días alternos o solo los días que tú marques.',
    ],
    tip: 'Puedes tener hasta 5 hábitos en cada momento del día. Los días que no le tocan a un hábito no aparecen como casilla ni cuentan como fallo.',
    go: '/habitos',
    rel: ['habito-marcar', 'habito-fases', 'habito-frecuencia'],
  },
  {
    id: 'habito-marcar',
    title: 'Marcar un hábito como cumplido',
    a: '¿Ya cumpliste tu hábito de hoy? En **Hábitos**, busca la fila de ese hábito y **pulsa la casilla** del día de hoy: se marcará como cumplida.\n\nSi te equivocaste, vuelve a pulsarla para desmarcarla.',
    tip: 'Las casillas de los días que no le tocan a ese hábito aparecen bloqueadas, con el mensaje «Este día no le toca».',
    go: '/habitos',
    rel: ['habito-semanas', 'habito-analisis'],
  },
  {
    id: 'habito-semanas',
    title: 'Ver semanas anteriores de tus hábitos',
    a: 'En **Hábitos**, junto al título **Registro de hábitos**, hay dos **flechas**: una para ir a la **semana anterior** y otra para volver a la **siguiente**.\n\nAsí puedes revisar cómo te fue otras semanas o marcar un hábito que olvidaste marcar.',
    go: '/habitos',
    rel: ['habito-marcar'],
  },
  {
    id: 'habito-fases',
    title: 'Fases del día de un hábito (mañana, tarde, noche)',
    a: 'Cada hábito pertenece a un momento del día, para que la tabla quede ordenada como tu día real:\n\n**Mañana**: de 5:00 a 11:59. **Tarde**: de 12:00 a 18:59. **Noche**: desde las 19:00.\n\nSi quieres cambiar un hábito de momento, pulsa el **icono de la fase** que aparece en su fila.',
    go: '/habitos',
    rel: ['habito-crear'],
  },
  {
    id: 'habito-frecuencia',
    title: 'Cambiar qué días toca un hábito',
    a: 'No todos los hábitos son de todos los días, y Frame lo entiende.\n\nEn la fila del hábito, pulsa el **icono del calendario** (dice «¿Qué días toca?» al pasar el ratón) y marca los días en que quieres hacerlo. Los demás días no contarán como fallo.',
    go: '/habitos',
    rel: ['habito-crear'],
  },
  {
    id: 'habito-renombrar',
    title: 'Cambiar el nombre de un hábito',
    a: 'En **Hábitos**, pulsa el **lápiz** (Editar nombres), arriba de la tabla. Los nombres se vuelven editables: cambia los que quieras y pulsa otra vez el lápiz para guardar.',
    go: '/habitos',
  },
  {
    id: 'habito-archivar',
    title: 'Archivar, recuperar o borrar un hábito',
    a: 'Si ya no sigues un hábito, puedes **archivarlo**: deja de aparecer en la tabla, pero conserva todo su historial por si quieres retomarlo.\n\nEn **Hábitos**, pulsa el botón de la **caja** (Archivar hábitos), arriba de la tabla, y elige el hábito. Para recuperarlo, entra en **Ver archivados**: desde ahí puedes restaurarlo o eliminarlo para siempre.',
    go: '/habitos',
    rel: ['habito-crear'],
  },
  {
    id: 'habito-analisis',
    title: 'Análisis de tus hábitos',
    a: 'En **Hábitos**, debajo de la tabla, encontrarás un análisis de tu constancia:\n\nTu **ritmo** del periodo, tus **días perfectos** (los días en que cumpliste todo), tu **racha perfecta**, los días activos, tu **semana tipo** (qué día de la semana cumples más y cuál menos) y un **mapa de constancia** de las últimas 12 semanas.\n\nPuedes verlo por semana o por mes.',
    tip: 'El cumplimiento solo cuenta los días que ya pasaron, no los que faltan.',
    go: '/habitos',
    rel: ['habito-anillos'],
  },
  {
    id: 'habito-anillos',
    title: 'Los anillos de hábitos',
    a: 'Los **anillos de colores** de la sección **Hábitos** son una forma visual de ver tu semana: cada anillo es un hábito y cada trozo del anillo es un día. Cuando cumples el hábito ese día, su trozo se pinta.\n\nPara saber qué hábito es cada color, pulsa el botón **Qué es cada color**.',
    go: '/habitos',
    rel: ['habito-analisis'],
  },
];
