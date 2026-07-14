'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabase-auth'
import Link from 'next/link'
import { parseLocalDate, formatDate, daysUntil, localToday } from '@/lib/dates'
import { normalizeUrl } from '@/lib/utils'
import type { Entity, Cooperative, Vendor, GroupedContract } from '@/lib/types'
import WatchButton from '@/components/watch-button'

// Returns true when the selected institution is permitted to use this shared contract.
function isAuthorizedForInstitution(authorizedUsers: string | undefined, institutionName: string): boolean {
  if (!authorizedUsers || authorizedUsers === 'Any NJ public entity') return true
  return authorizedUsers.split(',').map(s => s.trim()).includes(institutionName)
}

// ── Local-only types ───────────────────────────────────────────────────────────
interface Contract {
  id: string
  contract_name: string
  contract_number: string
  trade_category: string
  status: string
  expiration_date: string
  notes: string
  cooperative_id: string
  vendors: Vendor | Vendor[]
  cooperatives: Cooperative | Cooperative[]
}

interface Membership { cooperative_id: string }

// ── Co-op color map ───────────────────────────────────────────────────────────
const COOP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ESCNJ:             { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'NJ State':        { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  Sourcewell:        { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300' },
  OMNIA:             { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  'Bergen Co-op':    { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  'Hunterdon ESC':   { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  NASPO:             { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  'NJ Edge':         { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300' },
  'Shared Contract': { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300' },
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

// ── Vendor Detail Panel ───────────────────────────────────────────────────────
function VendorPanel({
  vendor, contracts, entityMemberships, entityName, onViewLanguage, onClose,
}: {
  vendor: Vendor
  contracts: GroupedContract[]
  entityMemberships: string[]
  entityName?: string
  onViewLanguage: (text: string) => void
  onClose: () => void
}) {
  const allVendorContracts = contracts.filter(c => c.vendorList.some(v => v.id === vendor.id))
  const eligible = allVendorContracts.filter(c => {
    if (c.coop?.abbreviation === 'Shared Contract') {
      if (c.coop?.name === entityName) return true // lead institution
      return isAuthorizedForInstitution(c.authorized_users, entityName ?? '')
    }
    return entityMemberships.includes(c.cooperative_id)
  })
  const ineligible = allVendorContracts.filter(c => {
    if (c.coop?.abbreviation === 'Shared Contract') {
      if (c.coop?.name === entityName) return false
      return !isAuthorizedForInstitution(c.authorized_users, entityName ?? '')
    }
    return !entityMemberships.includes(c.cooperative_id)
  })
  const trades = [...new Set(allVendorContracts.map(c => c.trade_category))]
  const hasRealCoopContract = allVendorContracts.some(c => c.coop?.abbreviation !== 'Shared Contract')
  const coopEligibleCount = eligible.filter(c => c.coop?.abbreviation !== 'Shared Contract').length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 rounded-t-xl">
          <button onClick={onClose} className="float-right text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5 text-sm">✕ Close</button>
          <h2 className="text-lg font-bold text-[#1F3864] pr-8">{vendor.company_name}</h2>
          <div className="flex flex-wrap gap-1 mt-1">
            {trades.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t}</span>)}
          </div>
        </div>

        <div className="px-5 py-4">
          {entityName ? (
            hasRealCoopContract && (
              <div className="flex items-center gap-2 bg-green-50 text-green-800 text-sm px-3 py-2 rounded-lg mb-4">
                <span>✓</span>
                <span>Available via <strong>{coopEligibleCount}</strong> cooperative contract{coopEligibleCount !== 1 ? 's' : ''}</span>
              </div>
            )
          ) : (
            hasRealCoopContract && (
              <div className="flex items-center gap-2 bg-gray-50 text-gray-700 text-sm px-3 py-2 rounded-lg mb-4">
                <span>📋</span>
                <span>Holds <strong>{allVendorContracts.filter(c => c.coop?.abbreviation !== 'Shared Contract').length}</strong> cooperative contract{allVendorContracts.filter(c => c.coop?.abbreviation !== 'Shared Contract').length !== 1 ? 's' : ''}</span>
              </div>
            )
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`} className="flex items-center gap-1.5 text-xs bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100">📞 {vendor.phone}</a>
            )}
            {vendor.email && (
              <a href={`mailto:${vendor.email}`} className="flex items-center gap-1.5 text-xs bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100">✉️ {vendor.email}</a>
            )}
            {vendor.website && (
              <a href={normalizeUrl(vendor.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100">🌐 {vendor.website}</a>
            )}
            {(vendor as any).cert_url && (
              <a href={(vendor as any).cert_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100">📋 View documents</a>
            )}
          </div>

          {entityName ? (
            <>
              {eligible.length > 0 && (
                <>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contracts your institution can use</div>
                  {eligible.map(c => {
                    const days = daysUntil(c.expiration_date)
                    const exp = formatDate(c.expiration_date)
                    const isShared = c.coop?.abbreviation === 'Shared Contract'
                    return (
                      <div key={c.id} className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100 last:border-0">
                        <div>
                          <div className="text-sm font-semibold text-gray-800">{c.contract_name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {isShared ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">⭐ Your shared contract</span>
                            ) : <CoopBadge abbr={c.coop.abbreviation} />}
                            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{c.contract_number}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Expires {exp}
                            {days > 0 && days < 180 && <span className="text-amber-600 font-medium"> · {days} days left</span>}
                          </div>
                          {isShared ? (
                            c.piggyback_language && (
                              <button onClick={() => onViewLanguage(c.piggyback_language!)} className="text-xs text-teal-600 hover:text-teal-800 underline underline-offset-2 mt-1 block">View authorization language →</button>
                            )
                          ) : (
                            c.source_url && (
                              <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:text-teal-800 underline underline-offset-2 mt-1 block">View on {c.coop.abbreviation} →</a>
                            )
                          )}
                        </div>
                        {(() => {
                          const vpExpired = days < 0
                          const vpSoon = !vpExpired && days <= 180
                          const vpClass = vpExpired ? 'bg-red-100 text-red-700' : vpSoon || c.status === 'extended' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          const vpLabel = vpExpired ? 'Expired' : vpSoon ? 'Expiring Soon' : c.status === 'extended' ? 'Extended' : 'Active'
                          return <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${vpClass}`}>{vpLabel}</span>
                        })()}
                      </div>
                    )
                  })}
                </>
              )}
              {ineligible.length > 0 && (
                <>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Also holds — requires different co-op membership</div>
                  {ineligible.map(c => (
                    <div key={c.id} className="flex items-start justify-between mb-2 pb-2 border-b border-gray-100 last:border-0 opacity-40">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{c.contract_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <CoopBadge abbr={c.coop.abbreviation} />
                          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{c.contract_number}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">Not eligible</span>
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            allVendorContracts.length > 0 && (
              <>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contracts held</div>
                {allVendorContracts.map(c => {
                  const days = daysUntil(c.expiration_date)
                  const exp = formatDate(c.expiration_date)
                  return (
                    <div key={c.id} className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{c.contract_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <CoopBadge abbr={c.coop?.abbreviation || ''} />
                          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{c.contract_number}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Expires {exp}
                          {days === 0 && <span className="text-amber-600 font-medium"> · expires today</span>}
                          {days > 0 && days < 180 && <span className="text-amber-600 font-medium"> · {days} days left</span>}
                          {days < 0 && <span className="text-red-600 font-medium"> · EXPIRED</span>}
                        </div>
                        {c.source_url && (
                          <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:text-teal-800 underline underline-offset-2 mt-1 block">View on {c.coop?.abbreviation} →</a>
                        )}
                        {c.piggyback_language && (
                          <button onClick={() => onViewLanguage(c.piggyback_language!)} className="text-xs text-teal-600 hover:text-teal-800 underline underline-offset-2 mt-1 block">View authorization language →</button>
                        )}
                      </div>
                      {(() => {
                        const vpExpired = days < 0
                        const vpSoon = !vpExpired && days <= 180
                        const vpClass = vpExpired ? 'bg-red-100 text-red-700' : vpSoon || c.status === 'extended' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        const vpLabel = vpExpired ? 'Expired' : vpSoon ? 'Expiring Soon' : c.status === 'extended' ? 'Extended' : 'Active'
                        return <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${vpClass}`}>{vpLabel}</span>
                      })()}
                    </div>
                  )
                })}
              </>
            )
          )}
        </div>

        <div className="px-5 pb-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
          Sources: ESCNJ · NJ State Contract · Sourcewell · OMNIA Partners · Bergen Co-op · Hunterdon ESC · NASPO · NJ Edge · Verified June 2026
        </div>
      </div>
    </div>
  )
}

// ── Props for server-side initial data ────────────────────────────────────────
interface HomeClientProps {
  initialEntities?: Entity[]
  initialCooperatives?: Cooperative[]
  initialContracts?: GroupedContract[]
  initialTrades?: string[]
}

// ── Main Client Component ──────────────────────────────────────────────────────
export default function HomeClient({
  initialEntities = [],
  initialCooperatives = [],
  initialContracts = [],
  initialTrades = [],
}: HomeClientProps) {
  const [entities, setEntities] = useState<Entity[]>(initialEntities)
  const [cooperatives, setCooperatives] = useState<Cooperative[]>(initialCooperatives)
  const [allContracts, setAllContracts] = useState<GroupedContract[]>(initialContracts)
  const [trades, setTrades] = useState<string[]>(initialTrades)

  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [entityMemberships, setEntityMemberships] = useState<string[]>([])
  const [membershipsLoaded, setMembershipsLoaded] = useState(false)
  const [selectedTrades, setSelectedTrades] = useState<string[]>([])
  const [selectedCoops, setSelectedCoops] = useState<string[]>([])
  const [query, setQuery] = useState('')

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [piggybackModal, setPiggybackModal] = useState<string | null>(null)
  // Start loading=false when server already provided contracts
  const [loading, setLoading] = useState(initialContracts.length === 0)
  const [showAllTrades, setShowAllTrades] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [autoDetected, setAutoDetected] = useState(false)
  const lastDetectedEmail = useRef<string | null>(null)

  // Skip the initial client-side fetch when the server already provided data
  const skipInitialFetch = useRef(initialContracts.length > 0)

  // Load entities + cooperatives — skip if server already provided them
  useEffect(() => {
    if (initialEntities.length > 0) return
    async function load() {
      const [{ data: ents }, { data: coops }] = await Promise.all([
        supabase.from('entities').select('id, name, type, county').order('type').order('name'),
        supabase.from('cooperatives').select('id, name, abbreviation, display_color').order('name'),
      ])
      if (ents) setEntities(ents)
      if (coops) setCooperatives(coops)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auth state
  useEffect(() => {
    async function detectAndSetInstitution(email: string) {
      if (email === lastDetectedEmail.current) return
      lastDetectedEmail.current = email
      const domain = email.split('@')[1]
      if (!domain) return
      const { data } = await supabase
        .from('entities')
        .select('id, name, type, county')
        .eq('email_domain', domain)
        .maybeSingle()
      if (data) {
        setSelectedEntity(data)
        setAutoDetected(true)
      }
    }

    ;(async () => {
      const { data: { session } } = await supabaseAuth.auth.getSession()
      const loggedInUser = session?.user ?? (await supabaseAuth.auth.getUser()).data.user
      setUser(loggedInUser)
      if (loggedInUser?.email) detectAndSetInstitution(loggedInUser.email)
    })()

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange((_event, session) => {
      const loggedInUser = session?.user ?? null
      setUser(loggedInUser)
      if (loggedInUser?.email) {
        detectAndSetInstitution(loggedInUser.email)
      } else {
        setSelectedEntity(null)
        setAutoDetected(false)
        lastDetectedEmail.current = null
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load memberships when entity changes
  useEffect(() => {
    if (!selectedEntity) {
      setEntityMemberships([])
      setMembershipsLoaded(false)
      return
    }
    setMembershipsLoaded(false)
    async function loadMemberships() {
      const { data } = await supabase
        .from('memberships')
        .select('cooperative_id')
        .eq('entity_id', selectedEntity!.id)
        .eq('status', 'confirmed')
      if (data) setEntityMemberships(data.map((m: Membership) => m.cooperative_id))
      setMembershipsLoaded(true)
    }
    loadMemberships()
  }, [selectedEntity])

  // Fetch contracts — skips first run when server already provided initial data
  const search = useCallback(async () => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    if (selectedEntity && !membershipsLoaded) {
      setLoading(true)
      return
    }
    setLoading(true)

    const realCoopFilters = selectedCoops.filter(id => id !== 'shared-contract')
    const includesShared = selectedCoops.includes('shared-contract')
    const isAllCoops = selectedCoops.length === 0
    const showCoopContracts = isAllCoops || realCoopFilters.length > 0
    const showSharedContracts = isAllCoops || includesShared

    const grouped: Record<string, GroupedContract> = {}

    if (showCoopContracts) {
      let q = supabase
        .from('contracts')
        .select(`id, contract_name, contract_number, trade_category, status, expiration_date, notes, cooperative_id, source_url, verified_at, vendors ( id, company_name, phone, email, website, listing_tier, cert_url ), cooperatives ( id, name, abbreviation, display_color )`)
        .in('status', ['active', 'extended'])
        .order('expiration_date', { ascending: true })

      let coopIdsForQuery: string[] | null = null
      if (selectedEntity) {
        coopIdsForQuery = realCoopFilters.length > 0
          ? realCoopFilters.filter(id => entityMemberships.includes(id))
          : entityMemberships
        if (coopIdsForQuery.length === 0) coopIdsForQuery = null
      } else {
        coopIdsForQuery = realCoopFilters.length > 0 ? realCoopFilters : null
      }

      const skipCoopQuery = selectedEntity && coopIdsForQuery === null
      if (!skipCoopQuery) {
        if (coopIdsForQuery !== null) q = q.in('cooperative_id', coopIdsForQuery)
        if (selectedTrades.length > 0) q = q.in('trade_category', selectedTrades)
        const { data, error } = await q
        if (error) console.error(error)
        if (data) {
          data.forEach((row: Contract) => {
            const key = `${row.contract_number}||${row.cooperative_id}`
            const coop = (Array.isArray(row.cooperatives) ? row.cooperatives[0] : row.cooperatives) as Cooperative
            const vendor = (Array.isArray(row.vendors) ? row.vendors[0] : row.vendors) as Vendor
            if (!grouped[key]) {
              grouped[key] = { id: row.id, contract_name: row.contract_name, contract_number: row.contract_number, trade_category: row.trade_category, status: row.status, expiration_date: row.expiration_date, notes: row.notes, cooperative_id: row.cooperative_id, source_url: (row as any).source_url || '', verified_at: (row as any).verified_at ?? undefined, vendorList: [], coop, source: 'cooperative' }
            }
            if (vendor && !grouped[key].vendorList.find(v => v.id === vendor.id)) {
              grouped[key].vendorList.push(vendor)
            }
          })
        }
      }
    }

    if (showSharedContracts) {
      let iq = supabase.from('institution_contracts').select('*')
        .eq('approved_by_admin', true).eq('piggyback_allowed', true).gte('expiration_date', localToday())
      if (selectedTrades.length > 0) iq = iq.in('trade_category', selectedTrades)
      const { data: instData } = await iq
      instData?.forEach((row: any) => {
        grouped[`inst-${row.id}`] = {
          id: row.id,
          contract_name: row.vendor_name + ' — On-Call ' + row.trade_category,
          contract_number: row.contract_number || 'N/A',
          trade_category: row.trade_category,
          status: 'active',
          expiration_date: row.expiration_date,
          notes: row.notes || '',
          cooperative_id: '',
          vendorList: [{ id: `inst-vendor-${row.id}`, company_name: row.vendor_name, phone: '', email: '', website: '', listing_tier: '' }],
          coop: { id: `inst-coop-${row.id}`, name: row.institution_name, abbreviation: 'Shared Contract', display_color: '#854F0B' },
          source: 'institution',
          institution_name: row.institution_name,
          piggyback_language: row.piggyback_language,
          authorized_users: row.authorized_users,
          insurance_requirements: row.insurance_requirements,
          verified_at: row.verified_at ?? undefined,
          statutory_basis: row.statutory_basis ?? undefined,
          dlgs_registration_number: row.dlgs_registration_number ?? undefined,
        }
      })
    }

    const result = Object.values(grouped).filter(c => daysUntil(c.expiration_date) >= 0)
    result.sort((a, b) => {
      const tradeOrder = a.trade_category.localeCompare(b.trade_category)
      if (tradeOrder !== 0) return tradeOrder
      return parseLocalDate(b.expiration_date).getTime() - parseLocalDate(a.expiration_date).getTime()
    })
    setAllContracts(result)
    if (selectedTrades.length === 0) {
      setTrades([...new Set(result.map(c => c.trade_category))].sort())
    }
    setLoading(false)
  }, [selectedEntity, entityMemberships, membershipsLoaded, selectedTrades, selectedCoops])

  useEffect(() => { search() }, [search])

  // Client-side text filter — no network request on keystrokes
  const groupedContracts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allContracts
    return allContracts.filter(c =>
      c.contract_name?.toLowerCase().includes(q) ||
      c.contract_number?.toLowerCase().includes(q) ||
      c.trade_category?.toLowerCase().includes(q) ||
      c.vendorList.some(v => v.company_name?.toLowerCase().includes(q))
    )
  }, [allContracts, query])

  const groupedEntities = {
    university: entities.filter(e => e.type === 'university'),
    county_college: entities.filter(e => e.type === 'county_college'),
    county_gov: entities.filter(e => e.type === 'county_gov'),
  }

  const vendorSet = new Set(groupedContracts.flatMap(c => c.vendorList.map(v => v.id)))
  const coopSet = new Set(groupedContracts.map(c => c.cooperative_id))

  function isLeadContract(c: GroupedContract) {
    return c.coop?.abbreviation === 'Shared Contract' && c.coop?.name === selectedEntity?.name
  }
  const myContracts = groupedContracts.filter(isLeadContract)
  const otherContracts = groupedContracts.filter(c => !isLeadContract(c))

  function toggleTrade(t: string) { setSelectedTrades(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]) }
  function toggleCoop(id: string) { setSelectedCoops(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }

  function renderCard(c: GroupedContract) {
    const days = daysUntil(c.expiration_date)
    const exp = formatDate(c.expiration_date)
    const isPending = c.vendorList.length === 0 || c.vendorList[0]?.company_name?.startsWith('[')
    const coopAbbr = c.coop?.abbreviation || ''
    const coopLabel = coopAbbr === 'NJ State' ? 'NJ State Contract' : coopAbbr
    const isLead = isLeadContract(c)
    const isExpired = days < 0
    const isExpiringSoon = !isExpired && days <= 180
    const badgeClass = isExpired ? 'bg-red-100 text-red-700' : isExpiringSoon || c.status === 'extended' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
    const badgeLabel = isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : c.status === 'extended' ? 'Extended' : 'Active'
    const detailHref = c.source === 'institution' ? `/contract/shared-${c.id}` : `/contract/${c.id}`

    return (
      <div
        key={`${c.contract_number}-${c.cooperative_id}`}
        className={`rounded-xl p-4 mb-2 transition-colors ${isLead ? '' : 'bg-white border border-gray-200 hover:border-teal-400'}`}
        style={isLead ? { backgroundColor: '#FAEEDA', border: '0.5px solid #EF9F27' } : undefined}
      >
        <div className="flex justify-between items-start gap-2 mb-1.5">
          <div>
            {/* Contract name links to its detail page */}
            <Link href={detailHref} className="font-bold text-sm text-gray-800 hover:text-teal-700 transition-colors">
              {c.contract_name}
            </Link>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{c.trade_category}</span>
              {c.source === 'institution' ? (
                isLead ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#FAEEDA', color: '#854F0B', border: '0.5px solid #EF9F27' }}>
                    ⭐ Your contract
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-amber-100 text-amber-800 border-amber-300">
                    Shared via {c.coop?.name}
                  </span>
                )
              ) : <CoopBadge abbr={coopAbbr} />}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass}`}>{badgeLabel}</span>
            <WatchButton contractId={c.id} contractType={c.source === 'institution' ? 'institution' : 'cooperative'} />
          </div>
        </div>

        <div className="flex gap-4 text-xs text-gray-400 mb-2">
          <span>📄 {c.contract_number}</span>
          <span>
            📅 Expires {exp}
            {days === 0 && <span className="text-amber-600 font-medium"> · expires today</span>}
            {days > 0 && days < 180 && <span className="text-amber-600 font-medium"> · {days} days left</span>}
            {days < 0 && <span className="text-red-600 font-medium"> · EXPIRED</span>}
          </span>
        </div>

        {c.notes && <div className="text-xs text-gray-400 mb-2">{c.notes}</div>}
        {c.verified_at ? (
          <div className="text-xs text-gray-400 mb-2">✓ Verified {formatDate(c.verified_at)}</div>
        ) : (
          <div className="text-xs text-amber-600 mb-2">Unverified — confirm current terms with the cooperative before purchasing</div>
        )}
        {!!(c as any).source_url && (
          <div className="mb-2">
            <a href={(c as any).source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:text-teal-800 underline underline-offset-2">
              View on {coopAbbr === 'NJ State' ? 'NJ State Contract' : coopAbbr} →
            </a>
          </div>
        )}
        {c.source === 'institution' && c.piggyback_language && (
          <div className="mb-2">
            <button onClick={() => setPiggybackModal(c.piggyback_language!)} className="text-xs text-teal-600 hover:text-teal-800 underline underline-offset-2">
              View authorization language →
            </button>
          </div>
        )}

        <div className="text-xs text-gray-500 mb-2">
          <span className="font-semibold text-gray-700">Vendors: </span>
          {isPending ? (
            <span className="text-gray-300">Verification in progress</span>
          ) : (
            c.vendorList.map((v, i) => (
              <span key={v.id}>
                <button onClick={() => setSelectedVendor(v)} className="text-teal-600 underline underline-offset-2 hover:text-teal-800">
                  {v.company_name}
                </button>
                {i < c.vendorList.length - 1 && <span className="text-gray-300 mx-1">·</span>}
              </span>
            ))
          )}
        </div>

        {selectedEntity && (
          c.source === 'institution' ? (
            isLead ? (
              <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FAC775', color: '#633806' }}>
                <span>⭐</span>
                <span>This is {c.institution_name}'s contract — other institutions can use it</span>
              </div>
            ) : isAuthorizedForInstitution(c.authorized_users, selectedEntity.name) ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg">
                <span>✓</span>
                <span>{selectedEntity.name} can use this via {c.institution_name} — shared on-call contract</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                <span>🔒</span>
                <span>Restricted — not authorized for {selectedEntity.name}</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
              <span>✓</span>
              <span>{selectedEntity.name} eligible via {coopLabel} — competitively bid cooperative pricing</span>
              {!isPending && (
                <button onClick={() => setSelectedVendor(c.vendorList[0])} className="ml-auto text-teal-600 underline underline-offset-2 hover:text-teal-800 whitespace-nowrap">
                  View profiles →
                </button>
              )}
            </div>
          )
        )}
      </div>
    )
  }

  const activeTradeLabel = selectedTrades.length === 1 ? selectedTrades[0] : selectedTrades.length > 1 ? `${selectedTrades.length} trades` : null
  const realCoopFilters = selectedCoops.filter(id => id !== 'shared-contract')
  const includesShared = selectedCoops.includes('shared-contract')
  const activeCoopLabel = (() => {
    const parts: string[] = []
    if (realCoopFilters.length === 1) parts.push(cooperatives.find(c => c.id === realCoopFilters[0])?.abbreviation || '')
    else if (realCoopFilters.length > 1) parts.push(`${realCoopFilters.length} co-ops`)
    if (includesShared) parts.push('Shared Contract')
    return parts.length > 0 ? parts.join(' · ') : null
  })()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864] text-white">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs tracking-widest uppercase text-white/50">NJ Facilities Procurement Platform · Beta</div>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/50 hidden sm:block">{user.email}</span>
                <Link href="/watchlist" className="text-xs text-white/70 hover:text-white border border-white/30 hover:border-white/60 rounded px-2.5 py-1 transition-colors">
                  My Watchlist
                </Link>
                <button onClick={() => { supabaseAuth.auth.signOut(); setSelectedEntity(null); setAutoDetected(false) }}
                  className="text-xs text-white/70 hover:text-white border border-white/30 hover:border-white/60 rounded px-2.5 py-1 transition-colors">
                  Sign out
                </button>
              </div>
            ) : (
              <Link href="/login" className="text-xs text-white/70 hover:text-white border border-white/30 hover:border-white/60 rounded px-2.5 py-1 transition-colors">
                Sign in
              </Link>
            )}
          </div>
          <h1 className="text-xl font-bold">
            {selectedEntity
              ? <>Find qualified vendors at <span className="text-[#4ecba0]">{selectedEntity.name}</span></>
              : 'Find qualified vendors across NJ'
            }
          </h1>
          <p className="text-white/60 text-sm mt-1">
            ESCNJ · NJ State Contract · Sourcewell · OMNIA · Bergen Co-op · Hunterdon ESC · NASPO · NJ Edge
          </p>
          <Link href="/piggyback" className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2 mt-2 inline-block">
            Submit a Shared Contract for Approval →
          </Link>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-2">
          <select
            className="h-10 border border-gray-300 rounded-lg px-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 sm:min-w-[260px]"
            value={selectedEntity?.id || ''}
            onChange={e => {
              const ent = entities.find(en => en.id === e.target.value) || null
              setSelectedEntity(ent); setSelectedTrades([]); setSelectedCoops([]); setQuery('')
            }}
          >
            <option value="">Filter by institution (optional)</option>
            <optgroup label="Public Universities">
              {groupedEntities.university.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
            <optgroup label="County Colleges">
              {groupedEntities.county_college.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
            <optgroup label="County Governments">
              {groupedEntities.county_gov.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
          </select>
          <input type="text" placeholder="Search vendor, trade, or contract #..."
            className="flex-1 h-10 border border-gray-300 rounded-lg px-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      {user && autoDetected && selectedEntity && (
        <div className="bg-teal-50 border-b border-teal-200">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-teal-800 font-medium">🏛️ Signed in as <strong>{selectedEntity.name}</strong></span>
            <div className="flex items-center gap-3">
              <Link href="/my-institution" className="text-xs text-teal-700 hover:text-teal-900 underline underline-offset-2">My Institution →</Link>
              <button onClick={() => { supabaseAuth.auth.signOut(); setSelectedEntity(null); setAutoDetected(false) }} className="text-xs text-teal-600 hover:text-teal-800">Not you? Sign out</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-5">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[{ n: groupedContracts.length, l: 'contracts' }, { n: vendorSet.size, l: 'vendors' }, { n: coopSet.size, l: 'co-ops' }].map(s => (
            <div key={s.l} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-[#1F3864]">{loading ? '…' : s.n}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="mb-1">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Filter by trade</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button onClick={() => setSelectedTrades([])} className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedTrades.length === 0 ? 'bg-teal-50 border-teal-500 text-teal-700 font-semibold' : 'bg-white border-gray-300 text-gray-500 hover:border-teal-400'}`}>All trades</button>
            {trades.map((t, idx) => {
              const isActive = selectedTrades.includes(t)
              const hiddenOnMobile = !showAllTrades && idx >= 8 && !isActive
              return (
                <button key={t} onClick={() => toggleTrade(t)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${hiddenOnMobile ? 'hidden sm:inline-flex' : ''} ${isActive ? 'bg-teal-50 border-teal-500 text-teal-700 font-semibold' : 'bg-white border-gray-300 text-gray-500 hover:border-teal-400'}`}>
                  {t}
                </button>
              )
            })}
            {trades.length > 8 && (
              <button onClick={() => setShowAllTrades(p => !p)} className="sm:hidden text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-400 hover:border-gray-400">
                {showAllTrades ? 'Show fewer' : `+${trades.length - 8 - selectedTrades.filter(t => trades.indexOf(t) >= 8).length} more`}
              </button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Filter by co-op</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSelectedCoops([])} className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedCoops.length === 0 ? 'bg-teal-50 border-teal-500 text-teal-700 font-semibold' : 'bg-white border-gray-300 text-gray-500 hover:border-teal-400'}`}>All co-ops</button>
            {cooperatives.map(c => {
              const isMember = !selectedEntity || entityMemberships.includes(c.id)
              const isActive = selectedCoops.includes(c.id)
              const s = COOP_STYLES[c.abbreviation] || { bg: '', text: '', border: '' }
              return (
                <button key={c.id} onClick={() => isMember ? toggleCoop(c.id) : undefined} disabled={!isMember}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${!isMember ? 'opacity-30 cursor-not-allowed bg-white border-gray-200 text-gray-400' : ''} ${isMember && !isActive ? 'bg-white border-gray-300 text-gray-500 hover:border-gray-400' : ''} ${isActive ? `${s.bg} ${s.text} ${s.border} font-semibold` : ''}`}>
                  {c.abbreviation === 'NJ State' ? 'NJ State Contract' : c.abbreviation}
                </button>
              )
            })}
            <button onClick={() => toggleCoop('shared-contract')} className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedCoops.includes('shared-contract') ? 'bg-amber-50 border-amber-500 text-amber-700 font-semibold' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'}`}>Shared Contract</button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-500">
            {loading ? 'Searching...' : `${groupedContracts.length} contract${groupedContracts.length !== 1 ? 's' : ''} found`}
            {activeTradeLabel && ` · ${activeTradeLabel}`}
            {activeCoopLabel && ` · ${activeCoopLabel}`}
          </span>
          {selectedEntity && <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg font-semibold">✓ {selectedEntity.name}</span>}
        </div>

        {groupedContracts.length === 0 && !loading ? (
          <div className="text-center py-12 text-gray-400">No contracts match. Try adjusting the filters.</div>
        ) : (
          <>
            {myContracts.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#854F0B' }}>{selectedEntity?.name}'s contracts</span>
                <div className="flex-1 h-px" style={{ backgroundColor: '#EF9F27' }} />
              </div>
            )}
            {myContracts.map(c => renderCard(c))}
            {myContracts.length > 0 && (
              <div className="flex items-center gap-2 mt-4 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">Co-op contracts</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}
            {otherContracts.map(c => renderCard(c))}
          </>
        )}
      </main>

      {selectedVendor && (
        <VendorPanel vendor={selectedVendor} contracts={groupedContracts} entityMemberships={entityMemberships}
          entityName={selectedEntity?.name} onViewLanguage={text => setPiggybackModal(text)} onClose={() => setSelectedVendor(null)} />
      )}

      {piggybackModal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPiggybackModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 rounded-t-xl flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1F3864]">Authorization Language</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => navigator.clipboard.writeText(piggybackModal)} className="text-xs text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 rounded px-2.5 py-1 transition-colors">Copy</button>
                <button onClick={() => setPiggybackModal(null)} className="text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5 text-sm">✕ Close</button>
              </div>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap select-text">{piggybackModal}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
