import { SCOPED_KEYS, applyLocalData, readCloudForm } from '@/lib/storage-snapshot';
import { isCollection, noteRemoteChanges, recordId, recordPrint, syncedPrints } from '@/lib/sync-merge';

// ============================================================
// Cambios que viajan al instante por el canal en vivo (1.6.8).
//
// Hasta la 1.6.7 el canal de la cuenta (Supabase Realtime) solo llevaba un
// «hay cambios»: cada dispositivo bajaba entonces el respaldo entero. Ahora,
// además, cada cambio viaja tal cual (las tareas, sesiones o eventos que se
// tocaron) y el otro dispositivo lo aplica en menos de un segundo. La
// sincronización completa sigue detrás, como siempre: es la que confirma y
// la que resuelve los choques.
//
// SEGURIDAD. El canal no es privado (cualquiera que conozca el id de la
// cuenta podría escucharlo), así que el contenido va CIFRADO (AES-GCM, 256
// bits) con una clave de la cuenta que solo conocen sus dispositivos: viaja
// dentro del respaldo, que solo puede leer la propia cuenta (RLS). El id de la
// cuenta va como dato asociado: un mensaje de otra cuenta no se descifra. Lo
// que no se descifra se ignora (y se hace una sincronización completa).
//
// PRUDENCIA. Un cambio que llega solo se aplica si este dispositivo NO tiene
// pendiente un cambio propio del mismo registro; si lo tiene, decide la
// fusión completa (por marca de tiempo), como siempre.
// ============================================================

export interface DeltaChange {
  key: string;
  /** Registro de una colección (ausente en los valores sueltos). */
  id?: string;
  record?: unknown;
  /** Valor suelto (metas, ajustes…). */
  value?: unknown;
  deleted?: boolean;
  /** Marca del cambio (ISO). */
  at: string;
}

/** Lo que este dispositivo ya anunció: huella de cada registro y valor suelto. */
export interface Announced {
  collections: Map<string, Map<string, string>>;
  scalars: Map<string, string>;
}

export interface SealedDelta {
  v: 1;
  /** Dispositivo que lo manda (no se aplica el propio). */
  from: string;
  iv: string;
  c: string;
}

/** Por encima de esto no se manda por el canal (límite del plan: 256 KB). */
const MAX_PAYLOAD_CHARS = 180_000;
/** Un mensaje más viejo que esto se ignora (repetición de uno capturado). */
const MAX_AGE_MS = 5 * 60_000;

const scoped = new Set<string>(SCOPED_KEYS);

// ------------------------------------------------------------
// Identidad del dispositivo y clave de la cuenta
// ------------------------------------------------------------

const DEVICE_KEY = 'frameDeviceId';
let device: string | null = null;

export function deviceId(): string {
  if (device) return device;
  try {
    device = localStorage.getItem(DEVICE_KEY);
    if (!device) {
      device = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, device);
    }
  } catch {
    device ??= crypto.randomUUID();
  }
  return device;
}

const keyStorage = (uid: string) => `syncKey_${uid}`;

function readKeyText(uid: string): string | null {
  try {
    const raw = localStorage.getItem(keyStorage(uid));
    const text = raw ? (JSON.parse(raw) as unknown) : null;
    return typeof text === 'string' && text.length >= 40 ? text : null;
  } catch {
    return null;
  }
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));

/**
 * La primera sincronización de la cuenta crea la clave; viaja con el respaldo
 * y los demás dispositivos la reciben en su siguiente sincronización.
 */
export function ensureSyncKey(uid: string): void {
  if (readKeyText(uid)) return;
  try {
    localStorage.setItem(keyStorage(uid), JSON.stringify(toBase64(crypto.getRandomValues(new Uint8Array(32)))));
  } catch {
    /* sin espacio: sin cambios al instante; la sincronización completa sigue */
  }
}

let keyCache: { text: string; key: CryptoKey } | null = null;

async function cryptoKey(uid: string): Promise<CryptoKey | null> {
  const text = readKeyText(uid);
  if (!text || typeof crypto === 'undefined' || !crypto.subtle) return null;
  if (keyCache?.text === text) return keyCache.key;
  try {
    const key = await crypto.subtle.importKey('raw', fromBase64(text), 'AES-GCM', false, ['encrypt', 'decrypt']);
    keyCache = { text, key };
    return key;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Qué cambió desde lo último anunciado
// ------------------------------------------------------------

/** Lo anunciado parte de la última sincronización (lo que la nube ya tiene). */
export function announcedFromSync(uid: string): Announced | null {
  const base = syncedPrints(uid);
  if (!base) return null;
  return {
    collections: new Map(Object.entries(base.collections).map(([key, prints]) => [key, new Map(Object.entries(prints))])),
    scalars: new Map(Object.entries(base.scalars)),
  };
}

/** Los cambios de `keys` respecto a lo anunciado; lo anunciado se pone al día. */
export function computeDelta(uid: string, keys: Iterable<string>, announced: Announced, at: string): DeltaChange[] {
  const changes: DeltaChange[] = [];
  for (const key of keys) {
    if (!scoped.has(key)) continue;
    const value = readCloudForm(uid, key);
    if (isCollection(key)) {
      if (!Array.isArray(value)) continue; // ausente o ilegible: lo resuelve la sincronización completa
      const known = announced.collections.get(key) ?? new Map<string, string>();
      announced.collections.set(key, known);
      const seen = new Set<string>();
      for (const record of value as Record<string, unknown>[]) {
        const id = recordId(record);
        if (!id) continue;
        seen.add(id);
        const print = recordPrint(record);
        if (known.get(id) === print) continue;
        known.set(id, print);
        changes.push({ key, id, record, at });
      }
      for (const id of [...known.keys()]) {
        if (seen.has(id)) continue;
        known.delete(id);
        changes.push({ key, id, deleted: true, at });
      }
    } else if (value !== undefined) {
      const print = recordPrint(value);
      if (announced.scalars.get(key) === print) continue;
      announced.scalars.set(key, print);
      changes.push({ key, value, at });
    }
  }
  return changes;
}

/** Lo que llega aplicado también cuenta como anunciado: no se reenvía de vuelta. */
export function rememberAnnounced(announced: Announced, changes: DeltaChange[]): void {
  for (const change of changes) {
    if (change.id === undefined) {
      announced.scalars.set(change.key, recordPrint(change.value));
      continue;
    }
    const known = announced.collections.get(change.key) ?? new Map<string, string>();
    announced.collections.set(change.key, known);
    if (change.deleted) known.delete(change.id);
    else known.set(change.id, recordPrint(change.record));
  }
}

// ------------------------------------------------------------
// Cifrado
// ------------------------------------------------------------

const encoder = new TextEncoder();

export async function sealDelta(uid: string, changes: DeltaChange[]): Promise<SealedDelta | null> {
  if (changes.length === 0) return null;
  const key = await cryptoKey(uid);
  if (!key) return null;
  const plain = JSON.stringify({ u: uid, sent: Date.now(), changes });
  if (plain.length > MAX_PAYLOAD_CHARS) return null; // muy grande: va por la sincronización completa
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(uid) }, key, encoder.encode(plain));
    return { v: 1, from: deviceId(), iv: toBase64(iv), c: toBase64(new Uint8Array(cipher)) };
  } catch {
    return null;
  }
}

const isChange = (value: unknown): value is DeltaChange => {
  const change = value as DeltaChange;
  return (
    !!change &&
    typeof change.key === 'string' &&
    typeof change.at === 'string' &&
    (change.id === undefined || typeof change.id === 'string')
  );
};

/** Descifra un mensaje del canal. null: no es de esta cuenta, está alterado o es viejo. */
export async function openDelta(uid: string, sealed: unknown): Promise<DeltaChange[] | null> {
  const message = sealed as Partial<SealedDelta> | null;
  if (!message || message.v !== 1 || typeof message.iv !== 'string' || typeof message.c !== 'string') return null;
  if (message.from === deviceId()) return null;
  const key = await cryptoKey(uid);
  if (!key) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(message.iv), additionalData: encoder.encode(uid) },
      key,
      fromBase64(message.c)
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as { u?: unknown; sent?: unknown; changes?: unknown };
    if (parsed.u !== uid || typeof parsed.sent !== 'number' || Date.now() - parsed.sent > MAX_AGE_MS) return null;
    return Array.isArray(parsed.changes) ? parsed.changes.filter(isChange) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Aplicar lo que llega
// ------------------------------------------------------------

/**
 * Aplica los cambios que este dispositivo no tenga pendientes por su cuenta.
 * Devuelve los aplicados (vacío si no aplicó nada).
 */
export function applyDelta(uid: string, changes: DeltaChange[]): DeltaChange[] {
  const base = syncedPrints(uid);
  // Sin una primera sincronización no hay con qué comparar: que llegue por ella.
  if (!base) return [];
  const applied: DeltaChange[] = [];
  const next: Record<string, unknown> = {};

  const byKey = new Map<string, DeltaChange[]>();
  for (const change of changes) {
    if (!scoped.has(change.key)) continue;
    const list = byKey.get(change.key) ?? [];
    list.push(change);
    byKey.set(change.key, list);
  }

  for (const [key, list] of byKey) {
    const current = readCloudForm(uid, key);
    if (isCollection(key)) {
      if (current !== undefined && !Array.isArray(current)) continue;
      const rows = Array.isArray(current) ? [...(current as Record<string, unknown>[])] : [];
      const prints = base.collections[key] ?? {};
      let touched = false;
      for (const change of list) {
        if (change.id === undefined) continue;
        const index = rows.findIndex((row) => recordId(row) === change.id);
        const local = index >= 0 ? rows[index] : undefined;
        // Cambio propio pendiente (editado o borrado aquí desde la última
        // sincronización): no se toca; lo decide la fusión completa.
        if (local !== undefined ? prints[change.id] !== recordPrint(local) : prints[change.id] !== undefined) continue;
        if (change.deleted) {
          if (index < 0) continue;
          rows.splice(index, 1);
        } else if (change.record && typeof change.record === 'object') {
          if (index >= 0) rows[index] = change.record as Record<string, unknown>;
          else rows.push(change.record as Record<string, unknown>);
        } else continue;
        touched = true;
        applied.push(change);
      }
      if (touched) next[key] = rows;
    } else {
      const change = list[list.length - 1];
      const synced = base.scalars[key];
      const pending = current === undefined ? synced !== undefined : synced !== recordPrint(current);
      if (pending || change.value === undefined) continue;
      next[key] = change.value;
      applied.push(change);
    }
  }

  if (applied.length === 0) return [];
  const outcome = applyLocalData(uid, next);
  if (!outcome.ok) return [];
  noteRemoteChanges(uid, applied);
  return applied;
}
