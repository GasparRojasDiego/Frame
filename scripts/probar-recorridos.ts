// Comprueba que cada paso de los recorridos «Descubrir» señala una marca
// data-tour que existe en el código (ver src/lib/help/tours.ts).
//
// 1.6.2: también lee las marcas que llegan por props (`tourId="…"`, como la
// cuadrícula del calendario) o desde una lista de opciones (`tour: '…'`, como
// el conmutador Google / Local), y descarta las de archivos que nadie importa:
// un componente retirado conserva sus marcas en disco, pero en la app no
// existen (pasó con ExtensionsMenu, el «+» de la barra de la Ayuda).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { allTours } from '../src/lib/help/tours';
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && files.push(p); } };
walk('src');
const sources = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

/** Las rutas (src/app) las monta el enrutador; el resto tiene que importarlas alguien. */
const isUsed = (file: string): boolean => {
  if (/[\\/]app[\\/]/.test(file)) return true;
  const name = basename(file).replace(/\.tsx?$/, '');
  const base = name === 'index' ? basename(dirname(file)) : name;
  const imported = new RegExp(`['"][^'"\\n]*/${base}(\\.tsx?)?['"]`);
  for (const [other, text] of sources) if (other !== file && imported.test(text)) return true;
  return false;
};

const MARK_PATTERNS = [/data-tour="([^"]+)"/g, /\btourId="([^"]+)"/g, /(?<!\w)tour: '([^']+)'/g];
const marks = new Set<string>();
const unused: string[] = [];
for (const [file, text] of sources) {
  const found = MARK_PATTERNS.flatMap((re) => [...text.matchAll(re)].map((m) => m[1]));
  if (found.length === 0) continue;
  if (!isUsed(file)) {
    unused.push(`${file} (${found.join(', ')})`);
    continue;
  }
  for (const m of found) marks.add(m);
}
for (const u of unused) console.log('MARCAS EN UN ARCHIVO QUE NADIE IMPORTA (no cuentan):', u);
// Marcas dinámicas: menú (nav-*), documentos (doc-*), informes (informe-pdf/docx).
for (const r of ['inicio', 'temporizador', 'tareas', 'habitos', 'knowledge', 'calendario', 'gmail', 'classroom', 'youtube', 'music']) marks.add(`nav-${r}`);
for (const k of ['info', 'terms', 'support']) marks.add(`doc-${k}`);
marks.add('informe-pdf'); marks.add('informe-docx'); marks.add('enfoque-videos');
let bad = 0;
let steps = 0;
const used = new Set<string>();
for (const t of allTours()) for (const s of t.steps) {
  if (!s.el) continue;
  steps++;
  used.add(s.el);
  if (!marks.has(s.el)) { bad++; console.log('SIN MARCA', t.id, '→', s.el); }
}
console.log('marcas', marks.size, '· recorridos', allTours().length, '· pasos con marca', steps, '· marcas distintas usadas', used.size, '· pasos rotos', bad);
