#!/usr/bin/env node
// ============================================================
// Prueba de la sincronización entre dispositivos (1.6.8).
//
//   node scripts/probar-sincronizacion.mjs
//   SEMILLA=7 node scripts/probar-sincronizacion.mjs     (otras latencias)
//
// Cada dispositivo es un contexto aislado de Node (node:vm) que ejecuta el
// motor REAL de src/ empaquetado con esbuild: su almacenamiento, sus
// temporizadores, su canal en vivo y sus prisas. La nube es una fila como la
// de la tabla `backups` (escritura condicionada a `updated_at`, fecha en el
// formato de Postgres) y cada petición y cada mensaje tardan lo que en una
// red de verdad (10 a 50 ms, al azar pero reproducible).
//
// Un tercer tipo de dispositivo ejecuta el motor de la 1.6.7 (móvil 1.1.3),
// copiado de git: comprueba que las dos versiones conviven mientras cada
// equipo se actualiza.
//
// No usa la red ni la nube real.
// ============================================================

import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'scripts', 'sincronizacion');
const UID = '0c1d2e3f-0000-4000-8000-00000000f4a3';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------
// Azar reproducible (mulberry32)
// ------------------------------------------------------------
let seed = Number(process.env.SEMILLA ?? 168) >>> 0;
function random() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const latency = () => 10 + Math.floor(random() * 40);
const later = (fn) => setTimeout(fn, latency());

// ------------------------------------------------------------
// Los dos motores, empaquetados una vez
// ------------------------------------------------------------
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function aliases(map) {
  const filter = new RegExp(`^(${Object.keys(map).map(escapeRe).join('|')})$`);
  return {
    name: 'alias-prueba',
    setup(build) {
      build.onResolve({ filter }, (args) => {
        // './client' solo es el cliente de Supabase desde su carpeta (o desde la copia de la 1.6.7).
        if (args.path.startsWith('./') && !/[\\/](supabase|sincronizacion)$/.test(args.resolveDir)) return undefined;
        return { path: map[args.path] };
      });
    },
  };
}

async function compile(entry, extra = {}) {
  const fake = path.join(dir, 'cliente-falso.ts');
  const result = await esbuild.build({
    entryPoints: [path.join(dir, entry)],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
    plugins: [
      aliases({
        '@/lib/supabase/client': fake,
        './client': fake,
        '@/lib/error-report': path.join(dir, 'registro-falso.ts'),
        ...extra,
      }),
    ],
  });
  return new vm.Script(result.outputFiles[0].text, { filename: entry.replace(/\.ts$/, '.js') });
}

const engines = {
  actual: await compile('dispositivo.ts'),
  '1.6.7': await compile('dispositivo-1.6.7.ts', {
    '@/lib/supabase/sync': path.join(dir, 'sync-1.6.7.ts'),
    '@/lib/storage-snapshot': path.join(dir, 'storage-snapshot-1.6.7.ts'),
    '@/lib/sync-merge': path.join(dir, 'sync-merge-1.6.7.ts'),
  }),
};

// ------------------------------------------------------------
// La nube: una fila por cuenta, como la tabla `backups`
// ------------------------------------------------------------
const cloud = {
  row: null,
  reads: 0,
  probes: 0,
  writes: 0,
  lost: 0,
  down: 0,
  up: 0,
  writers: [],
};

/** Postgres devuelve «…+00:00» y sin ceros de más en los milisegundos. */
const pg = (iso) =>
  iso ? iso.replace(/\.(\d*?)0+Z$/, (_, digits) => (digits ? `.${digits}Z` : 'Z')).replace(/Z$/, '+00:00') : iso;
const sameInstant = (a, b) => (a === null || b === null ? a === b : Date.parse(a) === Date.parse(b));

class Query {
  constructor(dev) {
    this.dev = dev;
    this.mode = 'select';
    this.columns = '';
    this.filters = [];
    this.payload = null;
    this.returning = false;
  }
  select(columns) {
    if (this.mode === 'select') this.columns = columns;
    else this.returning = true;
    return this;
  }
  update(payload) {
    this.mode = 'update';
    this.payload = payload;
    return this;
  }
  upsert(payload) {
    this.mode = 'upsert';
    this.payload = payload;
    return this;
  }
  eq(column, value) {
    this.filters.push([column, value]);
    return this;
  }
  is(column, value) {
    this.filters.push([column, value]);
    return this;
  }
  maybeSingle() {
    return this;
  }
  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }
  async run() {
    await sleep(latency()); // la petición viaja
    const response = this.dev.offline ? { data: null, error: { message: 'TypeError: Failed to fetch' } } : this.execute();
    await sleep(latency()); // y la respuesta vuelve
    return response;
  }
  execute() {
    const row = cloud.row;
    if (this.mode === 'select') {
      if (this.columns === 'updated_at') {
        cloud.probes++;
        return { data: row ? { updated_at: pg(row.updated_at) } : null, error: null };
      }
      cloud.reads++;
      if (!row) return { data: null, error: null };
      const body = JSON.stringify(row.data);
      cloud.down += body.length;
      return { data: { data: JSON.parse(body), updated_at: pg(row.updated_at) }, error: null };
    }
    cloud.onWrite?.(this.dev); // para provocar un cambio justo mientras se sube otro
    const body = JSON.stringify(this.payload.data);
    cloud.up += body.length; // el cuerpo viaja aunque la condición no encaje
    if (this.mode === 'upsert') {
      cloud.writes++;
      cloud.writers.push(this.dev.name);
      cloud.row = { user_id: this.payload.user_id, data: JSON.parse(body), updated_at: this.payload.updated_at };
      return { data: null, error: null };
    }
    const matches =
      row &&
      this.filters.every(([column, value]) => (column === 'updated_at' ? sameInstant(row.updated_at, value) : row[column] === value));
    if (!matches) {
      cloud.lost++;
      return { data: [], error: null };
    }
    cloud.writes++;
    cloud.writers.push(this.dev.name);
    cloud.row = { ...row, data: JSON.parse(body), updated_at: this.payload.updated_at };
    return { data: this.returning ? [{ user_id: row.user_id }] : null, error: null };
  }
}

// ------------------------------------------------------------
// El canal en vivo de la cuenta (Realtime Broadcast, `self: false`)
// ------------------------------------------------------------
const bus = {
  channels: new Set(),
  sent: { changed: 0, delta: 0 },
  bytes: 0,
  open(dev, topic) {
    const channel = {
      dev,
      topic,
      joined: false,
      listeners: [],
      status: null,
      on(_type, filter, callback) {
        channel.listeners.push({ event: filter?.event, callback });
        return channel;
      },
      subscribe(callback) {
        channel.status = callback ?? null;
        later(() => {
          if (!bus.channels.has(channel)) return;
          if (dev.offline || dev.asleep) return channel.status?.('CHANNEL_ERROR');
          channel.joined = true;
          channel.status?.('SUBSCRIBED');
        });
        return channel;
      },
      async send(message) {
        if (dev.offline || !channel.joined) return 'error';
        const text = JSON.stringify(message.payload ?? null);
        bus.sent[message.event] = (bus.sent[message.event] ?? 0) + 1;
        bus.bytes += text.length;
        for (const other of bus.channels) {
          if (other === channel || other.dev === dev || other.topic !== topic || !other.joined) continue;
          later(() => bus.deliver(other, message.event, JSON.parse(text)));
        }
        return 'ok';
      },
    };
    bus.channels.add(channel);
    return channel;
  },
  deliver(channel, event, payload) {
    if (!bus.channels.has(channel) || !channel.joined || channel.dev.offline) return;
    for (const listener of channel.listeners) {
      if (listener.event === event) listener.callback({ type: 'broadcast', event, payload });
    }
  },
  close(channel) {
    channel.joined = false;
    bus.channels.delete(channel);
  },
  of: (dev) => [...bus.channels].filter((channel) => channel.dev === dev),
};

function supabaseFor(dev) {
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id: UID } } } }) },
    from: () => new Query(dev),
    channel: (topic) => bus.open(dev, topic),
    removeChannel: async (channel) => {
      bus.close(channel);
      return 'ok';
    },
  };
}

// ------------------------------------------------------------
// Dispositivos
// ------------------------------------------------------------
const alive = new Set();

/** Un reloj adelantado o atrasado `offset` ms (como el de un equipo sin hora de red). */
function skewedDate(offset) {
  const Real = Date;
  return class SkewedDate extends Real {
    constructor(...args) {
      if (args.length === 0) super(Real.now() + offset);
      else super(...args);
    }
    static now() {
      return Real.now() + offset;
    }
  };
}

function device(name, version = 'actual', { clockOffset = 0 } = {}) {
  const dev = { name, version, offline: false, asleep: false };
  const sandbox = {
    ...(clockOffset ? { Date: skewedDate(clockOffset) } : {}),
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    btoa,
    atob,
    Event,
    EventTarget,
    structuredClone,
    URL,
    performance,
    __uid: UID,
    __supabase: supabaseFor(dev),
  };
  vm.createContext(sandbox);
  engines[version].runInContext(sandbox);
  dev.frame = sandbox.frame;
  alive.add(dev);
  return dev;
}

function shutdown() {
  for (const dev of alive) dev.frame.stop();
  alive.clear();
  for (const channel of [...bus.channels]) bus.close(channel);
}

function resetWorld() {
  shutdown();
  Object.assign(cloud, { row: null, reads: 0, probes: 0, writes: 0, lost: 0, down: 0, up: 0, writers: [] });
  bus.sent = { changed: 0, delta: 0 };
  bus.bytes = 0;
}

/** Sin red: ni nube ni canal (que se cae, como en un equipo de verdad). */
function setOffline(dev, offline) {
  dev.offline = offline;
  for (const channel of bus.of(dev)) {
    if (offline) {
      channel.joined = false;
      channel.status?.('CHANNEL_ERROR');
    } else {
      // Supabase vuelve a unirse solo al recuperar la red.
      later(() => {
        if (!bus.channels.has(channel) || dev.offline) return;
        channel.joined = true;
        channel.status?.('SUBSCRIBED');
      });
    }
  }
  dev.frame.setOnline(!offline);
}

/** Android duerme la app en segundo plano y su canal se cierra. */
function putToSleep(dev) {
  dev.asleep = true;
  dev.frame.setVisible(false);
  for (const channel of bus.of(dev)) {
    channel.joined = false;
    channel.status?.('CLOSED');
  }
}

function wakeUp(dev) {
  dev.asleep = false;
  dev.frame.setVisible(true);
}

// ------------------------------------------------------------
// Medir y comparar
// ------------------------------------------------------------
const RECORD_KEYS = new Set([
  'courses', 'tasks', 'notes', 'archivedTasks', 'incompleteTasks', 'archivedNotes', 'localEvents', 'dayColors', 'habits',
  'studySessions', 'dailyPerformances', 'playlists', 'spaces', 'syncedImages', 'looseNotes', 'studyVideos', 'imageRefs',
  'schedules', 'classSessions',
]);
const RETIRED = new Set(['classSessions', 'schedules', 'playHistory', 'headerQuote', 'school']);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const idOf = (record) => String(record?.id ?? record?.month ?? '');
function normalized(data) {
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = RECORD_KEYS.has(key) && Array.isArray(value) ? [...value].sort((a, b) => idOf(a).localeCompare(idOf(b))) : value;
  }
  return out;
}

/** Claves en las que dos dispositivos no coinciden (por defecto, todas las que viajan). */
function differences(a, b, keys) {
  const da = normalized(a.frame.cloudForm());
  const db = normalized(b.frame.cloudForm());
  const all = keys ?? [...new Set([...Object.keys(da), ...Object.keys(db)])].filter((key) => !RETIRED.has(key));
  return all.filter((key) => canonical(da[key]) !== canonical(db[key]));
}

const counters = () => ({
  reads: cloud.reads,
  probes: cloud.probes,
  writes: cloud.writes,
  lost: cloud.lost,
  down: cloud.down,
  up: cloud.up,
  changed: bus.sent.changed ?? 0,
  delta: bus.sent.delta ?? 0,
  writers: cloud.writers.length,
});

function since(before) {
  const now = counters();
  const out = {};
  for (const key of Object.keys(now)) out[key] = now[key] - before[key];
  out.by = cloud.writers.slice(before.writers);
  return out;
}

const activity = () => `${cloud.reads}|${cloud.probes}|${cloud.writes}|${cloud.lost}|${bus.sent.changed}|${bus.sent.delta}`;

/** Espera a que todo quede quieto (1,5 s sin tráfico). false: no se calma (bucle). */
async function settle(limit = 30_000, quiet = 1_500) {
  const start = Date.now();
  let last = activity();
  let calm = Date.now();
  while (Date.now() - start < limit) {
    await sleep(25);
    const now = activity();
    if (now !== last) {
      last = now;
      calm = Date.now();
    } else if (Date.now() - calm >= quiet) {
      return true;
    }
  }
  return false;
}

/** Milisegundos hasta que se cumple `condition` (null si no llega). */
async function until(condition, limit = 15_000) {
  const start = performance.now();
  while (performance.now() - start < limit) {
    if (condition()) return Math.round(performance.now() - start);
    await sleep(4);
  }
  return null;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const failures = [];
const timings = [];

function check(ok, text) {
  console.log(`  ${ok ? '✓' : '✗'} ${text}`);
  if (!ok) failures.push(text);
}

function traffic(label, m) {
  const by = Object.entries(m.by.reduce((acc, name) => ({ ...acc, [name]: (acc[name] ?? 0) + 1 }), {}))
    .map(([name, count]) => `${name} ${count}`)
    .join(', ');
  console.log(
    `    ${label}: ${m.writes} escrituras${by ? ` (${by})` : ''}, ${kb(m.up)} subidos · ${m.reads} lecturas completas, ${kb(m.down)} bajados · ${m.probes} sondas · ${m.lost} rechazadas · canal: ${m.delta} cambios cifrados, ${m.changed} avisos`
  );
}

function timing(what, ms) {
  timings.push([what, ms]);
  console.log(`    ${what}: ${ms === null ? 'NO LLEGÓ' : `${ms} ms`}`);
}

const find = (dev, key, id) => (dev.frame.get(key) ?? []).find((record) => record?.id === id);

// ------------------------------------------------------------
// Datos de partida (los de una cuenta con uso)
// ------------------------------------------------------------
function fixture() {
  return {
    courses: [
      { id: 'c1', name: 'Matemática', color: '#2563eb' },
      { id: 'c2', name: 'Historia', color: '#16a34a' },
    ],
    spaces: [{ id: 'sp1', name: 'Proyectos' }],
    tasks: [
      { id: 't1', title: 'Resolver la guía 3', courseId: 'c1', dueDate: '2026-10-20' },
      { id: 't2', title: 'Leer el capítulo 4', courseId: 'c2', dueDate: '2026-10-22' },
      { id: 't3', title: 'Ensayo', courseId: 'c2' },
    ],
    habits: [
      { id: 'h1', name: 'Leer 20 minutos', log: ['2026-10-12'] },
      { id: 'h2', name: 'Tomar agua', log: [] },
    ],
    studySessions: [{ id: 's1', courseId: 'c1', start: '2026-10-12T15:00:00.000Z', minutes: 50 }],
    localEvents: [{ id: 'e1', title: 'Examen parcial', start: '2026-10-21', allDay: true }],
    dailyPerformances: [{ id: '2026-10-12', score: 4 }],
    studyVideos: [{ id: 'yt-derivadas', title: 'Derivadas en 10 minutos', courseId: 'c1' }],
    imageRefs: [{ id: 'courseImage_c1', kind: 'native', src: '/native_pictures/montana.jpg', crop: [0, 0.1, 1, 0.8], out: [800, 450], at: 1760300000000 }],
    competencyCourseIds: ['c1', 'c2'],
    streakGoal: 5,
    appSettings: { lang: 'es', cardRatio: 1.7778 },
    playlists: [],
    // Retiradas en la 1.6.8: siguen en el equipo, ya no viajan.
    classSessions: [{ id: 'cs1', courseId: 'c1', start: '2026-10-13T13:00:00.000Z' }],
    schedules: [{ month: '2026-10', days: {} }],
    playHistory: [{ songId: 'x', at: '2026-10-12T20:00:00.000Z' }],
  };
}

function load(dev, data) {
  for (const [key, value] of Object.entries(data)) dev.frame.put(key, value);
}

const edit = (dev, key, id, changes) =>
  dev.frame.put(key, (dev.frame.get(key) ?? []).map((record) => (record.id === id ? { ...record, ...changes } : record)));
const add = (dev, key, record) => dev.frame.put(key, [...(dev.frame.get(key) ?? []), record]);
const drop = (dev, key, id) => dev.frame.put(key, (dev.frame.get(key) ?? []).filter((record) => record.id !== id));

// ============================================================
// Escenarios
// ============================================================

async function twoDevices() {
  console.log('\n▶ Dos dispositivos con la 1.6.8 (laptop y tablet)');
  resetWorld();
  const laptop = device('laptop');
  const tablet = device('tablet');
  load(laptop, fixture());

  // --- 1. Primer encuentro: la tablet entra a la cuenta sin nada ---
  console.log('\n 1. Primer encuentro');
  let before = counters();
  laptop.frame.start();
  await sleep(120);
  tablet.frame.start();
  check(await settle(), 'se calma (sin escrituras de ida y vuelta)');
  let m = since(before);
  traffic('tráfico', m);
  check(differences(laptop, tablet).length === 0, `los dos tienen lo mismo ${JSON.stringify(differences(laptop, tablet))}`);
  const remote = cloud.row?.data?.data ?? {};
  check(![...RETIRED].some((key) => key in remote), 'la nube no lleva las claves retiradas (clases, horario, bitácora)');
  check(Array.isArray(laptop.frame.get('classSessions')), 'la laptop conserva su copia local de lo retirado');
  const key = laptop.frame.get('syncKey');
  check(typeof key === 'string' && key.length >= 40 && key === tablet.frame.get('syncKey'), 'los dos comparten la clave del canal cifrado');
  check(m.writes <= 4, `pocas escrituras para el primer encuentro (${m.writes})`);

  // --- 2. Un cambio, al instante ---
  console.log('\n 2. Una tarea nueva en la laptop');
  before = counters();
  add(laptop, 'tasks', { id: 't4', title: 'Practicar integrales', courseId: 'c1' });
  timing('tarea nueva → tablet', await until(() => !!find(tablet, 'tasks', 't4')));
  check(await settle(), 'se calma');
  m = since(before);
  traffic('tráfico', m);
  check(m.by.every((name) => name === 'laptop') && m.writes === 1, `una sola escritura y de quien hizo el cambio (${m.by.join(', ') || 'ninguna'})`);
  check(m.reads === 0, `la tablet no baja el respaldo: ya lo tenía todo por el canal (${m.reads} lecturas)`);
  check(differences(laptop, tablet).length === 0, 'los dos tienen lo mismo');

  // --- 2b. Un cambio justo mientras se sube el anterior ---
  console.log('\n 2b. Un cambio llega justo mientras se sube el anterior');
  before = counters();
  let provoked = false;
  cloud.onWrite = (dev) => {
    if (dev !== laptop || provoked) return;
    provoked = true;
    edit(laptop, 'tasks', 't2', { title: 'Cambiado durante la subida' });
  };
  edit(laptop, 'tasks', 't3', { title: 'Ensayo (antes de la subida)' });
  check(await settle(), 'se calma');
  cloud.onWrite = null;
  const inCloud = (cloud.row?.data?.data?.tasks ?? []).find((task) => task.id === 't2')?.title;
  check(provoked && inCloud === 'Cambiado durante la subida', `la nube también recibe el segundo cambio (${inCloud})`);
  check(find(tablet, 'tasks', 't2')?.title === 'Cambiado durante la subida', 'y la tablet lo tiene');
  traffic('tráfico', since(before));

  // --- 2c. La interfaz reescribe una lista igual, en otro orden ---
  console.log('\n 2c. La interfaz reescribe las tareas en otro orden (sin cambiar ninguna)');
  before = counters();
  laptop.frame.put('tasks', [...laptop.frame.get('tasks')].reverse());
  check(await settle(), 'se calma');
  m = since(before);
  traffic('tráfico', m);
  check(m.writes === 0 && m.delta === 0, `nada que subir ni que anunciar (${m.writes} escrituras, ${m.delta} mensajes)`);

  // --- 3. Ráfaga: 25 cambios en 3 s ---
  console.log('\n 3. Ráfaga de 25 cambios en 3 segundos');
  before = counters();
  // Cada 20 ms se mira qué paso ve la tablet: el mayor retraso es lo que el
  // usuario notaría mirando las dos pantallas mientras escribe.
  const stepOf = (dev) => Number(/paso (\d+)/.exec(find(dev, 'tasks', 't1')?.title ?? '')?.[1] ?? 0);
  const editedAt = [];
  let worstLag = 0;
  const watcher = setInterval(() => {
    const seen = stepOf(tablet);
    const pending = editedAt.findIndex((at, index) => index + 1 > seen);
    if (pending >= 0) worstLag = Math.max(worstLag, Math.round(performance.now() - editedAt[pending]));
  }, 20);
  for (let i = 1; i <= 25; i++) {
    edit(laptop, 'tasks', 't1', { title: `Resolver la guía 3 (paso ${i})` });
    editedAt.push(performance.now());
    await sleep(120);
  }
  timing('último cambio de la ráfaga → tablet', await until(() => stepOf(tablet) === 25));
  clearInterval(watcher);
  timing('mayor retraso de la tablet durante la ráfaga', worstLag);
  check(await settle(), 'se calma');
  m = since(before);
  traffic('tráfico', m);
  check(m.writes <= 4, `la nube recibe pocas escrituras (${m.writes}), no una por cambio`);
  check(worstLag <= 800, `durante la ráfaga la tablet nunca va más de 0,8 s por detrás (${worstLag} ms)`);
  check(differences(laptop, tablet).length === 0, 'los dos tienen lo mismo');

  // --- 4. Registros distintos a la vez ---
  console.log('\n 4. Cada uno cambia una tarea distinta, a la vez');
  before = counters();
  edit(laptop, 'tasks', 't2', { title: 'Leer el capítulo 4 y resumir' });
  edit(tablet, 'tasks', 't3', { title: 'Ensayo (borrador)' });
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));
  check(find(laptop, 'tasks', 't3')?.title === 'Ensayo (borrador)' && find(tablet, 'tasks', 't2')?.title === 'Leer el capítulo 4 y resumir', 'se conservan los dos cambios');
  check(differences(laptop, tablet).length === 0, 'los dos tienen lo mismo');

  // --- 5. El mismo registro casi a la vez ---
  console.log('\n 5. Los dos cambian la MISMA tarea casi a la vez');
  before = counters();
  edit(laptop, 'tasks', 't1', { title: 'Versión de la laptop' });
  await sleep(80);
  edit(tablet, 'tasks', 't1', { title: 'Versión de la tablet' });
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));
  const winner = find(laptop, 'tasks', 't1')?.title;
  check(winner === find(tablet, 'tasks', 't1')?.title, `terminan iguales: «${winner}»`);
  check(winner === 'Versión de la tablet', 'gana el cambio más reciente');

  // --- 6. Borrar ---
  console.log('\n 6. La tablet borra un hábito');
  before = counters();
  drop(tablet, 'habits', 'h2');
  timing('hábito borrado → laptop', await until(() => !find(laptop, 'habits', 'h2')));
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));
  check(!find(laptop, 'habits', 'h2') && !find(tablet, 'habits', 'h2'), 'desaparece en los dos');
  check(cloud.row?.data?.meta?.collections?.habits?.h2?.d !== undefined, 'la nube guarda la lápida (no resucita desde un equipo rezagado)');

  // --- 7. Sin conexión ---
  console.log('\n 7. La tablet trabaja sin conexión');
  setOffline(tablet, true);
  await sleep(200);
  before = counters();
  add(tablet, 'studySessions', { id: 's2', courseId: 'c2', start: '2026-10-13T16:00:00.000Z', minutes: 25 });
  edit(tablet, 'localEvents', 'e1', { title: 'Examen parcial (aula 204)' });
  await sleep(300);
  drop(laptop, 'tasks', 't2');
  add(laptop, 'tasks', { id: 't5', title: 'Mapa conceptual', courseId: 'c2' });
  edit(laptop, 'courses', 'c2', { name: 'Historia del Perú' });
  await settle();
  check(!find(tablet, 'tasks', 't5'), 'sin conexión, la tablet no recibe nada (y no falla)');
  setOffline(tablet, false);
  timing('reconexión → tablet al día', await until(() => !!find(tablet, 'tasks', 't5') && !!find(laptop, 'studySessions', 's2')));
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));
  check(!!find(laptop, 'studySessions', 's2') && find(laptop, 'localEvents', 'e1')?.title === 'Examen parcial (aula 204)', 'lo hecho sin conexión llega a la laptop');
  check(!find(tablet, 'tasks', 't2') && find(tablet, 'courses', 'c2')?.name === 'Historia del Perú', 'lo hecho en la laptop llega a la tablet');
  check(differences(laptop, tablet).length === 0, `los dos tienen lo mismo ${JSON.stringify(differences(laptop, tablet))}`);

  // --- 8. Playlists con bibliotecas distintas ---
  console.log('\n 8. Playlists: cada dispositivo con su propia música');
  laptop.frame.songs([
    { id: 'L1', title: 'Alpha', artist: 'Ana', fileName: 'alpha.mp3' },
    { id: 'L2', title: 'Beta', artist: 'Bruno', fileName: 'beta.mp3' },
    { id: 'L3', title: 'Gamma', artist: 'Gala', fileName: 'gamma.mp3' },
  ]);
  tablet.frame.songs([
    { id: 'T9', title: 'ALPHA', artist: 'ana', fileName: 'Alpha (1).mp3' },
    { id: 'T8', title: 'Beta', artist: 'Bruno', fileName: 'beta.m4a' },
    { id: 'T7', title: 'Delta', artist: 'Dora', fileName: 'delta.mp3' },
  ]);
  before = counters();
  laptop.frame.put('playlists', [
    { id: 'p1', name: 'Estudio', songIds: ['L1', 'L2', 'L3'], order: 0 },
    { id: 'p2', name: 'Gimnasio', songIds: ['L2'], order: 1 },
  ]);
  timing('playlist nueva → tablet', await until(() => !!find(tablet, 'playlists', 'p1')));
  check(await settle(), 'se calma');
  const p1 = find(tablet, 'playlists', 'p1');
  check(canonical(p1?.songIds) === canonical(['T9', 'T8', 'k:gamma\u001fgala']), `la tablet la ve con SUS canciones (${JSON.stringify(p1?.songIds)})`);
  tablet.frame.put('playlists', [
    { id: 'p1', name: 'Estudio', songIds: ['T8', 'k:gamma\u001fgala', 'T9', 'T7'], order: 1 },
    { id: 'p2', name: 'Gimnasio', songIds: ['T8'], order: 0 },
  ]);
  timing('orden nuevo → laptop', await until(() => find(laptop, 'playlists', 'p1')?.order === 1));
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));
  const back = find(laptop, 'playlists', 'p1');
  check(canonical(back?.songIds) === canonical(['L2', 'L3', 'L1', 'k:delta\u001fdora']), `la laptop recibe el orden con las suyas (${JSON.stringify(back?.songIds)})`);
  check(find(laptop, 'playlists', 'p2')?.order === 0, 'el orden de las playlists también viaja');
  check(differences(laptop, tablet).length === 0, 'los dos tienen lo mismo (en la forma que viaja)');

  console.log('\n 8b. La tablet importa después una canción que ya estaba en la playlist');
  before = counters();
  tablet.frame.songs([
    { id: 'T9', title: 'ALPHA', artist: 'ana', fileName: 'Alpha (1).mp3' },
    { id: 'T8', title: 'Beta', artist: 'Bruno', fileName: 'beta.m4a' },
    { id: 'T7', title: 'Delta', artist: 'Dora', fileName: 'delta.mp3' },
    { id: 'T6', title: 'Gamma', artist: 'Gala', fileName: 'gamma.flac' },
  ]);
  check(tablet.frame.localize(), 'la clave pasa al id de la canción de aquí');
  check(canonical(find(tablet, 'playlists', 'p1')?.songIds) === canonical(['T8', 'T6', 'T9', 'T7']), `y aparece en su sitio (${JSON.stringify(find(tablet, 'playlists', 'p1')?.songIds)})`);
  check(await settle(), 'se calma');
  m = since(before);
  traffic('tráfico', m);
  check(m.writes === 0 && m.delta === 0, `lo que viaja no cambia: nada que subir (${m.writes} escrituras, ${m.delta} mensajes)`);

  // --- 9. Ajustes de la cuenta ---
  console.log('\n 9. Idioma y proporción de las imágenes');
  before = counters();
  tablet.frame.put('appSettings', { lang: 'en', cardRatio: 1.3333 });
  timing('ajustes → laptop', await until(() => laptop.frame.get('appSettings')?.lang === 'en'));
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));
  check(differences(laptop, tablet).length === 0, 'los dos tienen lo mismo');

  // --- 10. Mensaje ajeno en el canal ---
  console.log('\n10. Un mensaje que no es de la cuenta llega al canal');
  before = counters();
  for (const channel of bus.of(tablet)) bus.deliver(channel, 'delta', { v: 1, from: 'intruso', iv: 'AAAAAAAAAAAAAAAA', c: 'SG9sYQ==' });
  check(await settle(), 'se calma');
  check(differences(laptop, tablet).length === 0, 'se ignora: nada cambia');
  add(laptop, 'tasks', { id: 't6', title: 'Después del intruso', courseId: 'c1' });
  timing('cambio siguiente → tablet', await until(() => !!find(tablet, 'tasks', 't6')));
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));

  // --- 11. Android duerme la app ---
  console.log('\n11. La tablet pasa a segundo plano (Android cierra el canal)');
  putToSleep(tablet);
  await sleep(300);
  before = counters();
  edit(laptop, 'habits', 'h1', { log: ['2026-10-12', '2026-10-13'] });
  await settle();
  check(find(tablet, 'habits', 'h1')?.log?.length === 1, 'dormida, no recibe');
  wakeUp(tablet);
  timing('al volver al frente → tablet al día', await until(() => find(tablet, 'habits', 'h1')?.log?.length === 2));
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));
  check(differences(laptop, tablet).length === 0, 'los dos tienen lo mismo');

  // --- 12. Quietos: nada viaja ---
  console.log('\n12. Diez segundos sin tocar nada');
  before = counters();
  await sleep(10_000);
  m = since(before);
  traffic('tráfico', m);
  check(m.writes === 0 && m.reads === 0, 'sin cambios no se sube ni se baja nada');

  check(laptop.frame.reported().length === 0 && tablet.frame.reported().length === 0, 'ningún fallo anotado en el registro de errores');
  shutdown();
}

async function threeDevices() {
  console.log('\n▶ Tres dispositivos (laptop, tablet y celular)');
  resetWorld();
  const laptop = device('laptop');
  const tablet = device('tablet');
  const phone = device('celular');
  load(laptop, fixture());
  laptop.frame.start();
  await sleep(100);
  tablet.frame.start();
  phone.frame.start();
  check(await settle(), 'se calma');
  check(differences(laptop, tablet).length === 0 && differences(laptop, phone).length === 0, 'los tres tienen lo mismo');

  console.log('\n 1. Un cambio llega a los otros dos');
  let before = counters();
  add(laptop, 'localEvents', { id: 'e2', title: 'Feria de ciencias', start: '2026-10-30', allDay: true });
  timing('evento nuevo → tablet', await until(() => !!find(tablet, 'localEvents', 'e2')));
  timing('evento nuevo → celular', await until(() => !!find(phone, 'localEvents', 'e2')));
  check(await settle(), 'se calma');
  const m = since(before);
  traffic('tráfico', m);
  check(m.writes === 1 && m.reads === 0, `una escritura y nadie baja el respaldo (${m.writes} escrituras, ${m.reads} lecturas)`);
  check(differences(laptop, tablet).length === 0 && differences(laptop, phone).length === 0, 'los tres tienen lo mismo');

  console.log('\n 2. El celular, sin conexión, edita una tarea que luego se borra en la laptop');
  setOffline(phone, true);
  await sleep(200);
  before = counters();
  edit(phone, 'tasks', 't3', { title: 'Ensayo (editado sin conexión)' });
  await sleep(500);
  drop(laptop, 'tasks', 't3');
  drop(tablet, 'habits', 'h1');
  await settle();
  setOffline(phone, false);
  timing('reconexión → celular al día', await until(() => !find(phone, 'habits', 'h1') && !find(phone, 'tasks', 't3')));
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));
  check(
    [laptop, tablet, phone].every((dev) => !find(dev, 'tasks', 't3')),
    'gana el borrado, que fue posterior a la edición (la marca es la hora de la edición, no la de la reconexión)'
  );
  check(differences(laptop, tablet).length === 0 && differences(laptop, phone).length === 0, `los tres tienen lo mismo ${JSON.stringify(differences(laptop, phone))}`);
  shutdown();
}

async function clockSkew() {
  console.log('\n▶ Relojes distintos: la tablet va dos minutos atrasada');
  resetWorld();
  const laptop = device('laptop');
  const tablet = device('tablet', 'actual', { clockOffset: -120_000 });
  load(laptop, fixture());
  laptop.frame.start();
  await sleep(100);
  tablet.frame.start();
  check(await settle(), 'se calma');

  console.log('\n 1. La tablet edita lo último que llegó de la laptop');
  const before = counters();
  edit(laptop, 'tasks', 't1', { title: 'Primero en la laptop' });
  await until(() => find(tablet, 'tasks', 't1')?.title === 'Primero en la laptop');
  await settle();
  edit(tablet, 'tasks', 't1', { title: 'Después en la tablet' });
  timing('edición de la tablet → laptop', await until(() => find(laptop, 'tasks', 't1')?.title === 'Después en la tablet'));
  check(await settle(), 'se calma');
  traffic('tráfico', since(before));
  check(
    [laptop, tablet].every((dev) => find(dev, 'tasks', 't1')?.title === 'Después en la tablet'),
    'gana la edición de la tablet aunque su reloj la haga «anterior» (la editó después de verla)'
  );
  check(differences(laptop, tablet).length === 0, 'los dos tienen lo mismo');
  shutdown();
}

async function withOldVersion() {
  console.log('\n▶ Convivencia: laptop con la 1.6.8 y tablet aún con la 1.6.7 (móvil 1.1.3)');
  resetWorld();
  const laptop = device('laptop');
  const tablet = device('tablet-1.6.7', '1.6.7');
  load(laptop, fixture());
  // La tablet ya sincronizaba con la 1.6.7: tiene lo mismo (sin lo nuevo de la 1.6.8).
  const old = fixture();
  delete old.studyVideos;
  delete old.imageRefs;
  delete old.appSettings;
  load(tablet, old);
  laptop.frame.songs([{ id: 'L1', title: 'Alpha', artist: 'Ana', fileName: 'alpha.mp3' }]);
  laptop.frame.put('playlists', [{ id: 'p1', name: 'Estudio', songIds: ['L1'], order: 0 }]);

  console.log('\n 1. Arrancan los dos');
  let before = counters();
  tablet.frame.start();
  await sleep(300);
  laptop.frame.start();
  const calm = await settle(20_000);
  check(calm, 'se calma (sin escrituras de ida y vuelta entre versiones)');
  let m = since(before);
  traffic('tráfico', m);
  const shared = Object.keys(tablet.frame.cloudForm()).filter((key) => !RETIRED.has(key));
  check(differences(laptop, tablet, shared).length === 0, `los dos tienen lo mismo ${JSON.stringify(differences(laptop, tablet, shared))}`);

  console.log('\n 2. Cambios en cada uno');
  before = counters();
  add(laptop, 'tasks', { id: 't9', title: 'Desde la 1.6.8', courseId: 'c1' });
  timing('1.6.8 → 1.6.7', await until(() => !!find(tablet, 'tasks', 't9')));
  await settle(20_000);
  edit(tablet, 'tasks', 't1', { title: 'Desde la 1.6.7' });
  timing('1.6.7 → 1.6.8', await until(() => find(laptop, 'tasks', 't1')?.title === 'Desde la 1.6.7'));
  check(await settle(20_000), 'se calma');
  m = since(before);
  traffic('tráfico', m);
  check(differences(laptop, tablet, shared).length === 0, 'los dos tienen lo mismo');
  const data = cloud.row?.data?.data ?? {};
  check(Array.isArray(data.studyVideos) && Array.isArray(data.imageRefs) && !!data.appSettings && !!data.syncKey, 'lo nuevo de la 1.6.8 sobrevive a las escrituras de la 1.6.7');
  check(canonical(find(tablet, 'playlists', 'p1')?.songIds) === canonical(['k:alpha\u001fana']), 'la playlist llega a la 1.6.7 con la clave de la canción, intacta');
  check(Array.isArray(tablet.frame.get('classSessions')), 'la 1.6.7 conserva lo suyo retirado');

  console.log('\n 3. Diez segundos sin tocar nada');
  before = counters();
  await sleep(10_000);
  m = since(before);
  traffic('tráfico', m);
  check(m.writes === 0, 'nadie escribe sin cambios');
  shutdown();
}

async function oldPair() {
  console.log('\n▶ Referencia: dos dispositivos con la 1.6.7 (lo que Diego vio)');
  resetWorld();
  const laptop = device('laptop-1.6.7', '1.6.7');
  const tablet = device('tablet-1.6.7', '1.6.7');
  const data = fixture();
  delete data.studyVideos;
  delete data.imageRefs;
  delete data.appSettings;
  load(laptop, data);
  laptop.frame.start();
  tablet.frame.start();
  await settle(8_000);
  const before = counters();
  add(laptop, 'tasks', { id: 't4', title: 'Practicar integrales', courseId: 'c1' });
  timing('1.6.7: tarea nueva → tablet', await until(() => !!find(tablet, 'tasks', 't4')));
  await sleep(8_000);
  const m = since(before);
  traffic('tráfico en 8 s tras UN cambio', m);
  console.log(`    (${m.writes > 4 ? 'se reenvían el respaldo sin parar' : 'se calma'})`);
  shutdown();
}

const started = Date.now();
// --solo=dos|tres|relojes|convivencia|referencia corre solo ese grupo.
const only = process.argv.find((arg) => arg.startsWith('--solo='))?.slice('--solo='.length);
const groups = { dos: twoDevices, tres: threeDevices, relojes: clockSkew, convivencia: withOldVersion, referencia: oldPair };
for (const [name, run] of Object.entries(groups)) {
  if (only ? only === name : name !== 'referencia' || !process.argv.includes('--sin-referencia')) await run();
}

console.log(`\n${failures.length === 0 ? '✓ Todo en orden' : `✗ ${failures.length} comprobaciones fallidas`} · ${((Date.now() - started) / 1000).toFixed(0)} s · semilla ${process.env.SEMILLA ?? 168}`);
for (const failure of failures) console.log(`  ✗ ${failure}`);
process.exit(failures.length === 0 ? 0 : 1);
