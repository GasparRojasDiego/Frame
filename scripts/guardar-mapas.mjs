// ============================================================
// Saca los mapas de fuente de dist/ antes de que Tauri empaquete la app.
//
// vite.config.ts compila con `sourcemap: 'hidden'`: genera los .map pero el
// código no los referencia. Aquí se mueven a sourcemaps/<versión>/, fuera del
// instalador (pesan varios MB y no le sirven al estudiante), y se conservan
// para traducir la pila de un error reportado a la línea real del código:
//
//   node scripts/resolver-pila.mjs 1.5.7 "at Xy (index-AbC123.js:12:3456)"
// ============================================================
import { readdirSync, mkdirSync, renameSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const target = join(root, 'sourcemaps', version);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.map')) out.push(full);
  }
  return out;
}

if (!existsSync(dist)) process.exit(0);
const maps = walk(dist);
mkdirSync(target, { recursive: true });
for (const file of maps) {
  const name = file.split(/[\\/]/).pop();
  renameSync(file, join(target, name));
}
console.log(`Mapas de fuente: ${maps.length} movidos a sourcemaps/${version}/`);
