// All date logic is pinned to America/New_York so that server (Vercel UTC)
// and client (US Eastern) produce identical strings and day-counts.
// This prevents React hydration mismatches (#418) on the server-rendered homepage.

/** Split a YYYY-MM-DD string into numeric [year, month, day] parts. */
function parseParts(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split('-').map(Number)
  return [y, m, d]
}

/** "Today" as YYYY-MM-DD in America/New_York. Works identically in UTC (Vercel) and ET (browser). */
function nyToday(): string {
  // en-CA locale gives YYYY-MM-DD format; timeZone pins the calendar day to NY.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * Parse a YYYY-MM-DD string as UTC midnight.
 * Using Date.UTC means the resulting timestamp is the same value on any server or browser,
 * so comparisons and sorts are timezone-neutral.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN)
  const [y, m, d] = parseParts(dateStr)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * "Jun 30, 2027" display format from a YYYY-MM-DD string.
 * Uses Date.UTC + timeZone:'UTC' so the displayed date never shifts
 * with the runtime's local offset.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = parseParts(dateStr)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/**
 * Whole calendar-day difference between the expiration date and NY-today.
 * Returns 0 on the expiration day (still valid), positive for future, negative for past.
 * Pure Date.UTC arithmetic — no local Date construction, so server === client.
 */
export function daysUntil(dateStr: string): number {
  if (!dateStr) return -1
  const [ey, em, ed] = parseParts(dateStr)
  const [ty, tm, td] = parseParts(nyToday())
  return Math.round(
    (Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86400000
  )
}

/**
 * Today as YYYY-MM-DD in America/New_York.
 * Use for Supabase .gte() filters so contracts remain visible through
 * end-of-day NY time even when the Vercel server has rolled past UTC midnight.
 */
export function localToday(): string {
  return nyToday()
}

/**
 * Format a Date object as YYYY-MM-DD using its UTC values.
 * (Used by extendOneYear in admin/contracts — call setUTCFullYear on the Date first.)
 */
export function dateToString(date: Date): string {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
