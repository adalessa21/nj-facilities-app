'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const TRADES = [
  'Automotive Parts','Doors & Hardware','Electrical','Elevator','Equipment Rental','Fencing',
  'Fire Alarm','Fire Protection','Fleet Maintenance','Fleet Vehicles','Flooring',
  'Furniture','General Construction','Generator','Grounds','HVAC',
  'Janitorial Supplies','Lighting','MRO Supplies','Painting','Paving',
  'Pest Control','Plumbing','Roofing','Security','Waste & Recycling',
]

const INSTITUTIONS = {
  'Public Universities': [
    'NJIT','Ramapo College of NJ','Rutgers University','Montclair State University',
    'Rowan University','Kean University','The College of New Jersey','Stockton University',
    'William Paterson University','NJ City University',
  ],
  'County Colleges': [
    'Bergen Community College','Brookdale Community College','Middlesex College',
    'Ocean County College','Raritan Valley CC','County College of Morris',
    'Mercer County Community College','Union County College','Essex County College',
    'Passaic County Community College',
  ],
  'County Governments': [
    'Bergen County','Hunterdon County','Morris County','Essex County',
    'Middlesex County','Union County','Monmouth County','Ocean County',
  ],
}

const ALL_INSTITUTIONS = Object.values(INSTITUTIONS).flat()

interface InstitutionContract {
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
  submitter_name: string
  submitter_email: string
  approved_by_admin: boolean
  created_at: string
}

interface EditForm {
  institution_name: string
  vendor_name: string
  trade_category: string
  contract_number: string
  start_date: string
  expiration_date: string
  piggyback_allowed: boolean
  // 'Any NJ public entity' | 'Specific institutions only'
  authorized_users_mode: string
  piggyback_language: string
  insurance_requirements: string
  notes: string
  submitter_name: string
  submitter_email: string
}

const emptyForm: EditForm = {
  institution_name: '',
  vendor_name: '',
  trade_category: '',
  contract_number: '',
  start_date: '',
  expiration_date: '',
  piggyback_allowed: true,
  authorized_users_mode: 'Any NJ public entity',
  piggyback_language: '',
  insurance_requirements: '',
  notes: '',
  submitter_name: '',
  submitter_email: '',
}

export default function AdminInstitutionContracts() {
  const [contracts, setContracts] = useState<InstitutionContract[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all')
  const [message, setMessage] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state — shared by add and edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>(emptyForm)
  const [editSelectedInstitutions, setEditSelectedInstitutions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const showForm = addMode || editingId !== null

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('institution_contracts')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setContracts(data)
    setLoading(false)
  }

  async function approve(id: string) {
    const { error } = await supabase
      .from('institution_contracts')
      .update({ approved_by_admin: true })
      .eq('id', id)
    if (error) { setMessage('Error: ' + error.message); return }
    setMessage('✓ Contract approved and now visible on the platform.')
    loadData()
  }

  async function reject(id: string, name: string) {
    if (!confirm(`Reject and delete "${name}"? This cannot be undone.`)) return
    const { error } = await supabase
      .from('institution_contracts')
      .delete()
      .eq('id', id)
    if (error) { setMessage('Error: ' + error.message); return }
    setMessage('✓ Contract rejected and removed.')
    if (editingId === id) cancelForm()
    if (expandedId === id) setExpandedId(null)
    loadData()
  }

  // Determine whether an authorized_users string is specific institutions or "Any NJ public entity"
  function parseAuthorizedUsers(value: string): { mode: string; selected: string[] } {
    if (!value || value === 'Any NJ public entity') {
      return { mode: 'Any NJ public entity', selected: [] }
    }
    // If the value contains known institution names, treat as specific
    const names = value.split(',').map(s => s.trim()).filter(Boolean)
    const knownNames = names.filter(n => ALL_INSTITUTIONS.includes(n))
    if (knownNames.length > 0) {
      return { mode: 'Specific institutions only', selected: knownNames }
    }
    // Unknown format — show as-is in "Any" mode
    return { mode: 'Any NJ public entity', selected: [] }
  }

  function openEdit(c: InstitutionContract) {
    const { mode, selected } = parseAuthorizedUsers(c.authorized_users)
    setEditForm({
      institution_name: c.institution_name,
      vendor_name: c.vendor_name,
      trade_category: c.trade_category,
      contract_number: c.contract_number || '',
      start_date: c.start_date ? c.start_date.split('T')[0] : '',
      expiration_date: c.expiration_date ? c.expiration_date.split('T')[0] : '',
      piggyback_allowed: c.piggyback_allowed,
      authorized_users_mode: mode,
      piggyback_language: c.piggyback_language || '',
      insurance_requirements: c.insurance_requirements || '',
      notes: c.notes || '',
      submitter_name: c.submitter_name || '',
      submitter_email: c.submitter_email || '',
    })
    setEditSelectedInstitutions(selected)
    setEditingId(c.id)
    setAddMode(false)
    setExpandedId(null)
    setMessage('')
  }

  function openAdd() {
    setEditForm(emptyForm)
    setEditSelectedInstitutions([])
    setEditingId(null)
    setAddMode(true)
    setExpandedId(null)
    setMessage('')
  }

  function cancelForm() {
    setEditingId(null)
    setAddMode(false)
    setEditForm(emptyForm)
    setEditSelectedInstitutions([])
  }

  function buildAuthorizedUsersValue(): string {
    if (editForm.authorized_users_mode === 'Specific institutions only') {
      return editSelectedInstitutions.join(', ')
    }
    return 'Any NJ public entity'
  }

  async function saveEdit() {
    if (!editForm.institution_name || !editForm.vendor_name || !editForm.expiration_date) {
      setMessage('Institution name, vendor name, and expiration date are required.')
      return
    }
    if (editForm.authorized_users_mode === 'Specific institutions only' && editSelectedInstitutions.length === 0) {
      setMessage('Please select at least one authorized institution.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('institution_contracts')
      .update({
        institution_name: editForm.institution_name,
        vendor_name: editForm.vendor_name,
        trade_category: editForm.trade_category,
        contract_number: editForm.contract_number || null,
        start_date: editForm.start_date || null,
        expiration_date: editForm.expiration_date,
        piggyback_allowed: editForm.piggyback_allowed,
        authorized_users: buildAuthorizedUsersValue(),
        piggyback_language: editForm.piggyback_language || null,
        insurance_requirements: editForm.insurance_requirements || null,
        notes: editForm.notes || null,
        submitter_name: editForm.submitter_name || null,
        submitter_email: editForm.submitter_email || null,
      })
      .eq('id', editingId!)
    setSaving(false)
    if (error) { setMessage('Error: ' + error.message); return }
    setMessage('✓ Contract updated successfully.')
    cancelForm()
    loadData()
  }

  async function saveAdd() {
    if (!editForm.institution_name || !editForm.vendor_name || !editForm.expiration_date) {
      setMessage('Institution name, vendor name, and expiration date are required.')
      return
    }
    if (editForm.authorized_users_mode === 'Specific institutions only' && editSelectedInstitutions.length === 0) {
      setMessage('Please select at least one authorized institution.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('institution_contracts')
      .insert({
        institution_name: editForm.institution_name,
        vendor_name: editForm.vendor_name,
        trade_category: editForm.trade_category,
        contract_number: editForm.contract_number || null,
        start_date: editForm.start_date || null,
        expiration_date: editForm.expiration_date,
        piggyback_allowed: editForm.piggyback_allowed,
        authorized_users: buildAuthorizedUsersValue(),
        piggyback_language: editForm.piggyback_language || null,
        insurance_requirements: editForm.insurance_requirements || null,
        notes: editForm.notes || null,
        submitter_name: editForm.submitter_name || null,
        submitter_email: editForm.submitter_email || null,
        approved_by_admin: false,
      })
    setSaving(false)
    if (error) { setMessage('Error: ' + error.message); return }
    setMessage('✓ Contract added and is now in the pending queue.')
    cancelForm()
    loadData()
  }

  const filtered = contracts.filter(c => {
    if (filterStatus === 'pending') return !c.approved_by_admin
    if (filterStatus === 'approved') return c.approved_by_admin
    return true
  })

  const pendingCount = contracts.filter(c => !c.approved_by_admin).length

  function daysUntil(d: string) {
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'
  const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1'

  // Shared form body — used for both add and edit
  function FormPanel() {
    return (
      <div className={`mt-4 bg-white border rounded-xl p-5 ${addMode ? 'border-gray-200' : 'border-amber-200'}`}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-gray-800">{addMode ? 'Add Contract' : 'Edit Contract'}</h3>
          <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600 text-sm border border-gray-200 rounded px-2 py-0.5">✕ Cancel</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Institution Name *</label>
            <input type="text" value={editForm.institution_name}
              onChange={e => setEditForm(f => ({ ...f, institution_name: e.target.value }))}
              placeholder="e.g. Rutgers University" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Vendor Name *</label>
            <input type="text" value={editForm.vendor_name}
              onChange={e => setEditForm(f => ({ ...f, vendor_name: e.target.value }))}
              placeholder="e.g. ABC Mechanical Inc." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Trade Category</label>
            <select value={editForm.trade_category}
              onChange={e => setEditForm(f => ({ ...f, trade_category: e.target.value }))}
              className={inputCls}>
              <option value="">Select trade...</option>
              {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Bid / Contract Number</label>
            <input type="text" value={editForm.contract_number}
              onChange={e => setEditForm(f => ({ ...f, contract_number: e.target.value }))}
              placeholder="e.g. RU-2024-HVAC-001" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Contract Start Date</label>
            <input type="date" value={editForm.start_date}
              onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Contract Expiration Date *</label>
            <input type="date" value={editForm.expiration_date}
              onChange={e => setEditForm(f => ({ ...f, expiration_date: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Piggyback Allowed</label>
            <div className="flex items-center gap-3 mt-1">
              <button type="button"
                onClick={() => setEditForm(f => ({ ...f, piggyback_allowed: true }))}
                className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${editForm.piggyback_allowed ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                Yes
              </button>
              <button type="button"
                onClick={() => setEditForm(f => ({ ...f, piggyback_allowed: false }))}
                className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${!editForm.piggyback_allowed ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                No
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Authorized Users</label>
            <select
              value={editForm.authorized_users_mode}
              onChange={e => {
                setEditForm(f => ({ ...f, authorized_users_mode: e.target.value }))
                if (e.target.value === 'Any NJ public entity') setEditSelectedInstitutions([])
              }}
              className={inputCls}>
              <option value="Any NJ public entity">Any NJ public entity</option>
              <option value="Specific institutions only">Specific institutions only</option>
            </select>
          </div>

          {editForm.authorized_users_mode === 'Specific institutions only' && (
            <div className="col-span-2">
              <label className={labelCls}>
                Authorized Institutions <span className="text-gray-400 font-normal normal-case">({editSelectedInstitutions.length} selected)</span>
              </label>
              <div className="flex gap-2 mb-3">
                <button type="button"
                  onClick={() => setEditSelectedInstitutions([...ALL_INSTITUTIONS])}
                  className="text-xs text-green-700 hover:text-green-900 font-medium bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  Select all
                </button>
                <button type="button"
                  onClick={() => setEditSelectedInstitutions([])}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                  Clear all
                </button>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 max-h-[380px] overflow-y-auto space-y-4">
                {(Object.entries(INSTITUTIONS) as [string, string[]][]).map(([group, names]) => (
                  <div key={group}>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{group}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {names.map(name => {
                        const isChecked = editSelectedInstitutions.includes(name)
                        return (
                          <label key={name}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                            <input type="checkbox" checked={isChecked}
                              onChange={() => setEditSelectedInstitutions(prev =>
                                prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
                              )}
                              className="w-4 h-4 accent-green-600" />
                            <span className={`text-sm ${isChecked ? 'font-semibold text-green-800' : 'text-gray-700'}`}>{name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="col-span-2">
            <label className={labelCls}>Piggyback Language</label>
            <textarea value={editForm.piggyback_language}
              onChange={e => setEditForm(f => ({ ...f, piggyback_language: e.target.value }))}
              placeholder="Paste the contract language that authorizes piggyback use..."
              rows={3} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Insurance Requirements</label>
            <input type="text" value={editForm.insurance_requirements}
              onChange={e => setEditForm(f => ({ ...f, insurance_requirements: e.target.value }))}
              placeholder="e.g. $1M general liability, $2M umbrella" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Submitter Name</label>
            <input type="text" value={editForm.submitter_name}
              onChange={e => setEditForm(f => ({ ...f, submitter_name: e.target.value }))}
              placeholder="e.g. John Smith" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Submitter Email</label>
            <input type="email" value={editForm.submitter_email}
              onChange={e => setEditForm(f => ({ ...f, submitter_email: e.target.value }))}
              placeholder="e.g. jsmith@rutgers.edu" className={inputCls} />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={addMode ? saveAdd : saveEdit}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
          >
            {saving ? 'Saving...' : addMode ? 'Add Contract' : 'Save Changes'}
          </button>
          <button onClick={cancelForm}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">Admin Portal</div>
          <h1 className="text-2xl font-bold">Institution Contracts</h1>
          <p className="text-white/60 text-sm mt-1">
            Review piggybacked on-call contracts submitted by NJ institutions — {contracts.length} total · {pendingCount} pending
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link href="/admin" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
            ← Back to admin
          </Link>
          <div className="flex items-center gap-2">
            {(['all', 'pending', 'approved'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterStatus === s ? 'bg-amber-50 border-amber-500 text-amber-700 font-semibold' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'}`}
              >
                {s === 'all' ? `All (${contracts.length})` : s === 'pending' ? `Pending (${pendingCount})` : `Approved (${contracts.length - pendingCount})`}
              </button>
            ))}
            <button
              onClick={openAdd}
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg ml-2"
            >
              + Add Contract
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {filterStatus === 'pending' ? 'No contracts pending review.' : 'No institution contracts found.'}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Institution</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Trade</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Dates</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Piggyback</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Submitter</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const days = daysUntil(c.expiration_date)
                  const exp = new Date(c.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  const start = c.start_date ? new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
                  const isExpanded = expandedId === c.id
                  const isEditing = editingId === c.id

                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${!c.approved_by_admin ? 'border-l-4 border-l-amber-400' : ''} ${isEditing ? 'bg-amber-50/40' : ''}`}
                      onClick={() => {
                        if (isEditing) return
                        setExpandedId(isExpanded ? null : c.id)
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{c.institution_name}</div>
                        {c.contract_number && <div className="text-xs text-gray-400 font-mono">{c.contract_number}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.vendor_name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.trade_category}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-600 text-xs">{start} — {exp}</div>
                        {days < 90 && days > 0 && <div className="text-xs text-amber-600 font-medium">{days} days left</div>}
                        {days <= 0 && <div className="text-xs text-red-600 font-medium">Expired</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.piggyback_allowed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {c.piggyback_allowed ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-700">{c.submitter_name}</div>
                        <div className="text-xs text-gray-400">{c.submitter_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.approved_by_admin ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {c.approved_by_admin ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                          {!c.approved_by_admin && (
                            <button onClick={() => approve(c.id)}
                              className="text-xs text-green-600 hover:text-green-800 font-medium">
                              Approve
                            </button>
                          )}
                          <button onClick={() => openEdit(c)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                            Edit
                          </button>
                          <button onClick={() => reject(c.id, c.vendor_name)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium">
                            {c.approved_by_admin ? 'Delete' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && <FormPanel />}

        {/* Read-only detail view */}
        {expandedId && !showForm && (() => {
          const c = contracts.find(x => x.id === expandedId)
          if (!c) return null
          return (
            <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-800">{c.vendor_name} — {c.institution_name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(c)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded px-2 py-0.5">
                    Edit
                  </button>
                  <button onClick={() => setExpandedId(null)}
                    className="text-gray-400 hover:text-gray-600 text-sm border border-gray-200 rounded px-2 py-0.5">
                    ✕ Close
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Contract Number</div>
                  <div className="text-gray-700">{c.contract_number || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Authorized Users</div>
                  <div className="text-gray-700">{c.authorized_users || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Insurance Requirements</div>
                  <div className="text-gray-700">{c.insurance_requirements || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Submitted</div>
                  <div className="text-gray-700">{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                {c.piggyback_language && (
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Piggyback Language</div>
                    <div className="text-gray-700 bg-gray-50 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap">{c.piggyback_language}</div>
                  </div>
                )}
                {c.notes && (
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</div>
                    <div className="text-gray-700">{c.notes}</div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
