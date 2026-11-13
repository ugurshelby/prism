// Links read from data embedded in the page (JSON or data-* attributes) may only go to two places:
// release pages and downloads on GitHub, or the site itself. Anything else (javascript:, other hosts) stays unlinked.

const RELEASES = 'https://github.com/ugurshelby/prism/releases/'

export function safeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw === '') return null
  let url: URL
  try {
    url = new URL(raw, location.href)
  } catch {
    return null
  }
  if (url.username || url.password) return null
  const href = url.href
  if (url.origin === location.origin && (url.protocol === 'https:' || url.protocol === 'http:')) return href
  if (href.startsWith(RELEASES)) return href
  return null
}
