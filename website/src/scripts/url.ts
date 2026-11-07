// Sayfaya gömülü veriden (JSON ya da data-* öznitelikleri) okunan bağlantılar yalnızca iki yere gidebilir:
// GitHub'daki sürüm sayfaları ve indirmeler, ya da sitenin kendisi. Diğer her şey (javascript:, başka alan adı) bağlantısız kalır.

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
