'use client'

import { useState, useEffect } from 'react'
import { adminGet, adminInsert, adminUpdate, adminDelete } from '@/lib/admin-client'
import { parseLocalDate, formatDate, daysUntil, dateToString } from '@/lib/dates'
import { inputCls, labelCls } from '@/lib/ui'
import Link from 'next/link'

interface Contract {
  id: string
  contract_name: string
  contract_number: string
  trade_category: string
  status: string
  expiration_date: string
  notes: string
  source_url: string
  vendor_id: string
  cooperative_id: string
  vendors: { company_name: string }
  cooperatives: { name: string; abbreviation: string }
}

interface Vendor { id: string; company_name: string }
interface Coop { id: string; name: string; abbreviation: string }

const TRADES = [
  'Automotive Parts','Doors & Hardware','Electrical','Elevator','Equipment Rental','Fencing',
  'Fire Alarm','Fire Protection','Fleet Maintenance','Fleet Vehicles','Flooring',
  'Furniture','General Construction','Generator','Grounds','HVAC',
  'Janitorial Supplies','Lighting','MRO Supplies','Painting','Paving',
  'Pest Control','Plumbing','Roofing','Security','Waste & Recycling',
]

// Group contracts by contract_number + cooperative_id for display
interface GroupedContractRow {
  contract_number: string
  contract_name: string
  trade_category: string
  status: string
  expiration_date: string
  notes: string
  source_url: string
  cooperative_id: string
  coopAbbr: string
  vendorNames: string[]
  contractIds: string[]
}

export default function AdminContracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [coops, setCoops] = useState<Coop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTrade, setFilterTrade] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupedContractRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Form state
const emptyForm = {
    cooperative_id: '',
    contract_number: '',
    contract_name: '',
    trade_category: '',
    status: 'active',
    expiration_date: '',
    notes: '',
    source_url: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [vendorSearch, setVendorSearch] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: c }, { data: v }, { data: co }] = await Promise.all([
      adminGet<Contract>('contracts', { select: '*,vendors(company_name),cooperatives(name,abbreviation)', order: 'expiration_date' }),
      adminGet<Vendor>('vendors', { select: 'id,company_name', order: 'company_name' }),
      adminGet<Coop>('cooperatives', { select: 'id,name,abbreviation', order: 'name' }),
    ])
    if (c) setContracts(c)
    if (v) setVendors(v)
    if (co) setCoops(co)
    setLoading(false)
  }

  // Group contracts by contract_number + cooperative_id
  function getGrouped(contractList: Contract[]): GroupedContractRow[] {
    const grouped: Record<string, GroupedContractRow> = {}
    contractList.forEach(c => {
      const key = `${c.contract_number}||${c.cooperative_id}`
      if (!grouped[key]) {
        grouped[key] = {
          contract_number: c.contract_number,
          contract_name: c.contract_name,
          trade_category: c.trade_category,
          status: c.status,
          expiration_date: c.expiration_date,
          notes: c.notes || '',
          source_url: c.source_url || '',
          cooperative_id: c.cooperative_id,
          coopAbbr: c.cooperatives?.abbreviation || '',
          vendorNames: [],
          contractIds: [],
        }
      }
      if (c.vendors?.company_name && !grouped[key].vendorNames.includes(c.vendors.company_name)) {
        grouped[key].vendorNames.push(c.vendors.company_name)
      }
      grouped[key].contractIds.push(c.id)
    })
    return Object.values(grouped)
  }

  function openAdd() {
    setForm(emptyForm)
    setSelectedVendorIds([])
    setVendorSearch('')
    setEditingGroup(null)
    setShowForm(true)
    setMessage('')
  }

  function openEdit(group: GroupedContractRow) {
    setForm({
      cooperative_id: group.cooperative_id,
      contract_number: group.contract_number,
      contract_name: group.contract_name,
      trade_category: group.trade_category,
      status: group.status,
      expiration_date: group.expiration_date?.split('T')[0] || '',
      notes: group.notes || '',
      source_url: group.source_url || '',
    })
    // Pre-select vendors in this group
    const preSelected = vendors
      .filter(v => group.vendorNames.includes(v.company_name))
      .map(v => v.id)
    setSelectedVendorIds(preSelected)
    setVendorSearch('')
    setEditingGroup(group)
    setShowForm(true)
    setMessage('')
  }

  function toggleVendor(vendorId: string) {
    setSelectedVendorIds(prev =>
      prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]
    )
  }

  async function save() {
    if (!form.cooperative_id || !form.contract_name || !form.expiration_date) {
      setMessage('Please fill in all required fields.')
      return
    }
    if (selectedVendorIds.length === 0) {
      setMessage('Please select at least one vendor.')
      return
    }
    setSaving(true)
    setMessage('')

    // If editing, delete old contract rows for this group first
    if (editingGroup) {
      const { error: delError } = await adminDelete('contracts', { ids: editingGroup.contractIds })
      if (delError) { setMessage('Error deleting old rows: ' + delError.message); setSaving(false); return }
    }

    // Insert one row per vendor
    const inserts = selectedVendorIds.map(vendorId => ({
      vendor_id: vendorId,
      cooperative_id: form.cooperative_id,
      contract_number: form.contract_number,
      contract_name: form.contract_name,
      trade_category: form.trade_category,
      status: form.status,
      expiration_date: form.expiration_date,
      notes: form.notes,
      source_url: form.source_url || null,
    }))

    const { error } = await adminInsert('contracts', inserts)
    if (error) { setMessage('Error: ' + error.message); setSaving(false); return }

    setMessage(`✓ Contract saved with ${inserts.length} vendor${inserts.length !== 1 ? 's' : ''}`)
    setSaving(false)
    setShowForm(false)
    await loadData()
  }

  async function deleteGroup(group: GroupedContractRow) {
    if (!confirm(`Delete "${group.contract_name}" and all ${group.contractIds.length} vendor rows? This cannot be undone.`)) return
    const { error } = await adminDelete('contracts', { ids: group.contractIds })
    if (error) { alert('Error: ' + error.message); return }
    await loadData()
  }

  // Quick extend by 1 year
  async function extendOneYear(group: GroupedContractRow) {
    const current = parseLocalDate(group.expiration_date)
    current.setUTCFullYear(current.getUTCFullYear() + 1) // use UTC to match parseLocalDate's UTC midnight representation
    const newDate = dateToString(current)
    const { error } = await adminUpdate('contracts', { ids: group.contractIds }, { expiration_date: newDate, status: 'extended' })
    if (error) { alert('Error: ' + error.message); return }
    setMessage(`✓ Extended "${group.contract_name}" to ${newDate}`)
    await loadData()
  }

  const allGrouped = getGrouped(contracts)

  const filtered = allGrouped.filter(g => {
    const matchSearch = !search ||
      g.contract_name?.toLowerCase().includes(search.toLowerCase()) ||
      g.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      g.vendorNames.some(v => v.toLowerCase().includes(search.toLowerCase())) ||
      g.coopAbbr?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || g.status === filterStatus
    const matchTrade = filterTrade === 'all' || g.trade_category === filterTrade
    return matchSearch && matchStatus && matchTrade
  })

  const filteredVendors = vendors.filter(v =>
    !vendorSearch || v.company_name.toLowerCase().includes(vendorSearch.toLowerCase())
  )


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">Admin Portal</div>
          <h1 className="text-2xl font-bold">Contracts</h1>
          <p className="text-white/60 text-sm mt-1">
            Manage all cooperative contracts — {allGrouped.length} contracts · {contracts.length} vendor rows
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link href="/admin" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
            ← Back to admin
          </Link>
          <button
            onClick={openAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            + Add Contract
          </button>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-1">
              {editingGroup ? 'Edit Contract' : 'Add New Contract'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Select all vendors awarded this contract — they will all appear under one contract card on the platform.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Cooperative *</label>
                <select
                  value={form.cooperative_id}
                  onChange={e => setForm({ ...form, cooperative_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select co-op...</option>
                  {coops.map(c => <option key={c.id} value={c.id}>{c.abbreviation} — {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Contract Number</label>
                <input
                  type="text"
                  value={form.contract_number}
                  onChange={e => setForm({ ...form, contract_number: e.target.value })}
                  placeholder="e.g. ESCNJ 23/24-23"
                  className={inputCls}
                />
              </div>
              <div className="col-span-full">
                <label className={labelCls}>Contract Name *</label>
                <input
                  type="text"
                  value={form.contract_name}
                  onChange={e => setForm({ ...form, contract_name: e.target.value })}
                  placeholder="e.g. H.V.A.C. Services — Time & Material"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Trade Category *</label>
                <select
                  value={form.trade_category}
                  onChange={e => setForm({ ...form, trade_category: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select trade...</option>
                  {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className={inputCls}
                >
                  <option value="active">Active</option>
                  <option value="extended">Extended</option>
                  <option value="expired">Expired</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Expiration Date *</label>
                <input
                  type="date"
                  value={form.expiration_date}
                  onChange={e => setForm({ ...form, expiration_date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Brief description shown on contract card"
                  className={inputCls}
                />
              </div>
              <div className="col-span-full">
                <label className={labelCls}>Source Document URL</label>
                <input
                  type="text"
                  value={form.source_url || ''}
                  onChange={e => setForm({ ...form, source_url: e.target.value })}
                  placeholder="e.g. https://escnj.us/co-op-pricing/members-section/hvac-escnj-2324-23"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">Direct link to the co-op's page for this contract. Users click "View source →" to go there.</p>
              </div>
            </div>

            {/* Vendor multi-select */}
            <div className="mb-4">
              <label className={labelCls}>
                Awarded Vendors * <span className="text-gray-400 font-normal normal-case">({selectedVendorIds.length} selected)</span>
              </label>
              <input
                type="text"
                placeholder="Search vendors..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 mb-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {filteredVendors.map((v, i) => {
                  const isChecked = selectedVendorIds.includes(v.id)
                  return (
                    <label
                      key={v.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${isChecked ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-amber-50 border-b border-gray-100 last:border-0`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleVendor(v.id)}
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span className={`text-sm ${isChecked ? 'font-semibold text-amber-800' : 'text-gray-700'}`}>
                        {v.company_name}
                      </span>
                    </label>
                  )
                })}
              </div>
              {selectedVendorIds.length > 0 && (
                <div className="mt-2 text-xs text-amber-700 font-medium">
                  Selected: {vendors.filter(v => selectedVendorIds.includes(v.id)).map(v => v.company_name).join(', ')}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
              >
                {saving ? 'Saving...' : editingGroup ? `Save Changes (${selectedVendorIds.length} vendors)` : `Add Contract (${selectedVendorIds.length} vendors)`}
              </button>
              <button
                onClick={() => { setShowForm(false); setMessage('') }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Search contracts, vendors, co-ops..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="extended">Extended</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={filterTrade}
            onChange={e => setFilterTrade(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
          >
            <option value="all">All trades</option>
            {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="text-sm text-gray-500 mb-3">{filtered.length} contracts</div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Contract</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendors</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Co-op</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Trade</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Expires</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g, i) => {
                  const days = daysUntil(g.expiration_date)
                  const exp = formatDate(g.expiration_date)
                  return (
                    <tr key={`${g.contract_number}-${g.cooperative_id}`} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{g.contract_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{g.contract_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-600">
                          {g.vendorNames.length === 0 ? (
                            <span className="text-gray-300">Pending</span>
                          ) : (
                            <span>{g.vendorNames.join(' · ')}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{g.vendorNames.length} vendor{g.vendorNames.length !== 1 ? 's' : ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          {g.coopAbbr}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{g.trade_category}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-600">{exp}</div>
                        {days === 0 && <div className="text-xs text-amber-600 font-medium">expires today</div>}
                        {days > 0 && days < 90 && <div className="text-xs text-amber-600 font-medium">{days} days left</div>}
                        {days < 0 && <div className="text-xs text-red-600 font-medium">Expired</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          g.status === 'active' ? 'bg-green-100 text-green-700' :
                          g.status === 'extended' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {g.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end flex-wrap">
                          <button
                            onClick={() => openEdit(g)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => extendOneYear(g)}
                            className="text-xs text-green-600 hover:text-green-800 font-medium"
                            title="Extend expiration by 1 year"
                          >
                            +1yr
                          </button>
                          <button
                            onClick={() => deleteGroup(g)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-400">No contracts match your search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
