'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Contract {
  id: string
  contract_name: string
  contract_number: string
  trade_category: string
  status: string
  expiration_date: string
  notes: string
  vendor_id: string
  cooperative_id: string
  vendors: { company_name: string }
  cooperatives: { name: string; abbreviation: string }
}

interface Vendor { id: string; company_name: string }
interface Coop { id: string; name: string; abbreviation: string }

const TRADES = [
  'HVAC','Electrical','Plumbing','Roofing','General Construction',
  'Fire Alarm','Fire Protection','Generator','Elevator','Lighting',
  'Flooring','Grounds','Painting','Fencing','Pest Control',
  'MRO Supplies','Security','Janitorial Supplies','Waste & Recycling',
  'Equipment Rental','Furniture','Paving'
]

export default function AdminContracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [coops, setCoops] = useState<Coop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTrade, setFilterTrade] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const emptyForm = {
    vendor_id: '',
    cooperative_id: '',
    contract_number: '',
    contract_name: '',
    trade_category: '',
    status: 'active',
    expiration_date: '',
    notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: c }, { data: v }, { data: co }] = await Promise.all([
      supabase
        .from('contracts')
        .select('*, vendors(company_name), cooperatives(name, abbreviation)')
        .order('expiration_date', { ascending: true }),
      supabase.from('vendors').select('id, company_name').order('company_name'),
      supabase.from('cooperatives').select('id, name, abbreviation').order('name'),
    ])
    if (c) setContracts(c as unknown as Contract[])
    if (v) setVendors(v)
    if (co) setCoops(co)
    setLoading(false)
  }

  function openAdd() {
    setForm(emptyForm)
    setEditingContract(null)
    setShowForm(true)
    setMessage('')
  }

  function openEdit(c: Contract) {
    setForm({
      vendor_id: c.vendor_id,
      cooperative_id: c.cooperative_id,
      contract_number: c.contract_number,
      contract_name: c.contract_name,
      trade_category: c.trade_category,
      status: c.status,
      expiration_date: c.expiration_date?.split('T')[0] || '',
      notes: c.notes || '',
    })
    setEditingContract(c)
    setShowForm(true)
    setMessage('')
  }

  async function save() {
    if (!form.vendor_id || !form.cooperative_id || !form.contract_name || !form.expiration_date) {
      setMessage('Please fill in all required fields.')
      return
    }
    setSaving(true)
    setMessage('')
    if (editingContract) {
      const { error } = await supabase
        .from('contracts')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editingContract.id)
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Contract updated successfully')
    } else {
      const { error } = await supabase.from('contracts').insert(form)
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Contract added successfully')
    }
    setSaving(false)
    setShowForm(false)
    loadData()
  }

  async function deleteContract(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    loadData()
  }

  const filtered = contracts.filter(c => {
    const matchSearch = !search ||
      c.contract_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.vendors?.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.cooperatives?.abbreviation?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    const matchTrade = filterTrade === 'all' || c.trade_category === filterTrade
    return matchSearch && matchStatus && matchTrade
  })

  function daysUntil(d: string) {
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1F3864] text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">Admin Portal</div>
          <h1 className="text-2xl font-bold">Contracts</h1>
          <p className="text-white/60 text-sm mt-1">
            Manage all cooperative contracts — {contracts.length} total
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Nav */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/admin" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
            ← Back to admin
          </Link>
          <button
            onClick={openAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Add Contract
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4">
              {editingContract ? 'Edit Contract' : 'Add New Contract'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Vendor *
                </label>
                <select
                  value={form.vendor_id}
                  onChange={e => setForm({ ...form, vendor_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select vendor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Cooperative *
                </label>
                <select
                  value={form.cooperative_id}
                  onChange={e => setForm({ ...form, cooperative_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select co-op...</option>
                  {coops.map(c => (
                    <option key={c.id} value={c.id}>{c.abbreviation} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Contract Name *
                </label>
                <input
                  type="text"
                  value={form.contract_name}
                  onChange={e => setForm({ ...form, contract_name: e.target.value })}
                  placeholder="e.g. H.V.A.C. Services — Time & Material"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Contract Number
                </label>
                <input
                  type="text"
                  value={form.contract_number}
                  onChange={e => setForm({ ...form, contract_number: e.target.value })}
                  placeholder="e.g. ESCNJ 23/24-23"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Trade Category *
                </label>
                <select
                  value={form.trade_category}
                  onChange={e => setForm({ ...form, trade_category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select trade...</option>
                  {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="active">Active</option>
                  <option value="extended">Extended</option>
                  <option value="expired">Expired</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Expiration Date *
                </label>
                <input
                  type="date"
                  value={form.expiration_date}
                  onChange={e => setForm({ ...form, expiration_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Brief description shown on contract card"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={save}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : editingContract ? 'Save Changes' : 'Add Contract'}
              </button>
              <button
                onClick={() => { setShowForm(false); setMessage('') }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
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
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="extended">Extended</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={filterTrade}
            onChange={e => setFilterTrade(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="all">All trades</option>
            {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="text-sm text-gray-500 mb-3">{filtered.length} contracts</div>

        {/* Contracts table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Contract</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Co-op</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Trade</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Expires</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const days = daysUntil(c.expiration_date)
                  const exp = new Date(c.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  return (
                    <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{c.contract_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{c.contract_number}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.vendors?.company_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          {c.cooperatives?.abbreviation}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.trade_category}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-600">{exp}</div>
                        {days < 90 && days > 0 && (
                          <div className="text-xs text-amber-600 font-medium">{days} days left</div>
                        )}
                        {days <= 0 && (
                          <div className="text-xs text-red-600 font-medium">Expired</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          c.status === 'active' ? 'bg-green-100 text-green-700' :
                          c.status === 'extended' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openEdit(c)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteContract(c.id, c.contract_name)}
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
