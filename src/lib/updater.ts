// ============================================================
// Actualización de Frame (solo escritorio).
//
// LA APP NUNCA SE ACTUALIZA SOLA. Los sondeos solo MIRAN si hay versión nueva
// y, si la hay, encienden el testigo junto al perfil y la entrada de la
// campana. Pulsar cualquiera de los dos abre el recuadro de actualización
// (UpdateDialog): peso, tiempo estimado y pasos. La descarga y el reinicio
// empiezan solo al pulsar «Actualizar ahora» dentro de ese recuadro, y nadie
// más los dispara.
//
// La razón es simple: reiniciar es lo más invasivo que puede hacer una app de
// escritorio. Que ocurra sin avisar, aunque sea al arrancar, es una decisión
// que le corresponde a quien está usando el programa.
//
// Desde la 1.6.2 la actualización va en pasos separados para poder contarlos
// y medirlos: descargar → verificar la firma → instalar → reiniciar. Cada uno
// se cronometra y se guarda en este equipo, y la estimación de la siguiente
// parte de esas medidas reales (ver «Estimación», más abajo).
// ============================================================
import { isTauri } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from '@/hooks/use-toast';
import { APP_VERSION } from '@/lib/version';
import { intlLocale, tr } from '@/lib/i18n';

/**
 * Compilación para Microsoft Store (scripts/empaquetar-msix.ps1): la Store
 * actualiza la app por su cuenta, así que el actualizador propio no se usa.
 */
const IS_STORE_BUILD = import.meta.env.VITE_STORE_BUILD === '1';

/** `ready`: descargada y verificada, esperando a que acabe la sesión de
 *  estudio, la música o la grabación que empezó mientras se descargaba. */
export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'ready' | 'installing';

/** Los pasos que ve el usuario, en orden. */
export type UpdateStep = 'download' | 'verify' | 'install' | 'restart';
export const UPDATE_STEPS: UpdateStep[] = ['download', 'verify', 'install', 'restart'];

/** De dónde sale la velocidad con la que se estima la descarga. */
export type SpeedSource = 'medida' | 'anterior' | 'conexion' | 'supuesta';

export interface UpdateState {
  phase: UpdatePhase;
  /** versión disponible; null si no hay ninguna */
  version: string | null;
  /** 0–1 mientras se descarga; null si no aplica */
  progress: number | null;
  /** Bytes descargados en esta actualización. */
  downloaded: number;
  /** Peso exacto del instalador en bytes (del manifiesto o de la descarga); null si aún no se sabe. */
  size: number | null;
  /** Velocidad medida en vivo (bytes/s, media móvil); null antes de la primera muestra. */
  speed: number | null;
  /** Momento (performance.now) en que empezó el paso actual; null fuera de la actualización. */
  stepStartedAt: number | null;
  /** ¿Está abierto el recuadro de actualización? */
  dialogOpen: boolean;
  /** Último fallo, para mostrarlo en el recuadro; null si no hubo. */
  error: string | null;
}

let state: UpdateState = {
  phase: 'idle',
  version: null,
  progress: null,
  downloaded: 0,
  size: null,
  speed: null,
  stepStartedAt: null,
  dialogOpen: false,
  error: null,
};

/** Devuelve true si hay trabajo en curso que un reinicio interrumpiría (una
 *  sesión de estudio, música sonando, una grabación a medias). La registra el
 *  layout, que es quien conoce el estado de la app. Mientras devuelva true, el
 *  recuadro no deja actualizar y lo dice; `startUpdateInstall` lo vuelve a
 *  comprobar, y una descarga que acaba entonces queda en `ready`. */
let busyGuard: (() => boolean) | null = null;

export function setUpdateBusyGuard(guard: (() => boolean) | null): void {
  busyGuard = guard;
}

/** Handle del plugin: se guarda para no volver a consultar al instalar. */
let pending: Update | null = null;
/** Ya descargada y verificada (fase `ready`): solo falta instalar. */
let verified: Update | null = null;
/** Sondeo en marcha: quien quiera instalar lo espera en vez de pisarlo. */
let checkInFlight: Promise<void> | null = null;
/** Descarga o instalación en marcha. */
let installing = false;

const listeners = new Set<() => void>();

function setState(next: Partial<UpdateState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function getUpdateState(): UpdateState {
  return state;
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Abre el recuadro de actualización (testigo junto al perfil o campana). */
export function openUpdateDialog(): void {
  if (!state.version) return;
  setState({ dialogOpen: true });
}

export function closeUpdateDialog(): void {
  setState({ dialogOpen: false });
}

/** Versión ya anunciada: evita repetir el aviso en cada sondeo. */
const ANNOUNCED_KEY = 'lastAnnouncedUpdate';

/**
 * Consulta si hay versión nueva. NUNCA instala: como mucho enciende el testigo
 * y avisa una vez. `silent` calla el aviso de "ya estás al día" en los sondeos
 * de fondo, para no molestar cada media hora.
 */
function checkForUpdates(options?: { silent?: boolean }): Promise<void> {
  // Instalando, o con una ya descargada a la espera, consultar soltaría su handle.
  if (!isTauri() || IS_STORE_BUILD || installing || state.phase === 'ready') return Promise.resolve();
  if (checkInFlight) return checkInFlight;
  checkInFlight = runCheck(options).finally(() => {
    checkInFlight = null;
  });
  return checkInFlight;
}

async function runCheck(options?: { silent?: boolean }): Promise<void> {
  setState({ phase: state.version ? 'available' : 'checking' });
  try {
    // Con límite de tiempo: si el servidor no responde, el sondeo se quedaba
    // colgado y ni los siguientes ni el botón de actualizar volvían a funcionar.
    const update = await check({ timeout: 20_000 });

    if (!update) {
      releasePending();
      setState({ phase: 'idle', version: null, progress: null, size: null, dialogOpen: false });
      if (!options?.silent) {
        toast({ title: tr('Frame está actualizado'), description: tr('Ya tienes la última versión.') });
      }
      return;
    }

    // Cada sondeo trae un handle nuevo: el anterior se suelta.
    if (pending && pending !== update) releasePending();
    pending = update;
    // El peso que ya se sabía solo vale si sigue siendo la misma versión.
    const manifest = manifestSize(update);
    const sameVersion = update.version === state.version;
    setState({
      phase: 'available',
      version: update.version,
      progress: null,
      size: manifest ?? (sameVersion ? state.size : null),
      // Un sondeo que llega bien desmiente el fallo de conexión de antes; el
      // de la firma sigue en pie mientras la versión sea la misma.
      error: sameVersion && state.error === BAD_SIGNATURE ? state.error : null,
    });

    // Aviso UNA vez por versión: en cada sondeo posterior el testigo del
    // sidebar sigue encendido, pero no se vuelve a interrumpir al usuario.
    const alreadyAnnounced = localStorage.getItem(ANNOUNCED_KEY) === update.version;
    if (!alreadyAnnounced || !options?.silent) {
      localStorage.setItem(ANNOUNCED_KEY, update.version);
      toast({
        title: tr('Frame {version} disponible', { version: update.version }),
        description: tr('Pulsa el icono de descarga junto a tu perfil para ver cuánto pesa y cuánto tarda.'),
      });
    }
  } catch (e) {
    // Sin red o GitHub caído: silencio absoluto, se reintenta después.
    console.warn('checkForUpdates failed', e);
    setState({ phase: state.version ? 'available' : 'idle' });
  }
}

function releasePending() {
  const old = pending;
  pending = null;
  void old?.close().catch(() => undefined);
}

// ============================================================
// Estimación
//
// Lo que tarda una actualización hasta poder usar la versión nueva es la suma
// de cuatro tramos, y cada uno se estima con lo mejor que haya:
//
//  - Descargar: peso ÷ velocidad, más lo que tarda en llegar el primer byte.
//    El peso lo publica release.ps1 en latest.json (`frame.size`), fuera de
//    `platforms`, donde el plugin no mira; si falta, vale el de la última
//    actualización, y al empezar la descarga se sabe exacto. La velocidad es
//    la medida en la última descarga de este equipo (el mismo servidor y,
//    casi siempre, la misma red); sin ella, la que el navegador estima de la
//    conexión. En cuanto empieza la descarga manda la medida en vivo: una
//    media móvil exponencial de los bytes por segundo reales.
//  - Verificar la firma: un instante; se mide y se guarda.
//  - Instalar y reiniciar: el instalador corre fuera de Frame (la app se
//    cierra), así que se mide al volver. Antes de lanzarlo se deja una marca
//    con la hora; al arrancar la versión nueva, el tramo hasta que se abre la
//    ventana es «instalar» y el que va de ahí a poder usar Frame, «reiniciar».
//    Sin medidas previas: unos 10 s entre los dos, lo que tarda el instalador
//    silencioso de Frame (~7 MB) en un portátil normal.
// ============================================================

const TIMINGS_KEY = 'frameUpdateTimings';
const LANDING_KEY = 'frameUpdateLanding';

interface UpdateTimings {
  /** bytes/s de la última descarga completa */
  speed?: number;
  /** Cuándo se midió (Date.now()). */
  speedAt?: number;
  /** ms desde pedir la descarga hasta el primer byte */
  latencyMs?: number;
  verifyMs?: number;
  /** ms desde lanzar el instalador hasta que se abre la ventana nueva */
  installMs?: number;
  /** ms desde que se abre la ventana nueva hasta poder usar Frame */
  bootMs?: number;
  /** último peso conocido del instalador */
  size?: number;
}

/** Peso aproximado del instalador cuando no hay ningún dato (~7 MB). */
const FALLBACK_SIZE = 7.3 * 1024 * 1024;
/** 1,5 MB/s: una conexión doméstica modesta. */
const FALLBACK_SPEED = 1.5 * 1024 * 1024;
const DEFAULT_LATENCY_MS = 900;
const DEFAULT_VERIFY_MS = 400;
const DEFAULT_INSTALL_MS = 7000;
const DEFAULT_BOOT_MS = 3000;
/** Una velocidad medida hace más de esto ya no dice mucho de la red de hoy. */
const SPEED_STALE_MS = 45 * 86_400_000;
/** Constante de tiempo de la media móvil de la velocidad. */
const SPEED_TAU_MS = 2500;
/** Cada cuánto se toma una muestra de velocidad. */
const SAMPLE_MS = 250;
/** Cada cuánto, como mucho, se avisa del avance (el plugin manda un aviso por trozo). */
const EMIT_MS = 100;
/** Un minuto sin recibir nada: la descarga está estancada, no lenta. */
const STALL_MS = 60_000;

function readTimings(): UpdateTimings {
  try {
    const raw = JSON.parse(localStorage.getItem(TIMINGS_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? (raw as UpdateTimings) : {};
  } catch {
    return {};
  }
}

function forget(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* almacenamiento vetado: nada que limpiar */
  }
}

function saveTimings(next: Partial<UpdateTimings>) {
  try {
    localStorage.setItem(TIMINGS_KEY, JSON.stringify({ ...readTimings(), ...next }));
  } catch {
    /* sin almacenamiento: la próxima estimación usará los valores de base */
  }
}

/** Mezcla una medida nueva con la anterior: un arranque lento aislado no descoloca la siguiente. */
const blend = (old: number | undefined, measured: number) =>
  old && Number.isFinite(old) ? Math.round(old * 0.4 + measured * 0.6) : Math.round(measured);

const positive = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

/** Peso que publica release.ps1 en latest.json (`"frame": { "size": … }`). */
function manifestSize(update: Update): number | null {
  const frame = update.rawJson?.frame as { size?: unknown } | undefined;
  return positive(frame?.size);
}

/** Velocidad de partida, antes de medir nada en esta descarga. */
function priorSpeed(timings: UpdateTimings): { speed: number; source: SpeedSource } {
  const stored = positive(timings.speed);
  const fresh = stored !== null && Date.now() - (timings.speedAt ?? 0) < SPEED_STALE_MS;
  // `downlink` (Mb/s) es la estimación de la red que hace el propio
  // navegador; Chromium la topa en 10, así que por encima solo dice «rápida».
  const connection = (navigator as Navigator & { connection?: { downlink?: number } }).connection;
  const downlink = positive(connection?.downlink);
  // Un 85 %: la descarga real nunca llega al ancho de banda nominal.
  const fromConnection = downlink !== null ? (downlink * 1_000_000 * 0.85) / 8 : null;

  if (stored !== null && fresh) {
    // Si la red de ahora es claramente más lenta que la de la última vez
    // (otra wifi), manda la de ahora.
    if (fromConnection !== null && downlink! < 10 && fromConnection < stored * 0.5) {
      return { speed: fromConnection, source: 'conexion' };
    }
    return { speed: stored, source: 'anterior' };
  }
  if (fromConnection !== null) return { speed: fromConnection, source: 'conexion' };
  if (stored !== null) return { speed: stored, source: 'anterior' };
  return { speed: FALLBACK_SPEED, source: 'supuesta' };
}

interface UpdateEstimate {
  /** Peso con el que se calcula (bytes). */
  size: number;
  /** ¿Peso exacto o supuesto? */
  sizeKnown: boolean;
  /** Velocidad con la que se calcula (bytes/s). */
  speed: number;
  speedSource: SpeedSource;
  /** Duración prevista de cada paso, en ms (la del paso en curso, lo que le queda). */
  steps: Record<UpdateStep, number>;
  /** ms que faltan hasta poder usar la versión nueva. */
  remainingMs: number;
  /** Paso en curso; null antes de confirmar. */
  current: UpdateStep | null;
}

/** Estado de la descarga en curso, para la estimación en vivo. */
const live = {
  /** performance.now() al recibir el primer byte */
  startedAt: 0,
  /** Media de toda la descarga (bytes/s), más estable que la móvil. */
  average: 0,
};

/**
 * Cuánto falta, paso a paso. Se llama antes de confirmar (todo previsto) y
 * durante la actualización (lo que queda, con la velocidad medida en vivo).
 */
export function estimateUpdate(now: number = performance.now()): UpdateEstimate {
  const timings = readTimings();
  const prior = priorSpeed(timings);
  const size = state.size ?? positive(timings.size) ?? FALLBACK_SIZE;
  const sizeKnown = state.size !== null;

  // En vivo: la media móvil, templada con la media de toda la descarga.
  let speed = prior.speed;
  let speedSource = prior.source;
  if (state.phase === 'downloading' && state.speed !== null) {
    speed = live.average > 0 ? state.speed * 0.7 + live.average * 0.3 : state.speed;
    speedSource = 'medida';
  }

  const latency = positive(timings.latencyMs) ?? DEFAULT_LATENCY_MS;
  const verify = positive(timings.verifyMs) ?? DEFAULT_VERIFY_MS;
  const install = positive(timings.installMs) ?? DEFAULT_INSTALL_MS;
  const boot = positive(timings.bootMs) ?? DEFAULT_BOOT_MS;
  const elapsed = state.stepStartedAt !== null ? Math.max(0, now - state.stepStartedAt) : 0;

  const steps: Record<UpdateStep, number> = {
    download: latency + (size / speed) * 1000,
    verify,
    install,
    restart: boot,
  };
  let current: UpdateStep | null = null;

  if (state.phase === 'downloading') {
    current = 'download';
    const left = Math.max(0, size - state.downloaded);
    // Sin el primer byte todavía, queda la espera de conexión.
    const waiting = state.downloaded === 0 ? Math.max(0, latency - elapsed) : 0;
    steps.download = waiting + (left / speed) * 1000;
  } else if (state.phase === 'verifying') {
    current = 'verify';
    steps.download = 0;
    steps.verify = Math.max(0, verify - elapsed);
  } else if (state.phase === 'ready') {
    // Bajada y verificada: queda instalar y reiniciar, aún sin empezar.
    current = 'install';
    steps.download = 0;
    steps.verify = 0;
  } else if (state.phase === 'installing') {
    current = 'install';
    steps.download = 0;
    steps.verify = 0;
    steps.install = Math.max(0, install - elapsed);
  }

  const remainingMs = UPDATE_STEPS.reduce((sum, step) => sum + steps[step], 0);
  return { size, sizeKnown, speed, speedSource, steps, remainingMs, current };
}

/**
 * Descarga, verifica e instala la actualización pendiente. ES EL ÚNICO CAMINO
 * QUE INSTALA, y solo lo llama «Actualizar ahora» del recuadro: nada lo
 * dispara por su cuenta. El instalador corre en modo silencioso
 * (`installMode: "quiet"` en tauri.conf.json), así que no aparece ningún
 * asistente: la app se cierra y vuelve sola ya actualizada.
 */
export async function startUpdateInstall(): Promise<void> {
  if (!isTauri() || installing) return;
  // Con una sesión de estudio, música sonando o una grabación a medias no se
  // reinicia: el recuadro ya lo dice y deja el botón apagado; esto es solo la
  // última red.
  if (busyGuard?.()) return;
  if (state.phase === 'ready' && verified) return resumeVerifiedInstall();

  installing = true;
  try {
    // Un sondeo de fondo a medias cambiaría el handle en plena descarga: se espera.
    if (checkInFlight) await checkInFlight;

    live.startedAt = 0;
    live.average = 0;
    setState({
      phase: 'downloading',
      progress: 0,
      downloaded: 0,
      speed: null,
      stepStartedAt: performance.now(),
      error: null,
    });
    // Sin handle (falló un intento anterior): se consulta de nuevo.
    const update = pending ?? (await check({ timeout: 20_000 }));
    if (!update) {
      toast({ title: tr('Frame está actualizado'), description: tr('No hay nada que instalar.') });
      setState({ phase: 'idle', version: null, progress: null, stepStartedAt: null, dialogOpen: false });
      return;
    }
    pending = update;
    if (update.version !== state.version) setState({ version: update.version });
    await downloadAndVerify(update);
  } catch (e) {
    fail(e);
  } finally {
    installing = false;
  }
}

/** Descarga (midiendo), verifica y, si nada lo impide, instala. */
async function downloadAndVerify(update: Update): Promise<void> {
  const requestedAt = performance.now();

  let downloaded = 0;
  let total = state.size ?? 0;
  let sampleBytes = 0;
  let sampleAt = 0;
  let ema: number | null = null;
  let lastEmit = 0;
  let finishedAt = 0;

  // Vigía: una conexión viva pero muda (un proxy, un antivirus que inspecciona
  // HTTPS) no hace fallar la descarga nunca, y el recuadro se quedaba en
  // «Descargando» sin poder reintentar. Si en STALL_MS no llega ni un byte, se
  // da por fallida; lo que esa descarga abandonada avise después, no cuenta.
  let abandoned = false;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let stall: (reason: Error) => void = () => undefined;
  const stalled = new Promise<never>((_, reject) => {
    stall = reject;
  });
  const watch = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      abandoned = true;
      stall(new Error(tr('La descarga dejó de recibir datos')));
    }, STALL_MS);
  };

  watch();
  const download = update.download((event) => {
    if (abandoned) return;
    const now = performance.now();
    // Tras el último byte queda verificar la firma, que es local: sin vigía.
    if (event.event === 'Finished') clearTimeout(stallTimer);
    else watch();
    if (event.event === 'Started') {
      const length = positive(event.data.contentLength);
      if (length !== null) total = length;
      live.startedAt = now;
      sampleAt = now;
      if (total > 0) setState({ size: total });
      saveTimings({ latencyMs: blend(readTimings().latencyMs, now - requestedAt) });
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      sampleBytes += event.data.chunkLength;
      const dt = now - sampleAt;
      if (dt >= SAMPLE_MS) {
        // Media móvil exponencial por tiempo: el peso de cada muestra
        // depende de lo que duró, no de cuántos trozos llegaron.
        const instant = sampleBytes / (dt / 1000);
        ema = ema === null ? instant : ema + (1 - Math.exp(-dt / SPEED_TAU_MS)) * (instant - ema);
        sampleBytes = 0;
        sampleAt = now;
      }
      if (live.startedAt) live.average = downloaded / Math.max(0.001, (now - live.startedAt) / 1000);
      if (now - lastEmit >= EMIT_MS) {
        lastEmit = now;
        setState({
          downloaded,
          progress: total > 0 ? Math.min(1, downloaded / total) : null,
          speed: ema,
        });
      }
    } else if (event.event === 'Finished') {
      finishedAt = now;
      setState({ phase: 'verifying', downloaded, progress: 1, speed: ema, stepStartedAt: now });
    }
  });
  try {
    await Promise.race([download, stalled]);
  } finally {
    clearTimeout(stallTimer);
  }

  // `download` termina después de comprobar la firma: ese rato es «verificar».
  const verifiedAt = performance.now();
  const learned: Partial<UpdateTimings> = { size: downloaded || total || undefined };
  if (finishedAt) learned.verifyMs = blend(readTimings().verifyMs, verifiedAt - finishedAt);
  // Solo descargas que duraron algo: en medio segundo la velocidad aún no dice nada.
  const span = (finishedAt || verifiedAt) - live.startedAt;
  if (live.startedAt && span > 500 && downloaded > 0) {
    learned.speed = Math.round(downloaded / (span / 1000));
    learned.speedAt = Date.now();
  }
  saveTimings(learned);
  verified = update;

  // Si mientras bajaba empezó una sesión de estudio, sonó música o se puso a
  // grabar, no se reinicia en medio: queda lista y el recuadro espera a que se
  // libere.
  if (busyGuard?.()) {
    setState({ phase: 'ready', progress: 1, speed: null, stepStartedAt: null, dialogOpen: true });
    return;
  }
  await installVerified(update);
}

async function installVerified(update: Update): Promise<void> {
  setState({ phase: 'installing', progress: 1, stepStartedAt: performance.now() });
  // La marca que se lee al volver (recordUpdateLanding): de aquí en adelante
  // todo ocurre con Frame cerrada.
  try {
    localStorage.setItem(LANDING_KEY, JSON.stringify({ to: update.version, at: Date.now() }));
  } catch {
    /* sin almacenamiento: se pierde solo la medida */
  }
  // Un instante para que el recuadro llegue a mostrar «Instalar» antes de cerrarse.
  await new Promise((resolve) => setTimeout(resolve, 120));

  // En Windows el instalador cierra la app por sí mismo; relaunch cubre el
  // resto de plataformas y cualquier caso en que siga viva.
  await update.install();
  await relaunch();
}

/** Instala la que quedó lista (fase `ready`) cuando ya no hay nada en marcha. */
async function resumeVerifiedInstall(): Promise<void> {
  const update = verified;
  if (!update || installing || busyGuard?.()) return;
  installing = true;
  try {
    await installVerified(update);
  } catch (e) {
    fail(e);
  } finally {
    installing = false;
  }
}

const BAD_SIGNATURE = 'La firma de la descarga no es la de Frame: no se instaló nada.';

function fail(e: unknown) {
  console.warn('startUpdateInstall failed', e);
  forget(LANDING_KEY);
  // El handle ya pudo quedar gastado: el próximo intento consulta de nuevo.
  verified = null;
  releasePending();
  // Una firma que no cuadra no es un problema de red, y conviene decirlo.
  const badSignature = /signature|firma|minisign/i.test(String(e));
  setState({
    phase: 'available',
    progress: null,
    downloaded: 0,
    speed: null,
    stepStartedAt: null,
    error: badSignature ? BAD_SIGNATURE : 'No se pudo actualizar. Revisa tu conexión e inténtalo de nuevo.',
  });
}

/**
 * Primer arranque tras actualizar: mide lo que tardaron la instalación y el
 * reinicio (desde la marca que se dejó antes de cerrar) y lo guarda para la
 * próxima estimación. Lo llama el recuadro al montarse, que ocurre cuando
 * Frame ya se puede usar.
 */
export function recordUpdateLanding(): void {
  let mark: { to?: string; at?: number } | null = null;
  try {
    mark = JSON.parse(localStorage.getItem(LANDING_KEY) ?? 'null');
  } catch {
    mark = null;
  }
  if (!mark || typeof mark.at !== 'number') return;
  const now = Date.now();
  const total = now - mark.at;

  if (mark.to !== APP_VERSION) {
    // Aún no es la versión nueva (o el instalador falló): la marca se tira
    // cuando ya no puede ser de una instalación en curso.
    if (total > 15 * 60_000) forget(LANDING_KEY);
    return;
  }
  forget(LANDING_KEY);
  // Medidas absurdas (reloj cambiado, equipo suspendido a mitad): fuera.
  if (total < 1000 || total > 10 * 60_000) return;

  // `timeOrigin`: cuándo empezó a cargar esta ventana. Antes, el instalador;
  // después, lo que tarda Frame en estar lista.
  const windowAt = performance.timeOrigin;
  const timings = readTimings();
  if (windowAt > mark.at && windowAt < now) {
    saveTimings({
      installMs: blend(timings.installMs, windowAt - mark.at),
      bootMs: blend(timings.bootMs, now - windowAt),
    });
  } else {
    // Sin un corte fiable, el total se reparte como los valores de base.
    const share = DEFAULT_INSTALL_MS / (DEFAULT_INSTALL_MS + DEFAULT_BOOT_MS);
    saveTimings({
      installMs: blend(timings.installMs, total * share),
      bootMs: blend(timings.bootMs, total * (1 - share)),
    });
  }
  toast({
    title: tr('Frame {APP_VERSION} instalada', { APP_VERSION }),
    description: tr('La actualización tardó {duration}.', { duration: formatDuration(total) }),
  });
}

// ------------------------------------------------------------
// Formatos que comparten el recuadro y el testigo
// ------------------------------------------------------------

const MB = 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/** «menos de 1 s», «24 s», «1 min 20 s», «12 min». */
export function formatDuration(ms: number): string {
  if (ms < 1000) return tr('menos de 1 s');
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  if (ms >= 10 * 60_000) return `${Math.round(ms / 60_000)} min`;
  // Por encima del minuto, de 5 en 5 segundos: el número no baila.
  const rounded = Math.round(ms / 5000) * 5;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

/** Sondeo: 20 s tras arrancar y luego cada 30 minutos. SOLO MIRA Y AVISA;
 *  ninguna de las dos llamadas instala nada. */
export function startUpdaterLoop(): () => void {
  if (!isTauri() || IS_STORE_BUILD) return () => {};
  const first = setTimeout(() => void checkForUpdates({ silent: true }), 20000);
  const interval = setInterval(() => void checkForUpdates({ silent: true }), 30 * 60 * 1000);
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}
