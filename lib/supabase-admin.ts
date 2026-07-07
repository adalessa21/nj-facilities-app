import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS entirely.
// Never import this from client components; server-only import above
// will fail the build if you try.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
