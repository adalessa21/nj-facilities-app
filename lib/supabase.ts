import { createBrowserClient } from '@supabase/ssr'

// Single cookie-based browser client shared across all client-side code.
// Exported as both `supabase` (data queries) and `supabaseAuth` (auth calls)
// so every existing import continues to work without touching call sites.
const client = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const supabase = client
export const supabaseAuth = client
