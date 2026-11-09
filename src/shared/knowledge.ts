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

// Takvimde olan bir gün (2026-02-30 geçmez); gidiş-dönüş denetimi.
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => !Number.isNaN(Date.parse(d)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), 'geçersiz tarih')

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

const MARKER = / {0,8}\[s:([a-z0-9, -]{1,200})\]/g
const UNVERIFIED = / {0,8}\[unverified\]/g

/** İddia sayılmayan satırlar: başlık, boş, tablo başlığı/ayracı, kod bloğu, iki noktayla biten giriş satırı. */
function isClaimLine(line: string, next: string | undefined): boolean {
  const t = line.trim()
  // Başlık ve giriş satırı kısa olmalı: uzun bir "başlık" ya da ":" ile biten paragraf kaynaksız iddia taşıyamasın.
  if (!t || t.startsWith('```')) return false
  if ((t.startsWith('#') || t.endsWith(':')) && t.length <= 90) return false
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
  for (const id of meta.sources) if (!Object.hasOwn(registry.sources, id)) issues.push(`bilinmeyen kaynak: ${id}`)
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
  if (inCode) issues.push('kod bloğu kapanmamış')
  for (const id of meta.sources) if (!used.has(id)) issues.push(`kaynak listelenmiş ama kullanılmamış: ${id}`)
  if (Date.parse(meta.verified) > Date.now() + 86_400_000) issues.push('son doğrulama tarihi gelecekte')

  // İşaretler yalnızca kod bloğu dışında silinir: kartlardaki örnek kod ve snippet'ler olduğu gibi kalır.
  let code = false
  const body = lines
    .map((line) => {
      if (line.trim().startsWith('```')) code = !code
      return code || line.trim().startsWith('```') ? line : line.replace(MARKER, '').replace(UNVERIFIED, ' (unverified)')
    })
    .join('\n')
    .trim()
  return { meta, body, claims, unverified, issues }
}

/** Son doğrulaması `maxDays` günden eski kart mı (ROADMAP: 90 günü geçen kart yayından önce yeniden doğrulanır). */
export function isStale(meta: CardMeta, today: Date, maxDays = 90): boolean {
  return (today.getTime() - Date.parse(meta.verified)) / 86_400_000 > maxDays
}
