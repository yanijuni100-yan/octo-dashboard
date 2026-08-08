import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/* Satu instance client Supabase untuk seluruh aplikasi. Dibuat ulang
   ketika URL/anon key berubah (lihat store.initCloud). */
let client: SupabaseClient | null = null

export function initSupabase(url: string, key: string): SupabaseClient | null {
  client = null
  if (!url || !key) return null
  try {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  } catch {
    client = null
  }
  return client
}

export function getSupabase(): SupabaseClient | null {
  return client
}
