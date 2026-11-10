// Bilgi kartı raporu: `npm run cards:report [-- --family=claude|openai|gemini|grok] [--json]`.
// knowledge/ altını yalnızca okur; kart başına iddia, [unverified] ve yaş sayısını, 90 günü geçen kartları ve
// hiçbir kartın anmadığı kaynakları listeler. Bir kapı değil rapordur: çıkış kodu her zaman 0.
// Ayrıştırma kuralları src/shared/knowledge.ts'ten yalnızca gerektiği kadar yansıtılır (TypeScript içe aktarılmaz).
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
  console.error(`Kullanım: node scripts/cards-report.mjs [--family=${FAMILIES.join('|')}] [--json]`)
  process.exit(0)
}

const MARKER = / {0,8}\[s:([a-z0-9, -]{1,200})\]/g
const today = Date.now()
const ageOf = (iso) => Math.floor((today - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000)
const validDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d)

// İddia sayılmayan satırlar: başlık, boş, tablo başlığı ve ayracı, kod bloğu, iki noktayla biten kısa giriş satırı.
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
  if (!m) return { error: 'ön bilgi bloğu yok' }
  const fields = Object.fromEntries(
    m[1].split(/\r?\n/).flatMap((l) => {
      const i = l.indexOf(':')
      return i > 0 ? [[l.slice(0, i).trim(), l.slice(i + 1).trim()]] : []
    })
  )
  if (!['model', 'method'].includes(fields.kind)) return { error: `kind geçersiz: ${fields.kind ?? 'yok'}` }
  if (!validDate(fields.verified)) return { error: `verified geçersiz: ${fields.verified ?? 'yok'}` }
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

// Kaynak listeleri filtreden bağımsızdır: "hiçbir kart anmıyor" bütün kartlara göre hesaplanır.
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
  console.log(c.error ? `${pad(c.path, w)}  HATA: ${c.error}` : `${pad(c.path, w)}  ${pad(c.kind, 6)}  ${c.verified}  ${pad(c.age, 4)}  ${pad(c.claims, 6)}  ${c.unverified}`)
}
console.log(`\n${MAX_DAYS} günden eski kartlar (${staleCards.length}):`)
for (const c of staleCards) console.log(`  ${c.path}  ${c.verified} (${c.age} gün)`)
console.log(`\nHiçbir kartın anmadığı kaynaklar (${uncitedSources.length}):`)
for (const id of uncitedSources) console.log(`  ${id}`)
console.log(`\n${MAX_DAYS} günden eski kaynak kayıtları (${staleSources.length}):`)
for (const s of staleSources) console.log(`  ${s.id}  ${s.retrieved} (${s.age} gün)`)
if (registryError) console.log(`\nsources.json okunamadı: ${registryError}`)
console.log(`\nToplam: ${totals.cards} kart, ${totals.claims} iddia, ${totals.unverified} doğrulanmamış, ${totals.staleCards} eski kart${totals.errors ? `, ${totals.errors} hatalı kart` : ''}`)
process.exit(0)
