'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Membership {
  id: string
  entity_id: string
  cooperative_id: string
  status: string
  verified_by: string
  notes: string
  entities: { name: string }
  cooperatives: { name: string; abbreviation: string }
}

interface Entity { id: string; name: string; type: string }
interface Coop { id: string; name: string; abbreviation: string }

export default function AdminMemberships() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [coops, setCoops] = useState<Coop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCoop, setFilterCoop] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const emptyForm = { entity_id: '', cooperative_id: '', status: 'confirmed', verified_by: '', notes: '' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: m }, { data: e }, { data: c }] = await Promise.all([
      supabase.from('memberships').select('*, entities(name), cooperatives(name, abbreviation)').order('cooperative_id'),
      supabase.from('entities').select('id, name, type').order('type').order('name'),
      supabase.from('cooperatives').select('id, name, abbreviation').order('name'),
    ])
    if (m) setMemberships(m as unknown as Membership[])
    if (e) setEntities(e)
    if (c) setCoops(c)
    setLoading(false)
  }

  function openAdd() { setForm(emptyForm); setEditingMembership(null); setShowForm(true); setMessage('') }

  function openEdit(m: Membership) {
    setForm({ entity_id: m.entity_id, cooperative_id: m.cooperative_id, status: m.status, verified_by: m.verified_by || '', notes: m.notes || '' })
    setEditingMembership(m); setShowForm(true); setMessage('')
  }

  async function save() {
    if (!form.entity_id || !form.cooperative_id) { setMessage('Institution and co-op are required.'); return }
    setSaving(true); setMessage('')
    if (editingMembership) {
      const { error } = await supabase.from('memberships').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingMembership.id)
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Membership updated successfully')
    } else {
      const { error } = await supabase.from('memberships').insert(form)
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Membership added successfully')
    }
    setSaving(false); setShowForm(false); loadData()
  }

  async function deleteMembership(id: string) {
    if (!confirm('Delete this membership? This cannot be undone.')) return
    const { error } = await supabase.from('memberships').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    loadData()
  }

  const filtered = memberships.filter(m => {
    const matchSearch = !search ||
      m.entities?.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.cooperatives?.abbreviation?.toLowerCase().includes(search.toLowerCase())
    const matchCoop = filterCoop === 'all' || m.cooperative_id === filterCoop
    return matchSearch && matchCoop
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">Admin Portal</div>
          <h1 className="text-2xl font-bold">Memberships</h1>
          <p className="text-white/60 text-sm mt-1">Manage institution ↔ cooperative memberships — {memberships.length} total</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link href="/admin" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">← Back to admin</Link>
          <button onClick={openAdd} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">+ Add Membership</button>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message}
          </div>
        )}

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
          <strong>This is the most important table.</strong> It controls which institutions can see which co-op contracts.
          When a new institution joins a co-op, add a membership here and they'll immediately see all contracts from that co-op.
        </div>

        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4">{editingMembership ? 'Edit Membership' : 'Add New Membership'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Institution *</label>
                <select value={form.entity_id} onChange={e => setForm({ ...form, entity_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                  <option value="">Select institution...</option>
                  <optgroup label="Public Universities">
                    {entities.filter(e => e.type === 'university').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </optgroup>
                  <optgroup label="County Colleges">
                    {entities.filter(e => e.type === 'county_college').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </optgroup>
                  <optgroup label="County Governments">
                    {entities.filter(e => e.type === 'county_gov').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </optgroup>
                  <optgroup label="Municipalities">
                    {entities.filter(e => e.type === 'municipality').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Cooperative *</label>
                <select value={form.cooperative_id} onChange={e => setForm({ ...form, cooperative_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                  <option value="">Select co-op...</option>
                  {coops.map(c => <option key={c.id} value={c.id}>{c.abbreviation} — {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                  <option value="confirmed">Confirmed</option>
                  <option value="unverified">Unverified</option>
                  <option value="pending">Pending</option>
                  <option value="not_member">Not a member</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Verified By</label>
                <input type="text" value={form.verified_by} onChange={e => setForm({ ...form, verified_by: e.target.value })}
                  placeholder="e.g. ESCNJ public member list"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional notes"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
                {saving ? 'Saving...' : editingMembership ? 'Save Changes' : 'Add Membership'}
              </button>
              <button onClick={() => { setShowForm(false); setMessage('') }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-4">
          <input type="text" placeholder="Search institutions or co-ops..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <select value={filterCoop} onChange={e => setFilterCoop(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">All co-ops</option>
            {coops.map(c => <option key={c.id} value={c.id}>{c.abbreviation}</option>)}
          </select>
        </div>

        <div className="text-sm text-gray-500 mb-3">{filtered.length} memberships</div>

        {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Institution</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cooperative</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Verified By</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{m.entities?.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        {m.cooperatives?.abbreviation}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        m.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        m.status === 'unverified' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.verified_by || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(m)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                        <button onClick={() => deleteMembership(m.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
