// ============================================================
// Título y artista de una canción a partir de lo que se sepa de ella.
//
// Las etiquetas mandan, pero a menudo faltan o son basura («Track 01»,
// «Artista desconocido», el título con «Artista - Canción» dentro). Entonces
// se lee el nombre del archivo, que llega de mil maneras:
//   «01 - Artista - Canción.mp3» · «Artista - Canción (Official Video).mp3» ·
//   «Artista_-_Canción.mp3» · «1-03 Canción.flac» · «Canción - Artista.mp3»
// Para decidir qué lado es el artista se usan los artistas que el usuario ya
// tiene en su biblioteca; si no hay pista, gana lo habitual: «Artista - Título».
//
// Sin dependencias: se prueba con `node scripts/probar-musica.ts`.
// ============================================================

export interface SongName {
  title: string;
  artist?: string;
}

export interface SongNameInput {
  /** Nombre del archivo, con o sin extensión. */
  fileName: string;
  tagTitle?: string;
  tagArtist?: string;
  tagAlbumArtist?: string;
  /** Artistas ya conocidos, pasados por `foldName`. */
  knownArtists?: ReadonlySet<string>;
}

/** Forma de comparar nombres: sin tildes, mayúsculas, signos ni espacios. */
export function foldName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

const AUDIO_EXTENSION = /\.(mp3|m4a|aac|ogg|oga|opus|flac|wav|webm|weba|wma|aiff?|ape|mp4)$/i;

/** Valores de etiqueta que no dicen nada. */
const JUNK =
  /^(?:track|pista|audio\s*track|tema|untitled|sin\s*t[ií]tulo|unknown(?:\s*artist)?|artista\s*desconocido|desconocido|unbekannt|inconnu|various(?:\s*artists)?|varios(?:\s*artistas)?|va|<unknown>|<desconocido>|n\/?a|null|undefined|-+|\?+)(?:\s*\d+)?$/i;

export function isJunkTag(value: string | undefined): boolean {
  const text = value?.trim();
  return !text || JUNK.test(text);
}

/**
 * Lo que sobra en los nombres que vienen de vídeos o de webs: «(Official
 * Video)», «[Lyrics]», «(Audio)», «HD»… Lo que sí es parte de la canción
 * —«(Live)», «(Remix)», «(Acoustic)», «(feat. X)», «(Remastered 2011)»— se
 * queda.
 */
const NOISE_WORDS = [
  'official\\s+(?:music\\s+)?video',
  'official\\s+(?:lyrics?\\s+)?video',
  'official\\s+audio',
  'official\\s+visuali[sz]er',
  'official',
  'music\\s+video',
  'lyrics?\\s+video',
  'lyrics?',
  'with\\s+lyrics',
  'video\\s+oficial',
  'v[ií]deo\\s+oficial',
  'v[ií]deo\\s+musical',
  'v[ií]deoclip',
  'videoclip\\s+oficial',
  'clip\\s+officiel',
  'audio\\s+oficial',
  'letra',
  'con\\s+letra',
  'letra\\s+oficial',
  'visuali[sz]er',
  'audio',
  'video',
  'v[ií]deo',
  'hd',
  'hq',
  '4k',
  '1080p',
  '720p',
  'explicit',
  'clean',
  'free\\s+download',
];
const NOISE = new RegExp(`\\s*[\\(\\[\\{]\\s*(?:${NOISE_WORDS.join('|')})\\s*[\\)\\]\\}]`, 'gi');
/** Igual, pero suelto al final: «Canción - Official Video», «Canción | Letra». */
const TRAILING_NOISE = new RegExp(`\\s*[-|–—]\\s*(?:${NOISE_WORDS.join('|')})\\s*$`, 'i');

/** Separadores entre artista y título. */
const SEPARATOR = /\s+[-–—~]+\s+|\s*[–—]\s*|\s+-{2,}\s+/;

/**
 * Número de pista al principio: «01 - », «01. », «1-03 », «03_», «Track 05 ».
 * Un número sin cero delante y sin signo detrás («7 Rings», «99 Problems») es
 * parte del título y no se toca.
 */
const TRACK_PREFIX =
  /^\s*(?:(?:cd|disc|disco)\s*\d{1,2}\s*[-_.]?\s*)?(?:(?:track|pista)\s*\d{1,3}\s*[-_.):]?\s*|\d{1,2}\s*[-_.]\s*\d{1,3}(?:\s*[-_.)]\s*|\s+)|0\d{1,2}(?:\s*[-_.)]\s*|\s+)|\d{1,3}\s*(?:[-_.)]|\s-\s)\s*)(?=\S)/i;

function tidy(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'«“‘]+|[\s"'»”’]+$/g, '')
    .trim();
}

/** Quita el ruido de un título («(Official Video)», comillas, espacios de más). */
export function cleanTitle(value: string): string {
  let text = value.replace(NOISE, '');
  // El ruido puede venir encadenado: «Canción (Audio) [HD]».
  for (let i = 0; i < 3 && TRAILING_NOISE.test(text); i++) text = text.replace(TRAILING_NOISE, '');
  return tidy(text) || tidy(value);
}

/** Quita lo que añaden los canales de vídeo al artista («… - Topic», «…VEVO»). */
export function cleanArtist(value: string): string {
  const text = tidy(
    value
      .replace(/\s*-\s*topic$/i, '')
      .replace(/(?<=\S)\s*vevo$/i, '')
      .replace(/\s*[\(\[]\s*official\s*[\)\]]\s*$/i, '')
  );
  return text || tidy(value);
}

/** Nombre de archivo sin extensión, con los guiones bajos como espacios. */
function readableBase(fileName: string): string {
  let base = fileName.replace(AUDIO_EXTENSION, '').replace(/\.[a-z0-9]{2,4}$/i, '');
  // «Artista_-_Canción» o «mi_cancion_favorita»: los guiones bajos eran espacios.
  if (base.includes('_') && (!base.includes(' ') || /_-_/.test(base))) base = base.replace(/_+/g, ' ');
  return base.replace(/\s+/g, ' ').trim();
}

const isKnown = (value: string, known?: ReadonlySet<string>): boolean => {
  if (!known || known.size === 0) return false;
  const folded = foldName(value);
  if (!folded) return false;
  if (known.has(folded)) return true;
  // «Artista feat. Otro», «Artista & Otro», «Artista, Otro»: basta el primero.
  const first = foldName(value.split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bfeaturing\b|\bx\b|\by\b|\bcon\b|\bwith\b|\/)\s*/i)[0] ?? '');
  return !!first && known.has(first);
};

/**
 * Lo que va tras el guion es la versión, no el título: «Canción - Remastered
 * 2011», «Canción - En vivo». Con solo dos partes, eso no es «Artista - Título».
 */
const VERSION_INFO =
  /^(?:\d{4}\s+)?(?:remaster(?:ed|izado)?|live|en\s+vivo|ao\s+vivo|remix|mix|edit|radio\s+edit|version|versi[oó]n|acoustic|ac[uú]stic[oa]|unplugged|mono|stereo|instrumental|demo|bonus|extended|original\s+mix|single\s+version|album\s+version|from\b|de\s+la\s+pel[ií]cula|bso|ost)\b/i;

/** «Artista - Título» (o al revés) → partes; null si no hay separador claro. */
function splitPair(text: string, known?: ReadonlySet<string>): SongName | null {
  const parts = text.split(SEPARATOR).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  if (parts.length === 2 && VERSION_INFO.test(parts[1]) && !isKnown(parts[0], known)) return null;

  // «Artista - Álbum - 03 - Título»: lo que va tras el número es el título.
  const numberAt = parts.findIndex((part, index) => index > 0 && /^\d{1,3}$/.test(part));
  if (numberAt > 0 && numberAt < parts.length - 1) {
    return { artist: parts[0], title: parts.slice(numberAt + 1).join(' - ') };
  }

  const first = parts[0];
  const rest = parts.slice(1).join(' - ');
  const last = parts[parts.length - 1];
  const head = parts.slice(0, -1).join(' - ');

  // «Título - Artista» solo si el artista conocido está a la derecha y no a la izquierda.
  if (isKnown(last, known) && !isKnown(first, known)) return { artist: last, title: head };
  return { artist: first, title: rest };
}

/** Nombre presentable sacado solo del nombre del archivo. */
export function guessFromFileName(fileName: string, knownArtists?: ReadonlySet<string>): SongName {
  const base = readableBase(fileName);
  const withoutNumber = base.replace(TRACK_PREFIX, '').trim() || base;
  // «Canción | Artista» o «Canción | Letra»: lo de detrás de la barra casi nunca es el título.
  const [main] = withoutNumber.split(/\s+\|\s+/);
  const text = cleanTitle(main || withoutNumber);
  const pair = splitPair(text, knownArtists);
  if (pair?.artist && pair.title) {
    return { artist: cleanArtist(pair.artist), title: cleanTitle(pair.title.replace(TRACK_PREFIX, '')) };
  }
  return { title: text || base || fileName };
}

/**
 * Título y artista definitivos: etiquetas limpias si sirven y, si no, lo que
 * diga el nombre del archivo. Nunca devuelve un título vacío.
 */
export function resolveSongName(input: SongNameInput): SongName {
  const known = input.knownArtists;
  let title = isJunkTag(input.tagTitle) ? '' : cleanTitle(input.tagTitle!);
  let artist = !isJunkTag(input.tagArtist)
    ? cleanArtist(input.tagArtist!)
    : !isJunkTag(input.tagAlbumArtist)
      ? cleanArtist(input.tagAlbumArtist!)
      : '';

  if (title && !artist) {
    const pair = splitPair(title, known);
    // El nombre del archivo solo aporta si dice algo distinto del título.
    const fromFile =
      foldName(readableBase(input.fileName)) !== foldName(input.tagTitle ?? '')
        ? guessFromFileName(input.fileName, known)
        : null;
    if (pair?.artist && pair.title && isKnown(pair.artist, known)) {
      // El título trae «Artista - Canción» y ese artista ya está en la biblioteca.
      artist = cleanArtist(pair.artist);
      title = cleanTitle(pair.title);
    } else if (fromFile?.artist && foldName(fromFile.artist) !== foldName(title)) {
      artist = fromFile.artist;
    } else if (pair?.artist && pair.title) {
      // Sin más pistas, «A - B» en un título suele ser «Artista - Canción».
      artist = cleanArtist(pair.artist);
      title = cleanTitle(pair.title);
    }
  }

  if (title && artist) {
    // «Artista - Canción» en el título, con el mismo artista en su etiqueta.
    const prefix = new RegExp(`^${artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]\\s*`, 'i');
    const stripped = title.replace(prefix, '').trim();
    if (stripped && stripped !== title) title = stripped;
  }

  if (!title) {
    const guess = guessFromFileName(input.fileName, known);
    // Si el archivo dice «A - B» y uno de los dos es el artista de la etiqueta, el otro es el título.
    if (artist && guess.artist && foldName(guess.title) === foldName(artist)) {
      title = guess.artist;
    } else {
      title = guess.title;
      if (!artist && guess.artist) artist = guess.artist;
    }
  }

  return { title: title || readableBase(input.fileName) || input.fileName, artist: artist || undefined };
}
