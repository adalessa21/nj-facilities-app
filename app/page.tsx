import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseLocalDate, daysUntil, localToday } from '@/lib/dates'
import type { Entity, Cooperative, Vendor, GroupedContract } from '@/lib/types'
import HomeClient from './home-client'

// Revalidate the server-side data fetch every 60 seconds
export const revalidate = 60

export const metadata = {
  title: 'NJ Facilities Procurement Platform — Cooperative Contract Search for NJ Public Institutions',
  description: 'Search cooperative contracts from ESCNJ, NJ State Contract, Sourcewell, OMNIA, Bergen Co-op, and more for NJ public colleges, universities, and county governments.',
}

async function fetchInitialData() {
  const supabase = await createSupabaseServerClient()
  const today = localToday()

  const [
    { data: rawContracts },
    { data: instContracts },
    { data: entities },
    { data: cooperatives },
  ] = await Promise.all([
    supabase
      .from('contracts')
      .select(`
        id, contract_name, contract_number, trade_category,
        status, expiration_date, notes, cooperative_id, source_url,
        vendors ( id, company_name, phone, email, website, listing_tier, cert_url ),
        cooperatives ( id, name, abbreviation, display_color )
      `)
      .in('status', ['active', 'extended'])
      .order('expiration_date', { ascending: true }),
    supabase
      .from('institution_contracts')
      .select('*')
      .eq('approved_by_admin', true)
      .eq('piggyback_allowed', true)
      .gte('expiration_date', today),
    supabase.from('entities').select('id, name, type, county').order('type').order('name'),
    supabase.from('cooperatives').select('id, name, abbreviation, display_color').order('name'),
  ])

  const grouped: Record<string, GroupedContract> = {}

  rawContracts?.forEach((row: any) => {
    const key = `${row.contract_number}||${row.cooperative_id}`
    const coop = (Array.isArray(row.cooperatives) ? row.cooperatives[0] : row.cooperatives) as Cooperative
    const vendor = (Array.isArray(row.vendors) ? row.vendors[0] : row.vendors) as Vendor
    if (!grouped[key]) {
      grouped[key] = {
        id: row.id,
        contract_name: row.contract_name,
        contract_number: row.contract_number,
        trade_category: row.trade_category,
        status: row.status,
        expiration_date: row.expiration_date,
        notes: row.notes,
        cooperative_id: row.cooperative_id,
        source_url: row.source_url || '',
        vendorList: [],
        coop,
        source: 'cooperative',
      }
    }
    if (vendor && !grouped[key].vendorList.find((v: Vendor) => v.id === vendor.id)) {
      grouped[key].vendorList.push(vendor)
    }
  })

  instContracts?.forEach((row: any) => {
    grouped[`inst-${row.id}`] = {
      id: row.id,
      contract_name: `${row.vendor_name} — On-Call ${row.trade_category}`,
      contract_number: row.contract_number || 'N/A',
      trade_category: row.trade_category,
      status: 'active',
      expiration_date: row.expiration_date,
      notes: row.notes || '',
      cooperative_id: '',
      vendorList: [{ id: `inst-vendor-${row.id}`, company_name: row.vendor_name, phone: '', email: '', website: '', listing_tier: '' }],
      coop: { id: `inst-coop-${row.id}`, name: row.institution_name, abbreviation: 'Shared Contract', display_color: '#854F0B' },
      source: 'institution',
      institution_name: row.institution_name,
      piggyback_language: row.piggyback_language,
      authorized_users: row.authorized_users,
      insurance_requirements: row.insurance_requirements,
    }
  })

  const initialContracts = Object.values(grouped)
    .filter(c => daysUntil(c.expiration_date) >= 0)
  initialContracts.sort((a, b) => {
    const tradeOrder = a.trade_category.localeCompare(b.trade_category)
    if (tradeOrder !== 0) return tradeOrder
    return parseLocalDate(b.expiration_date).getTime() - parseLocalDate(a.expiration_date).getTime()
  })

  const initialTrades = [...new Set(initialContracts.map(c => c.trade_category))].sort()

  return {
    initialContracts,
    initialTrades,
    initialEntities: (entities ?? []) as Entity[],
    initialCooperatives: (cooperatives ?? []) as Cooperative[],
  }
}

export default async function Page() {
  const data = await fetchInitialData()
  return <HomeClient {...data} />
}
