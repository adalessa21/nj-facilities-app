'use client'

import { useState } from 'react'
import { supabaseAuth as supabase } from '@/lib/supabase-auth'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/auth/callback',
      },
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864] text-white">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Facilities Procurement Platform · Beta</div>
          <h1 className="text-xl font-bold">Sign in to NJ Facilities</h1>
        </div>
      </header>

      <div className="max-w-sm mx-auto px-4 py-12">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-4">✉️</div>
              <h2 className="text-lg font-bold text-[#1F3864] mb-2">Check your email</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                We sent a sign-in link to <strong>{email}</strong>. Click the link in the email to sign in.
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-4 text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="text-lg font-bold text-[#1F3864] mb-1">Sign in</h2>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                Enter your institutional email address (.edu or .gov) to receive a sign-in link.
              </p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
                  {error}
                </div>
              )}

              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@institution.edu"
                required
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-[#1F3864] hover:bg-[#2A4A82] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-4">
          <Link href="/" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">
            ← Back to platform
          </Link>
        </div>
      </div>
    </div>
  )
}
