'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Vendor {
  id: string
  company_name: string
  phone: string
  email: string
  website: string
  service_area: string
  emergency_available: boolean
  listing_tier: string
  verified: boolean
  notes: string
}

export default function AdminVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTier, setFilterTier] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const emptyForm = {
    company_name: '',
    phone: '',
    email: '',
    website: '',
    service_area: '',
    emergency_available: false,
    listing_tier: 'basic',
    verified: true,
    notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .order('company_name')
    if (data) setVendors(data)
    setLoading(false)
  }

  function openAdd() {
    setForm(emptyForm)
    setEditingVendor(null)
    setShowForm(true)
    setMessage('')
  }

  function openEdit(v: Vendor) {
    setForm({
      company_name: v.company_name,
      phone: v.phone || '',
      email: v.email || '',
      website: v.website || '',
      service_area: v.service_area || '',
      emergency_available: v.emergency_available || false,
      listing_tier: v.listing_tier || 'basic',
      verified: v.verified || false,
      notes: v.notes || '',
    })
    setEditingVendor(v)
    setShowForm(true)
    setMessage('')
  }

  async function save() {
    if (!form.company_name) {
      setMessage('Company name is required.')
      return
    }
    setSaving(true)
    setMessage('')
    if (editingVendor) {
      const { error } = await supabase
        .from('vendors')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editingVendor.id)
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Vendor updated successfully')
    } else {
      const { error } = await supabase.from('vendors').insert(form)
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Vendor added successfully')
    }
    setSaving(false)
    setShowForm(false)
    loadData()
  }

  async function deleteVendor(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will also delete all their contracts. This cannot be undone.`)) return
    const { error } = await supabase.from('vendors').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    loadData()
  }

  const filtered = vendors.filter(v => {
    const matchSearch = !search ||
      v.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.email?.toLowerCase().includes(search.toLowerCase()) ||
      v.website?.toLowerCase().includes(search.toLowerCase())
    const matchTier = filterTier === 'all' || v.listing_tier === filterTier
    return matchSearch && matchTier
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">Admin Portal</div>
          <h1 className="text-2xl font-bold">Vendors</h1>
          <p className="text-white/60 text-sm mt-1">Manage vendor profiles — {vendors.length} total</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link href="/admin" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
            ← Back to admin
          </Link>
          <button
            onClick={openAdd}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            + Add Vendor
          </button>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4">
              {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Company Name *', key: 'company_name', placeholder: 'e.g. Envirocon LLC' },
                { label: 'Phone', key: 'phone', placeholder: '(908) 555-0100' },
                { label: 'Email', key: 'email', placeholder: 'contact@company.com' },
                { label: 'Website', key: 'website', placeholder: 'company.com' },
                { label: 'Service Area', key: 'service_area', placeholder: 'e.g. NJ, NY, PA' },
                { label: 'Notes', key: 'notes', placeholder: 'Internal notes' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{f.label}</label>
                  <input
                    type="text"
                    value={(form as Record<string, unknown>)[f.key] as string}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Listing Tier</label>
                <select
                  value={form.listing_tier}
                  onChange={e => setForm({ ...form, listing_tier: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="basic">Basic (Free)</option>
                  <option value="premium">Premium ($1,500/yr)</option>
                  <option value="lead_gen">Lead Gen ($3,000/yr)</option>
                </select>
              </div>
              <div className="flex items-center gap-4 pt-5">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.verified}
                    onChange={e => setForm({ ...form, verified: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  Verified vendor
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.emergency_available}
                    onChange={e => setForm({ ...form, emergency_available: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  24/7 emergency available
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={save}
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
              >
                {saving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Add Vendor'}
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
            placeholder="Search vendors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <select
            value={filterTier}
            onChange={e => setFilterTier(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All tiers</option>
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
            <option value="lead_gen">Lead Gen</option>
          </select>
        </div>

        <div className="text-sm text-gray-500 mb-3">{filtered.length} vendors</div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Company</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Website</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Tier</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => (
                  <tr key={v.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{v.company_name}</div>
                      {v.verified && <span className="text-xs text-green-600">✓ verified</span>}
                      {v.emergency_available && <span className="text-xs text-blue-600 ml-2">24/7</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{v.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{v.website || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        v.listing_tier === 'lead_gen' ? 'bg-purple-100 text-purple-700' :
                        v.listing_tier === 'premium' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {v.listing_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(v)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                        <button onClick={() => deleteVendor(v.id, v.company_name)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-400">No vendors match your search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
