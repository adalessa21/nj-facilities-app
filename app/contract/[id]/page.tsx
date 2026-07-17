import { notFound } from 'next/navigation'
import { cache } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { formatDate, daysUntil, localToday } from '@/lib/dates'
import { normalizeUrl } from '@/lib/utils'
import { CopyButton } from './copy-button'
import WatchButton from '@/components/watch-button'
import { SITE_URL } from '@/lib/site'

type Params = { params: Promise<{ id: string }> }

// ── Data fetching ─────────────────────────────────────────────────────────────

const getContractData = cache(async (id: string) => {
  const supabase = await createSupabaseServerClient()

  if (id.startsWith('shared-')) {
    // Institution (shared) contract
    const uuid = id.slice('shared-'.length)
    const { data } = await supabase
      .from('institution_contracts')
      .select('*')
      .eq('id', uuid)
      .eq('approved_by_admin', true)
      .eq('piggyback_allowed', true)
      .single()
    if (!data) return null
    return { kind: 'shared' as const, data }
  }

  // Cooperative contract — first fetch the row to get contract_number + cooperative_id
  const { data: row } = await supabase
    .from('contracts')
    .select('id, contract_name, contract_number, trade_category, status, expiration_date, notes, cooperative_id, source_url, verified_at, cooperatives(id, name, abbreviation, display_color)')
    .eq('id', id)
    .single()

  if (!row) return null

  const coop = (Array.isArray(row.cooperatives) ? row.cooperatives[0] : row.cooperatives) as {
    id: string; name: string; abbreviation: string; display_color: string
  }

  // Fetch all rows in the same contract group to assemble the vendor list
  const { data: allRows } = await supabase
    .from('contracts')
    .select('id, vendor_id, vendors(id, company_name, phone, email, website, listing_tier, cert_url)')
    .eq('contract_number', row.contract_number)
    .eq('cooperative_id', row.cooperative_id)

  const vendors = (allRows ?? [])
    .map((r: any) => Array.isArray(r.vendors) ? r.vendors[0] : r.vendors)
    .filter(Boolean)

  return { kind: 'cooperative' as const, row, coop, vendors }
})

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const result = await getContractData(id)
  if (!result) return { title: 'Contract Not Found' }

  if (result.kind === 'shared') {
    const d = result.data
    return {
      title: `${d.vendor_name} — ${d.institution_name} Shared Contract | NJ Vetted Vendors`,
      description: `${d.trade_category} on-call contract shared by ${d.institution_name}. Expiration: ${formatDate(d.expiration_date)}.`,
    }
  }

  const { row, coop, vendors } = result
  const vendorNames = vendors.map((v: any) => v.company_name).join(', ')
  return {
    title: `${row.contract_name} — ${coop.abbreviation === 'NJ State' ? 'NJ State Contract' : coop.abbreviation} | NJ Vetted Vendors`,
    description: `${row.trade_category} cooperative contract ${row.contract_number}. Vendors: ${vendorNames || 'TBD'}. Expires ${formatDate(row.expiration_date)}.`,
  }
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const COOP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ESCNJ:           { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'NJ State':      { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  Sourcewell:      { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300' },
  OMNIA:           { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  'Bergen Co-op':  { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  'Hunterdon ESC': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  NASPO:           { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  'NJ Edge':       { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300' },
}

function CoopBadge({ abbr }: { abbr: string }) {
  const s = COOP_STYLES[abbr] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' }
  const label = abbr === 'NJ State' ? 'NJ State Contract' : abbr
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
      {label}
    </span>
  )
}

function StatusBadge({ expiration_date, status }: { expiration_date: string; status: string }) {
  const days = daysUntil(expiration_date)
  const isExpired = days < 0
  const isSoon = !isExpired && days <= 180
  const cls = isExpired ? 'bg-red-100 text-red-700' : isSoon || status === 'extended' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
  const label = isExpired ? 'Expired' : isSoon ? 'Expiring Soon' : status === 'extended' ? 'Extended' : 'Active'
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ContractDetailPage({ params }: Params) {
  const { id } = await params
  const result = await getContractData(id)
  if (!result) notFound()

  const pageUrl = `${SITE_URL}/contract/${id}`

  if (result.kind === 'shared') {
    const d = result.data
    const days = daysUntil(d.expiration_date)

    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-[#1F3864] text-white">
          <div className="max-w-3xl mx-auto px-4 py-5">
            <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Vetted Vendors</div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold leading-snug">{d.vendor_name} — On-Call {d.trade_category}</h1>
              <div className="flex items-center gap-2 shrink-0">
                <WatchButton contractId={d.id} contractType="institution" />
                <CopyButton text={pageUrl} label="Copy link" />
              </div>
            </div>
            <p className="text-white/60 text-sm mt-1">Shared contract by {d.institution_name}</p>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
            ← Back to all contracts
          </Link>

          <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4 space-y-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-amber-100 text-amber-800 border-amber-300">
                    Shared Contract
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{d.trade_category}</span>
                </div>
                <div className="text-sm text-gray-600">Submitted by <strong>{d.institution_name}</strong></div>
              </div>
              <StatusBadge expiration_date={d.expiration_date} status="active" />
            </div>

            {/* Key details */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Vendor</dt>
                <dd className="text-gray-800 font-medium">{d.vendor_name}</dd>
              </div>
              {d.contract_number && (
                <div>
                  <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Contract Number</dt>
                  <dd className="text-gray-700 font-mono">{d.contract_number}</dd>
                </div>
              )}
              {d.start_date && (
                <div>
                  <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Start Date</dt>
                  <dd className="text-gray-700">{formatDate(d.start_date)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Expiration Date</dt>
                <dd className="text-gray-700">
                  {formatDate(d.expiration_date)}
                  {days === 0 && <span className="ml-2 text-amber-600 font-medium text-xs">expires today</span>}
                  {days > 0 && days < 180 && <span className="ml-2 text-amber-600 font-medium text-xs">{days} days left</span>}
                  {days < 0 && <span className="ml-2 text-red-600 font-medium text-xs">expired</span>}
                </dd>
              </div>
              {d.authorized_users && (
                <div className="col-span-full">
                  <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Authorized Users</dt>
                  <dd className="text-gray-700">{d.authorized_users}</dd>
                </div>
              )}
              {d.insurance_requirements && (
                <div className="col-span-full">
                  <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Insurance Requirements</dt>
                  <dd className="text-gray-700">{d.insurance_requirements}</dd>
                </div>
              )}
              {(d as any).statutory_basis && (
                <div className="col-span-full">
                  <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Statutory Basis</dt>
                  <dd className="text-gray-700">{(d as any).statutory_basis}</dd>
                </div>
              )}
              {(d as any).dlgs_registration_number && (
                <div>
                  <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">DLGS Registration #</dt>
                  <dd className="text-gray-700 font-mono">{(d as any).dlgs_registration_number}</dd>
                </div>
              )}
              {d.notes && (
                <div className="col-span-full">
                  <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Notes</dt>
                  <dd className="text-gray-700">{d.notes}</dd>
                </div>
              )}
              <div className="col-span-full pt-1">
                {(d as any).verified_at ? (
                  <p className="text-xs text-gray-400">✓ Verified {formatDate((d as any).verified_at)}</p>
                ) : (
                  <p className="text-xs text-amber-600">Unverified — confirm current terms with the lead agency before purchasing</p>
                )}
              </div>
            </dl>

            {/* Authorization language */}
            {d.piggyback_language && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Authorization Language</h2>
                  <CopyButton text={d.piggyback_language} label="Copy text" />
                </div>
                <pre className="bg-gray-50 rounded-lg p-4 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans select-text border border-gray-200">
                  {d.piggyback_language}
                </pre>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // Cooperative contract
  const { row, coop, vendors } = result
  const days = daysUntil(row.expiration_date)
  const coopLabel = coop.abbreviation === 'NJ State' ? 'NJ State Contract' : coop.abbreviation

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864] text-white">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Vetted Vendors</div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold leading-snug">{row.contract_name}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <WatchButton contractId={row.id} contractType="cooperative" />
              <CopyButton text={pageUrl} label="Copy link" />
            </div>
          </div>
          <p className="text-white/60 text-sm mt-1">{coopLabel} · {row.trade_category}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
          ← Back to all contracts
        </Link>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4 space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <CoopBadge abbr={coop.abbreviation} />
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{row.trade_category}</span>
            </div>
            <StatusBadge expiration_date={row.expiration_date} status={row.status} />
          </div>

          {/* Key details */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Contract Number</dt>
              <dd className="text-gray-700 font-mono">{row.contract_number || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Expiration Date</dt>
              <dd className="text-gray-700">
                {formatDate(row.expiration_date)}
                {days === 0 && <span className="ml-2 text-amber-600 font-medium text-xs">expires today</span>}
                {days > 0 && days < 180 && <span className="ml-2 text-amber-600 font-medium text-xs">{days} days left</span>}
                {days < 0 && <span className="ml-2 text-red-600 font-medium text-xs">expired</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Cooperative</dt>
              <dd className="text-gray-800 font-medium">{coop.name}</dd>
            </div>
            {row.notes && (
              <div className="col-span-full">
                <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Notes</dt>
                <dd className="text-gray-700">{row.notes}</dd>
              </div>
            )}
            <div className="col-span-full pt-1">
              {(row as any).verified_at ? (
                <p className="text-xs text-gray-400">✓ Verified {formatDate((row as any).verified_at)}</p>
              ) : (
                <p className="text-xs text-amber-600">Unverified — confirm current terms with the cooperative before purchasing</p>
              )}
            </div>
          </dl>

          {/* Source link */}
          {row.source_url && (
            <a
              href={row.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2"
            >
              View on {coopLabel} →
            </a>
          )}

          {/* Vendor list */}
          {vendors.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Awarded Vendor{vendors.length !== 1 ? 's' : ''} ({vendors.length})
              </h2>
              <div className="space-y-3">
                {vendors.map((v: any) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-800 text-sm">{v.company_name}</span>
                    <div className="flex flex-wrap gap-2 ml-auto">
                      {v.phone && (
                        <a href={`tel:${v.phone}`} className="text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                          📞 {v.phone}
                        </a>
                      )}
                      {v.email && (
                        <a href={`mailto:${v.email}`} className="text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                          ✉️ {v.email}
                        </a>
                      )}
                      {v.website && (
                        <a href={normalizeUrl(v.website)} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                          🌐 {v.website}
                        </a>
                      )}
                      {v.cert_url && (
                        <a href={v.cert_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                          📋 View documents
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
