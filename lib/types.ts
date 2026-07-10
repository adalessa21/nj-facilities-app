// Shared domain types used across server and client components.

export interface Entity {
  id: string
  name: string
  type: string
  county: string
}

export interface Cooperative {
  id: string
  name: string
  abbreviation: string
  display_color: string
}

export interface Vendor {
  id: string
  company_name: string
  phone: string
  email: string
  website: string
  listing_tier: string
  cert_url?: string
}

// Grouped contract — the display unit shown as a card on the homepage.
// Cooperative contracts group multiple DB rows (one per vendor) into one card.
// Institution contracts always have a single-vendor list.
export interface GroupedContract {
  id: string
  contract_name: string
  contract_number: string
  trade_category: string
  status: string
  expiration_date: string
  notes: string
  cooperative_id: string
  source_url?: string
  vendorList: Vendor[]
  coop: Cooperative
  source?: 'cooperative' | 'institution'
  institution_name?: string
  piggyback_language?: string
  authorized_users?: string
  insurance_requirements?: string
}
