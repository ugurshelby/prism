import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { wipeOwnData } from './wipe'

const dirs: string[] = []
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), 'prism-wipe-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('wipeOwnData', () => {
  it('removes only Prism files, across every given folder, and reports nothing left', () => {
    const a = scratch()
    const b = scratch()
    for (const f of ['settings.json', 'history.enc', 'history.enc.1.bak', 'anthropic.key', 'models.json.bozuk-1', 'notes.txt', '.env']) writeFileSync(join(a, f), 'x')
    mkdirSync(join(a, 'Cache'))
    writeFileSync(join(b, 'vertex.key'), 'x')
    expect(wipeOwnData([a, b, join(a, 'missing')])).toEqual([])
    expect(readdirSync(a).sort()).toEqual(['.env', 'Cache', 'notes.txt'])
    expect(readdirSync(b)).toEqual([])
  })

  it('reports a Prism-named entry it cannot delete instead of passing silently', () => {
    const a = scratch()
    mkdirSync(join(a, 'settings.json'))
    expect(wipeOwnData([a])).toEqual(['settings.json'])
  })
})
