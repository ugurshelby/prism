// Knowledge card format: a short front matter block at the top, a source marker at the end of each claim line in the body.
//
//   ---
//   kind: model            (model: claims about a model, every line sourced; method: Prism's own method)
//   verified: 2026-11-08   (last verification date)
//   sources: gemini-models, gemini-thinking
//   ---
//   - Thinking cannot be turned off. [s:gemini-thinking]
//   - Something we could not confirm. [unverified]
//
// Markers are stripped from the body before it goes to the model; [unverified] stays as "(unverified)".
// Pure module: imports neither Node nor Electron; the main process and tests use the same check.
import { z } from 'zod'

// A day that exists in the calendar (2026-02-30 fails); round-trip check.
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => !Number.isNaN(Date.parse(d)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), 'invalid date')

export const SourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('doc'),
    title: z.string().min(1),
    publisher: z.string().min(1),
    url: z.url({ protocol: /^https$/ }),
    retrieved: IsoDate
  }),
    // Prism's own eval measurement: the evidence is in the run report under .work, there is no URL.
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
    /** Text that goes to the model: front matter and source markers removed. */
  body: string
  claims: number
  unverified: number
  issues: string[]
}

const MARKER = / {0,8}\[s:([a-z0-9, -]{1,200})\]/g
const UNVERIFIED = / {0,8}\[unverified\]/g

/** Lines that are not claims: heading, blank, table header/separator, code fence, intro line ending in a colon. */
function isClaimLine(line: string, next: string | undefined): boolean {
  const t = line.trim()
    // Headings and intro lines must be short: a long "heading" or a paragraph ending in ":" must not carry an unsourced claim.
  if (!t || t.startsWith('```')) return false
  if ((t.startsWith('#') || t.endsWith(':')) && t.length <= 90) return false
  if (/^\|?\s*:?-{3,}/.test(t)) return false
    // Table header row: the line below it is the separator.
  if (t.startsWith('|') && next !== undefined && /^\|?\s*:?-{3,}/.test(next.trim())) return false
  return true
}

export function parseCard(raw: string, registry: SourcesFile): ParsedCard {
  const issues: string[] = []
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw)
  if (!m) {
        return { meta: { kind: 'model', verified: '1970-01-01', sources: [] }, body: raw.trim(), claims: 0, unverified: 0, issues: ['no front matter block'] }
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
    if (!metaParsed.success) issues.push(`invalid front matter: ${metaParsed.error.issues.map((i) => i.path.join('.')).join(', ')}`)
  for (const id of meta.sources) if (!Object.hasOwn(registry.sources, id)) issues.push(`unknown source: ${id}`)
    if (meta.kind === 'model' && !meta.sources.length) issues.push('model card has an empty source list')

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
            if (!meta.sources.includes(id)) issues.push(`line ${i + 1}: [s:${id}] is not listed in the front matter`)
    }
    const isUnverified = line.includes('[unverified]')
    if (!isClaimLine(line, lines[i + 1])) return
    claims++
    if (isUnverified) unverified++
        else if (meta.kind === 'model' && !ids.length) issues.push(`line ${i + 1}: unsourced claim: ${line.trim().slice(0, 60)}`)
  })
    if (inCode) issues.push('code fence is not closed')
    for (const id of meta.sources) if (!used.has(id)) issues.push(`source listed but unused: ${id}`)
    if (Date.parse(meta.verified) > Date.now() + 86_400_000) issues.push('last verified date is in the future')

    // Markers are stripped only outside code blocks: example code and snippets in the cards stay as they are.
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

/** Is the card last verified more than `maxDays` days ago (ROADMAP: cards older than 90 days are re-verified before release). */
export function isStale(meta: CardMeta, today: Date, maxDays = 90): boolean {
  return (today.getTime() - Date.parse(meta.verified)) / 86_400_000 > maxDays
}
