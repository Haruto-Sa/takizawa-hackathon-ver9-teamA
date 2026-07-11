import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const hasSupabaseConfig = Boolean(url && key)
export const supabase = hasSupabaseConfig ? createClient(url!, key!) : null

export async function ensureAnonymousSession() {
  if (!supabase) return null
  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) return existing.session
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}
