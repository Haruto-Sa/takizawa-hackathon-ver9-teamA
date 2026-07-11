import { createClient, type User } from 'npm:@supabase/supabase-js@2'

export const admin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

export async function requireUser(req: Request): Promise<User> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/, '')
  if (!token) throw new Error('unauthorized')
  const { data, error } = await admin().auth.getUser(token)
  if (error || !data.user) throw new Error('unauthorized')
  return data.user
}
