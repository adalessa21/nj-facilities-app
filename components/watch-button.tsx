'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface WatchButtonProps {
  contractId: string
  contractType: 'cooperative' | 'institution'
}

export default function WatchButton({ contractId, contractType }: WatchButtonProps) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined) // undefined = loading
  const [watched, setWatched] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      const uid = session?.user?.id ?? null
      setUserId(uid)
      if (!uid) return

      const { data } = await supabase
        .from('watched_contracts')
        .select('id')
        .eq('contract_id', contractId)
        .eq('contract_type', contractType)
        .maybeSingle()
      if (!cancelled) setWatched(!!data)
    }
    init()
    return () => { cancelled = true }
  }, [contractId, contractType])

  // Still resolving auth — render nothing to avoid layout shift
  if (userId === undefined) return null

  if (userId === null) {
    return (
      <Link
        href="/login"
        className="text-xs text-gray-400 hover:text-teal-600 transition-colors whitespace-nowrap"
        title="Sign in to watch"
      >
        ☆ Watch
      </Link>
    )
  }

  async function toggle() {
    if (busy) return
    setBusy(true)
    if (watched) {
      await supabase
        .from('watched_contracts')
        .delete()
        .eq('contract_id', contractId)
        .eq('contract_type', contractType)
      setWatched(false)
    } else {
      await supabase
        .from('watched_contracts')
        .insert({ contract_id: contractId, contract_type: contractType, user_id: userId })
      setWatched(true)
    }
    setBusy(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`text-xs transition-colors whitespace-nowrap ${watched ? 'text-teal-600 hover:text-teal-800' : 'text-gray-400 hover:text-teal-600'}`}
      title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {watched ? '★ Watching' : '☆ Watch'}
    </button>
  )
}
