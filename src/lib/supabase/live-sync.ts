import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { CLOUD_APPLIED_EVENT, adoptRemoteWrite, printOfLocal, pushToCloud, readCursor, writeCursor } from '@/lib/supabase/sync';
import { SCOPED_KEYS, isApplyingRemote } from '@/lib/storage-snapshot';
import {
  announcedFromSync,
  applyDelta,
  computeDelta,
  deviceId,
  ensureSyncKey,
  openDelta,
  rememberAnnounced,
  sealDelta,
  type Announced,
  type DeltaChange,
} from '@/lib/sync-delta';
import { noteLocalEdits } from '@/lib/sync-merge';
import { markLiveChange } from '@/lib/sync-status';
import { SYNC_NOW_EVENT } from '@/lib/sync-check';

// ============================================================
// Sincronización en vivo entre dispositivos (laptop ↔ celular ↔ tablet).
//
//   1. AL INSTANTE (1.6.8). Cada cambio del usuario viaja cifrado por el
//      canal de la cuenta (sync-delta.ts) a los ~200 ms (en una ráfaga, cada
//      medio segundo como mucho) y el otro dispositivo lo aplica sin bajar
//      nada: unos 250 ms de punta a punta.
//   2. RESPALDO. A los 600 ms del último cambio (y como mucho a los 3 s de
//      una ráfaga: antes, escribir sin pausa la posponía para siempre) se
//      sincroniza con la nube (sync.ts), que es lo que confirma y resuelve
//      los choques. Tras escribir, un «hay cambios» avisa a los demás con la
//      huella de lo escrito: quien ya lo tiene todo por el canal no baja nada;
//      los dispositivos con versiones anteriores, que solo entienden el aviso,
//      sincronizan como siempre.
//   3. RED DE SEGURIDAD. Al volver Frame al frente, al recuperar la conexión y
//      cada 30 s con Frame a la vista (una sonda de pocos bytes).
//
// Todo esto lo ejercita scripts/probar-sincronizacion.mjs con dos y tres
// dispositivos simulados (y uno con la 1.6.7).
// ============================================================

const DELTA_DEBOUNCE_MS = 200;
const DELTA_MAX_WAIT_MS = 500;
const LOCAL_DEBOUNCE_MS = 600;
const LOCAL_MAX_WAIT_MS = 3000;
const REMOTE_DELAY_MS = 150;
const PROBE_MS = 30_000;

export function startLiveSync(uid: string): () => void {
  let stopped = false;
  let timer: number | null = null;
  let deltaTimer: number | null = null;
  /** Primer cambio aún sin sincronizar / sin anunciar (para las esperas máximas). */
  let pendingSince: number | null = null;
  let deltaSince: number | null = null;
  let running = false;
  let again = false;
  let channel: RealtimeChannel | null = null;
  let channelReady = false;
  const dirty = new Set<string>();
  let announced: Announced | null = announcedFromSync(uid);
  const me = deviceId();

  const run = async () => {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    pendingSince = null;
    // Lo pendiente de anunciar, antes: así la sincronización ve cuándo se hizo
    // cada cambio y el otro dispositivo recibe la misma marca por el canal.
    flushLocal();
    try {
      const result = await pushToCloud(uid);
      if (result.ok) {
        // Lo que la nube ya tiene cuenta como anunciado; y si la cuenta aún no
        // tiene clave para los cambios al instante, se crea (viaja en el
        // siguiente ciclo).
        announced = announcedFromSync(uid);
        ensureSyncKey(uid);
      }
      // Llegó algo de otro dispositivo: la interfaz viva relee el disco.
      if (result.applied) window.dispatchEvent(new Event(CLOUD_APPLIED_EVENT));
      // Subimos algo nuevo: que los otros dispositivos lo traigan ya (o que
      // comprueben con la huella que ya lo tienen).
      if (result.ok && result.wrote && channel && channelReady) {
        const payload = { at: Date.now(), from: me, u: result.remoteAt, p: result.print };
        void channel.send({ type: 'broadcast', event: 'changed', payload }).catch(() => undefined);
      }
    } catch {
      /* el siguiente disparo lo reintenta */
    } finally {
      running = false;
      if (again && !stopped) {
        again = false;
        schedule(300);
      }
    }
  };

  /** Programa la sincronización completa; `local`: viene de un cambio del usuario. */
  const schedule = (delay: number, local = false) => {
    if (stopped) return;
    if (local) {
      const now = Date.now();
      pendingSince ??= now;
      delay = Math.min(delay, Math.max(0, pendingSince + LOCAL_MAX_WAIT_MS - now));
    }
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      void run();
    }, delay);
  };

  // --- 1. Al instante: los cambios, cifrados, por el canal ---
  const sendDelta = async (changes: DeltaChange[]) => {
    const sealed = await sealDelta(uid, changes);
    if (sealed && channel && channelReady && !stopped) {
      void channel.send({ type: 'broadcast', event: 'delta', payload: sealed }).catch(() => undefined);
    }
  };

  /**
   * Lo cambiado aquí desde lo último anunciado: se anota cuándo se hizo
   * (sync-merge.ts, también sin conexión) y viaja si el canal está abierto.
   */
  const flushLocal = () => {
    if (deltaTimer !== null) window.clearTimeout(deltaTimer);
    deltaTimer = null;
    deltaSince = null;
    if (stopped || dirty.size === 0) return;
    announced ??= announcedFromSync(uid);
    if (!announced) return; // sin primera sincronización: todo viaja con ella
    const keys = [...dirty];
    dirty.clear();
    const changes = noteLocalEdits(uid, computeDelta(uid, keys, announced, new Date().toISOString()));
    if (changes.length > 0 && channel && channelReady) void sendDelta(changes);
  };

  const receiveDelta = async (payload: unknown) => {
    const changes = await openDelta(uid, payload);
    if (!changes) {
      // No se pudo leer (otra clave, aún sin la de la cuenta): que llegue por la nube.
      schedule(REMOTE_DELAY_MS);
      return;
    }
    if (changes.length === 0) return;
    const cursor = readCursor(uid);
    const wasSynced = cursor !== null && cursor.localPrint === printOfLocal(uid);
    const applied = applyDelta(uid, changes);
    if (applied.length === 0) {
      schedule(REMOTE_DELAY_MS);
      return;
    }
    if (announced) rememberAnnounced(announced, applied);
    // Si aquí no había nada pendiente, lo aplicado no es un cambio propio que
    // haya que subir: lo sube quien lo hizo. Así los dos no escriben lo mismo.
    if (wasSynced && cursor) writeCursor(uid, { ...cursor, localPrint: printOfLocal(uid) });
    markLiveChange();
    window.dispatchEvent(new Event(CLOUD_APPLIED_EVENT));
    // Lo que no se aplicó (había un cambio propio pendiente) lo resuelve la fusión.
    if (applied.length < changes.length) schedule(REMOTE_DELAY_MS);
  };

  // --- 2. Cambios locales: se vigila el propio almacenamiento ---
  const keyOf = new Map<string, string>(SCOPED_KEYS.map((key) => [`${key}_${uid}`, key]));
  const onLocalChange = (storageKey: string) => {
    const key = keyOf.get(storageKey);
    if (!key || isApplyingRemote()) return;
    dirty.add(key);
    // Como la sincronización, con espera máxima: escribir sin pausa no retiene
    // los cambios al instante hasta que el usuario pare.
    const now = Date.now();
    deltaSince ??= now;
    if (deltaTimer !== null) window.clearTimeout(deltaTimer);
    deltaTimer = window.setTimeout(flushLocal, Math.min(DELTA_DEBOUNCE_MS, Math.max(0, deltaSince + DELTA_MAX_WAIT_MS - now)));
    schedule(LOCAL_DEBOUNCE_MS, true);
  };
  const proto = Storage.prototype;
  const originalSet = proto.setItem;
  const originalRemove = proto.removeItem;
  const patchedSet = function (this: Storage, key: string, value: string) {
    originalSet.call(this, key, value);
    if (this === window.localStorage) onLocalChange(key);
  };
  const patchedRemove = function (this: Storage, key: string) {
    originalRemove.call(this, key);
    if (this === window.localStorage) onLocalChange(key);
  };
  proto.setItem = patchedSet;
  proto.removeItem = patchedRemove;

  // --- 3. El canal de la cuenta (Realtime Broadcast) ---
  const supabase = getSupabase();
  const connect = () => {
    if (!supabase || stopped) return;
    try {
      channelReady = false;
      const next = supabase.channel(`frame-sync:${uid}`, { config: { broadcast: { self: false } } });
      next.on('broadcast', { event: 'changed' }, (message) => {
        const payload = message.payload as { from?: string; u?: unknown; p?: unknown } | undefined;
        if (payload?.from === me) return;
        // Lo que escribió ya llegó entero por el canal: nada que bajar.
        if (!running && typeof payload?.u === 'string' && typeof payload.p === 'string' && adoptRemoteWrite(uid, payload.u, payload.p)) return;
        schedule(REMOTE_DELAY_MS);
      });
      next.on('broadcast', { event: 'delta' }, (message) => void receiveDelta(message.payload));
      next.subscribe((status) => {
        channelReady = status === 'SUBSCRIBED';
        // Al (re)conectar se pone al día: pudo perderse un aviso mientras tanto.
        if (channelReady) schedule(REMOTE_DELAY_MS);
      });
      channel = next;
    } catch {
      channel = null;
    }
  };
  connect();

  // --- 4. Red de seguridad ---
  const onVisible = () => {
    if (document.visibilityState !== 'visible') {
      // A segundo plano: lo pendiente sale ya, sin esperar a la pausa (Android
      // puede congelar la app en cuanto deja de verse).
      if (pendingSince !== null || dirty.size > 0) schedule(0);
      return;
    }
    // Android duerme el canal con la app en segundo plano: al volver, de nuevo.
    if (!channelReady && channel && supabase) {
      void supabase.removeChannel(channel).catch(() => undefined);
      channel = null;
      connect();
    }
    schedule(200);
  };
  const onOnline = () => schedule(200);
  // «Sincronizar ahora» del verificador de sincronización.
  const onNow = () => schedule(0);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener(SYNC_NOW_EVENT, onNow);
  let tick = 0;
  const interval = window.setInterval(() => {
    tick += 1;
    // Visible: cada 30 s. Oculta: cada 2 min (Android congela lo de fondo).
    if (document.visibilityState === 'visible' || tick % 4 === 0) schedule(0);
  }, PROBE_MS);

  // Primera puesta al día al arrancar.
  schedule(800);

  return () => {
    stopped = true;
    if (timer !== null) window.clearTimeout(timer);
    if (deltaTimer !== null) window.clearTimeout(deltaTimer);
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('online', onOnline);
    window.removeEventListener(SYNC_NOW_EVENT, onNow);
    if (proto.setItem === patchedSet) proto.setItem = originalSet;
    if (proto.removeItem === patchedRemove) proto.removeItem = originalRemove;
    if (channel && supabase) void supabase.removeChannel(channel).catch(() => undefined);
  };
}
