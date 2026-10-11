// Prueba de «Exportar música» (music-export.ts) sin la app: el puente nativo,
// el audio y las letras se sustituyen por dobles en memoria. Comprueba la
// carpeta fija que se pone al día: primera exportación completa, segunda sin
// cambios (no se reescribe nada), cambios sueltos y canciones borradas.
// Solo para desarrollo:  node scripts/probar-exportacion.mjs
import { build } from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(os.tmpdir(), `frame-prueba-exportacion-${process.pid}.mjs`);

const stubs = {
  '@tauri-apps/api/core': `
    export const isTauri = () => true;
    export const invoke = (...args) => globalThis.__invoke(...args);`,
  '@/lib/song-audio': `
    export const getSongAudio = async (id) => globalThis.__audio.get(id);
    export const getSongAudioSize = async (id) => globalThis.__audio.get(id)?.size ?? 0;`,
  '@/lib/lyrics': `
    export const storedLyrics = async (id) => globalThis.__lyrics.get(id) ?? null;`,
};

await build({
  entryPoints: [path.join(root, 'src/lib/music-export.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'warning',
  plugins: [
    {
      name: 'dobles',
      setup(b) {
        b.onResolve({ filter: /^(@tauri-apps\/api\/core|@\/lib\/song-audio|@\/lib\/lyrics)$/ }, (args) => ({ path: args.path, namespace: 'doble' }));
        b.onLoad({ filter: /.*/, namespace: 'doble' }, (args) => ({ contents: stubs[args.path], loader: 'js' }));
      },
    },
  ],
});

// --- Disco simulado (la carpeta de Descargas) ---
let disk = new Map(); // ruta relativa → Uint8Array
let current = null; // { reused }
let writes = 0;
let removes = 0;
globalThis.__invoke = async (cmd, payload, options) => {
  switch (cmd) {
    case 'music_export_begin': {
      const reused = Boolean(payload.reuse) && disk.size > 0;
      current = { reused };
      const manifest = disk.get('frame-musica.json');
      return { path: `C:/Descargas/${payload.folderName}`, reused, previous: reused && manifest ? new TextDecoder().decode(manifest) : null };
    }
    case 'music_export_list':
      return Object.fromEntries([...disk].map(([k, v]) => [k, v.length]));
    case 'music_export_write': {
      const rel = decodeURIComponent(options.headers['x-frame-path']);
      disk.set(rel, payload);
      writes++;
      return null;
    }
    case 'music_export_remove':
      disk.delete(payload.relative);
      removes++;
      return null;
    case 'music_export_finish':
      if (payload.discard && current && !current.reused) disk = new Map();
      current = null;
      return null;
    default:
      throw new Error(`comando inesperado ${cmd}`);
  }
};

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const pic = `data:image/png;base64,${png.toString('base64')}`;
const mp3 = (n) => new Blob([new Uint8Array([0xff, 0xfb, 0x90, 0x64, ...new Array(400 + n).fill(0)])], { type: 'audio/mpeg' });

globalThis.__audio = new Map();
globalThis.__lyrics = new Map();
let songs = [
  { id: 'a', seq: 0, title: 'Uno', artist: 'Banda', album: '', picture: pic, fileName: 'Banda - Uno.mp3' },
  { id: 'b', seq: 1, title: 'Dos', artist: 'Banda', album: '', picture: '', fileName: 'Banda - Dos.mp3' },
  { id: 'c', seq: 2, title: 'Tres', artist: 'Otra', album: 'X', picture: pic, fileName: 'Otra - Tres.mp3' },
  { id: 'd', seq: 3, title: 'Uno', artist: 'Banda', album: '', picture: '', fileName: 'Banda - Uno (directo).mp3' },
];
songs.forEach((s, i) => globalThis.__audio.set(s.id, mp3(i)));
globalThis.__lyrics.set('c', { synced: [{ time: 1, text: 'hola' }], plain: '', missing: false, offset: 0 });
let playlists = [{ id: 'p1', name: 'Favoritas', songIds: ['c', 'a'] }];

const { exportMusicLibrary } = await import(pathToFileURL(out).href);
const run = async (label) => {
  writes = 0;
  removes = 0;
  const result = await exportMusicLibrary(songs, playlists, () => {});
  const files = [...disk.keys()].sort();
  return { label, result, writes, removes, files };
};

let fails = 0;
const check = (ok, text) => {
  console.log(`${ok ? 'OK ' : 'MAL'} ${text}`);
  if (!ok) fails++;
};

// 1) Primera exportación: todo nuevo, nombres sin número, colisión con « (2)».
let r = await run('primera');
check(!r.result.updated && r.result.unchanged === 0 && r.result.songs === 4, 'primera: 4 canciones, ninguna reutilizada');
check(r.files.includes('Banda - Uno.mp3') && r.files.includes('Banda - Uno (2).mp3'), 'nombres sin número y « (2)» para el repetido');
check(r.files.includes('Portadas/Banda - Uno.png') && r.files.includes('Otra - Tres.lrc'), 'portada y .lrc');
check(r.files.includes('Playlists/Favoritas.m3u8') && r.files.includes('frame-musica.json'), 'playlist e índice');
check(!r.files.some((f) => /^\d{3} - /.test(f)), 'ningún «001 - »');
const manifest1 = JSON.parse(new TextDecoder().decode(disk.get('frame-musica.json')));
check(manifest1.format === 2 && manifest1.songs.every((s) => s.sig && s.size > 0), 'índice formato 2 con firma y tamaño');
const id3 = disk.get('Banda - Uno.mp3');
check(id3[0] === 0x49 && id3[1] === 0x44 && id3[2] === 0x33, 'MP3 con etiqueta ID3');

// 2) Segunda exportación sin cambios: no se reescribe ninguna canción.
r = await run('sin cambios');
check(r.result.updated && r.result.unchanged === 4 && r.result.bytes === 0, `sin cambios: 4 al día, 0 bytes (${r.result.bytes})`);
check(r.writes === 3, `solo índice, LÉEME y playlist (${r.writes} escrituras)`);

// 3) Un título cambia y otra canción se borra.
songs = songs.map((s) => (s.id === 'b' ? { ...s, title: 'Dos (remaster)' } : s)).filter((s) => s.id !== 'c');
playlists = [{ id: 'p1', name: 'Favoritas', songIds: ['a'] }];
r = await run('cambios');
check(r.result.unchanged === 2 && r.result.songs === 3, `cambios: 2 al día de 3 (${r.result.unchanged})`);
check(r.files.includes('Banda - Dos (remaster).mp3') && !r.files.includes('Banda - Dos.mp3'), 'renombrada: nuevo archivo, el viejo se quita');
check(!r.files.includes('Otra - Tres.mp3') && !r.files.includes('Portadas/Otra - Tres.png') && !r.files.includes('Otra - Tres.lrc'), 'borrada: audio, portada y letra fuera');
check(r.result.removed >= 4, `archivos sobrantes quitados: ${r.result.removed}`);

// 4) Una canción nueva al final: las demás siguen al día (la pista no lleva total).
songs = [...songs, { id: 'e', seq: 4, title: 'Cinco', artist: 'Nueva', album: '', picture: '', fileName: 'Nueva - Cinco.mp3' }];
globalThis.__audio.set('e', mp3(9));
r = await run('añadida');
check(r.result.unchanged === 3 && r.result.songs === 4, `añadida al final: 3 al día (${r.result.unchanged})`);

// 5) Cancelar a media exportación de una carpeta reutilizada no la borra.
const before = disk.size;
const controller = new AbortController();
controller.abort();
try {
  await exportMusicLibrary(songs, playlists, () => {}, controller.signal);
  check(false, 'debía cancelarse');
} catch (error) {
  check(error.name === 'MusicExportCancelled' && disk.size === before, 'cancelada: la carpeta anterior sigue intacta');
}

fs.rmSync(out, { force: true });
console.log(fails === 0 ? 'TODO BIEN' : `${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
