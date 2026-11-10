// Güncelleme bildirimi: GitHub'daki yayın listesinden bu ürünün daha yeni sürümünü bulur. Saf modül: ağ ve dosya
// işi main/update.ts'te. Yanıttan yalnızca etiket adı ve taslak/ön sürüm bayrakları okunur; açılacak sayfa adresi
// yanıttan değil, doğrulanmış etiketten kurulur.
import { z } from 'zod'

export const UPDATE_REPO = 'ugurshelby/prism'
export const RELEASES_API_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=50`
/** Günde en fazla bir otomatik denetim. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
/** Yayın listesi için üst sınır; daha büyük yanıt okunmaz. */
export const MAX_RESPONSE_BYTES = 2_000_000

export const ReleaseListSchema = z
  .array(z.object({ tag_name: z.string().max(100), draft: z.boolean(), prerelease: z.boolean() }))
  .max(100)

export type Version = readonly [number, number, number]

/** Yalnızca düz `x.y.z` kabul edilir; ön ek, ek ya da boşluk olan sürüm yok sayılır. */
export function parseVersion(text: string): Version | null {
  const m = /^(\d{1,5})\.(\d{1,5})\.(\d{1,5})$/.exec(text)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

export interface LatestRelease {
  tag: string
  version: string
}

/** Ürünün etiket önekini taşıyan, taslak ya da ön sürüm olmayan ve çalışan sürümden yeni olan en yüksek yayın. */
export function newerRelease(releases: z.infer<typeof ReleaseListSchema>, tagPrefix: string, current: string): LatestRelease | null {
  const cur = parseVersion(current)
  if (!cur) return null
  let best: { tag: string; v: Version } | null = null
  for (const r of releases) {
    if (r.draft || r.prerelease || !r.tag_name.startsWith(tagPrefix)) continue
    const v = parseVersion(r.tag_name.slice(tagPrefix.length))
    if (!v || compareVersions(v, cur) <= 0) continue
    if (!best || compareVersions(v, best.v) > 0) best = { tag: r.tag_name, v }
  }
  return best ? { tag: best.tag, version: best.v.join('.') } : null
}

/** Bu ürüne ait, biçimi doğrulanmış bir etiketin yayın sayfası; başka bir etiket için null. */
export function releasePageUrl(tag: string, tagPrefix: string): string | null {
  if (!tag.startsWith(tagPrefix) || !parseVersion(tag.slice(tagPrefix.length))) return null
  return `https://github.com/${UPDATE_REPO}/releases/tag/${tag}`
}

/** Son denetimden bu yana bir gün geçti mi; saat geri alınmışsa da denetlenir. */
export function checkDue(lastCheckedAt: number | null, now: number): boolean {
  return lastCheckedAt === null || now - lastCheckedAt >= CHECK_INTERVAL_MS || lastCheckedAt > now
}

export const UpdateStateSchema = z.object({
  checkedAt: z.number().int().nonnegative(),
  latest: z.object({ tag: z.string().max(100), version: z.string().max(20) }).nullable()
})
export type UpdateState = z.infer<typeof UpdateStateSchema>
