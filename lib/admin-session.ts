import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from './supabase-admin'

export interface AdminStatus {
  sessionEmail: string | null  // email from the session cookie; null = not signed in
  isAdmin: boolean             // email found in admin_users
  lookupError: string | null   // set if the admin_users query itself failed
}

// Returns full diagnostic status — used by /api/admin/check and layout.tsx.
export async function getAdminStatus(): Promise<AdminStatus> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const sessionEmail = user?.email ?? null

  if (!sessionEmail) {
    return { sessionEmail: null, isAdmin: false, lookupError: null }
  }

  // Case-insensitive comparison via ilike with exact value (no wildcards)
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('email')
    .ilike('email', sessionEmail)
    .maybeSingle()

  if (error) {
    return { sessionEmail, isAdmin: false, lookupError: error.message }
  }

  return { sessionEmail, isAdmin: data !== null, lookupError: null }
}

// Thin wrapper used by /api/admin/[table] — returns email when admin, null otherwise.
export async function requireAdmin(): Promise<string | null> {
  const { sessionEmail, isAdmin } = await getAdminStatus()
  return isAdmin ? sessionEmail : null
}
