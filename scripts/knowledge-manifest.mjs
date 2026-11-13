// SHA-256 of every file under knowledge/, keyed by its POSIX path relative to that folder. electron.vite.config.ts
// embeds it in the main bundle at build time; the app refuses a card whose bytes differ (src/main/engine/integrity.ts).
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export function knowledgeManifest(dir) {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
  const out = {}
  for (const e of files) {
    const full = join(e.parentPath, e.name)
    out[relative(dir, full).split(sep).join('/')] = createHash('sha256').update(readFileSync(full)).digest('hex')
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}
