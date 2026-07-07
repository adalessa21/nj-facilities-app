// Client-side fetch helpers for admin pages.
// All calls are routed through /api/admin/[table] which verifies
// the admin session server-side before touching the database.

export type AdminQueryParams = {
  select?: string
  order?: string
  asc?: boolean
  eq?: Record<string, string>
  in?: Record<string, string[]>
}

function buildUrl(table: string, params: AdminQueryParams & { count?: boolean; head?: boolean } = {}) {
  const sp = new URLSearchParams()
  if (params.select) sp.set('select', params.select)
  if (params.order) sp.set('order', params.order)
  if (params.asc !== undefined) sp.set('asc', String(params.asc))
  if (params.count) sp.set('count', 'true')
  if (params.head) sp.set('head', 'true')
  for (const [k, v] of Object.entries(params.eq ?? {})) sp.set(`eq_${k}`, v)
  for (const [k, vs] of Object.entries(params.in ?? {})) sp.set(`in_${k}`, vs.join(','))
  const qs = sp.toString()
  return `/api/admin/${table}${qs ? '?' + qs : ''}`
}

function buildFilterUrl(table: string, filter: AdminFilter) {
  const sp = new URLSearchParams()
  if (filter.id) sp.set('id', filter.id)
  if (filter.ids) sp.set('ids', filter.ids.join(','))
  for (const [k, v] of Object.entries(filter.eq ?? {})) sp.set(`eq_${k}`, v)
  for (const [k, vs] of Object.entries(filter.in ?? {})) sp.set(`in_${k}`, vs.join(','))
  const qs = sp.toString()
  return `/api/admin/${table}${qs ? '?' + qs : ''}`
}

export type AdminFilter = {
  id?: string
  ids?: string[]
  eq?: Record<string, string>
  in?: Record<string, string[]>
}

async function handleResponse(r: Response): Promise<{ data: any; count?: number; error: { message: string } | null }> {
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    return { data: null, error: { message: body.error ?? `HTTP ${r.status}` } }
  }
  const body = await r.json()
  return { data: body.data ?? null, count: body.count ?? null, error: null }
}

export async function adminGet<T = any>(
  table: string,
  params?: AdminQueryParams
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const r = await fetch(buildUrl(table, params), { cache: 'no-store' })
  const res = await handleResponse(r)
  return { data: res.data as T[] | null, error: res.error }
}

export async function adminCount(
  table: string,
  params?: AdminQueryParams
): Promise<{ count: number; error: { message: string } | null }> {
  const r = await fetch(buildUrl(table, { ...params, count: true, head: true }), { cache: 'no-store' })
  const res = await handleResponse(r)
  return { count: res.count ?? 0, error: res.error }
}

export async function adminInsert<T = any>(
  table: string,
  data: object | object[]
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const r = await fetch(`/api/admin/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const res = await handleResponse(r)
  return { data: res.data as T[] | null, error: res.error }
}

export async function adminUpdate<T = any>(
  table: string,
  filter: AdminFilter,
  data: object
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const r = await fetch(buildFilterUrl(table, filter), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const res = await handleResponse(r)
  return { data: res.data as T[] | null, error: res.error }
}

export async function adminDelete(
  table: string,
  filter: AdminFilter
): Promise<{ error: { message: string } | null }> {
  const r = await fetch(buildFilterUrl(table, filter), { method: 'DELETE' })
  const res = await handleResponse(r)
  return { error: res.error }
}
