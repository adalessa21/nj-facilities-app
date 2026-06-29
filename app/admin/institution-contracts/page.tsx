'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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

export default function AdminInstitutionContracts() {
  const [contracts, setContracts] = useState<InstitutionContract[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all')
  const [message, setMessage] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
          <div className="flex gap-2">
            {(['all', 'pending', 'approved'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterStatus === s ? 'bg-amber-50 border-amber-500 text-amber-700 font-semibold' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'}`}
              >
                {s === 'all' ? `All (${contracts.length})` : s === 'pending' ? `Pending (${pendingCount})` : `Approved (${contracts.length - pendingCount})`}
              </button>
            ))}
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

                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${!c.approved_by_admin ? 'border-l-4 border-l-amber-400' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
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
                            <button
                              onClick={() => approve(c.id)}
                              className="text-xs text-green-600 hover:text-green-800 font-medium"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => reject(c.id, c.vendor_name)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
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

        {expandedId && (() => {
          const c = contracts.find(x => x.id === expandedId)
          if (!c) return null
          return (
            <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-800">{c.vendor_name} — {c.institution_name}</h3>
                <button onClick={() => setExpandedId(null)} className="text-gray-400 hover:text-gray-600 text-sm border border-gray-200 rounded px-2 py-0.5">✕ Close</button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Contract Number</div>
                  <div className="text-gray-700">{c.contract_number || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Authorized Users</div>
                  <div className="text-gray-700">{c.authorized_users}</div>
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
