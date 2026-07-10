'use client'

import { useState, useEffect } from 'react'
import { adminGet, adminInsert, adminUpdate, adminDelete } from '@/lib/admin-client'
import Link from 'next/link'

interface Entity {
  id: string
  name: string
  type: string
  county: string
  city: string
  email_domain: string
  website: string
  facilities_contact_name: string
  facilities_contact_email: string
  verified: boolean
  notes: string
}

const TYPES = [
  { value: 'university', label: 'Public University / State College' },
  { value: 'county_college', label: 'County College' },
  { value: 'county_gov', label: 'County Government' },
  { value: 'municipality', label: 'Municipality' },
]

const NJ_COUNTIES = [
  'Atlantic','Bergen','Burlington','Camden','Cape May','Cumberland',
  'Essex','Gloucester','Hudson','Hunterdon','Mercer','Middlesex',
  'Monmouth','Morris','Ocean','Passaic','Salem','Somerset','Sussex','Union','Warren'
]

export default function AdminEntities() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const emptyForm = {
    name: '', type: 'university', county: '', city: '',
    email_domain: '', website: '', facilities_contact_name: '',
    facilities_contact_email: '', verified: true, notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await adminGet<Entity>('entities', { order: 'name' })
    if (data) setEntities(data)
    setLoading(false)
  }

  function openAdd() { setForm(emptyForm); setEditingEntity(null); setShowForm(true); setMessage('') }

  function openEdit(e: Entity) {
    setForm({
      name: e.name, type: e.type, county: e.county || '',
      city: e.city || '', email_domain: e.email_domain || '',
      website: e.website || '', facilities_contact_name: e.facilities_contact_name || '',
      facilities_contact_email: e.facilities_contact_email || '',
      verified: e.verified || false, notes: e.notes || '',
    })
    setEditingEntity(e); setShowForm(true); setMessage('')
  }

  async function save() {
    if (!form.name || !form.type) { setMessage('Name and type are required.'); return }
    setSaving(true); setMessage('')
    if (editingEntity) {
      const { error } = await adminUpdate('entities', { id: editingEntity.id }, { ...form, updated_at: new Date().toISOString() })
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Institution updated successfully')
    } else {
      const { error } = await adminInsert('entities', form)
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Institution added successfully')
    }
    setSaving(false); setShowForm(false); loadData()
  }

  async function deleteEntity(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    const { error } = await adminDelete('entities', { id })
    if (error) { alert('Error: ' + error.message); return }
    loadData()
  }

  const filtered = entities.filter(e => {
    const matchSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.county?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || e.type === filterType
    return matchSearch && matchType
  })

  const typeLabel = (t: string) => TYPES.find(x => x.value === t)?.label || t

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">Admin Portal</div>
          <h1 className="text-2xl font-bold">Institutions</h1>
          <p className="text-white/60 text-sm mt-1">Manage NJ public institutions — {entities.length} total</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link href="/admin" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">← Back to admin</Link>
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">+ Add Institution</button>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message}
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4">{editingEntity ? 'Edit Institution' : 'Add New Institution'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-full">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Institution Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Raritan Valley Community College"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Type *</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">County</label>
                <select value={form.county} onChange={e => setForm({ ...form, county: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Select county...</option>
                  {NJ_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {[
                { label: 'City', key: 'city', ph: 'e.g. Branchburg' },
                { label: 'Email Domain', key: 'email_domain', ph: 'e.g. raritanval.edu' },
                { label: 'Website', key: 'website', ph: 'e.g. raritanval.edu' },
                { label: 'Facilities Contact Name', key: 'facilities_contact_name', ph: 'e.g. John Smith' },
                { label: 'Facilities Contact Email', key: 'facilities_contact_email', ph: 'e.g. jsmith@college.edu' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{f.label}</label>
                  <input type="text" value={(form as Record<string, unknown>)[f.key] as string}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.ph}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" checked={form.verified} onChange={e => setForm({ ...form, verified: e.target.checked })} className="w-4 h-4 rounded" />
                <label className="text-sm text-gray-700">Verified institution</label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
                {saving ? 'Saving...' : editingEntity ? 'Save Changes' : 'Add Institution'}
              </button>
              <button onClick={() => { setShowForm(false); setMessage('') }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-4">
          <input type="text" placeholder="Search institutions..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">All types</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="text-sm text-gray-500 mb-3">{filtered.length} institutions</div>

        {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Institution</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">County</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email Domain</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{e.name}</div>
                      {e.verified && <span className="text-xs text-green-600">✓ verified</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{typeLabel(e.type)}</td>
                    <td className="px-4 py-3 text-gray-600">{e.county}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.email_domain || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(e)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                        <button onClick={() => deleteEntity(e.id, e.name)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
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
