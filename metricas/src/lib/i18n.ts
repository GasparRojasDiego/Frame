import { es } from 'date-fns/locale';

// ============================================================
// Idioma de las métricas: solo español.
//
// Mismas firmas que `src/lib/i18n.ts` de la app, para que las piezas que se
// comparten con ella (botones, diálogos, avisos, informes) funcionen aquí sin
// arrastrar el diccionario inglés ni el núcleo nativo de Tauri. El alias de
// `vite.config.ts` hace que esas piezas importen este archivo.
// ============================================================

export type Lang = 'es' | 'en';

type Vars = Record<string, unknown>;

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;

export const tr = (text: string, vars?: Vars): string => fill(text, vars);

export const trc = (_context: string, text: string, vars?: Vars): string => fill(text, vars);

export const getLang = (): Lang => 'es';

export const dateLocale = () => es;

export const intlLocale = () => 'es-PE';

/** Coma decimal, como en Frame. */
export const decimalText = (value: number, digits = 1): string => value.toFixed(digits).replace('.', ',');

export const errorText = (error: unknown): string => String((error as { message?: unknown } | null)?.message ?? error ?? '');
