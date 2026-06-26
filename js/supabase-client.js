import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = window.DMDN_ENV ?? {};

export function isSupabaseConfigured() {
  return Boolean(
    env.SUPABASE_URL &&
    env.SUPABASE_ANON_KEY &&
    !env.SUPABASE_ANON_KEY.startsWith('__')
  );
}

export const supabase = isSupabaseConfigured()
  ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase não configurado. Informe a chave pública anon/publishable em js/env.js.');
  }
  return supabase;
}
