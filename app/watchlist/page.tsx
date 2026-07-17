'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate, daysUntil, parseLocalDate } from '@/lib/dates'

interface WatchedItem {
  watchId: string
  contractId: string
  contractType: 'cooperative' | 'institution'
  name: string
  contractNumber: string
  tradeCategory: string
  expirationDate: string
  badgeLabel: string
  badgeType: 'cooperative' | 'institution'
  detailHref: string
}

const COOP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ESCNJ:             { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'NJ State':        { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  Sourcewell:        { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300' },
  OMNIA:             { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  'Bergen Co-op':    { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  'Hunterdon ESC':   { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  NASPO:             { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  'NJ Edge':         { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300' },
}

export default function WatchlistPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<WatchedItem[]>([])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      const { data: watchRows } = await supabase
        .from('watched_contracts')
        .select('id, contract_id, contract_type')

      if (!watchRows || watchRows.length === 0) {
        setLoading(false)
        return
      }

      const coopIds = watchRows.filter((w: any) => w.contract_type === 'cooperative').map((w: any) => w.contract_id as string)
      const instIds = watchRows.filter((w: any) => w.contract_type === 'institution').map((w: any) => w.contract_id as string)

      const [coopResult, instResult] = await Promise.all([
        coopIds.length > 0
          ? supabase.from('contracts').select('id, contract_name, contract_number, trade_category, expiration_date, cooperatives(name, abbreviation)').in('id', coopIds)
          : Promise.resolve({ data: [] as any[] }),
        instIds.length > 0
          ? supabase.from('institution_contracts').select('id, vendor_name, contract_number, trade_category, expiration_date, institution_name').in('id', instIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const contractDataMap = new Map<string, WatchedItem>()

      for (const c of (coopResult.data ?? [])) {
        const coop = Array.isArray(c.cooperatives) ? c.cooperatives[0] : c.cooperatives
        const abbr: string = coop?.abbreviation ?? ''
        const badgeLabel = abbr === 'NJ State' ? 'NJ State Contract' : abbr
        const watchRow = watchRows.find((w: any) => w.contract_id === c.id && w.contract_type === 'cooperative')!
        contractDataMap.set(`coop-${c.id}`, {
          watchId: watchRow.id,
          contractId: c.id,
          contractType: 'cooperative',
          name: c.contract_name,
          contractNumber: c.contract_number || '—',
          tradeCategory: c.trade_category,
          expirationDate: c.expiration_date,
          badgeLabel,
          badgeType: 'cooperative',
          detailHref: `/contract/${c.id}`,
        })
      }

      for (const c of (instResult.data ?? [])) {
        const watchRow = watchRows.find((w: any) => w.contract_id === c.id && w.contract_type === 'institution')!
        contractDataMap.set(`inst-${c.id}`, {
          watchId: watchRow.id,
          contractId: c.id,
          contractType: 'institution',
          name: `${c.vendor_name} — On-Call ${c.trade_category}`,
          contractNumber: c.contract_number || 'N/A',
          tradeCategory: c.trade_category,
          expirationDate: c.expiration_date,
          badgeLabel: `Shared via ${c.institution_name}`,
          badgeType: 'institution',
          detailHref: `/contract/shared-${c.id}`,
        })
      }

      const result = watchRows
        .map((w: any) => contractDataMap.get(`${w.contract_type === 'cooperative' ? 'coop' : 'inst'}-${w.contract_id}`))
        .filter((item): item is WatchedItem => !!item)

      result.sort((a, b) =>
        parseLocalDate(a.expirationDate).getTime() - parseLocalDate(b.expirationDate).getTime()
      )

      setItems(result)
      setLoading(false)
    }

    load()
  }, [router])

  async function unwatch(watchId: string) {
    await supabase.from('watched_contracts').delete().eq('id', watchId)
    setItems(prev => prev.filter(w => w.watchId !== watchId))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864] text-white">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Vetted Vendors</div>
          <h1 className="text-xl font-bold">My Watchlist</h1>
          <p className="text-white/60 text-sm mt-1">Contracts you&apos;re tracking for expiration alerts</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
          ← Back to all contracts
        </Link>

        <div className="mt-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading&hellip;</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              You&apos;re not watching any contracts yet &mdash; tap ☆ Watch on any contract.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => {
                const days = daysUntil(item.expirationDate)
                const isExpired = days < 0
                const isSoon = !isExpired && days <= 180
                const daysBadgeClass = isExpired
                  ? 'bg-red-100 text-red-700'
                  : isSoon
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
                const daysBadgeLabel = isExpired
                  ? 'Expired'
                  : isSoon
                  ? `${days} days left`
                  : 'Active'

                const coopStyle = item.badgeType === 'cooperative'
                  ? (COOP_STYLES[item.badgeLabel] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' })
                  : { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' }

                return (
                  <div key={item.watchId} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <Link
                          href={item.detailHref}
                          className="font-bold text-sm text-gray-800 hover:text-teal-700 transition-colors block truncate"
                        >
                          {item.name}
                        </Link>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${coopStyle.bg} ${coopStyle.text} ${coopStyle.border}`}>
                            {item.badgeLabel}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.tradeCategory}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                          <span>📄 {item.contractNumber}</span>
                          <span>📅 Expires {formatDate(item.expirationDate)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${daysBadgeClass}`}>
                          {daysBadgeLabel}
                        </span>
                        <button
                          onClick={() => unwatch(item.watchId)}
                          className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove from watchlist"
                        >
                          ✕ Unwatch
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
