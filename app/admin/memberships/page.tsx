'use client'

import { useState, useEffect } from 'react'
import { adminGet, adminInsert, adminDelete } from '@/lib/admin-client'
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
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Bulk form state
  const [selectedEntityId, setSelectedEntityId] = useState('')
  const [selectedCoopIds, setSelectedCoopIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState('confirmed')
  const [bulkVerifiedBy, setBulkVerifiedBy] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: m }, { data: e }, { data: c }] = await Promise.all([
      adminGet<Membership>('memberships', { select: '*,entities(name),cooperatives(name,abbreviation)', order: 'cooperative_id' }),
      adminGet<Entity>('entities', { select: 'id,name,type', order: 'name' }),
      adminGet<Coop>('cooperatives', { select: 'id,name,abbreviation', order: 'name' }),
    ])
    if (m) setMemberships(m)
    if (e) setEntities(e)
    if (c) setCoops(c)
    setLoading(false)
  }

  // Get existing co-op memberships for selected entity
  const existingCoopIds = memberships
    .filter(m => m.entity_id === selectedEntityId)
    .map(m => m.cooperative_id)

  function toggleCoop(coopId: string) {
    setSelectedCoopIds(prev =>
      prev.includes(coopId) ? prev.filter(id => id !== coopId) : [...prev, coopId]
    )
  }

  function openBulkForm() {
    setSelectedEntityId('')
    setSelectedCoopIds([])
    setBulkStatus('confirmed')
    setBulkVerifiedBy('')
    setShowForm(true)
    setMessage('')
  }

  // When entity changes, pre-check existing memberships
  function handleEntityChange(entityId: string) {
    setSelectedEntityId(entityId)
    const existing = memberships
      .filter(m => m.entity_id === entityId)
      .map(m => m.cooperative_id)
    setSelectedCoopIds(existing)
  }

  async function saveBulk() {
    if (!selectedEntityId) { setMessage('Please select an institution.'); return }

    const entityName = entities.find(e => e.id === selectedEntityId)?.name ?? ''
    const isRemovingAll = selectedCoopIds.length === 0 && existingCoopIds.length > 0

    if (isRemovingAll) {
      if (!confirm(`Remove ALL co-op memberships for ${entityName}? They will no longer see any co-op contracts.`)) return
    }

    setSaving(true); setMessage('')

    // Delete all existing memberships for this entity first
    await adminDelete('memberships', { eq: { entity_id: selectedEntityId } })

    // Insert new ones — skip entirely if selection is empty (Supabase errors on empty inserts)
    if (selectedCoopIds.length > 0) {
      const inserts = selectedCoopIds.map(coopId => ({
        entity_id: selectedEntityId,
        cooperative_id: coopId,
        status: bulkStatus,
        verified_by: bulkVerifiedBy,
      }))
      const { error } = await adminInsert('memberships', inserts)
      if (error) { setMessage('Error: ' + error.message); setSaving(false); return }
    }

    setMessage(selectedCoopIds.length === 0
      ? `✓ Removed all memberships for ${entityName}`
      : `✓ Saved ${selectedCoopIds.length} membership${selectedCoopIds.length !== 1 ? 's' : ''} for ${entityName}`
    )
    setSaving(false)
    setShowForm(false)
    loadData()
  }

  async function deleteMembership(id: string) {
    if (!confirm('Delete this membership?')) return
    const { error } = await adminDelete('memberships', { id })
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

  // Group filtered memberships by entity for display
  const byEntity: Record<string, Membership[]> = {}
  filtered.forEach(m => {
    const key = m.entity_id
    if (!byEntity[key]) byEntity[key] = []
    byEntity[key].push(m)
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
          <button onClick={openBulkForm} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + Add / Update Memberships
          </button>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
          <strong>This is the most important table.</strong> It controls which institutions can see which co-op contracts.
          Use <strong>Add / Update Memberships</strong> to set all co-ops for an institution at once.
        </div>

        {/* Bulk form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-1">Add / Update Memberships</h2>
            <p className="text-sm text-gray-500 mb-4">Select an institution and check all co-ops they belong to. This will replace their existing memberships.</p>

            {/* Institution selector */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Institution *</label>
              <select
                value={selectedEntityId}
                onChange={e => handleEntityChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
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

            {/* Co-op checkboxes */}
            {selectedEntityId && (
              <>
                <div className="mb-3">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                    Select Co-ops * <span className="text-gray-400 font-normal normal-case">({selectedCoopIds.length} selected)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {coops.map(c => {
                      const isChecked = selectedCoopIds.includes(c.id)
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCoop(c.id)}
                            className="w-4 h-4 accent-green-600"
                          />
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{c.abbreviation}</div>
                            <div className="text-xs text-gray-500">{c.name}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Status</label>
                    <select
                      value={bulkStatus}
                      onChange={e => setBulkStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="confirmed">Confirmed</option>
                      <option value="unverified">Unverified</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Verified By</label>
                    <input
                      type="text"
                      value={bulkVerifiedBy}
                      onChange={e => setBulkVerifiedBy(e.target.value)}
                      placeholder="e.g. ESCNJ public member list"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={saveBulk}
                disabled={saving || !selectedEntityId || (selectedCoopIds.length === 0 && existingCoopIds.length === 0)}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
              >
                {saving ? 'Saving...'
                  : selectedCoopIds.length === 0 ? 'Remove all memberships'
                  : `Save ${selectedCoopIds.length} Membership${selectedCoopIds.length !== 1 ? 's' : ''}`}
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
            placeholder="Search institutions or co-ops..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <select
            value={filterCoop}
            onChange={e => setFilterCoop(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All co-ops</option>
            {coops.map(c => <option key={c.id} value={c.id}>{c.abbreviation}</option>)}
          </select>
        </div>

        <div className="text-sm text-gray-500 mb-3">{filtered.length} memberships</div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
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
                        <button
                          onClick={() => { handleEntityChange(m.entity_id); setShowForm(true); }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit all
                        </button>
                        <button onClick={() => deleteMembership(m.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-400">No memberships match your search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
