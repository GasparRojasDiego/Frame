#!/usr/bin/env node
// ============================================================
// Genera metricas/src/lib/world-map.ts: el mapa del mundo del Panel de uso
// (1.6.9; desde la 1.7.0, en la página de métricas, fuera de la app).
//
// Los contornos (Natural Earth 1:110m, de `world-atlas`) se proyectan UNA vez
// aquí (Equal Earth) y se guardan como trazos SVG ya hechos: la app no carga
// librerías de mapas ni descarga nada para dibujarlo. Cada país va con su
// código ISO de dos letras y su continente (`countries-list`).
//
// Los paquetes no son de Frame: se instalan aparte, solo para generar.
//   mkdir mapa && cd mapa && npm i world-atlas@2.0.2 d3-geo@3.1.1 topojson-client@3.1.0 countries-list@3.1.1
//   node scripts/generar-mapa.mjs <carpeta mapa>
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = path.resolve(process.argv[2] ?? '.', 'node_modules');
const require = createRequire(path.join(modules, 'x.js'));
const { geoEqualEarth, geoPath } = await import(path.join(modules, 'd3-geo', 'src', 'index.js').replace(/\\/g, '/').replace(/^([A-Z]):/, 'file:///$1:'));
const { feature } = require('topojson-client');
const { countries } = require('countries-list');
const world = require('world-atlas/countries-110m.json');

// Nombres de Natural Earth que no coinciden con los de `countries-list`.
const BY_NAME = {
  'United States of America': 'US',
  'Dem. Rep. Congo': 'CD',
  Congo: 'CG',
  "Côte d'Ivoire": 'CI',
  'Bosnia and Herz.': 'BA',
  'Central African Rep.': 'CF',
  'Dominican Rep.': 'DO',
  'Eq. Guinea': 'GQ',
  'S. Sudan': 'SS',
  'Solomon Is.': 'SB',
  'Falkland Is.': 'FK',
  'Fr. S. Antarctic Lands': 'TF',
  'N. Cyprus': 'CY',
  Somaliland: 'SO',
  Kosovo: 'XK',
  'W. Sahara': 'EH',
  'North Macedonia': 'MK',
  eSwatini: 'SZ',
  Macedonia: 'MK',
  'Timor-Leste': 'TL',
  Czechia: 'CZ',
  Russia: 'RU',
  'South Korea': 'KR',
  'North Korea': 'KP',
  Laos: 'LA',
  Vietnam: 'VN',
  Syria: 'SY',
  Iran: 'IR',
  Bolivia: 'BO',
  Venezuela: 'VE',
  Tanzania: 'TZ',
  Moldova: 'MD',
  Brunei: 'BN',
  Taiwan: 'TW',
  Palestine: 'PS',
  'Puerto Rico': 'PR',
  Greenland: 'GL',
  'New Caledonia': 'NC',
  Antarctica: 'AQ',
  'Turkey': 'TR',
  'Cape Verde': 'CV',
  'Myanmar': 'MM',
};

const byEnglish = new Map(Object.entries(countries).map(([code, data]) => [data.name, code]));
const projection = geoEqualEarth().fitExtent([[4, 4], [956, 496]], { type: 'Sphere' });
const draw = geoPath(projection);
const round = (d) => d.replace(/(\d+\.\d)\d+/g, '$1');

const shapes = new Map();
const missing = [];
for (const country of feature(world, world.objects.countries).features) {
  const name = country.properties.name;
  const code = BY_NAME[name] ?? byEnglish.get(name);
  if (!code) {
    missing.push(name);
    continue;
  }
  const d = round(draw(country) ?? '');
  if (!d) continue;
  // El Chipre del norte y Somalilandia se suman a su país.
  shapes.set(code, shapes.has(code) ? `${shapes.get(code)}${d}` : d);
}
if (missing.length > 0) {
  console.error('Sin código:', missing.join(', '));
  process.exit(1);
}

const continentOf = (code) => (code === 'XK' ? 'EU' : countries[code]?.continent ?? 'AN');
const allCodes = [...new Set([...Object.keys(countries), ...shapes.keys()])].sort();

const out = `// ============================================================
// GENERADO por scripts/generar-mapa.mjs — no editar a mano.
//
// Mapa del mundo del Panel de uso (1.6.9): contornos de Natural Earth 1:110m
// (dominio público, vía world-atlas) en proyección Equal Earth, ya trazados
// para un lienzo de 960 × 500. Y el continente de cada código ISO de dos
// letras (countries-list, licencia MIT).
// ============================================================

export type Continent = 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA';

export const WORLD_VIEWBOX = '0 0 960 500';

/** Contorno de cada país (código ISO de dos letras → trazo SVG). */
export const WORLD_SHAPES: Record<string, string> = ${JSON.stringify(Object.fromEntries([...shapes.entries()].sort()), null, 0).replace(/","/g, '",\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, ',\n}')};

/** Continente de cada código ISO de dos letras. */
export const CONTINENT_OF: Record<string, Continent> = ${JSON.stringify(Object.fromEntries(allCodes.map((code) => [code, continentOf(code)])))};
`;
fs.writeFileSync(path.join(root, 'metricas', 'src', 'lib', 'world-map.ts'), out);
console.log(`${shapes.size} países · ${(out.length / 1024).toFixed(0)} KB`);
