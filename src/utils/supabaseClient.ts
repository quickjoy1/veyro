import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createLocalSupabase } from '@/utils/localSupabase'

const env = import.meta.env as Record<string, string | undefined>

// Without Supabase keys the app runs fully offline in local mode (data lives in
// the browser). Placeholder values keep createClient from throwing at startup.
export const isSupabaseConfigured = Boolean(env['VITE_SUPABASE_URL'] && env['VITE_SUPABASE_ANON_KEY'])
const supabaseUrl = env['VITE_SUPABASE_URL'] || 'http://localhost:54321'
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'] || 'local-mode-placeholder-key'

// Without keys, use the built-in local database (see localSupabase.ts) so everything works offline.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    })
  : (createLocalSupabase() as unknown as SupabaseClient)
