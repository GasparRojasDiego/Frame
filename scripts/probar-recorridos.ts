// Comprueba que cada paso de los recorridos «Descubrir» señala una marca
// data-tour que existe en el código (ver src/lib/help/tours.ts).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { allTours } from '../src/lib/help/tours';
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && files.push(p); } };
walk('src');
const marks = new Set<string>();
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/data-tour="([^"]+)"/g)) marks.add(m[1]);
// Marcas dinámicas: menú (nav-*), documentos (doc-*), informes (informe-pdf/docx).
for (const r of ['inicio', 'temporizador', 'tareas', 'habitos', 'knowledge', 'calendario', 'gmail', 'classroom', 'youtube', 'music']) marks.add(`nav-${r}`);
for (const k of ['info', 'terms', 'support']) marks.add(`doc-${k}`);
marks.add('informe-pdf'); marks.add('informe-docx'); marks.add('enfoque-videos');
let bad = 0;
for (const t of allTours()) for (const s of t.steps) if (s.el && !marks.has(s.el)) { bad++; console.log('SIN MARCA', t.id, '→', s.el); }
console.log('marcas', marks.size, 'pasos rotos', bad);
