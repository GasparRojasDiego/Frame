// ============================================================
// Lector mínimo de archivos .zip (sin dependencias).
//
// Lee el directorio central del final del archivo y descomprime cada entrada
// con el descompresor del propio motor web (DecompressionStream
// 'deflate-raw'). Solo lee lo que se pide: un zip grande no se carga entero
// en memoria. Admite los métodos «sin compresión» (0) y «deflate» (8), que
// son los que usan Notion, Windows y casi todo el mundo; no admite ZIP64.
// ============================================================

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

const view = async (blob: Blob, start: number, end: number) =>
  new DataView(await blob.slice(start, end).arrayBuffer());

export async function listZip(file: Blob): Promise<ZipEntry[]> {
  // El registro final (EOCD) está en los últimos 22 bytes + el comentario.
  const tailStart = Math.max(0, file.size - 66000);
  const tail = await view(file, tailStart, file.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('No es un archivo .zip válido.');
  const count = tail.getUint16(eocd + 10, true);
  const dirSize = tail.getUint32(eocd + 12, true);
  const dirOffset = tail.getUint32(eocd + 16, true);
  if (dirOffset === 0xffffffff) throw new Error('El .zip es demasiado grande (ZIP64).');

  const dir = await view(file, dirOffset, dirOffset + dirSize);
  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= dir.byteLength; n++) {
    if (dir.getUint32(p, true) !== 0x02014b50) break;
    const method = dir.getUint16(p + 10, true);
    const compressedSize = dir.getUint32(p + 20, true);
    const size = dir.getUint32(p + 24, true);
    const nameLength = dir.getUint16(p + 28, true);
    const extraLength = dir.getUint16(p + 30, true);
    const commentLength = dir.getUint16(p + 32, true);
    const offset = dir.getUint32(p + 42, true);
    const nameBytes = new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLength);
    entries.push({ name: decoder.decode(nameBytes), method, compressedSize, size, offset });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function readZipEntry(file: Blob, entry: ZipEntry): Promise<Uint8Array> {
  const header = await view(file, entry.offset, entry.offset + 30);
  if (header.getUint32(0, true) !== 0x04034b50) throw new Error(`Entrada dañada: ${entry.name}`);
  const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const data = file.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return new Uint8Array(await data.arrayBuffer());
  if (entry.method === 8) {
    const stream = data.stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error(`Compresión no admitida en ${entry.name}`);
}

export async function readZipText(file: Blob, entry: ZipEntry): Promise<string> {
  return new TextDecoder('utf-8').decode(await readZipEntry(file, entry));
}
