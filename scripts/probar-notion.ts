// Prueba del importador de Notion: node --experimental-... (ver probar-ayuda.ts)
import { readFileSync } from 'node:fs';
import { guessMapping, interpretTable, parseNotionDate, readNotionFiles } from '../src/lib/extensions/notion-import';

const zipPath = process.argv[2];
const bytes = readFileSync(zipPath);
const file = new File([bytes], 'Export-notion.zip');
const tables = await readNotionFiles([file]);
console.log('tablas', tables.map((t) => `${t.name} (${t.rows.length} filas)`));
const table = tables[0];
const mapping = guessMapping(table);
console.log('columnas', mapping);
const courses = [
  { id: 'c1', name: 'Historia' },
  { id: 'c2', name: 'Matemática' },
  { id: 'c3', name: 'Ciencias' },
] as never;
for (const item of interpretTable(table, mapping, courses)) console.log(JSON.stringify(item));
const checks: [string, 'dmy' | 'mdy', string | null][] = [
  ['October 6, 2026', 'dmy', '2026-10-06'],
  ['Oct 6, 2026 3:30 PM', 'dmy', '2026-10-06'],
  ['6 de octubre de 2026', 'dmy', '2026-10-06'],
  ['06/10/2026', 'dmy', '2026-10-06'],
  ['10/06/2026', 'mdy', '2026-10-06'],
  ['10/25/2026', 'dmy', '2026-10-25'],
  ['2026-10-06', 'dmy', '2026-10-06'],
  ['31/02/2026', 'dmy', null],
  ['mañana', 'dmy', null],
];
let ok = 0;
for (const [raw, order, expected] of checks) {
  const got = parseNotionDate(raw, order)?.date ?? null;
  if (got === expected) ok++;
  else console.log('MAL fecha', raw, got, expected);
}
console.log(`${ok}/${checks.length} fechas correctas`);
