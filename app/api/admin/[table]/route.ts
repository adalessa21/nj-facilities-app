import { requireAdmin } from '@/lib/admin-session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_TABLES = new Set([
  'entities', 'cooperatives', 'vendors', 'contracts',
  'memberships', 'institution_contracts',
])

type Context = { params: Promise<{ table: string }> }

// Parse eq_field and in_field query params into filter descriptors
function parseFilters(sp: URLSearchParams) {
  const eq: Record<string, string> = {}
  const inF: Record<string, string[]> = {}
  for (const [key, val] of sp.entries()) {
    if (key.startsWith('eq_')) eq[key.slice(3)] = val
    else if (key.startsWith('in_')) inF[key.slice(3)] = val.split(',').filter(Boolean)
  }
  return { eq, in: inF }
}

function applyFilters(q: any, eq: Record<string, string>, inF: Record<string, string[]>) {
  for (const [field, val] of Object.entries(eq)) q = q.eq(field, val)
  for (const [field, vals] of Object.entries(inF)) q = q.in(field, vals)
  return q
}

function unauthorized() { return NextResponse.json({ error: 'Unauthorized — not signed in' }, { status: 401 }) }
function forbidden() { return NextResponse.json({ error: 'Forbidden — not an admin' }, { status: 403 }) }
function badTable(t: string) { return NextResponse.json({ error: `Table '${t}' not allowed` }, { status: 400 }) }

async function checkAdmin(): Promise<string | null> {
  return requireAdmin()
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, ctx: Context) {
  const email = await checkAdmin()
  if (email === null) {
    // Distinguish no-session vs not-admin by trying to get user separately
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { table } = await ctx.params
  if (!ALLOWED_TABLES.has(table)) return badTable(table)

  const sp = req.nextUrl.searchParams
  const selectStr = sp.get('select') ?? '*'
  const orderCol = sp.get('order')
  const asc = sp.get('asc') !== 'false'
  const countMode = sp.get('count') === 'true' ? ('exact' as const) : undefined
  const headOnly = sp.get('head') === 'true'
  const { eq, in: inF } = parseFilters(sp)

  let q: any = supabaseAdmin
    .from(table)
    .select(selectStr, countMode ? { count: countMode, head: headOnly } : undefined)

  q = applyFilters(q, eq, inF)
  if (orderCol) q = q.order(orderCol, { ascending: asc })

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, ctx: Context) {
  const email = await checkAdmin()
  if (!email) return unauthorized()

  const { table } = await ctx.params
  if (!ALLOWED_TABLES.has(table)) return badTable(table)

  const body = await req.json()
  const { data, error } = await supabaseAdmin.from(table).insert(body).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, ctx: Context) {
  const email = await checkAdmin()
  if (!email) return unauthorized()

  const { table } = await ctx.params
  if (!ALLOWED_TABLES.has(table)) return badTable(table)

  const sp = req.nextUrl.searchParams
  const id = sp.get('id')
  const ids = sp.get('ids')?.split(',').filter(Boolean)
  const { eq, in: inF } = parseFilters(sp)

  if (!id && !ids?.length && !Object.keys(eq).length && !Object.keys(inF).length) {
    return NextResponse.json({ error: 'PATCH requires at least one filter (id, ids, eq_*, or in_*)' }, { status: 400 })
  }

  const body = await req.json()
  let q: any = supabaseAdmin.from(table).update(body)

  if (id) q = q.eq('id', id)
  else if (ids?.length) q = q.in('id', ids)
  q = applyFilters(q, eq, inF)

  const { data, error } = await q.select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, ctx: Context) {
  const email = await checkAdmin()
  if (!email) return unauthorized()

  const { table } = await ctx.params
  if (!ALLOWED_TABLES.has(table)) return badTable(table)

  const sp = req.nextUrl.searchParams
  const id = sp.get('id')
  const ids = sp.get('ids')?.split(',').filter(Boolean)
  const { eq, in: inF } = parseFilters(sp)

  if (!id && !ids?.length && !Object.keys(eq).length && !Object.keys(inF).length) {
    return NextResponse.json({ error: 'DELETE requires at least one filter (id, ids, eq_*, or in_*)' }, { status: 400 })
  }

  let q: any = supabaseAdmin.from(table).delete()

  if (id) q = q.eq('id', id)
  else if (ids?.length) q = q.in('id', ids)
  q = applyFilters(q, eq, inF)

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
