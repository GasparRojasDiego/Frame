import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { CLOUD_APPLIED_EVENT, pushToCloud } from '@/lib/supabase/sync';
import { SCOPED_KEYS, isApplyingRemote } from '@/lib/storage-snapshot';

// ============================================================
// Sincronización en vivo entre dispositivos (laptop ↔ celular ↔ tablet).
//
// Antes la copia en la nube se hacía cada dos minutos: un cambio en el
// celular tardaba hasta cuatro en verse en la laptop. Ahora, dentro del plan
// gratuito de Supabase:
//
//   1. SUBIR ENSEGUIDA. Cualquier escritura del usuario en sus datos programa
//      una sincronización a 1,5 s (agrupa las ráfagas: escribir una tarea no
//      son diez subidas). Se detecta en el propio almacenamiento, así ninguna
//      pantalla puede olvidarse de avisar.
//   2. AVISAR A LOS DEMÁS. Tras subir, el dispositivo manda un «hay cambios»
//      por Supabase Realtime (Broadcast: un mensaje de pocos bytes, sin datos)
//      al canal de la cuenta. Los otros dispositivos lo oyen y bajan al
//      instante. Los datos siguen yendo por la tabla protegida con RLS.
//   3. RED DE SEGURIDAD. Al volver Frame al frente, al recuperar la conexión y
//      cada 30 s con Frame a la vista (una sonda de pocos bytes: sync.ts).
//
// Latencia típica de un cambio en otro dispositivo: 2 a 4 segundos.
// ============================================================

const LOCAL_DEBOUNCE_MS = 1500;
const REMOTE_DELAY_MS = 250;
const PROBE_MS = 30_000;

export function startLiveSync(uid: string): () => void {
  let stopped = false;
  let timer: number | null = null;
  let running = false;
  let again = false;
  let channel: RealtimeChannel | null = null;
  let channelReady = false;

  const run = async () => {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      const result = await pushToCloud(uid);
      // Llegó algo de otro dispositivo: la interfaz viva relee el disco.
      if (result.applied) window.dispatchEvent(new Event(CLOUD_APPLIED_EVENT));
      // Subimos algo nuevo: que los otros dispositivos lo traigan ya.
      if (result.ok && result.wrote && channel && channelReady) {
        void channel.send({ type: 'broadcast', event: 'changed', payload: { at: Date.now() } }).catch(() => undefined);
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

  const schedule = (delay: number) => {
    if (stopped) return;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      void run();
    }, delay);
  };

  // --- 1. Cambios locales: se vigila el propio almacenamiento ---
  const watched = new Set<string>(SCOPED_KEYS.map((key) => `${key}_${uid}`));
  const proto = Storage.prototype;
  const originalSet = proto.setItem;
  const originalRemove = proto.removeItem;
  const patchedSet = function (this: Storage, key: string, value: string) {
    originalSet.call(this, key, value);
    if (this === window.localStorage && watched.has(key) && !isApplyingRemote()) schedule(LOCAL_DEBOUNCE_MS);
  };
  const patchedRemove = function (this: Storage, key: string) {
    originalRemove.call(this, key);
    if (this === window.localStorage && watched.has(key) && !isApplyingRemote()) schedule(LOCAL_DEBOUNCE_MS);
  };
  proto.setItem = patchedSet;
  proto.removeItem = patchedRemove;

  // --- 2. Aviso de los otros dispositivos (Realtime Broadcast) ---
  const supabase = getSupabase();
  if (supabase) {
    try {
      channel = supabase.channel(`frame-sync:${uid}`, { config: { broadcast: { self: false } } });
      channel.on('broadcast', { event: 'changed' }, () => schedule(REMOTE_DELAY_MS));
      channel.subscribe((status) => {
        channelReady = status === 'SUBSCRIBED';
        // Al (re)conectar se pone al día: pudo perderse un aviso mientras tanto.
        if (channelReady) schedule(REMOTE_DELAY_MS);
      });
    } catch {
      channel = null;
    }
  }

  // --- 3. Red de seguridad ---
  const onVisible = () => {
    if (document.visibilityState === 'visible') schedule(200);
  };
  const onOnline = () => schedule(200);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('online', onOnline);
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
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('online', onOnline);
    if (proto.setItem === patchedSet) proto.setItem = originalSet;
    if (proto.removeItem === patchedRemove) proto.removeItem = originalRemove;
    if (channel && supabase) void supabase.removeChannel(channel).catch(() => undefined);
  };
}
