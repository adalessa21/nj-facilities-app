'use client'

import { useState, useEffect } from 'react'
import { supabaseAuth } from '@/lib/supabase-auth'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'no-session' | 'not-admin' | 'admin'>('loading')
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function check() {
      const r = await fetch('/api/admin/check', { cache: 'no-store' })
      if (r.status === 401) { setStatus('no-session'); return }
      const { isAdmin, email: e } = await r.json()
      setEmail(e ?? '')
      setStatus(isAdmin ? 'admin' : 'not-admin')
    }
    check()
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#1F3864] flex items-center justify-center">
        <div className="text-white/60 text-sm">Checking access…</div>
      </div>
    )
  }

  if (status === 'no-session') {
    return (
      <div className="min-h-screen bg-[#1F3864] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
          <div className="text-3xl mb-3">🔐</div>
          <h1 className="text-xl font-bold text-[#1F3864] mb-2">Admin Portal</h1>
          <p className="text-sm text-gray-500 mb-5">Sign in with your admin email to continue.</p>
          <Link
            href="/login"
            className="block w-full bg-[#1F3864] hover:bg-[#2A4A82] text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'not-admin') {
    return (
      <div className="min-h-screen bg-[#1F3864] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
          <div className="text-3xl mb-3">🚫</div>
          <h1 className="text-xl font-bold text-[#1F3864] mb-2">Access denied</h1>
          <p className="text-sm text-gray-500 mb-1">Signed in as:</p>
          <p className="text-sm font-mono text-gray-700 mb-5 break-all">{email}</p>
          <p className="text-xs text-gray-400 mb-5">Your email is not on the admin list. Contact the platform owner to request access.</p>
          <button
            onClick={() => supabaseAuth.auth.signOut().then(() => setStatus('no-session'))}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-xs">
        <span className="text-gray-400">🔐 Admin Portal — NJ Facilities Procurement Platform</span>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 hidden sm:block">{email}</span>
          <button
            onClick={() => supabaseAuth.auth.signOut().then(() => setStatus('no-session'))}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
