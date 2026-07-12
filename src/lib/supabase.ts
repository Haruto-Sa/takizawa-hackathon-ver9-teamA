import { createClient } from '@supabase/supabase-js'

const fallbackUrl = 'https://ttqujouheefjtrdwpvea.supabase.co'
const fallbackAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0cXVqb3VoZWVmanRyZHdwdmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTc4NjAsImV4cCI6MjA5OTMzMzg2MH0.epcAJ7KJO0mX0UBeNs_oMtAlixSWED1Wr456Ub2KL-8'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || fallbackUrl
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || fallbackAnonKey

export const hasSupabaseConfig = Boolean(url && key)
export const supabase = hasSupabaseConfig ? createClient(url, key, { auth: { persistSession: false } }) : null

export async function ensureAnonymousSession() {
  if (!supabase) return null
  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) return existing.session
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}
