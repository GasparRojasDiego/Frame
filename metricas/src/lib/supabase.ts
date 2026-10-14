import { createClient } from '@supabase/supabase-js';

// ============================================================
// Cliente de Supabase de las métricas.
//
// La sesión vive en `sessionStorage`: se pierde al cerrar la pestaña y nunca
// queda escrita en el disco del equipo. PKCE para el regreso de Google (el
// código del enlace no sirve sin el verificador que guardó esta pestaña).
// Clave propia: no se mezcla con nada más que viva en el mismo dominio.
// ============================================================

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'falta-la-clave', {
  auth: {
    storage: window.sessionStorage,
    storageKey: 'frame-metricas',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export const isConfigured = Boolean(url && anonKey);
