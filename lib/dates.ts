// Parse a "YYYY-MM-DD" string as LOCAL midnight, not UTC midnight.
// new Date('2027-06-30') parses as UTC, which is June 29 evening in US
// timezones and causes off-by-one display errors.
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN)
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// "Jun 30, 2027" display format from a YYYY-MM-DD string
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Days from local midnight today until the expiration date (local midnight).
// Returns 0 on the expiration day (still valid), positive for future, negative for past.
export function daysUntil(dateStr: string): number {
  if (!dateStr) return -1
  const expiry = parseLocalDate(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((expiry.getTime() - today.getTime()) / 86400000)
}

// Today as YYYY-MM-DD in LOCAL time — use for Supabase .gte() filters so
// contracts don't disappear mid-day due to UTC rollover.
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Format a Date object as YYYY-MM-DD in local time
export function dateToString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
