'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabase-auth'
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

export default function PiggybackSubmit() {
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [entityId, setEntityId] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabaseAuth.auth.getSession()
      const user = session?.user ?? (await supabaseAuth.auth.getUser()).data.user
      if (!user?.email) return

      setUserEmail(user.email)
      setForm(prev => ({ ...prev, submitter_email: user.email! }))

      const domain = user.email.split('@')[1]
      if (!domain) return
      const { data: entity } = await supabase
        .from('entities')
        .select('id, name')
        .eq('email_domain', domain)
        .maybeSingle()
      if (entity) {
        setEntityId(entity.id)
        setForm(prev => ({ ...prev, institution_name: entity.name }))
      }
    }
    checkAuth()
  }, [])

  const [form, setForm] = useState({
    institution_name: '',
    vendor_name: '',
    trade_category: '',
    contract_number: '',
    start_date: '',
    expiration_date: '',
    piggyback_allowed: true,
    piggyback_language: '',
    authorized_users: 'Any NJ public entity',
    insurance_requirements: '',
    notes: '',
    submitter_name: '',
    submitter_email: '',
  })

  function update(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.institution_name || !form.vendor_name || !form.trade_category ||
        !form.expiration_date || !form.submitter_name || !form.submitter_email) {
      setError('Please fill in all required fields.')
      return
    }

    if (form.authorized_users === 'Specific institutions only' && selectedInstitutions.length === 0) {
      setError('Please select at least one authorized institution.')
      return
    }

    setSaving(true)

    const authorizedUsersValue = form.authorized_users === 'Specific institutions only'
      ? selectedInstitutions.join(', ')
      : form.authorized_users

    const { error: insertError } = await supabase.from('institution_contracts').insert({
      institution_name: form.institution_name,
      entity_id: entityId,
      vendor_name: form.vendor_name,
      trade_category: form.trade_category,
      contract_number: form.contract_number || null,
      start_date: form.start_date || null,
      expiration_date: form.expiration_date,
      piggyback_allowed: form.piggyback_allowed,
      piggyback_language: form.piggyback_language || null,
      authorized_users: authorizedUsersValue,
      insurance_requirements: form.insurance_requirements || null,
      notes: form.notes || null,
      submitter_name: form.submitter_name,
      submitter_email: form.submitter_email,
    })

    setSaving(false)

    if (insertError) {
      setError('Error submitting: ' + insertError.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-[#1F3864] text-white">
          <div className="max-w-3xl mx-auto px-4 py-5">
            <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Facilities Procurement Platform</div>
            <h1 className="text-xl font-bold">Submit a Shared Contract</h1>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="bg-white border border-green-200 rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-lg font-bold text-[#1F3864] mb-2">Submission received</h2>
            <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              Thank you — your contract has been submitted for review. It will appear on the platform once approved.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => { setSubmitted(false); setSelectedInstitutions([]); setForm({ institution_name: '', vendor_name: '', trade_category: '', contract_number: '', start_date: '', expiration_date: '', piggyback_allowed: true, piggyback_language: '', authorized_users: 'Any NJ public entity', insurance_requirements: '', notes: '', submitter_name: '', submitter_email: '' }) }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
              >
                Submit another
              </button>
              <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg">
                Back to platform
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864] text-white">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Facilities Procurement Platform</div>
          <h1 className="text-xl font-bold">Submit a Shared Contract</h1>
          <p className="text-white/60 text-sm mt-1">
            Share your institution's on-call contract so other NJ public entities can use it.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
          ← Back to platform
        </Link>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
          <h2 className="font-bold text-gray-800 mb-1">Contract Details</h2>
          <p className="text-sm text-gray-500 mb-4">
            Fields marked with * are required.
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Institution Name *{entityId && <span className="ml-1 text-teal-600 font-normal normal-case">· verified</span>}
              </label>
              <input
                type="text"
                value={form.institution_name}
                onChange={e => !entityId && update('institution_name', e.target.value)}
                readOnly={!!entityId}
                placeholder="e.g. Rutgers University"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${entityId ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-default' : 'border-gray-300 focus:ring-2 focus:ring-amber-400'}`}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Vendor Name *</label>
              <input
                type="text"
                value={form.vendor_name}
                onChange={e => update('vendor_name', e.target.value)}
                placeholder="e.g. ABC Mechanical Inc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Trade Category *</label>
              <select
                value={form.trade_category}
                onChange={e => update('trade_category', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Select trade...</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Bid / Contract Number</label>
              <input
                type="text"
                value={form.contract_number}
                onChange={e => update('contract_number', e.target.value)}
                placeholder="e.g. RU-2024-HVAC-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Contract Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => update('start_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Contract Expiration Date *</label>
              <input
                type="date"
                value={form.expiration_date}
                onChange={e => update('expiration_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <h2 className="font-bold text-gray-800 mb-1">Sharing Details</h2>
          <p className="text-sm text-gray-500 mb-4">
            Let other institutions know if and how they can use this contract.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Sharing Allowed</label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => update('piggyback_allowed', true)}
                  className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${form.piggyback_allowed ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => update('piggyback_allowed', false)}
                  className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${!form.piggyback_allowed ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'}`}
                >
                  No
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Authorized Users</label>
              <select
                value={form.authorized_users}
                onChange={e => {
                  update('authorized_users', e.target.value)
                  if (e.target.value === 'Any NJ public entity') setSelectedInstitutions([])
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="Any NJ public entity">Any NJ public entity</option>
                <option value="Specific institutions only">Specific institutions only</option>
              </select>
            </div>
            {form.authorized_users === 'Specific institutions only' && (
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                  Authorized Institutions <span className="text-gray-400 font-normal normal-case">({selectedInstitutions.length} selected)</span>
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedInstitutions([...ALL_INSTITUTIONS])}
                    className="text-xs text-green-700 hover:text-green-900 font-medium bg-green-50 border border-green-200 rounded-lg px-3 py-1.5"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInstitutions([])}
                    className="text-xs text-gray-600 hover:text-gray-800 font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5"
                  >
                    Clear all
                  </button>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 max-h-[420px] overflow-y-auto space-y-4">
                  {(Object.entries(INSTITUTIONS) as [string, string[]][]).map(([group, names]) => (
                    <div key={group}>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{group}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {names.map(name => {
                          const isChecked = selectedInstitutions.includes(name)
                          return (
                            <label
                              key={name}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => setSelectedInstitutions(prev =>
                                  prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
                                )}
                                className="w-4 h-4 accent-green-600"
                              />
                              <span className={`text-sm ${isChecked ? 'font-semibold text-green-800' : 'text-gray-700'}`}>
                                {name}
                              </span>
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
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Authorization Language</label>
              <textarea
                value={form.piggyback_language}
                onChange={e => update('piggyback_language', e.target.value)}
                placeholder="Paste the contract language that authorizes shared use..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-xs text-gray-400 mt-1">The exact clause from the contract or bid spec that permits other entities to use this contract.</p>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Insurance Requirements</label>
              <input
                type="text"
                value={form.insurance_requirements}
                onChange={e => update('insurance_requirements', e.target.value)}
                placeholder="e.g. $1M general liability, $2M umbrella"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                placeholder="Any additional details about the contract..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <h2 className="font-bold text-gray-800 mb-1">Your Information</h2>
          <p className="text-sm text-gray-500 mb-4">
            So we can contact you if we have questions about this contract.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Your Name *</label>
              <input
                type="text"
                value={form.submitter_name}
                onChange={e => update('submitter_name', e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Your Email *</label>
              <input
                type="email"
                value={form.submitter_email}
                onChange={e => !userEmail && update('submitter_email', e.target.value)}
                readOnly={!!userEmail}
                placeholder="e.g. jsmith@rutgers.edu"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${userEmail ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-default' : 'border-gray-300 focus:ring-2 focus:ring-amber-400'}`}
              />
              {userEmail && !entityId && (
                <p className="text-xs text-amber-600 mt-1">Signed in as {userEmail} — no matching institution found for this email domain.</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg"
          >
            {saving ? 'Submitting...' : 'Submit Contract for Review'}
          </button>
        </form>
      </div>
    </div>
  )
}
