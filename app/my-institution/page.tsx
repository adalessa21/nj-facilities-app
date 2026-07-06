'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabase-auth'
import Link from 'next/link'

interface Entity {
  id: string
  name: string
  type: string
  county: string
}

interface Cooperative {
  id: string
  name: string
  abbreviation: string
  display_color: string
}

const COOP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ESCNJ:           { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'NJ State':      { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  Sourcewell:      { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  OMNIA:           { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  'Bergen Co-op':  { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  'Hunterdon ESC': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  NASPO:           { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
  'NJ Edge':       { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
}

export default function MyInstitutionPage() {
  const router = useRouter()

  const [entity, setEntity] = useState<Entity | null>(null)
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([])
  const [selectedCoopIds, setSelectedCoopIds] = useState<string[]>([])
  const [originalCoopIds, setOriginalCoopIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function init() {
      // Check auth
      const { data: { session } } = await supabaseAuth.auth.getSession()
      const user = session?.user ?? (await supabaseAuth.auth.getUser()).data.user

      if (!user?.email) {
        router.replace('/login')
        return
      }

      const domain = user.email.split('@')[1]
      if (!domain) {
        router.replace('/login')
        return
      }

      // Look up institution by email domain
      const { data: entityData } = await supabase
        .from('entities')
        .select('id, name, type, county')
        .eq('email_domain', domain)
        .single()

      if (!entityData) {
        router.replace('/login')
        return
      }

      setEntity(entityData)

      // Load cooperatives and memberships in parallel
      const [{ data: coops }, { data: memberships }] = await Promise.all([
        supabase.from('cooperatives').select('id, name, abbreviation, display_color').order('name'),
        supabase.from('memberships').select('cooperative_id').eq('entity_id', entityData.id),
      ])

      if (coops) setCooperatives(coops)

      const currentIds = (memberships ?? []).map((m: { cooperative_id: string }) => m.cooperative_id)
      setSelectedCoopIds(currentIds)
      setOriginalCoopIds(currentIds)
      setLoading(false)
    }

    init()
  }, [router])

  function toggleCoop(id: string) {
    setSelectedCoopIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    setMessage('')
  }

  async function save() {
    if (!entity) return
    setSaving(true)
    setMessage('')

    const toAdd = selectedCoopIds.filter(id => !originalCoopIds.includes(id))
    const toRemove = originalCoopIds.filter(id => !selectedCoopIds.includes(id))

    if (toAdd.length > 0) {
      const { error } = await supabase.from('memberships').upsert(
        toAdd.map(coopId => ({
          entity_id: entity.id,
          cooperative_id: coopId,
          status: 'confirmed',
        })),
        { onConflict: 'entity_id,cooperative_id' }
      )
      if (error) {
        setMessage('Error saving: ' + error.message)
        setSaving(false)
        return
      }
    }

    for (const coopId of toRemove) {
      const { error } = await supabase.from('memberships')
        .delete()
        .eq('entity_id', entity.id)
        .eq('cooperative_id', coopId)
      if (error) {
        setMessage('Error saving: ' + error.message)
        setSaving(false)
        return
      }
    }

    setOriginalCoopIds(selectedCoopIds)
    setMessage('✓ Memberships saved successfully.')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (!entity) return null

  const hasChanges =
    selectedCoopIds.length !== originalCoopIds.length ||
    selectedCoopIds.some(id => !originalCoopIds.includes(id))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864] text-white">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Facilities Procurement Platform</div>
          <h1 className="text-xl font-bold">My Institution</h1>
          <p className="text-white/60 text-sm mt-1">{entity.name}</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
          ← Back to platform
        </Link>

        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
          <h2 className="font-bold text-gray-800 mb-1">Co-op Memberships</h2>
          <p className="text-sm text-gray-500 mb-4">
            Check the cooperatives your institution belongs to. This controls which contracts appear when you're signed in.
          </p>

          {message && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-5">
            {cooperatives.map(c => {
              const isChecked = selectedCoopIds.includes(c.id)
              const s = COOP_STYLES[c.abbreviation] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? `${s.bg} ${s.border}` : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCoop(c.id)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <div>
                    <div className={`text-sm font-semibold ${isChecked ? s.text : 'text-gray-700'}`}>
                      {c.abbreviation === 'NJ State' ? 'NJ State Contract' : c.abbreviation}
                    </div>
                    <div className="text-xs text-gray-400">{c.name}</div>
                  </div>
                </label>
              )
            })}
          </div>

          <button
            onClick={save}
            disabled={saving || !hasChanges}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Memberships'}
          </button>
          {!hasChanges && !saving && (
            <span className="ml-3 text-xs text-gray-400">No changes to save</span>
          )}
        </div>
      </div>
    </div>
  )
}
