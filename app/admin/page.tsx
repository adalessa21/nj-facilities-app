'use client'

import { useState, useEffect } from 'react'
import { adminCount } from '@/lib/admin-client'
import Link from 'next/link'

interface Stats {
  entities: number
  cooperatives: number
  vendors: number
  contracts: number
  memberships: number
  pendingInstitution: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    entities: 0, cooperatives: 0, vendors: 0,
    contracts: 0, memberships: 0, pendingInstitution: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const [
        { count: entities },
        { count: cooperatives },
        { count: vendors },
        { count: contracts },
        { count: memberships },
        { count: pendingInstitution },
      ] = await Promise.all([
        adminCount('entities'),
        adminCount('cooperatives'),
        adminCount('vendors'),
        adminCount('contracts'),
        adminCount('memberships'),
        adminCount('institution_contracts', { eq: { approved_by_admin: 'false' } }),
      ])
      setStats({ entities, cooperatives, vendors, contracts, memberships, pendingInstitution })
      setLoading(false)
    }
    loadStats()
  }, [])

  const sections = [
    { title: 'Institutions', description: 'Add, edit, or remove NJ public colleges, universities, and county governments', href: '/admin/entities', count: stats.entities, label: 'institutions', color: 'bg-blue-50 border-blue-200', btnColor: 'bg-blue-600 hover:bg-blue-700', icon: '🏛️' },
    { title: 'Cooperatives', description: 'Manage purchasing cooperatives — ESCNJ, NJ State, Sourcewell, OMNIA, etc.', href: '/admin/cooperatives', count: stats.cooperatives, label: 'co-ops', color: 'bg-purple-50 border-purple-200', btnColor: 'bg-purple-600 hover:bg-purple-700', icon: '🤝' },
    { title: 'Vendors', description: 'Add or edit vendors — contact info, trades, listing tier', href: '/admin/vendors', count: stats.vendors, label: 'vendors', color: 'bg-teal-50 border-teal-200', btnColor: 'bg-teal-600 hover:bg-teal-700', icon: '🔧' },
    { title: 'Contracts', description: 'Add or edit cooperative contracts — numbers, dates, trade categories', href: '/admin/contracts', count: stats.contracts, label: 'contracts', color: 'bg-amber-50 border-amber-200', btnColor: 'bg-amber-600 hover:bg-amber-700', icon: '📄' },
    { title: 'Memberships', description: 'Manage which institutions belong to which cooperatives', href: '/admin/memberships', count: stats.memberships, label: 'memberships', color: 'bg-green-50 border-green-200', btnColor: 'bg-green-600 hover:bg-green-700', icon: '✓' },
    { title: 'Institution Contracts', description: stats.pendingInstitution > 0 ? `Review shared on-call contracts — ${stats.pendingInstitution} pending approval` : 'Review shared on-call contracts submitted by NJ institutions', href: '/admin/institution-contracts', count: stats.pendingInstitution, label: 'pending', color: stats.pendingInstitution > 0 ? 'bg-orange-50 border-orange-300' : 'bg-orange-50 border-orange-200', btnColor: 'bg-orange-600 hover:bg-orange-700', icon: '📋' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] text-white px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-white/50 mb-1">NJ Facilities Procurement Platform</div>
          <h1 className="text-2xl font-bold">Admin Portal</h1>
          <p className="text-white/60 text-sm mt-1">Manage all platform data — institutions, co-ops, vendors, contracts, and memberships</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Link href="/" className="text-sm text-teal-600 hover:text-teal-800 underline underline-offset-2">← Back to platform</Link>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Institutions', value: stats.entities },
            { label: 'Co-ops', value: stats.cooperatives },
            { label: 'Vendors', value: stats.vendors },
            { label: 'Contracts', value: stats.contracts },
            { label: 'Memberships', value: stats.memberships },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#1F3864]">{loading ? '…' : s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {sections.map(s => (
            <div key={s.href} className={`border rounded-xl p-5 ${s.color} flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                <span className="text-3xl">{s.icon}</span>
                <div>
                  <div className="font-bold text-gray-800 text-base">
                    {s.title}
                    <span className="ml-2 text-sm font-normal text-gray-500">({loading ? '…' : s.count} {s.label})</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-0.5">{s.description}</div>
                </div>
              </div>
              <Link href={s.href} className={`${s.btnColor} text-white text-sm font-semibold px-5 py-2.5 rounded-lg whitespace-nowrap transition-colors`}>
                Manage →
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-bold text-gray-800 mb-3">Quick reference</h2>
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <div><strong className="text-gray-800">Adding a new vendor:</strong> Go to Vendors → Add Vendor. Then go to Contracts → Add Contract to link them to a co-op.</div>
            <div><strong className="text-gray-800">Adding a new co-op contract:</strong> Make sure the vendor exists first, then go to Contracts → Add Contract.</div>
            <div><strong className="text-gray-800">New institution joined a co-op:</strong> Go to Memberships → Add Membership. Select the institution and co-op.</div>
            <div><strong className="text-gray-800">Contract expiration update:</strong> Go to Contracts → find the contract → Edit → update the expiration date.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
