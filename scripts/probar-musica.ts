// Pruebas de la música local de Frame (1.6.7): nombres de canción y lectura
// de etiquetas. Sin dependencias; Node 22.18+ ejecuta TypeScript directamente.
//
//   node scripts/probar-musica.ts                 → solo los nombres
//   node scripts/probar-musica.ts <carpeta>       → además, las etiquetas de
//                                                    cada audio de la carpeta
//
// Sale con código 1 si falla alguna prueba de nombres.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readAudioTags } from '../src/lib/audio-tags.ts';
import { foldName, resolveSongName } from '../src/lib/song-names.ts';
import { companionFinder } from '../src/lib/music-match.ts';

const known = new Set(['Shakira', 'Bad Bunny', 'Queen', 'Soda Stereo'].map(foldName));

const cases: { input: Parameters<typeof resolveSongName>[0]; title: string; artist?: string }[] = [
  { input: { fileName: '01 - Soda Stereo - De Música Ligera.mp3' }, title: 'De Música Ligera', artist: 'Soda Stereo' },
  { input: { fileName: "02. Shakira - Hips Don't Lie (Official Video) [HD].mp3" }, title: "Hips Don't Lie", artist: 'Shakira' },
  { input: { fileName: 'Bad_Bunny_-_Tití_Me_Preguntó.mp3' }, title: 'Tití Me Preguntó', artist: 'Bad Bunny' },
  { input: { fileName: '7 Rings.mp3' }, title: '7 Rings' },
  { input: { fileName: '99 Problems - Jay-Z.mp3', knownArtists: new Set([foldName('Jay-Z')]) }, title: '99 Problems', artist: 'Jay-Z' },
  { input: { fileName: '1-03 Bohemian Rhapsody.flac', tagArtist: 'Queen' }, title: 'Bohemian Rhapsody', artist: 'Queen' },
  { input: { fileName: 'Bohemian Rhapsody - Remastered 2011.mp3' }, title: 'Bohemian Rhapsody - Remastered 2011' },
  { input: { fileName: 'Queen - Bohemian Rhapsody - Remastered 2011.mp3' }, title: 'Bohemian Rhapsody - Remastered 2011', artist: 'Queen' },
  { input: { fileName: 'De Música Ligera - Soda Stereo.mp3', knownArtists: known }, title: 'De Música Ligera', artist: 'Soda Stereo' },
  { input: { fileName: 'x.mp3', tagTitle: 'Track 01', tagArtist: 'Unknown Artist' }, title: 'x' },
  { input: { fileName: 'Shakira - Antología.mp3', tagTitle: 'Antología', tagArtist: 'Artista desconocido' }, title: 'Antología', artist: 'Shakira' },
  { input: { fileName: 'cancion.mp3', tagTitle: 'Shakira - Antología', knownArtists: known }, title: 'Antología', artist: 'Shakira' },
  { input: { fileName: 'cancion.mp3', tagTitle: 'Soda Stereo - Persiana Americana' }, title: 'Persiana Americana', artist: 'Soda Stereo' },
  { input: { fileName: 'a.mp3', tagTitle: 'Queen - Bohemian Rhapsody', tagArtist: 'Queen' }, title: 'Bohemian Rhapsody', artist: 'Queen' },
  { input: { fileName: 'Track 05 - Intro.mp3' }, title: 'Intro' },
  { input: { fileName: 'Calvin Harris feat. Rihanna - This Is What You Came For.mp3' }, title: 'This Is What You Came For', artist: 'Calvin Harris feat. Rihanna' },
  { input: { fileName: 'BadBunnyVEVO - Callaíta (Video Oficial).mp3' }, title: 'Callaíta', artist: 'BadBunny' },
  { input: { fileName: 'Daft Punk - One More Time (Live).mp3' }, title: 'One More Time (Live)', artist: 'Daft Punk' },
  { input: { fileName: '2Pac - Changes.mp3' }, title: 'Changes', artist: '2Pac' },
  { input: { fileName: 'Mi canción favorita.mp3' }, title: 'Mi canción favorita' },
  { input: { fileName: '«Despacito» - Luis Fonsi.mp3', knownArtists: new Set([foldName('Luis Fonsi')]) }, title: 'Despacito', artist: 'Luis Fonsi' },
  { input: { fileName: 'Canción | Letra.mp3' }, title: 'Canción' },
];

let failed = 0;
for (const test of cases) {
  const got = resolveSongName(test.input);
  const ok = got.title === test.title && (got.artist ?? undefined) === test.artist;
  if (!ok) {
    failed++;
    console.log(`✗ ${test.input.fileName}\n    esperado: ${test.artist ?? '—'} · ${test.title}\n    obtenido: ${got.artist ?? '—'} · ${got.title}`);
  }
}
console.log(`Nombres: ${cases.length - failed}/${cases.length} correctos`);

// ---- Etiquetas ID3 construidas a mano: lo que ffmpeg no escribe ----
const enc = new TextEncoder();
const latin1 = (text: string) => Uint8Array.from([...text].map((ch) => ch.charCodeAt(0) & 0xff));
const utf16 = (text: string) => {
  const out = [0xff, 0xfe];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out.push(code & 0xff, code >> 8);
  }
  return Uint8Array.from(out);
};
const join2 = (...parts: (Uint8Array | number[])[]) => {
  const all = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of all) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const safe32 = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const frame23 = (id: string, body: Uint8Array) => join2(latin1(id), be32(body.length), [0, 0], body);
const tag = (major: number, frames: Uint8Array, flags = 0) => join2(latin1('ID3'), [major, 0, flags], safe32(frames.length), frames);
const mpegFrame = Uint8Array.from([0xff, 0xfb, 0x90, 0x64, ...new Array(400).fill(0)]);

const synthetic: { name: string; bytes: Uint8Array; check: (t: Awaited<ReturnType<typeof readAudioTags>>) => boolean }[] = [
  {
    name: 'ID3v2.3: título UTF-16, artista Latin-1, USLT con LRC en UTF-16',
    bytes: join2(
      tag(
        3,
        join2(
          frame23('TIT2', join2([1], utf16('Canción ñ'))),
          frame23('TPE1', join2([0], latin1('Señor'))),
          frame23('USLT', join2([1], latin1('spa'), [0xff, 0xfe, 0, 0], utf16('[00:01.00]Hola\n[00:02.00]Adiós')))
        )
      ),
      mpegFrame
    ),
    check: (t) => t.title === 'Canción ñ' && t.artist === 'Señor' && !!t.lyrics?.startsWith('[00:01.00]Hola'),
  },
  {
    name: 'ID3v2.3: SYLT en milisegundos',
    bytes: join2(
      tag(
        3,
        frame23(
          'SYLT',
          join2([0], latin1('spa'), [2, 1], [0], latin1('Uno'), [0], be32(1000), latin1('\nDos'), [0], be32(2500), latin1('\nTres'), [0], be32(4000))
        )
      ),
      mpegFrame
    ),
    check: (t) => t.syncedLyrics?.length === 3 && t.syncedLyrics[1].text === 'Dos' && t.syncedLyrics[1].time === 2.5,
  },
  {
    name: 'ID3v2.4: UTF-8, varios artistas y marco con longitud de datos',
    bytes: join2(
      tag(
        4,
        join2(
          join2(latin1('TIT2'), safe32(10), [0, 0x01], safe32(6), [3], enc.encode('Café')),
          join2(latin1('TPE1'), safe32(5), [0, 0], [3], enc.encode('A\0B'), [0])
        )
      ),
      mpegFrame
    ),
    check: (t) => t.title === 'Café' && t.artist === 'A, B',
  },
  {
    name: 'ID3v2.2: TT2 y TP1',
    bytes: join2(
      tag(2, join2(latin1('TT2'), [0, 0, 6], [0], latin1('Viejo'), latin1('TP1'), [0, 0, 5], [0], latin1('Raro'))),
      mpegFrame
    ),
    check: (t) => t.title === 'Viejo' && t.artist === 'Raro',
  },
  {
    name: 'ID3v1 al final (Windows-1252)',
    bytes: join2(
      mpegFrame,
      latin1('TAG'),
      Uint8Array.from([...latin1('Canción vieja'), ...new Array(17).fill(0)]),
      Uint8Array.from([...latin1('Peña'), ...new Array(26).fill(0)]),
      new Uint8Array(30),
      latin1('1999'),
      new Uint8Array(28),
      [0, 7, 255]
    ),
    check: (t) => t.title === 'Canción vieja' && t.artist === 'Peña' && t.year === '1999' && t.track === 7,
  },
  {
    name: 'APEv2 al final',
    bytes: (() => {
      const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
      const item = (key: string, value: string) => {
        const v = enc.encode(value);
        return join2(le32(v.length), le32(0), latin1(key), [0], v);
      };
      const items = join2(item('Title', 'Título APE'), item('Artist', 'Artista APE'));
      const footer = join2(latin1('APETAGEX'), le32(2000), le32(items.length + 32), le32(2), le32(0), new Array(8).fill(0));
      return join2(mpegFrame, items, footer);
    })(),
    check: (t) => t.title === 'Título APE' && t.artist === 'Artista APE',
  },
];

let syntheticFailed = 0;
for (const test of synthetic) {
  const got = await readAudioTags(new Blob([test.bytes]));
  if (!test.check(got)) {
    syntheticFailed++;
    console.log(`✗ ${test.name}\n    obtenido: ${JSON.stringify(got)}`);
  }
}
console.log(`Etiquetas ID3/APE a mano: ${synthetic.length - syntheticFailed}/${synthetic.length} correctas`);
failed += syntheticFailed;

// ---- Letras y portadas en subcarpetas (1.7.0) ----
// [ruta del audio, letra esperada, portada esperada, portada de carpeta esperada]
const tree = [
  // Lo que pidió Diego: canciones arriba, «Portadas/» y «Letras/» al lado.
  '01 - Canción.mp3',
  'Shakira - Antología.flac',
  'Otra.m4a',
  'De Música Ligera - Soda Stereo.mp3',
  'Sin nada.ogg',
  'Portadas/canción.JPG',
  'Portadas/Shakira - Antología.png',
  'Portadas/cover.jpg',
  'Letras/cancion.lrc',
  'Letras/Shakira - Antología.lrc',
  'Letras/Shakira - Otra.lrc',
  'Letras/De Música Ligera.lrc',
  // Un álbum en dos discos con nombres repetidos.
  'Álbum/CD1/01 - Intro.mp3',
  'Álbum/CD2/01 - Intro.mp3',
  'Álbum/CD1/Letras/Intro.lrc',
  'Álbum/CD2/Letras/Intro.lrc',
  'Álbum/folder.jpg',
  // Nombres en NFD (macOS) y una portada .webp suelta por canción en la misma carpeta.
  'Mac/Cafe\u0301 con leche.mp3'.normalize('NFD'),
  'Mac/Café con leche.webp',
  'Mac/Café con leche.txt',
].map((rel) => ({ rel, name: rel.split('/').pop()! }));
const expectations: [string, string | undefined, string | undefined, string | undefined][] = [
  ['01 - Canción.mp3', 'Letras/cancion.lrc', 'Portadas/canción.JPG', 'Portadas/cover.jpg'],
  ['Shakira - Antología.flac', 'Letras/Shakira - Antología.lrc', 'Portadas/Shakira - Antología.png', 'Portadas/cover.jpg'],
  ['Otra.m4a', 'Letras/Shakira - Otra.lrc', undefined, 'Portadas/cover.jpg'],
  ['De Música Ligera - Soda Stereo.mp3', 'Letras/De Música Ligera.lrc', undefined, 'Portadas/cover.jpg'],
  ['Sin nada.ogg', undefined, undefined, 'Portadas/cover.jpg'],
  ['Álbum/CD1/01 - Intro.mp3', 'Álbum/CD1/Letras/Intro.lrc', undefined, 'Álbum/folder.jpg'],
  ['Álbum/CD2/01 - Intro.mp3', 'Álbum/CD2/Letras/Intro.lrc', undefined, 'Álbum/folder.jpg'],
];
const find = companionFinder(tree);
let matchFailed = 0;
for (const [rel, lrc, cover, folderCover] of expectations) {
  const audio = tree.find((file) => file.rel === rel)!;
  const got = find(audio);
  const same = got.lrc?.rel === lrc && got.cover?.rel === cover && got.folderCover?.rel === folderCover;
  if (!same) {
    matchFailed++;
    console.log(`✗ ${rel}\n    esperado: ${lrc ?? '—'} · ${cover ?? '—'} · ${folderCover ?? '—'}\n    obtenido: ${got.lrc?.rel ?? '—'} · ${got.cover?.rel ?? '—'} · ${got.folderCover?.rel ?? '—'}`);
  }
}
{
  const mac = tree.find((file) => file.rel.startsWith('Mac/') && file.rel.endsWith('.mp3'))!;
  const got = find(mac);
  if (got.cover?.rel !== 'Mac/Café con leche.webp' || got.txt?.rel !== 'Mac/Café con leche.txt') {
    matchFailed++;
    console.log(`✗ nombre NFD: ${got.cover?.rel ?? '—'} · ${got.txt?.rel ?? '—'}`);
  }
}
console.log(`Letras y portadas en subcarpetas: ${expectations.length + 1 - matchFailed}/${expectations.length + 1} correctas`);
failed += matchFailed;

const folder = process.argv[2];
if (folder) {
  console.log('');
  for (const name of (await readdir(folder)).sort()) {
    if (!/\.(mp3|m4a|aac|ogg|oga|opus|flac|wav|webm|weba|wma|aiff?)$/i.test(name)) continue;
    const tags = await readAudioTags(new Blob([await readFile(join(folder, name))]));
    const summary = [
      tags.unsupported ? `NO COMPATIBLE: ${tags.unsupported}` : tags.container,
      tags.title && `«${tags.title}»`,
      tags.artist,
      tags.album && `álbum ${tags.album}`,
      tags.albumArtist && `artista del álbum ${tags.albumArtist}`,
      tags.track && `pista ${tags.track}`,
      tags.year,
      tags.duration && `${tags.duration.toFixed(2)} s`,
      tags.picture && `portada ${tags.picture.slice(5, tags.picture.indexOf(';'))} ${Math.round(tags.picture.length / 1024)} KB`,
      tags.lyrics && `letra «${tags.lyrics.split('\n')[0]}…» (${tags.lyrics.split('\n').length} líneas)`,
      tags.syncedLyrics && `SYLT ${tags.syncedLyrics.length} líneas`,
    ]
      .filter(Boolean)
      .join(' · ');
    console.log(`${name}\n    ${summary}`);
  }
}

if (failed > 0) process.exit(1);
