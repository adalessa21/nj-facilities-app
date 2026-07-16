import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { localToday } from '@/lib/dates'
import { SITE_URL } from '@/lib/site'

const BASE = SITE_URL

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Use a direct client (no cookies needed — all data is public-read)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const today = localToday()

  const [{ data: contracts }, { data: shared }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, contract_number, cooperative_id, expiration_date')
      .in('status', ['active', 'extended']),
    supabase
      .from('institution_contracts')
      .select('id, expiration_date')
      .eq('approved_by_admin', true)
      .eq('piggyback_allowed', true)
      .gte('expiration_date', today),
  ])

  // Deduplicate cooperative contracts by contract_number + cooperative_id
  // so each group gets one canonical URL (the first row's id in that group)
  const seenGroups = new Set<string>()
  const coopUrls: MetadataRoute.Sitemap = []
  for (const c of contracts ?? []) {
    const key = `${c.contract_number}||${c.cooperative_id}`
    if (!seenGroups.has(key)) {
      seenGroups.add(key)
      coopUrls.push({
        url: `${BASE}/contract/${c.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
  }

  const sharedUrls: MetadataRoute.Sitemap = (shared ?? []).map(c => ({
    url: `${BASE}/contract/shared-${c.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    ...coopUrls,
    ...sharedUrls,
  ]
}
