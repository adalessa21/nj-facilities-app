// Ensure a URL has a protocol. Prevents https://https://... double-prefix
// when the stored value already includes the scheme.
export function normalizeUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}
