'use client'

import { useState, useEffect } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check if already authenticated in session
  useEffect(() => {
    const isAuthed = sessionStorage.getItem('admin_authed')
    if (isAuthed === 'true') setAuthed(true)
    setChecking(false)
  }, [])

  function handleLogin() {
    // Change this password to something only you know
    if (password === 'njfacilities2026') {
      sessionStorage.setItem('admin_authed', 'true')
      setAuthed(true)
      setError(false)
    } else {
      setError(true)
      setPassword('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin()
  }

  if (checking) return null

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#1F3864] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-3xl mb-3">🔐</div>
            <h1 className="text-xl font-bold text-[#1F3864]">Admin Portal</h1>
            <p className="text-sm text-gray-500 mt-1">NJ Facilities Procurement Platform</p>
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              onKeyDown={handleKeyDown}
              placeholder="Enter admin password"
              autoFocus
              className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {error && (
              <p className="text-red-500 text-xs mt-1.5 font-medium">Incorrect password. Try again.</p>
            )}
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-[#1F3864] hover:bg-[#2A4A82] text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            Sign In
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            This area is restricted to platform administrators only.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Admin nav bar */}
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-xs">
        <span className="text-gray-400">🔐 Admin Portal — NJ Facilities Procurement Platform</span>
        <button
          onClick={() => {
            sessionStorage.removeItem('admin_authed')
            setAuthed(false)
          }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  )
}
