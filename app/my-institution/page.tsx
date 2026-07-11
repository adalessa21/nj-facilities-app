'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabase-auth'
import { formatDate, daysUntil } from '@/lib/dates'
import { inputCls, labelCls } from '@/lib/ui'
import Link from 'next/link'

const STATUTORY_BASIS_OPTIONS = [
  'DLGS-registered cooperative pricing system',
  'Joint purchasing agreement (N.J.S.A. 40A:11-10)',
  'County cooperative contract purchasing (N.J.S.A. 40A:11-11(6))',
  'Other — describe in notes',
]

const TRADES = [
  'Automotive Parts','Doors & Hardware','Electrical','Elevator','Equipment Rental','Fencing',
  'Fire Alarm','Fire Protection','Fleet Maintenance','Fleet Vehicles','Flooring',
  'Furniture','General Construction','Generator','Grounds','HVAC',
  'Janitorial Supplies','Lighting','MRO Supplies','Painting','Paving',
  'Pest Control','Plumbing','Roofing','Security','Waste & Recycling',
]

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

interface MyContract {
  id: string
  institution_name: string
  vendor_name: string
  trade_category: string
  contract_number: string
  start_date: string
  expiration_date: string
  piggyback_allowed: boolean
  piggyback_language: string
  authorized_users: string
  insurance_requirements: string
  notes: string
  approved_by_admin: boolean
}

interface ContractForm {
  vendor_name: string
  trade_category: string
  contract_number: string
  start_date: string
  expiration_date: string
  piggyback_allowed: boolean
  piggyback_language: string
  authorized_users: string
  statutory_basis: string
  dlgs_registration_number: string
  insurance_requirements: string
  notes: string
}

const emptyContractForm: ContractForm = {
  vendor_name: '',
  trade_category: '',
  contract_number: '',
  start_date: '',
  expiration_date: '',
  piggyback_allowed: true,
  piggyback_language: '',
  authorized_users: '',
  statutory_basis: '',
  dlgs_registration_number: '',
  insurance_requirements: '',
  notes: '',
}

const COOP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ESCNJ:           { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'NJ State':      { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  Sourcewell:      { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  OMNIA:           { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  'Bergen Co-op':  { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  'Hunterdon ESC': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  NASPO:           { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
  'NJ Edge':       { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
}

// inputCls and labelCls imported from @/lib/ui above

export default function MyInstitutionPage() {
  const router = useRouter()

  const [entity, setEntity] = useState<Entity | null>(null)
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([])
  const [selectedCoopIds, setSelectedCoopIds] = useState<string[]>([])
  const [originalCoopIds, setOriginalCoopIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [myContracts, setMyContracts] = useState<MyContract[]>([])
  const [contractMessage, setContractMessage] = useState('')
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [showContractForm, setShowContractForm] = useState(false)
  const [contractForm, setContractForm] = useState<ContractForm>(emptyContractForm)
  const [savingContract, setSavingContract] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabaseAuth.auth.getSession()
      const user = session?.user ?? (await supabaseAuth.auth.getUser()).data.user

      if (!user?.email) { router.replace('/login'); return }
      const domain = user.email.split('@')[1]
      if (!domain) { router.replace('/login'); return }

      const { data: entityData } = await supabase
        .from('entities')
        .select('id, name, type, county')
        .eq('email_domain', domain)
        .maybeSingle()

      if (!entityData) { router.replace('/login'); return }
      setEntity(entityData)

      const [{ data: coops }, { data: memberships }, { data: contracts }] = await Promise.all([
        supabase.from('cooperatives').select('id, name, abbreviation, display_color').order('name'),
        supabase.from('memberships').select('cooperative_id').eq('entity_id', entityData.id),
        supabase.from('institution_contracts').select('*')
          .or(`entity_id.eq.${entityData.id},and(entity_id.is.null,institution_name.eq.${entityData.name})`)
          .order('expiration_date', { ascending: true }),
      ])

      if (coops) setCooperatives(coops)
      const currentIds = (memberships ?? []).map((m: { cooperative_id: string }) => m.cooperative_id)
      setSelectedCoopIds(currentIds)
      setOriginalCoopIds(currentIds)
      if (contracts) setMyContracts(contracts)
      setLoading(false)
    }
    init()
  }, [router])

  async function reloadContracts(entityId: string, entityName: string) {
    const { data } = await supabase
      .from('institution_contracts')
      .select('*')
      .or(`entity_id.eq.${entityId},and(entity_id.is.null,institution_name.eq.${entityName})`)
      .order('expiration_date', { ascending: true })
    if (data) setMyContracts(data)
  }

  // ── Memberships ──────────────────────────────────────────────────────────────

  function toggleCoop(id: string) {
    setSelectedCoopIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setMessage('')
  }

  async function saveMemberships() {
    if (!entity) return
    setSaving(true); setMessage('')

    const toAdd = selectedCoopIds.filter(id => !originalCoopIds.includes(id))
    const toRemove = originalCoopIds.filter(id => !selectedCoopIds.includes(id))

    if (toAdd.length > 0) {
      const { error } = await supabase.from('memberships').upsert(
        toAdd.map(coopId => ({ entity_id: entity.id, cooperative_id: coopId, status: 'confirmed' })),
        { onConflict: 'entity_id,cooperative_id' }
      )
      if (error) { setMessage('Error saving: ' + error.message); setSaving(false); return }
    }
    for (const coopId of toRemove) {
      const { error } = await supabase.from('memberships').delete().eq('entity_id', entity.id).eq('cooperative_id', coopId)
      if (error) { setMessage('Error saving: ' + error.message); setSaving(false); return }
    }

    setOriginalCoopIds(selectedCoopIds)
    setMessage('✓ Memberships saved successfully.')
    setSaving(false)
  }

  // ── Contracts ────────────────────────────────────────────────────────────────

  function openEditContract(c: MyContract) {
    setContractForm({
      vendor_name: c.vendor_name,
      trade_category: c.trade_category,
      contract_number: c.contract_number || '',
      start_date: c.start_date ? c.start_date.split('T')[0] : '',
      expiration_date: c.expiration_date ? c.expiration_date.split('T')[0] : '',
      piggyback_allowed: c.piggyback_allowed,
      piggyback_language: c.piggyback_language || '',
      authorized_users: c.authorized_users || '',
      statutory_basis: (c as any).statutory_basis || '',
      dlgs_registration_number: (c as any).dlgs_registration_number || '',
      insurance_requirements: c.insurance_requirements || '',
      notes: c.notes || '',
    })
    setEditingContractId(c.id)
    setShowContractForm(true)
    setContractMessage('')
  }

  function openAddContract() {
    setContractForm(emptyContractForm)
    setEditingContractId(null)
    setShowContractForm(true)
    setContractMessage('')
  }

  function cancelContractForm() {
    setShowContractForm(false)
    setEditingContractId(null)
    setContractForm(emptyContractForm)
  }

  async function saveContract() {
    if (!entity) return
    if (!contractForm.vendor_name || !contractForm.expiration_date) {
      setContractMessage('Vendor name and expiration date are required.')
      return
    }
    setSavingContract(true); setContractMessage('')

    const payload = {
      institution_name: entity.name,
      entity_id: entity.id,
      vendor_name: contractForm.vendor_name,
      trade_category: contractForm.trade_category,
      contract_number: contractForm.contract_number || null,
      start_date: contractForm.start_date || null,
      expiration_date: contractForm.expiration_date,
      piggyback_allowed: contractForm.piggyback_allowed,
      piggyback_language: contractForm.piggyback_language || null,
      authorized_users: contractForm.authorized_users || null,
      statutory_basis: contractForm.statutory_basis || null,
      dlgs_registration_number: contractForm.dlgs_registration_number || null,
      insurance_requirements: contractForm.insurance_requirements || null,
      notes: contractForm.notes || null,
    }

    let error
    if (editingContractId) {
      ;({ error } = await supabase.from('institution_contracts').update(payload).eq('id', editingContractId))
    } else {
      ;({ error } = await supabase.from('institution_contracts').insert({ ...payload, submitter_name: null, submitter_email: null }))
    }

    setSavingContract(false)
    if (error) { setContractMessage('Error: ' + error.message); return }

    setContractMessage(editingContractId
      ? '✓ Contract updated. Changes will appear on the platform once reviewed by an admin.'
      : '✓ Contract submitted for review. It will appear on the platform once approved by an admin.'
    )
    cancelContractForm()
    await reloadContracts(entity.id, entity.name)
  }

  async function deleteContract(id: string, vendorName: string) {
    if (!confirm(`Delete the contract for "${vendorName}"? This cannot be undone.`)) return
    const { error } = await supabase.from('institution_contracts').delete().eq('id', id)
    if (error) { setContractMessage('Error: ' + error.message); return }
    setContractMessage('✓ Contract deleted.')
    if (entity) await reloadContracts(entity.id, entity.name)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (!entity) return null

  const hasCoopChanges = selectedCoopIds.length !== originalCoopIds.length || selectedCoopIds.some(id => !originalCoopIds.includes(id))


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864] text-white">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Facilities Procurement Platform</div>
          <h1 className="text-xl font-bold">My Institution</h1>
          <p className="text-white/60 text-sm mt-1">{entity.name}</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
          ← Back to platform
        </Link>

        {/* Co-op Memberships */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
          <h2 className="font-bold text-gray-800 mb-1">Co-op Memberships</h2>
          <p className="text-sm text-gray-500 mb-4">
            Check the cooperatives your institution belongs to. This controls which contracts appear when you're signed in.
          </p>

          {message && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {cooperatives.map(c => {
              const isChecked = selectedCoopIds.includes(c.id)
              const s = COOP_STYLES[c.abbreviation] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? `${s.bg} ${s.border}` : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                >
                  <input type="checkbox" checked={isChecked} onChange={() => toggleCoop(c.id)} className="w-4 h-4 accent-teal-600" />
                  <div>
                    <div className={`text-sm font-semibold ${isChecked ? s.text : 'text-gray-700'}`}>
                      {c.abbreviation === 'NJ State' ? 'NJ State Contract' : c.abbreviation}
                    </div>
                    <div className="text-xs text-gray-400">{c.name}</div>
                  </div>
                </label>
              )
            })}
          </div>

          <button
            onClick={saveMemberships}
            disabled={saving || !hasCoopChanges}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Memberships'}
          </button>
          {!hasCoopChanges && !saving && <span className="ml-3 text-xs text-gray-400">No changes to save</span>}
        </div>

        {/* My Shared Contracts */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-gray-800">My Shared Contracts</h2>
            <button
              onClick={openAddContract}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              + Add Shared Contract
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            On-call contracts your institution has shared with the NJ procurement network.
          </p>

          {contractMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${contractMessage.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {contractMessage}
            </div>
          )}

          {myContracts.length === 0 && !showContractForm ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No shared contracts yet. Add one to let other institutions use your on-call vendors.
            </div>
          ) : (
            <>
              {/* Mobile cards — hidden on sm:+ */}
              <div className="sm:hidden space-y-3 mb-4">
                {myContracts.map(c => {
                  const days = daysUntil(c.expiration_date)
                  const exp = formatDate(c.expiration_date)
                  return (
                    <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <div className="font-medium text-gray-800 text-sm">{c.vendor_name}</div>
                          {c.contract_number && <div className="text-xs text-gray-400 font-mono">{c.contract_number}</div>}
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${c.piggyback_allowed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {c.piggyback_allowed ? 'Sharing on' : 'No sharing'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">{c.trade_category}</div>
                      <div className="text-xs text-gray-600 mb-2">
                        Expires {exp}
                        {days === 0 && <span className="text-amber-600 font-medium"> · expires today</span>}
                        {days > 0 && days < 90 && <span className="text-amber-600 font-medium"> · {days} days left</span>}
                        {days < 0 && <span className="text-red-600 font-medium"> · Expired</span>}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => openEditContract(c)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                        <button onClick={() => deleteContract(c.id, c.vendor_name)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table — hidden below sm: */}
              <div className="hidden sm:block border border-gray-200 rounded-xl overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendor</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Trade</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Expires</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Sharing</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {myContracts.map((c, i) => {
                      const days = daysUntil(c.expiration_date)
                      const exp = formatDate(c.expiration_date)
                      const isEditing = editingContractId === c.id
                      return (
                        <tr key={c.id} className={`border-b border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{c.vendor_name}</div>
                            {c.contract_number && <div className="text-xs text-gray-400 font-mono">{c.contract_number}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{c.trade_category}</td>
                          <td className="px-4 py-3">
                            <div className="text-gray-600 text-xs">{exp}</div>
                            {days === 0 && <div className="text-xs text-amber-600 font-medium">expires today</div>}
                            {days > 0 && days < 90 && <div className="text-xs text-amber-600 font-medium">{days} days left</div>}
                            {days < 0 && <div className="text-xs text-red-600 font-medium">Expired</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.piggyback_allowed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {c.piggyback_allowed ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => openEditContract(c)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                              <button onClick={() => deleteContract(c.id, c.vendor_name)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Inline add / edit form */}
          {showContractForm && (
            <div className="border border-amber-200 rounded-xl p-5 bg-amber-50/20">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-gray-800">{editingContractId ? 'Edit Contract' : 'Add Shared Contract'}</h3>
                <button onClick={cancelContractForm} className="text-gray-400 hover:text-gray-600 text-sm border border-gray-200 rounded px-2 py-0.5">✕ Cancel</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelCls}>Vendor Name *</label>
                  <input type="text" value={contractForm.vendor_name}
                    onChange={e => setContractForm(f => ({ ...f, vendor_name: e.target.value }))}
                    placeholder="e.g. ABC Mechanical Inc." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Trade Category</label>
                  <select value={contractForm.trade_category}
                    onChange={e => setContractForm(f => ({ ...f, trade_category: e.target.value }))}
                    className={inputCls}>
                    <option value="">Select trade...</option>
                    {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Contract Number</label>
                  <input type="text" value={contractForm.contract_number}
                    onChange={e => setContractForm(f => ({ ...f, contract_number: e.target.value }))}
                    placeholder="e.g. RU-2024-HVAC-001" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Expiration Date *</label>
                  <input type="date" value={contractForm.expiration_date}
                    onChange={e => setContractForm(f => ({ ...f, expiration_date: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input type="date" value={contractForm.start_date}
                    onChange={e => setContractForm(f => ({ ...f, start_date: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Sharing Allowed</label>
                  <div className="flex gap-3 mt-1">
                    <button type="button"
                      onClick={() => setContractForm(f => ({ ...f, piggyback_allowed: true }))}
                      className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${contractForm.piggyback_allowed ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-300 text-gray-500'}`}>
                      Yes
                    </button>
                    <button type="button"
                      onClick={() => setContractForm(f => ({ ...f, piggyback_allowed: false }))}
                      className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${!contractForm.piggyback_allowed ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-gray-300 text-gray-500'}`}>
                      No
                    </button>
                  </div>
                </div>
                <div className="col-span-full">
                  <label className={labelCls}>Statutory Basis *</label>
                  <select value={contractForm.statutory_basis}
                    onChange={e => setContractForm(f => ({ ...f, statutory_basis: e.target.value }))}
                    className={inputCls}>
                    <option value="" disabled>Select statutory basis...</option>
                    {STATUTORY_BASIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">NJ law generally requires inter-entity purchasing to run through mechanisms approved by the Division of Local Government Services. Consult your purchasing counsel.</p>
                </div>
                {contractForm.statutory_basis === STATUTORY_BASIS_OPTIONS[0] && (
                  <div className="col-span-full">
                    <label className={labelCls}>DLGS Registration Number</label>
                    <input type="text" value={contractForm.dlgs_registration_number}
                      onChange={e => setContractForm(f => ({ ...f, dlgs_registration_number: e.target.value }))}
                      placeholder="e.g. CPS-12345" className={inputCls} />
                  </div>
                )}
                <div className="col-span-full">
                  <label className={labelCls}>Authorization Language</label>
                  <textarea value={contractForm.piggyback_language}
                    onChange={e => setContractForm(f => ({ ...f, piggyback_language: e.target.value }))}
                    placeholder="Paste the contract language that authorizes shared use..."
                    rows={3} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Insurance Requirements</label>
                  <input type="text" value={contractForm.insurance_requirements}
                    onChange={e => setContractForm(f => ({ ...f, insurance_requirements: e.target.value }))}
                    placeholder="e.g. $1M general liability" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea value={contractForm.notes}
                    onChange={e => setContractForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} className={inputCls} />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveContract}
                  disabled={savingContract}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
                >
                  {savingContract ? 'Saving…' : editingContractId ? 'Save Changes' : 'Add Contract'}
                </button>
                <button onClick={cancelContractForm} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
