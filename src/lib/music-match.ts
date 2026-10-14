import { foldName, TRACK_PREFIX } from './song-names.ts';

// ============================================================
// Cada canción con su letra y su portada, estén donde estén (1.7.0).
//
// Pedido de Diego: importar una carpeta con las canciones y, en subcarpetas,
// sus portadas y sus letras (.lrc), sin que haga falta ordenarlas a mano:
//
//   Mi música/
//     01 - Canción.mp3
//     Artista - Otra.flac
//     Portadas/  Canción.jpg · otra.png · cover.jpg
//     Letras/    canción.lrc · Artista - Otra.lrc
//
// Antes, la letra solo se encontraba en la MISMA carpeta y con el MISMO
// nombre; y la portada de otra carpeta, solo si el nombre coincidía letra a
// letra (y gana la primera que apareciera, aunque fuera de otro álbum).
//
// Ahora los nombres se comparan «doblados» (sin tildes, mayúsculas, signos ni
// espacios, y sin el número de pista: «01 - Canción» = «canción» =
// «Cancion»), también por el título sin el artista («Artista - Otra» =
// «Otra»). Entre varias candidatas gana la más cercana: la misma carpeta; si
// no, una carpeta «Letras», «Lyrics», «Portadas», «Covers»… junto a la
// canción o junto a su carpeta; si no, la única con ese nombre en todo lo
// elegido. Si dos quedan igual de cerca y no se puede saber cuál es, no se
// adivina: la canción entra sin ella.
//
// Módulo puro (sin Tauri): lo usan la importación de escritorio y la de
// Android, y lo prueba scripts/probar-musica.ts.
// ============================================================

export interface MatchFile {
  /** Ruta relativa dentro de lo elegido, con «/» («Letras/x.lrc»). */
  rel: string;
  name: string;
}

export const AUDIO_EXTENSIONS = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|flac|wav|webm|weba)$/i;
export const IMAGE_EXTENSIONS = /\.(jpe?g|jpe|jfif|png|webp|bmp|gif)$/i;

const LYRICS_FOLDER = /^(letras?|lyrics?|lrcs?|karaoke|subtitulos?|textos?)$/;
const COVERS_FOLDER = /^(portadas?|covers?|caratulas?|artworks?|arte|art|scans?|images?|imagenes?|fotos?|pictures?)$/;

/**
 * Imágenes que valen como portada de toda una carpeta, de la más fiable a la
 * menos (las de Windows Media Player incluidas).
 */
const FOLDER_COVERS = [
  /^cover$/i,
  /^folder$/i,
  /^front$/i,
  /^(portada|car[aá]tula)$/i,
  /^album$/i,
  /^albumart(?:_\{.+\}_large|large)?$/i,
  /^albumart(?:_\{.+\}_small|small)$/i,
];

const SEPARATOR = /\s+[-–—~]+\s+|\s*[–—]\s*/;

export const baseName = (name: string) => name.replace(/\.[a-z0-9]+$/i, '');
export const dirName = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** Nombre doblado; si no queda nada (un título en otro alfabeto sin letras latinas), el nombre tal cual en minúsculas. */
const fold = (text: string) => foldName(text) || text.normalize('NFC').trim().toLowerCase();

/**
 * Las claves de un nombre de archivo. Fuertes: el nombre entero y sin el
 * número de pista. Débiles: las mitades de «A - B» (no se sabe cuál es el
 * artista). Una mitad solo casa con un nombre entero: si no, «Shakira -
 * Antología» se llevaría la letra de «Shakira - Otra».
 */
export function matchKeys(fileName: string): { strong: string[]; weak: string[] } {
  const base = baseName(fileName).normalize('NFC').trim();
  const strong: string[] = [];
  const weak: string[] = [];
  const add = (list: string[], text: string) => {
    const key = fold(text);
    if (key && !strong.includes(key) && !weak.includes(key)) list.push(key);
  };
  add(strong, base);
  const noNumber = base.replace(/^\s*\d{2,4}\s+-\s+/, '').replace(TRACK_PREFIX, '').trim();
  if (noNumber) add(strong, noNumber);
  const parts = noNumber.split(SEPARATOR).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    add(weak, parts.slice(1).join(' - '));
    add(weak, parts[parts.length - 1]);
    add(weak, parts.slice(0, -1).join(' - '));
  }
  return { strong, weak };
}

const segments = (dir: string) => (dir ? dir.split('/') : []);

/** Cuántas carpetas comparten dos rutas desde la raíz de lo elegido. */
function sharedDepth(a: string[], b: string[]): number {
  let depth = 0;
  while (depth < a.length && depth < b.length && a[depth].toLowerCase() === b[depth].toLowerCase()) depth += 1;
  return depth;
}

/**
 * Qué tan cerca está un compañero de su canción (más alto, más cerca; 0, en
 * otra parte): la misma carpeta, ante todo; después, cuantas más carpetas
 * compartan desde la raíz, mejor (la letra de «CD1/» gana a la de «CD2/»), y
 * un punto más si está en una carpeta «Letras», «Portadas»… Solo cuenta lo que
 * está dentro de la carpeta de la canción o de su carpeta madre.
 */
function nearness(audioDir: string, fileDir: string, folderPattern: RegExp): number {
  if (audioDir.toLowerCase() === fileDir.toLowerCase()) return 1000;
  const a = segments(audioDir);
  const f = segments(fileDir);
  const shared = sharedDepth(a, f);
  const below = shared === a.length; // dentro de la carpeta de la canción
  const beside = shared >= a.length - 1; // dentro de su carpeta madre
  if (!below && !beside) return 0;
  const special = f.slice(shared).some((part) => folderPattern.test(fold(part)));
  return 1 + shared * 10 + (special ? 5 : 0);
}

type Kind = 'lyrics' | 'cover';

interface KeyIndex<F> {
  strong: Map<string, F[]>;
  weak: Map<string, F[]>;
}

/** Un índice por tipo de compañero: clave doblada → archivos. */
function indexByKey<F extends MatchFile>(files: F[]): KeyIndex<F> {
  const index: KeyIndex<F> = { strong: new Map(), weak: new Map() };
  const put = (map: Map<string, F[]>, key: string, file: F) => {
    const list = map.get(key);
    if (list) list.push(file);
    else map.set(key, [file]);
  };
  for (const file of files) {
    const keys = matchKeys(file.name);
    for (const key of keys.strong) put(index.strong, key, file);
    for (const key of keys.weak) put(index.weak, key, file);
  }
  return index;
}

/**
 * El compañero de una canción: para cada clave (de la más exacta a la más
 * laxa), el candidato más cercano. Si hay empate de cercanía entre archivos
 * distintos, no se elige ninguno; un candidato lejano solo vale si es el único
 * con esa clave en todo lo elegido.
 */
function bestMatch<F extends MatchFile>(audio: MatchFile, index: KeyIndex<F>, kind: Kind): F | undefined {
  const audioDir = dirName(audio.rel);
  const pattern = kind === 'lyrics' ? LYRICS_FOLDER : COVERS_FOLDER;
  const keys = matchKeys(audio.name);
  // Entero con entero; mitad de la canción con nombre entero; nombre entero
  // de la canción con mitad del compañero. Nunca mitad con mitad.
  const lookups: [string, Map<string, F[]>][] = [
    ...keys.strong.map((key): [string, Map<string, F[]>] => [key, index.strong]),
    ...keys.weak.map((key): [string, Map<string, F[]>] => [key, index.strong]),
    ...keys.strong.map((key): [string, Map<string, F[]>] => [key, index.weak]),
  ];
  for (const [key, map] of lookups) {
    const candidates = map.get(key) ?? [];
    if (candidates.length === 0) continue;
    let best: F | undefined;
    let bestScore = -1;
    let tie = false;
    for (const file of candidates) {
      const score = nearness(audioDir, dirName(file.rel), pattern);
      if (score > bestScore) {
        best = file;
        bestScore = score;
        tie = false;
      } else if (score === bestScore) {
        tie = true;
      }
    }
    if (!best || tie) continue;
    if (bestScore === 0 && candidates.length > 1) continue;
    return best;
  }
  return undefined;
}

/** La mejor portada de cada carpeta, por su nombre o por ser la única imagen suelta. */
function folderCoverIndex<F extends MatchFile>(images: F[], songCovers: Set<string>): Map<string, F> {
  const best = new Map<string, { file: F; rank: number }>();
  const loose = new Map<string, F[]>();
  for (const file of images) {
    const dir = dirName(file.rel).toLowerCase();
    const rank = FOLDER_COVERS.findIndex((pattern) => pattern.test(baseName(file.name)));
    if (rank >= 0) {
      const current = best.get(dir);
      if (!current || rank < current.rank) best.set(dir, { file, rank });
    } else if (!songCovers.has(file.rel)) {
      // Ni se llama «cover» ni es la portada de una canción concreta.
      loose.set(dir, [...(loose.get(dir) ?? []), file]);
    }
  }
  const result = new Map<string, F>();
  for (const [dir, { file }] of best) result.set(dir, file);
  // Una carpeta con una sola imagen suelta: casi siempre, la del álbum.
  for (const [dir, list] of loose) if (!result.has(dir) && list.length === 1) result.set(dir, list[0]);
  return result;
}

export interface Companions<F> {
  lrc?: F;
  txt?: F;
  /** Imagen con el nombre de la canción. */
  cover?: F;
  /** Portada de su carpeta (o de la carpeta de portadas que la acompaña, o de una carpeta superior). */
  folderCover?: F;
}

/**
 * Prepara la búsqueda de compañeros para un conjunto de archivos elegidos y
 * devuelve la función que, para cada audio, da su .lrc, su .txt, su portada y
 * la portada de su carpeta.
 */
export function companionFinder<F extends MatchFile>(files: F[]): (audio: F) => Companions<F> {
  const lrcs = files.filter((file) => /\.lrc$/i.test(file.name));
  const txts = files.filter((file) => /\.txt$/i.test(file.name));
  const images = files.filter((file) => IMAGE_EXTENSIONS.test(file.name));
  const audios = files.filter((file) => AUDIO_EXTENSIONS.test(file.name));
  const lrcIndex = indexByKey(lrcs);
  const txtIndex = indexByKey(txts);
  const imageIndex = indexByKey(images.filter((file) => !FOLDER_COVERS.some((pattern) => pattern.test(baseName(file.name)))));

  // Primero las portadas de cada canción: las que lo son no cuentan como
  // «imagen suelta» al buscar la de la carpeta.
  const songCover = new Map<string, F | undefined>();
  for (const audio of audios) songCover.set(audio.rel, bestMatch(audio, imageIndex, 'cover'));
  const songCovers = new Set([...songCover.values()].filter((file): file is F => !!file).map((file) => file.rel));
  const folderCovers = folderCoverIndex(images, songCovers);

  // Carpetas de portadas de cada carpeta («Álbum/Portadas»), para heredar su portada.
  const coverFolders = new Map<string, string[]>();
  for (const dir of new Set(images.map((file) => dirName(file.rel)))) {
    const parts = segments(dir);
    if (parts.length === 0 || !COVERS_FOLDER.test(fold(parts[parts.length - 1]))) continue;
    const parent = parts.slice(0, -1).join('/').toLowerCase();
    coverFolders.set(parent, [...(coverFolders.get(parent) ?? []), dir.toLowerCase()]);
  }

  const folderCoverOf = (audioDir: string): F | undefined => {
    let parts = segments(audioDir);
    // La de su carpeta; si no, la de su carpeta de portadas; si no, la de las
    // carpetas superiores (un álbum en CD1/ y CD2/ comparte la del álbum).
    for (;;) {
      const dir = parts.join('/').toLowerCase();
      const own = folderCovers.get(dir);
      if (own) return own;
      for (const sub of coverFolders.get(dir) ?? []) {
        const inner = folderCovers.get(sub);
        if (inner) return inner;
      }
      if (parts.length === 0) return undefined;
      parts = parts.slice(0, -1);
    }
  };

  return (audio) => ({
    lrc: bestMatch(audio, lrcIndex, 'lyrics'),
    txt: bestMatch(audio, txtIndex, 'lyrics'),
    cover: songCover.get(audio.rel) ?? bestMatch(audio, imageIndex, 'cover'),
    folderCover: folderCoverOf(dirName(audio.rel)),
  });
}
