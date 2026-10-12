import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Permite que la app siga funcionando 100% offline si no hay credenciales.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (client) return client;

  client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'aether-auth',
    },
  });

  return client;
}

/**
 * Cliente aparte, sin sesión y con flujo implícito, solo para pedir el correo
 * de «¿Olvidaste tu contraseña?». Con PKCE el enlace exigiría el verificador
 * guardado en este equipo; así la página web de la contraseña nueva puede
 * terminar el cambio desde cualquier navegador (1.6.6).
 */
export function getRecoveryClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' },
  });
}
