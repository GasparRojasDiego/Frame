// Genera carpetas de prueba con el formato de «Exportar música», para probar
// la importación de Frame para Android sin depender de una biblioteca real.
// Solo para desarrollo: no entra en la app.
//
//   npx esbuild scripts/generar-musica-prueba.ts --bundle --platform=node --format=esm --outfile=<tmp>.mjs
//   node <tmp>.mjs <carpeta de salida>
import fs from 'node:fs';
import path from 'node:path';
import { musicExportParts, MUSIC_EXPORT_MANIFEST, type MusicExportManifest } from '@/lib/music-export';

const { buildId3 } = musicExportParts;
const out = process.argv[2];
if (!out) throw new Error('Falta la carpeta de salida');

/** MP3 de silencio: tramas MPEG-1 Layer III de 128 kbps a 44,1 kHz. */
function silentMp3(seconds: number): Uint8Array {
  const frameSize = 417; // 144 * 128000 / 44100
  const frames = Math.ceil((seconds * 44100) / 1152);
  const data = new Uint8Array(frames * frameSize);
  for (let i = 0; i < frames; i++) {
    const at = i * frameSize;
    data[at] = 0xff;
    data[at + 1] = 0xfb;
    data[at + 2] = 0x90;
    data[at + 3] = 0x64;
  }
  return data;
}

/** PNG de un color (portada de prueba), de `side`×`side` píxeles. */
function tinyPng(r: number, g: number, b: number, side = 2): Uint8Array {
  // PNG mínimo generado a mano: IHDR 2×2 RGB, IDAT sin comprimir (zlib stored).
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: number[]) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunk = (type: string, body: number[]) => {
    const t = [...type].map((c) => c.charCodeAt(0));
    return [...u32(body.length), ...t, ...body, ...u32(crc([...t, ...body]))];
  };
  const raw: number[] = [];
  for (let y = 0; y < side; y++) {
    raw.push(0);
    for (let x = 0; x < side; x++) raw.push(r, g, b);
  }
  let a = 1;
  let s2 = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    s2 = (s2 + a) % 65521;
  }
  const zlib = [0x78, 0x01, 0x01, raw.length & 255, raw.length >> 8, ~raw.length & 255, (~raw.length >> 8) & 255, ...raw, ...u32((s2 << 16) | a)];
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [...u32(side), ...u32(side), 8, 2, 0, 0, 0]),
    ...chunk('IDAT', zlib),
    ...chunk('IEND', []),
  ]);
}

const SONGS = [
  { id: '11111111-1111-4111-8111-111111111111', title: 'Primera canción', artist: 'Banda Prueba', color: [220, 40, 40], fav: true },
  { id: '22222222-2222-4222-8222-222222222222', title: 'Segunda canción', artist: 'Banda Prueba', color: [40, 160, 60], fav: false },
  { id: '33333333-3333-4333-8333-333333333333', title: 'Tercera (con ñ y tilde)', artist: 'Solista Ñandú', color: [40, 80, 220], fav: false },
  { id: '44444444-4444-4444-8444-444444444444', title: 'Cuarta canción', artist: 'Otra Banda', color: [230, 180, 20], fav: true },
];

const lyricsFor = (title: string) => ({
  synced: [
    { time: 0.5, text: `Primera línea de ${title}` },
    { time: 2.5, text: 'Segunda línea' },
    { time: 4.5, text: 'Tercera línea' },
  ],
  plain: '',
  missing: false,
  offset: 0.3,
});

const lrcTime = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

// 1) Exportación nueva (1.5.8): nombres sin número, índice con firma.
const modern = path.join(out, 'Frame - Mi música');
fs.mkdirSync(path.join(modern, 'Portadas'), { recursive: true });
fs.mkdirSync(path.join(modern, 'Playlists'), { recursive: true });
const manifest: MusicExportManifest = {
  app: 'Frame',
  kind: 'music',
  format: 2,
  exportedAt: new Date().toISOString(),
  songs: [],
  playlists: [],
};
SONGS.forEach((song, index) => {
  const base = `${song.artist} - ${song.title}`;
  const cover = tinyPng(song.color[0], song.color[1], song.color[2]);
  const lyrics = lyricsFor(song.title);
  const lrc = lyrics.synced.map((l) => `[${lrcTime(l.time + lyrics.offset)}]${l.text}`).join('\r\n');
  const audio = new Uint8Array([
    ...buildId3({ title: song.title, artist: song.artist, album: 'Álbum de prueba', track: index + 1, cover: { bytes: cover, mime: 'image/png' }, lyrics: lrc }),
    ...silentMp3(6 + index),
  ]);
  fs.writeFileSync(path.join(modern, `${base}.mp3`), audio);
  fs.writeFileSync(path.join(modern, 'Portadas', `${base}.png`), cover);
  fs.writeFileSync(path.join(modern, `${base}.lrc`), '﻿' + lrc);
  manifest.songs.push({
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: 'Álbum de prueba',
    isFavorite: song.fav,
    order: index,
    file: `${base}.mp3`,
    originalFileName: `${base}.mp3`,
    cover: `Portadas/${base}.png`,
    lyrics,
    size: audio.length,
    sig: 'prueba',
  });
});
manifest.playlists.push({
  id: 'pl-prueba',
  name: 'Playlist de prueba',
  songIds: [SONGS[3].id, SONGS[0].id],
  file: 'Playlists/Playlist de prueba.m3u8',
});
fs.writeFileSync(
  path.join(modern, 'Playlists', 'Playlist de prueba.m3u8'),
  ['#EXTM3U', '#PLAYLIST:Playlist de prueba', `../${manifest.songs[3].file}`, `../${manifest.songs[0].file}`, ''].join('\r\n')
);
fs.writeFileSync(path.join(modern, MUSIC_EXPORT_MANIFEST), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(modern, 'LÉEME.txt'), 'Carpeta de prueba.\r\n');

// 2) Carpeta antigua SIN índice y con el «001 - » delante (como la 1.0.9).
const legacy = path.join(out, 'Musica suelta');
fs.mkdirSync(legacy, { recursive: true });
['Quinta canción', 'Sexta canción'].forEach((title, i) => {
  const cover = tinyPng(120, 40 + i * 80, 200);
  const audio = new Uint8Array([
    ...buildId3({ title, artist: 'Artista Suelto', album: '', track: i + 1, cover: { bytes: cover, mime: 'image/png' }, lyrics: '' }),
    ...silentMp3(5),
  ]);
  fs.writeFileSync(path.join(legacy, `00${i + 1} - Artista Suelto - ${title}.mp3`), audio);
});
fs.writeFileSync(path.join(legacy, '001 - Artista Suelto - Quinta canción.lrc'), '[00:01.00]Letra de la quinta\r\n[00:03.00]Segunda línea\r\n');

// 3) Una canción suelta con portada de tamaño real dentro del MP3 (APIC).
const loose = path.join(out, 'Musica suelta 2');
fs.mkdirSync(loose, { recursive: true });
const bigCover = tinyPng(200, 30, 120, 40);
fs.writeFileSync(
  path.join(loose, '007 - Artista Suelto - Séptima canción.mp3'),
  new Uint8Array([
    ...buildId3({ title: 'Séptima canción', artist: 'Artista Suelto', album: 'Suelto', track: 7, cover: { bytes: bigCover, mime: 'image/png' }, lyrics: '[00:01.00]Letra dentro del MP3' }),
    ...silentMp3(5),
  ])
);

console.log('Listo:', out);
