'use client'

import { useState, useEffect } from 'react'
import { adminGet, adminInsert, adminUpdate, adminDelete } from '@/lib/admin-client'
import { inputClsPurple as inputCls, labelCls } from '@/lib/ui'
import Link from 'next/link'

interface Cooperative {
  id: string
  name: string
  abbreviation: string
  geographic_scope: string
  website: string
  contact_phone: string
  contact_email: string
  display_color: string
  notes: string
}

export default function AdminCooperatives() {
  const [coops, setCoops] = useState<Cooperative[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCoop, setEditingCoop] = useState<Cooperative | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const emptyForm = {
    name: '', abbreviation: '', geographic_scope: '', website: '',
    contact_phone: '', contact_email: '', display_color: '#1D9E75', notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await adminGet<Cooperative>('cooperatives', { order: 'name' })
    if (data) setCoops(data)
    setLoading(false)
  }

  function openAdd() { setForm(emptyForm); setEditingCoop(null); setShowForm(true); setMessage('') }

  function openEdit(c: Cooperative) {
    setForm({
      name: c.name, abbreviation: c.abbreviation || '', geographic_scope: c.geographic_scope || '',
      website: c.website || '', contact_phone: c.contact_phone || '', contact_email: c.contact_email || '',
      display_color: c.display_color || '#1D9E75', notes: c.notes || '',
    })
    setEditingCoop(c); setShowForm(true); setMessage('')
  }

  async function save() {
    if (!form.name) { setMessage('Name is required.'); return }
    setSaving(true); setMessage('')
    if (editingCoop) {
      const { error } = await adminUpdate('cooperatives', { id: editingCoop.id }, { ...form, updated_at: new Date().toISOString() })
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Cooperative updated successfully')
    } else {
      const { error } = await adminInsert('cooperatives', form)
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
      setMessage('✓ Cooperative added successfully')
    }
    setSaving(false); setShowForm(false); loadData()
  }

  async function deleteCoop(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will remove all contracts and memberships linked to it. This cannot be undone.`)) return
    const { error } = await adminDelete('cooperatives', { id })
    if (error) { alert('Error: ' + error.message); return }
    loadData()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] text-white px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">Admin Portal</div>
          <h1 className="text-2xl font-bold">Cooperatives</h1>
          <p className="text-white/60 text-sm mt-1">Manage purchasing cooperatives — {coops.length} total</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link href="/admin" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">← Back to admin</Link>
          <button onClick={openAdd} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">+ Add Co-op</button>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message}
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4">{editingCoop ? 'Edit Cooperative' : 'Add New Cooperative'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-full">
                <label className={labelCls}>Full Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Educational Services Commission of New Jersey"
                  className={inputCls} />
              </div>
              {[
                { label: 'Abbreviation', key: 'abbreviation', ph: 'e.g. ESCNJ' },
                { label: 'Geographic Scope', key: 'geographic_scope', ph: 'e.g. New Jersey Statewide' },
                { label: 'Website', key: 'website', ph: 'e.g. escnj.us' },
                { label: 'Contact Phone', key: 'contact_phone', ph: 'e.g. (856) 547-5777' },
                { label: 'Contact Email', key: 'contact_email', ph: 'e.g. info@escnj.us' },
              ].map(f => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input type="text" value={(form as Record<string, unknown>)[f.key] as string}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.ph}
                    className={inputCls} />
                </div>
              ))}
              <div>
                <label className={labelCls}>Badge Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.display_color} onChange={e => setForm({ ...form, display_color: e.target.value })}
                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
                  <span className="text-sm text-gray-500">Used for co-op badge in search results</span>
                </div>
              </div>
              <div className="col-span-full">
                <label className={labelCls}>Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Internal notes"
                  className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
                {saving ? 'Saving...' : editingCoop ? 'Save Changes' : 'Add Cooperative'}
              </button>
              <button onClick={() => { setShowForm(false); setMessage('') }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : (
          <div className="grid grid-cols-1 gap-3">
            {coops.map(c => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.display_color || '#ccc' }} />
                  <div>
                    <div className="font-semibold text-gray-800">
                      {c.abbreviation && <span className="text-purple-700 mr-2">{c.abbreviation}</span>}
                      {c.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c.geographic_scope && <span>{c.geographic_scope}</span>}
                      {c.website && <span> · {c.website}</span>}
                      {c.contact_phone && <span> · {c.contact_phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                  <button onClick={() => deleteCoop(c.id, c.name)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
