// Knowledge card report: `npm run cards:report [-- --family=claude|openai|gemini|grok] [--json]`.
// Reads knowledge/ only; lists per-card claim, [unverified] and age counts, cards older than 90 days and
// sources no card cites. A report, not a gate: the exit code is always 0.
// Parsing rules mirror src/shared/knowledge.ts only as far as needed (TypeScript is not imported).
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_DAYS = 90
const FAMILIES = ['claude', 'openai', 'gemini', 'grok']
const dir = fileURLToPath(new URL('../knowledge/', import.meta.url))

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const familyArg = args.find((a) => a.startsWith('--family='))?.slice('--family='.length)
const unknown = args.filter((a) => a !== '--json' && !a.startsWith('--family='))
if (unknown.length || (familyArg !== undefined && !FAMILIES.includes(familyArg))) {
  console.error(`Usage: node scripts/cards-report.mjs [--family=${FAMILIES.join('|')}] [--json]`)
  process.exit(0)
}

const MARKER = / {0,8}\[s:([a-z0-9, -]{1,200})\]/g
const today = Date.now()
const ageOf = (iso) => Math.floor((today - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000)
const validDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d)

// Lines that are not claims: heading, blank, table header and separator, code fence, short intro line ending in a colon.
function isClaimLine(line, next) {
  const t = line.trim()
  if (!t || t.startsWith('```')) return false
  if ((t.startsWith('#') || t.endsWith(':')) && t.length <= 90) return false
  if (/^\|?\s*:?-{3,}/.test(t)) return false
  if (t.startsWith('|') && next !== undefined && /^\|?\s*:?-{3,}/.test(next.trim())) return false
  return true
}

function parseCard(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw)
  if (!m) return { error: 'no front matter block' }
  const fields = Object.fromEntries(
    m[1].split(/\r?\n/).flatMap((l) => {
      const i = l.indexOf(':')
      return i > 0 ? [[l.slice(0, i).trim(), l.slice(i + 1).trim()]] : []
    })
  )
  if (!['model', 'method'].includes(fields.kind)) return { error: `invalid kind: ${fields.kind ?? 'missing'}` }
  if (!validDate(fields.verified)) return { error: `invalid verified: ${fields.verified ?? 'missing'}` }
  const sources = (fields.sources ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const lines = raw.slice(m[0].length).split(/\r?\n/)
  let inCode = false
  let claims = 0
  let unverified = 0
  const cited = new Set(sources)
  lines.forEach((line, i) => {
    if (line.trim().startsWith('```')) inCode = !inCode
    if (inCode) return
    for (const x of line.matchAll(MARKER)) for (const id of x[1].split(',')) if (id.trim()) cited.add(id.trim())
    if (!isClaimLine(line, lines[i + 1])) return
    claims++
    if (line.includes('[unverified]')) unverified++
  })
  return { kind: fields.kind, verified: fields.verified, claims, unverified, cited: [...cited] }
}

const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.md'))
  .map((f) => relative(dir, join(dir, f)).replaceAll('\\', '/'))
  .toSorted()

const all = files.map((path) => {
  try {
    return { path, ...parseCard(readFileSync(join(dir, path), 'utf8')) }
  } catch (e) {
    return { path, error: e instanceof Error ? e.message : String(e) }
  }
})
const cards = familyArg ? all.filter((c) => c.path.startsWith(`${familyArg}/`)) : all
for (const c of cards) if (!c.error) c.age = ageOf(c.verified)

// Source lists ignore the filter: "no card cites it" is computed against all cards.
let registry = {}
let registryError
try {
  registry = JSON.parse(readFileSync(join(dir, 'sources.json'), 'utf8')).sources ?? {}
} catch (e) {
  registryError = e instanceof Error ? e.message : String(e)
}
const citedAll = new Set(all.flatMap((c) => c.cited ?? []))
const uncitedSources = Object.keys(registry).filter((id) => !citedAll.has(id))
const staleSources = Object.entries(registry)
  .filter(([, s]) => validDate(s?.retrieved) && ageOf(s.retrieved) > MAX_DAYS)
  .map(([id, s]) => ({ id, retrieved: s.retrieved, age: ageOf(s.retrieved) }))
const staleCards = cards.filter((c) => !c.error && c.age > MAX_DAYS).map((c) => ({ path: c.path, verified: c.verified, age: c.age }))
const totals = {
  cards: cards.length,
  claims: cards.reduce((n, c) => n + (c.claims ?? 0), 0),
  unverified: cards.reduce((n, c) => n + (c.unverified ?? 0), 0),
  staleCards: staleCards.length,
  errors: cards.filter((c) => c.error).length
}

if (asJson) {
  console.log(JSON.stringify({ generated: new Date(today).toISOString().slice(0, 10), maxDays: MAX_DAYS, cards, staleCards, uncitedSources, staleSources, registryError: registryError ?? null, totals }, null, 2))
  process.exit(0)
}

const pad = (v, n) => String(v).padEnd(n)
const w = Math.max(4, ...cards.map((c) => c.path.length))
console.log(`${pad('path', w)}  ${pad('kind', 6)}  ${pad('verified', 10)}  ${pad('age', 4)}  claims  unverified`)
for (const c of cards) {
  console.log(c.error ? `${pad(c.path, w)}  ERROR: ${c.error}` : `${pad(c.path, w)}  ${pad(c.kind, 6)}  ${c.verified}  ${pad(c.age, 4)}  ${pad(c.claims, 6)}  ${c.unverified}`)
}
console.log(`\nCards older than ${MAX_DAYS} days (${staleCards.length}):`)
for (const c of staleCards) console.log(`  ${c.path}  ${c.verified} (${c.age} days)`)
console.log(`\nSources no card cites (${uncitedSources.length}):`)
for (const id of uncitedSources) console.log(`  ${id}`)
console.log(`\nSource records older than ${MAX_DAYS} days (${staleSources.length}):`)
for (const s of staleSources) console.log(`  ${s.id}  ${s.retrieved} (${s.age} days)`)
if (registryError) console.log(`\ncould not read sources.json: ${registryError}`)
console.log(`\nTotal: ${totals.cards} cards, ${totals.claims} claims, ${totals.unverified} unverified, ${totals.staleCards} stale cards${totals.errors ? `, ${totals.errors} invalid cards` : ''}`)
process.exit(0)
