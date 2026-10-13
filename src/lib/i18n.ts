import { useSyncExternalStore } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { enUS, es } from 'date-fns/locale';

// ============================================================
// Idioma de la interfaz (1.6.7): español o inglés.
//
// El texto en español ES la clave: `tr('Guardar')` devuelve «Guardar» en
// español y lo que diga el diccionario (`i18n-en.ts`) en inglés. Así el código
// se sigue leyendo en el idioma en que se escribió y un texto sin traducir se
// nota enseguida (sale en español, y el comprobador de textos lo señala).
//
// Variables con nombre: `tr('Hoy llevas {total}', { total })`. El orden de
// las palabras cambia entre idiomas; las llaves, no.
//
// El diccionario inglés solo se carga si hace falta: quien usa Frame en
// español no lo descarga nunca. Cambiar de idioma repinta la interfaz al
// instante (ver `LangRoot` en main.tsx) sin recargarla: el temporizador y la
// música siguen como estaban. Las ventanas auxiliares (mini temporizador,
// vistazo al horario) se enteran por el evento `storage`.
//
// Regla: `tr()` se llama al pintar o al actuar, NUNCA al cargar un módulo
// (una constante traducida al cargar se quedaría en el idioma de arranque).
// ============================================================

export type Lang = 'es' | 'en';

export const LANG_STORAGE_KEY = 'appLanguage';

const readStored = (): Lang => {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
    // Sin elección guardada: quien ya usaba Frame sigue en español; una
    // instalación nueva sigue el idioma del sistema (la pantalla de acceso
    // ya sale en el idioma de quien la abre).
    if (localStorage.getItem('userProfile')) return 'es';
    return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'es';
  }
};

let current: Lang = readStored();
let english: Record<string, string> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

async function loadDictionary(lang: Lang): Promise<void> {
  if (lang === 'en' && !english) english = (await import('./i18n-en')).default;
}

/** Los títulos de las ventanas y de los selectores de archivos los pone el
 *  núcleo nativo: también se enteran del idioma. */
function tellNative(lang: Lang) {
  try {
    if (isTauri()) void invoke('set_ui_language', { lang }).catch(() => undefined);
  } catch {
    /* fuera de Tauri no hay núcleo nativo */
  }
}

function apply(lang: Lang) {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  tellNative(lang);
  notify();
}

/** Antes del primer pintado: deja listo el diccionario del idioma guardado. */
export async function prepareLang(): Promise<void> {
  await loadDictionary(current).catch(() => {
    current = 'es'; // sin diccionario, español antes que una mezcla
  });
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  tellNative(current);
}

export async function setLang(lang: Lang): Promise<void> {
  if (lang === current) return;
  await loadDictionary(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* sin almacenamiento, el cambio vale para esta sesión */
  }
  apply(lang);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== LANG_STORAGE_KEY) return;
    const next = readStored();
    if (next === current) return;
    void loadDictionary(next).then(() => apply(next));
  });
}

export const getLang = (): Lang => current;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Aviso de cambio de idioma fuera de React (ajustes de la cuenta, 1.6.8). */
export const subscribeLang = subscribe;

/** El idioma actual, con repintado al cambiar. */
export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang);

type Vars = Record<string, unknown>;

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;

/** Traduce un texto escrito en español al idioma de la interfaz. */
export function tr(text: string, vars?: Vars): string {
  if (current === 'es' || !english) return fill(text, vars);
  const translated = english[text];
  if (translated === undefined && import.meta.env.DEV) console.warn('[idioma] sin traducir:', text);
  return fill(translated ?? text, vars);
}

/**
 * Como `tr`, para las palabras con dos sentidos: «Media» es *Medium* como
 * importancia y *Mean* como promedio; «Mañana», *Tomorrow* o *Morning*. La
 * clave inglesa es `contexto|texto`; en español sale el texto tal cual.
 */
export function trc(context: string, text: string, vars?: Vars): string {
  if (current === 'es' || !english) return fill(text, vars);
  const translated = english[`${context}|${text}`] ?? english[text];
  if (translated === undefined && import.meta.env.DEV) console.warn('[idioma] sin traducir:', `${context}|${text}`);
  return fill(translated ?? text, vars);
}

/**
 * El mismo texto en los dos idiomas, para lo que se GUARDA ya escrito (el
 * historial de la campana): así un aviso de ayer se lee en el idioma de hoy.
 * `build` debe ser síncrona y solo construir textos. Si el diccionario inglés
 * aún no estaba cargado, se carga para la próxima vez.
 */
export function inBothLangs<T>(build: () => T): Partial<Record<Lang, T>> {
  const previous = current;
  const out: Partial<Record<Lang, T>> = {};
  try {
    current = 'es';
    out.es = build();
    if (english) {
      current = 'en';
      out.en = build();
    }
  } finally {
    current = previous;
  }
  if (!english) void loadDictionary('en').catch(() => undefined);
  return out;
}

/**
 * El texto de un error, listo para mostrarlo. Los mensajes propios de Frame
 * salen en el idioma de la interfaz, también los que llegan del núcleo nativo
 * con la forma «Prefijo: detalle» (el diccionario guarda «Prefijo: {e}»). Lo
 * que escribe otro (el sistema, Google, el servidor) se muestra tal cual.
 */
export function errorText(error: unknown): string {
  const raw = String((error as { message?: unknown } | null)?.message ?? error ?? '');
  if (current === 'es' || !english) return raw;
  if (english[raw] !== undefined) return english[raw];
  const colon = raw.indexOf(': ');
  if (colon > 0) {
    const pattern = english[`${raw.slice(0, colon)}: {e}`];
    if (pattern !== undefined) return fill(pattern, { e: raw.slice(colon + 2) });
  }
  return raw;
}

/** Locale de date-fns para el idioma actual. SOLO para dar formato a fechas:
 *  los cálculos de semanas siguen con `es` (la semana de Frame empieza en
 *  lunes; con `enUS` empezaría en domingo y moverían las métricas). */
export const dateLocale = () => (current === 'en' ? enUS : es);

/** Etiqueta BCP 47 para `toLocaleString` e `Intl`. */
export const intlLocale = () => (current === 'en' ? 'en-US' : 'es-PE');

/** Número con decimales fijos: coma en español (como siempre en Frame),
 *  punto en inglés. */
export const decimalText = (value: number, digits = 1): string => {
  const text = value.toFixed(digits);
  return current === 'en' ? text : text.replace('.', ',');
};
