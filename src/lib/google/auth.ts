// ============================================================
// Google OAuth 2.0 nativo para Frame (flujo "installed app"):
// PKCE + redirect a loopback (127.0.0.1) capturado por el núcleo Rust.
//
// La pantalla de Google se abre en una VENTANA DE FRAME, no en el navegador
// del sistema: entrar a la app no debería sacarte de la app ni dejarte una
// pestaña de Chrome abierta. El redirect a 127.0.0.1 lo recibe el mismo
// oyente Rust venga de donde venga la ventana, y si la ventana no pudiera
// crearse se cae al navegador: mejor un rodeo que quedarse fuera.
//
// 1.6.7: solo la identidad (openid, email, profile) para entrar en Frame.
// La vinculación por API de Gmail y Classroom se fue: pedía permisos
// restringidos y sensibles que obligan a una auditoría de Google para
// publicar el acceso. Gmail y Classroom siguen dentro de Frame con sus
// páginas reales (GoogleEmbed), que no necesitan ningún permiso.
// ============================================================
import { invoke, isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { listen } from '@tauri-apps/api/event';
import { getLang, tr } from '@/lib/i18n';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// Para clientes OAuth de tipo "Desktop app" Google emite un client_secret que
// NO se considera confidencial (documentación oficial de installed apps).
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string | undefined;

export const isGoogleConfigured = Boolean(CLIENT_ID);

// Ámbitos: solo la identidad (ver la cabecera).
const SCOPES = {
  identity: ['openid', 'email', 'profile'],
} as const;

type IntegrationKey = keyof typeof SCOPES;

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms en el que expira accessToken */
  expiresAt: number;
  /** ámbitos concedidos (space-separated, como los devuelve Google) */
  scope: string;
  idToken?: string;
}

interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

interface GoogleAccount {
  identity: GoogleIdentity;
  tokens: StoredTokens;
}

const ACCOUNTS_KEY = 'googleAccounts';
/** mapa integración → sub de la cuenta que la atiende */
const BINDINGS_KEY = 'googleIntegrationAccounts';
/** identidad principal (la usada para iniciar sesión en Frame) */
const IDENTITY_KEY = 'googleIdentity';
/** clave legada (una sola cuenta) — se migra automáticamente */
const LEGACY_TOKENS_KEY = 'googleTokens';

// --- Persistencia (localStorage, POR PERFIL de Frame) ---
//
// Estas claves eran globales («un solo usuario por máquina»). En un equipo
// compartido, el segundo estudiante heredaba las cuentas de Google del primero:
// `hasScopes('gmail')` daba verdadero y veía su bandeja y sus clases de
// Classroom. Ahora cada clave lleva el id del perfil activo.

/** Sufijo del perfil activo ('' mientras aún no hay perfil, p. ej. en pleno
 *  acceso con Google: lo escrito entonces se adopta al primer uso con perfil). */
function profileSuffix(): string {
  try {
    const id = (JSON.parse(localStorage.getItem('userProfile') ?? 'null') as { id?: string } | null)?.id;
    return id ? `_${id}` : '';
  } catch {
    return '';
  }
}

function scoped(base: string): string {
  const suffix = profileSuffix();
  if (!suffix) return base;
  const key = base + suffix;
  try {
    // Lo que quedó en la clave global (versión anterior, o el acceso con Google
    // que ocurre antes de existir el perfil) pasa al perfil que lo está usando.
    const pending = localStorage.getItem(base);
    if (pending !== null) {
      const current = localStorage.getItem(key);
      let merged = pending;
      if (current !== null && base !== IDENTITY_KEY) {
        try {
          merged = JSON.stringify({ ...(JSON.parse(current) as object), ...(JSON.parse(pending) as object) });
        } catch {
          merged = pending;
        }
      }
      localStorage.setItem(key, merged);
      localStorage.removeItem(base);
    }
  } catch {
    /* sin almacenamiento: se trabaja con lo que haya */
  }
  return key;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function loadAccounts(): Record<string, GoogleAccount> {
  migrateLegacyTokens();
  return readJSON<Record<string, GoogleAccount>>(scoped(ACCOUNTS_KEY)) ?? {};
}

function saveAccounts(accounts: Record<string, GoogleAccount>) {
  localStorage.setItem(scoped(ACCOUNTS_KEY), JSON.stringify(accounts));
}

function loadBindings(): Partial<Record<IntegrationKey, string>> {
  return readJSON<Partial<Record<IntegrationKey, string>>>(scoped(BINDINGS_KEY)) ?? {};
}

function saveBindings(bindings: Partial<Record<IntegrationKey, string>>) {
  localStorage.setItem(scoped(BINDINGS_KEY), JSON.stringify(bindings));
}

function loadGoogleIdentity(): GoogleIdentity | null {
  return readJSON<GoogleIdentity>(scoped(IDENTITY_KEY));
}

/** Migra el formato viejo (tokens únicos) al modelo por-cuenta. */
function migrateLegacyTokens() {
  const legacy = readJSON<StoredTokens>(LEGACY_TOKENS_KEY);
  if (!legacy) return;
  localStorage.removeItem(LEGACY_TOKENS_KEY);

  const identity = loadGoogleIdentity();
  if (!identity) return; // sin identidad no sabemos de quién eran los tokens

  const accounts = readJSON<Record<string, GoogleAccount>>(scoped(ACCOUNTS_KEY)) ?? {};
  accounts[identity.sub] = { identity, tokens: legacy };
  saveAccounts(accounts);

  const granted = new Set(legacy.scope.split(' '));
  const bindings = loadBindings();
  (Object.keys(SCOPES) as IntegrationKey[]).forEach((key) => {
    if (SCOPES[key].every((s) => granted.has(s))) bindings[key] = identity.sub;
  });
  bindings.identity = identity.sub;
  saveBindings(bindings);
}

export function disconnectGoogle() {
  for (const base of [ACCOUNTS_KEY, BINDINGS_KEY, IDENTITY_KEY]) {
    localStorage.removeItem(scoped(base));
    localStorage.removeItem(base);
  }
  localStorage.removeItem(LEGACY_TOKENS_KEY);
}

// --- PKCE ---

function base64Url(bytes: Uint8Array): string {
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkcePair() {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64Url(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));
  return { verifier, challenge };
}

// --- Flujo de autorización ---

interface AuthorizeOptions {
  scopes: string[];
  /**
   * Pantallas a forzar: 'consent' garantiza refresh_token; 'select_account'
   * muestra el selector de cuentas de Google; pueden combinarse
   * ('select_account consent').
   */
  prompt?: string;
  loginHint?: string;
}

/** El usuario cerró la ventana de Google antes de terminar. */
class AuthCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'AuthCancelled';
  }
}

async function authorize({ scopes, prompt, loginHint }: AuthorizeOptions): Promise<StoredTokens> {
  if (!isTauri()) {
    throw new Error(tr('Las integraciones de Google requieren la app de escritorio Frame.'));
  }
  if (!CLIENT_ID) {
    throw new Error(tr('Falta VITE_GOOGLE_CLIENT_ID en el archivo .env.'));
  }

  const { verifier, challenge } = await pkcePair();
  const state = base64Url(crypto.getRandomValues(new Uint8Array(16)));

  // Hasta 3 intentos por si el puerto elegido está ocupado.
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = 49152 + Math.floor(Math.random() * 16000);
    const redirectUri = `http://127.0.0.1:${port}/callback`;

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline',
      include_granted_scopes: 'true',
      // La pantalla de Google, en el idioma de Frame (no en el de Windows).
      hl: getLang(),
    });
    if (prompt) params.set('prompt', prompt);
    if (loginHint) params.set('login_hint', loginHint);

    // 1. Armar la escucha ANTES de abrir el navegador.
    const waiter = invoke<{ params: Record<string, string> }>('oauth_wait_callback', {
      port,
      timeoutSecs: 300,
    });

    // Pequeño margen para detectar un fallo de bind inmediato.
    const bindProbe = await Promise.race([
      waiter.then(
        (r) => ({ done: true as const, result: r }),
        (e) => ({ done: true as const, error: String(e) })
      ),
      new Promise<{ done: false }>((res) => setTimeout(() => res({ done: false }), 250)),
    ]);
    if (bindProbe.done && 'error' in bindProbe && bindProbe.error) {
      lastError = bindProbe.error;
      continue; // puerto ocupado → reintenta con otro
    }

    // 2. Abrir la pantalla de Google dentro de Frame. Si el usuario cierra
    //    esa ventana sin terminar, se cancela la espera en vez de dejar el
    //    puerto ocupado cinco minutos.
    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    let stopClosedWatch: (() => void) | undefined;
    const closedByUser = new Promise<never>((_, reject) => {
      void listen('auth-window-closed', () => reject(new AuthCancelled()))
        .then((unlisten) => { stopClosedWatch = unlisten; })
        .catch(() => undefined);
    });
    // Marca la promesa como atendida: si el cierre llegara justo después de
    // resolverse la carrera, no queda un rechazo huérfano en consola.
    closedByUser.catch(() => undefined);

    let inApp = true;
    try {
      await invoke('open_auth_window', { url: authUrl });
    } catch {
      inApp = false;
      await openUrl(authUrl);
    }

    // 3. Esperar el redirect (o el cierre de la ventana).
    let cb: Record<string, string>;
    try {
      ({ params: cb } = await Promise.race([waiter, closedByUser]));
    } catch (e) {
      if (e instanceof AuthCancelled) {
        void invoke('oauth_cancel_wait', { port }).catch(() => undefined);
        throw new Error(tr('Inicio de sesión cancelado.'));
      }
      throw e;
    } finally {
      stopClosedWatch?.();
      if (inApp) void invoke('close_auth_window').catch(() => undefined);
    }
    if (cb.error) throw new Error(tr('Google rechazó la autorización: {error}', { error: cb.error }));
    if (cb.state !== state) throw new Error(tr('Estado OAuth inválido (posible intento de suplantación).'));
    if (!cb.code) throw new Error(tr('Google no devolvió un código de autorización.'));

    // 4. Intercambiar el código por tokens (en el proceso nativo).
    const form: Record<string, string> = {
      client_id: CLIENT_ID,
      code: cb.code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };
    if (CLIENT_SECRET) form.client_secret = CLIENT_SECRET;

    const json = await invoke<any>('google_token_request', { form });

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000,
      scope: json.scope ?? scopes.join(' '),
      idToken: json.id_token,
    };
  }
  throw new Error(lastError || tr('No se pudo iniciar la escucha OAuth local.'));
}

/** Perfil de la cuenta dueña de un access token. */
async function fetchIdentity(accessToken: string): Promise<GoogleIdentity> {
  const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(tr('No se pudo obtener el perfil de Google.'));
  const info = await resp.json();
  return {
    sub: info.sub,
    email: info.email,
    name: info.name ?? info.email,
    givenName: info.given_name,
    familyName: info.family_name,
    picture: info.picture,
  };
}

/**
 * Guarda los tokens bajo su cuenta. Google solo devuelve refresh_token la
 * primera vez (o con prompt=consent): si no llega uno nuevo se conserva el
 * anterior de ESA MISMA cuenta — clave de la sincronización duradera.
 */
function saveAccount(identity: GoogleIdentity, tokens: StoredTokens): GoogleAccount {
  const accounts = loadAccounts();
  const prev = accounts[identity.sub];
  const merged: StoredTokens = {
    ...tokens,
    refreshToken: tokens.refreshToken || prev?.tokens.refreshToken,
  };
  const account: GoogleAccount = { identity, tokens: merged };
  accounts[identity.sub] = account;
  saveAccounts(accounts);
  return account;
}

/**
 * Inicio de sesión con Google (identidad principal). Devuelve el perfil.
 * Guarda tokens + identidad; el id_token queda disponible para Supabase.
 */
export async function googleSignIn(): Promise<GoogleIdentity & { idToken?: string }> {
  const tokens = await authorize({
    scopes: [...SCOPES.identity],
    prompt: 'select_account consent',
  });

  const identity = await fetchIdentity(tokens.accessToken);
  saveAccount(identity, tokens);

  const bindings = loadBindings();
  bindings.identity = identity.sub;
  saveBindings(bindings);
  localStorage.setItem(scoped(IDENTITY_KEY), JSON.stringify(identity));
  return { ...identity, idToken: tokens.idToken };
}
