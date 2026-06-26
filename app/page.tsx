'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Entity {
  id: string
  name: string
  type: string
  county: string
}

interface Cooperative {
  id: string
  name: string
  abbreviation: string
  display_color: string
}

interface Vendor {
  id: string
  company_name: string
  phone: string
  email: string
  website: string
  listing_tier: string
}

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

interface Membership {
  cooperative_id: string
}

// ── Co-op color map ───────────────────────────────────────────────────────────
const COOP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ESCNJ:          { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'NJ State':     { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  Sourcewell:     { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300' },
  OMNIA:          { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  'Bergen Co-op': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  'Hunterdon ESC':{ bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  NASPO:          { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  'NJ Edge':      { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300' },
}

function CoopBadge({ abbr, name }: { abbr: string; name: string }) {
  const s = COOP_STYLES[abbr] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' }
  const label = abbr === 'NJ State' ? 'NJ State Contract' : abbr
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
      {label}
    </span>
  )
}

// ── Days until expiration ─────────────────────────────────────────────────────
function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

// ── Vendor Detail Panel ───────────────────────────────────────────────────────
function VendorPanel({
  vendor,
  contracts,
  entityMemberships,
  onClose,
}: {
  vendor: Vendor
  contracts: Contract[]
  entityMemberships: string[]
  onClose: () => void
}) {
  const normalizedContracts = contracts.map(c => ({
  ...c,
  cooperatives: Array.isArray(c.cooperatives) ? c.cooperatives[0] : c.cooperatives
}))
const eligible = normalizedContracts.filter(c => entityMemberships.includes(c.cooperative_id))
const ineligible = normalizedContracts.filter(c => !entityMemberships.includes(c.cooperative_id))
const trades = [...new Set(normalizedContracts.map(c => c.trade_category))]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 rounded-t-xl">
          <button onClick={onClose} className="float-right text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5 text-sm">✕ Close</button>
          <h2 className="text-lg font-bold text-navy pr-8">{vendor.company_name}</h2>
          <div className="flex flex-wrap gap-1 mt-1">
            {trades.map(t => (
              <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t}</span>
            ))}
          </div>
        </div>

        <div className="px-5 py-4">
          {/* Eligibility check */}
          <div className="flex items-center gap-2 bg-green-50 text-green-800 text-sm px-3 py-2 rounded-lg mb-4">
            <span className="text-base">✓</span>
            <span>Available via <strong>{eligible.length}</strong> cooperative contract{eligible.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Contact info */}
          <div className="flex flex-wrap gap-2 mb-4">
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`} className="flex items-center gap-1.5 text-xs bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
                📞 {vendor.phone}
              </a>
            )}
            {vendor.email && (
              <a href={`mailto:${vendor.email}`} className="flex items-center gap-1.5 text-xs bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
                ✉️ {vendor.email}
              </a>
            )}
            {vendor.website && (
              <a href={`https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
                🌐 {vendor.website}
              </a>
            )}
          </div>

          {/* Eligible contracts */}
          {eligible.length > 0 && (
            <>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contracts your institution can use</div>
              {eligible.map(c => {
                const days = daysUntil(c.expiration_date)
                const exp = new Date(c.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                return (
                  <div key={c.id} className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{c.contract_name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <CoopBadge abbr={c.cooperatives.abbreviation} name={c.cooperatives.name} />
                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{c.contract_number}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Expires {exp}
                        {days < 180 && days > 0 && <span className="text-amber-600 font-medium"> · {days} days left</span>}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.status === 'active' ? 'Active' : 'Extended'}
                    </span>
                  </div>
                )
              })}
            </>
          )}

          {/* Ineligible contracts */}
          {ineligible.length > 0 && (
            <>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Also holds — requires different co-op membership</div>
              {ineligible.map(c => (
                <div key={c.id} className="flex items-start justify-between mb-2 pb-2 border-b border-gray-100 last:border-0 opacity-40">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{c.contract_name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <CoopBadge abbr={c.cooperatives.abbreviation} name={c.cooperatives.name} />
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{c.contract_number}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">Not eligible</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="px-5 pb-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
          Sources: ESCNJ · NJ State Contract · Sourcewell · OMNIA Partners · Bergen Co-op · Hunterdon ESC · NASPO · NJ Edge · Verified June 2026
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [trades, setTrades] = useState<string[]>([])

  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [entityMemberships, setEntityMemberships] = useState<string[]>([])
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null)
  const [selectedCoop, setSelectedCoop] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [vendorContracts, setVendorContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(false)

  // Load initial data
 useEffect(() => {
    async function load() {
      const [{ data: ents }, { data: coops }] = await Promise.all([
        supabase.from('entities').select('id, name, type, county').order('type').order('name'),
        supabase.from('cooperatives').select('id, name, abbreviation, display_color').order('name'),
      ])
      if (ents) setEntities(ents)
      if (coops) setCooperatives(coops)
    }
    load()
  }, [])

  // Load memberships when entity changes
  useEffect(() => {
    if (!selectedEntity) {
      setEntityMemberships([])
      setContracts([])
      setTrades([])
      return
    }
    async function loadMemberships() {
      const { data } = await supabase
        .from('memberships')
        .select('cooperative_id')
        .eq('entity_id', selectedEntity!.id)
        .eq('status', 'confirmed')
      if (data) setEntityMemberships(data.map((m: Membership) => m.cooperative_id))
    }
    loadMemberships()
  }, [selectedEntity])

  // Search contracts
  const search = useCallback(async () => {
    if (!selectedEntity || entityMemberships.length === 0) return
    setLoading(true)

    let q = supabase
      .from('contracts')
      .select(`
        id, contract_name, contract_number, trade_category,
        status, expiration_date, notes, cooperative_id,
        vendors ( id, company_name, phone, email, website, listing_tier ),
        cooperatives ( id, name, abbreviation, display_color )
      `)
      .in('cooperative_id', entityMemberships)
      .in('status', ['active', 'extended'])
      .order('expiration_date', { ascending: true })

    if (selectedTrade) q = q.eq('trade_category', selectedTrade)
    if (selectedCoop) q = q.eq('cooperative_id', selectedCoop)
    if (query.trim()) {
      q = q.or(`contract_name.ilike.%${query}%,contract_number.ilike.%${query}%,trade_category.ilike.%${query}%`)
    }

    const { data, error } = await q
    if (error) console.error(error)
    if (data) {
      setContracts(data as unknown as Contract[])
      const uniqueTrades = [...new Set(data.map((c: Contract) => c.trade_category))].sort()
      setTrades(uniqueTrades as string[])
    }
    setLoading(false)
  }, [selectedEntity, entityMemberships, selectedTrade, selectedCoop, query])

  useEffect(() => { search() }, [search])

  // Open vendor panel
  async function openVendor(vendor: Vendor) {
    setSelectedVendor(vendor)
    const { data } = await supabase
      .from('contracts')
      .select(`
        id, contract_name, contract_number, trade_category,
        status, expiration_date, cooperative_id,
        cooperatives ( id, name, abbreviation, display_color )
      `)
      .eq('vendor_id', vendor.id)
      .in('status', ['active', 'extended'])
    if (data) setVendorContracts(data as unknown as Contract[])
  }

  // Grouped entities for dropdown
  const grouped = {
    university: entities.filter(e => e.type === 'university'),
    county_college: entities.filter(e => e.type === 'county_college'),
    county_gov: entities.filter(e => e.type === 'county_gov'),
  }

  // Stats
  const vendorSet = new Set(contracts.map(c => c.vendors?.id).filter(Boolean))
  const coopSet = new Set(contracts.map(c => c.cooperative_id))

  // Accessible co-ops (entity is a member)
  const accessibleCoops = cooperatives.filter(c => entityMemberships.includes(c.id))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1F3864] text-white">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Facilities Procurement Platform · Beta</div>
          <h1 className="text-xl font-bold">
            Can <span className="text-[#4ecba0]" id="entity-display">{selectedEntity?.name || 'your institution'}</span> use this vendor?
          </h1>
          <p className="text-white/60 text-sm mt-1">
            ESCNJ · NJ State Contract · Sourcewell · OMNIA · Bergen Co-op · Hunterdon ESC · NASPO · NJ Edge
          </p>
        </div>
      </header>

      {/* Search bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex gap-2">
          <select
            className="h-10 border border-gray-300 rounded-lg px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[260px]"
            value={selectedEntity?.id || ''}
            onChange={e => {
              const ent = entities.find(en => en.id === e.target.value) || null
              setSelectedEntity(ent)
              setSelectedTrade(null)
              setSelectedCoop(null)
              setQuery('')
            }}
          >
            <option value="">Select your institution...</option>
            <optgroup label="Public Universities">
              {grouped.university.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
            <optgroup label="County Colleges">
              {grouped.county_college.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
            <optgroup label="County Governments">
              {grouped.county_gov.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
          </select>

          <input
            type="text"
            placeholder="Search vendor, trade, or contract #..."
            className="flex-1 h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-5">
        {!selectedEntity ? (
          /* Intro screen */
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mt-4">
            <div className="text-4xl mb-3">🏛️</div>
            <h2 className="text-lg font-bold text-[#1F3864] mb-2">Find compliant vendors in seconds</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
              Select your institution above to instantly see every vendor available through your cooperative purchasing memberships.
            </p>
            <ul className="text-left inline-block mt-4 text-sm text-gray-500 space-y-1.5">
              <li>✓ Real contracts across 8 co-ops</li>
              <li>✓ 28 NJ public institutions</li>
              <li>✓ Filter by trade and by cooperative</li>
              <li>✓ Vendor phone, email & website</li>
              <li>✓ Free for all NJ public institutions</li>
            </ul>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { n: contracts.length, l: 'contracts available' },
                { n: vendorSet.size, l: 'vendors available' },
                { n: coopSet.size, l: 'co-ops accessible' },
              ].map(s => (
                <div key={s.l} className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-2xl font-bold text-[#1F3864]">{loading ? '…' : s.n}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>

            {/* Trade filter */}
            <div className="mb-1">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Filter by trade</div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={() => setSelectedTrade(null)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedTrade === null ? 'bg-teal-50 border-teal-500 text-teal-700 font-semibold' : 'bg-white border-gray-300 text-gray-500 hover:border-teal-400'}`}
                >
                  All trades
                </button>
                {trades.map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedTrade(t === selectedTrade ? null : t)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedTrade === t ? 'bg-teal-50 border-teal-500 text-teal-700 font-semibold' : 'bg-white border-gray-300 text-gray-500 hover:border-teal-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Co-op filter */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Filter by co-op</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCoop(null)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedCoop === null ? 'bg-teal-50 border-teal-500 text-teal-700 font-semibold' : 'bg-white border-gray-300 text-gray-500 hover:border-teal-400'}`}
                >
                  All co-ops
                </button>
                {cooperatives.map(c => {
                  const isMember = entityMemberships.includes(c.id)
                  const isActive = selectedCoop === c.id
                  const abbr = c.abbreviation
                  const s = COOP_STYLES[abbr] || { bg: '', text: '', border: '' }
                  return (
                    <button
                      key={c.id}
                      onClick={() => isMember ? setSelectedCoop(c.id === selectedCoop ? null : c.id) : null}
                      disabled={!isMember}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all
                        ${!isMember ? 'opacity-30 cursor-not-allowed bg-white border-gray-200 text-gray-400' : ''}
                        ${isMember && !isActive ? 'bg-white border-gray-300 text-gray-500 hover:border-gray-400' : ''}
                        ${isActive ? `${s.bg} ${s.text} ${s.border} font-semibold` : ''}
                      `}
                    >
                      {abbr === 'NJ State' ? 'NJ State Contract' : abbr}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Results header */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-500">
                {loading ? 'Searching...' : `${contracts.length} contract${contracts.length !== 1 ? 's' : ''} found`}
                {selectedTrade && ` · ${selectedTrade}`}
                {selectedCoop && ` · ${cooperatives.find(c => c.id === selectedCoop)?.abbreviation}`}
              </span>
              <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg font-semibold">
                ✓ {selectedEntity.name}
              </span>
            </div>

            {/* Contract cards */}
            {contracts.length === 0 && !loading ? (
              <div className="text-center py-12 text-gray-400">No contracts match. Try adjusting the filters.</div>
            ) : (
              contracts.map(c => {
                const vendor = Array.isArray(c.vendors) ? c.vendors[0] : c.vendors
                const coop = Array.isArray(c.cooperatives) ? c.cooperatives[0] : c.cooperatives
                const days = daysUntil(c.expiration_date)
                const exp = new Date(c.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const isPending = !vendor || vendor.company_name.startsWith('[')

                return (
                  <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 mb-2 hover:border-teal-400 transition-colors">
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div>
                        <div className="font-bold text-sm text-gray-800">{c.contract_name}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{c.trade_category}</span>
                          {coop && <CoopBadge abbr={coop.abbreviation} name={coop.name} />}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.status === 'active' ? 'Active' : 'Extended'}
                      </span>
                    </div>

                    <div className="flex gap-4 text-xs text-gray-400 mb-2">
                      <span>📄 {c.contract_number}</span>
                      <span>
                        📅 Expires {exp}
                        {days < 180 && days > 0 && <span className="text-amber-600 font-medium"> · {days} days left</span>}
                        {days <= 0 && <span className="text-red-600 font-medium"> · EXPIRED</span>}
                      </span>
                    </div>

                    {c.notes && <div className="text-xs text-gray-400 mb-2">{c.notes}</div>}

                    <div className="text-xs text-gray-500 mb-2">
                      <span className="font-semibold text-gray-700">Vendors: </span>
                      {isPending ? (
                        <span className="text-gray-300">Verification in progress</span>
                      ) : (
                        <button
                          onClick={() => openVendor(vendor)}
                          className="text-teal-600 underline underline-offset-2 hover:text-teal-800"
                        >
                          {vendor.company_name}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                      <span>✓</span>
                      <span>
                        {selectedEntity.name} eligible via {coop?.abbreviation === 'NJ State' ? 'NJ State Contract' : coop?.abbreviation} — competitively bid cooperative pricing
                      </span>
                      {!isPending && (
                        <button
                          onClick={() => openVendor(vendor)}
                          className="ml-auto text-teal-600 underline underline-offset-2 hover:text-teal-800 whitespace-nowrap"
                        >
                          View profile →
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </main>

      {/* Vendor panel */}
      {selectedVendor && (
        <VendorPanel
          vendor={selectedVendor}
          contracts={vendorContracts}
          entityMemberships={entityMemberships}
          onClose={() => { setSelectedVendor(null); setVendorContracts([]) }}
        />
      )}
    </div>
  )
}
