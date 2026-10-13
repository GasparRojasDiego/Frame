// Sustituye a src/lib/supabase/client.ts en la prueba de sincronización: la
// «nube» y el canal en vivo los pone el probador en cada dispositivo.
import type { SupabaseClient } from '@supabase/supabase-js';

export const getSupabase = (): SupabaseClient | null =>
  ((globalThis as unknown as { __supabase?: SupabaseClient }).__supabase ?? null);
