// ============================================================
// Traduce la pila compacta de un error reportado (columna `stack` de
// error_log) a archivos y líneas reales del código fuente.
//
//   node scripts/resolver-pila.mjs <versión> "<pila>"
//   node scripts/resolver-pila.mjs 1.5.7 "at Xy (index-AbC123.js:12:3456)"
//
// Necesita los mapas que guardó scripts/guardar-mapas.mjs al compilar esa
// versión (carpeta sourcemaps/<versión>/).
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [version, ...rest] = process.argv.slice(2);
const stack = rest.join(' ');
if (!version || !stack) {
  console.error('Uso: node scripts/resolver-pila.mjs <versión> "<pila>"');
  process.exit(1);
}

const consumers = new Map();
function consumerFor(file) {
  if (consumers.has(file)) return consumers.get(file);
  const path = join(root, 'sourcemaps', version, `${file}.map`);
  const consumer = existsSync(path) ? new SourceMapConsumer(JSON.parse(readFileSync(path, 'utf8'))) : null;
  consumers.set(file, consumer);
  return consumer;
}

for (const line of stack.split(/\n|(?=\bat )/)) {
  const match = line.match(/([\w.-]+\.js):(\d+):(\d+)/);
  if (!match) {
    if (line.trim()) console.log(line.trim());
    continue;
  }
  const [, file, ln, col] = match;
  const consumer = consumerFor(file);
  if (!consumer) {
    console.log(`${line.trim()}   (sin mapa para ${file})`);
    continue;
  }
  const pos = consumer.originalPositionFor({ line: Number(ln), column: Number(col) - 1 });
  const where = pos.source ? `${pos.source.replace(/^(\.\.\/)+/, '')}:${pos.line}:${(pos.column ?? 0) + 1}` : '?';
  console.log(`${pos.name ?? '(anónima)'}  →  ${where}`);
}
