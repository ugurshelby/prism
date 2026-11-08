// Bilgi kartı biçimi: başta kısa bir ön bilgi bloğu, gövdede her iddia satırının sonunda kaynak işareti.
//
//   ---
//   kind: model            (model: modele dair iddialar, her satır kaynaklı; method: Prism'in kendi yöntemi)
//   verified: 2026-11-08   (son doğrulama tarihi)
//   sources: gemini-models, gemini-thinking
//   ---
//   - Thinking cannot be turned off. [s:gemini-thinking]
//   - Something we could not confirm. [unverified]
//
// İşaretler modele gönderilmeden önce gövdeden silinir; [unverified] "(unverified)" olarak kalır.
// Saf modül: Node ya da Electron içe aktarmaz; ana süreç ve testler aynı denetimi kullanır.
import { z } from 'zod'

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(Date.parse(d)), 'geçersiz tarih')

export const SourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('doc'),
    title: z.string().min(1),
    publisher: z.string().min(1),
    url: z.url({ protocol: /^https$/ }),
    retrieved: IsoDate
  }),
  // Prism'in kendi eval ölçümü: kanıt .work altındaki koşu raporundadır, adres yoktur.
  z.object({ kind: z.literal('eval'), title: z.string().min(1), run: z.string().min(1), retrieved: IsoDate })
])
export type Source = z.infer<typeof SourceSchema>

export const SourcesFileSchema = z.object({ version: z.literal(1), sources: z.record(z.string().regex(/^[a-z0-9-]+$/), SourceSchema) })
export type SourcesFile = z.infer<typeof SourcesFileSchema>

const MetaSchema = z.object({
  kind: z.enum(['model', 'method']),
  verified: IsoDate,
  sources: z.array(z.string().regex(/^[a-z0-9-]+$/))
})
export type CardMeta = z.infer<typeof MetaSchema>

export interface ParsedCard {
  meta: CardMeta
  /** Modele giden metin: ön bilgi ve kaynak işaretleri çıkarılmış. */
  body: string
  claims: number
  unverified: number
  issues: string[]
}

const MARKER = / *\[s:([a-z0-9, -]+)\]/g
const UNVERIFIED = /\s*\[unverified\]/g

/** İddia sayılmayan satırlar: başlık, boş, tablo başlığı/ayracı, kod bloğu, iki noktayla biten giriş satırı. */
function isClaimLine(line: string, next: string | undefined): boolean {
  const t = line.trim()
  if (!t || t.startsWith('#') || t.startsWith('```') || t.endsWith(':')) return false
  if (/^\|?\s*:?-{3,}/.test(t)) return false
  // Tablo başlık satırı: altındaki satır ayraçtır.
  if (t.startsWith('|') && next !== undefined && /^\|?\s*:?-{3,}/.test(next.trim())) return false
  return true
}

export function parseCard(raw: string, registry: SourcesFile): ParsedCard {
  const issues: string[] = []
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw)
  if (!m) {
    return { meta: { kind: 'model', verified: '1970-01-01', sources: [] }, body: raw.trim(), claims: 0, unverified: 0, issues: ['ön bilgi bloğu yok'] }
  }
  const fields = Object.fromEntries(
    (m[1] ?? '').split(/\r?\n/).flatMap((l) => {
      const i = l.indexOf(':')
      return i > 0 ? [[l.slice(0, i).trim(), l.slice(i + 1).trim()]] : []
    })
  )
  const metaParsed = MetaSchema.safeParse({
    kind: fields.kind,
    verified: fields.verified,
    sources: (fields.sources ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
  })
  const meta: CardMeta = metaParsed.success ? metaParsed.data : { kind: 'model', verified: '1970-01-01', sources: [] }
  if (!metaParsed.success) issues.push(`ön bilgi geçersiz: ${metaParsed.error.issues.map((i) => i.path.join('.')).join(', ')}`)
  for (const id of meta.sources) if (!registry.sources[id]) issues.push(`bilinmeyen kaynak: ${id}`)
  if (meta.kind === 'model' && !meta.sources.length) issues.push('model kartında kaynak listesi boş')

  const lines = raw.slice(m[0].length).split(/\r?\n/)
  let inCode = false
  let claims = 0
  let unverified = 0
  const used = new Set<string>()
  lines.forEach((line, i) => {
    if (line.trim().startsWith('```')) inCode = !inCode
    if (inCode) return
    const ids = [...line.matchAll(MARKER)].flatMap((x) => (x[1] ?? '').split(',').map((s) => s.trim())).filter(Boolean)
    for (const id of ids) {
      used.add(id)
      if (!meta.sources.includes(id)) issues.push(`satır ${i + 1}: [s:${id}] ön bilgide listelenmemiş`)
    }
    const isUnverified = line.includes('[unverified]')
    if (!isClaimLine(line, lines[i + 1])) return
    claims++
    if (isUnverified) unverified++
    else if (meta.kind === 'model' && !ids.length) issues.push(`satır ${i + 1}: kaynaksız iddia: ${line.trim().slice(0, 60)}`)
  })
  for (const id of meta.sources) if (!used.has(id)) issues.push(`kaynak listelenmiş ama kullanılmamış: ${id}`)

  const body = lines
    .join('\n')
    .replace(MARKER, '')
    .replace(UNVERIFIED, ' (unverified)')
    .trim()
  return { meta, body, claims, unverified, issues }
}

/** Son doğrulaması `maxDays` günden eski kart mı (ROADMAP: 90 günü geçen kart eval öncesi yeniden doğrulanır). */
export function isStale(meta: CardMeta, today: Date, maxDays = 90): boolean {
  return (today.getTime() - Date.parse(meta.verified)) / 86_400_000 > maxDays
}
