import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PRODUCT_INFO } from '@shared/product'
import { MIGRATION_MARKER, migrateLegacyData } from './migrate'

const roots: string[] = []
const appData = () => {
  const d = mkdtempSync(join(tmpdir(), 'prism-migrate-'))
  roots.push(d)
  return d
}
afterEach(() => {
  for (const d of roots.splice(0)) rmSync(d, { recursive: true, force: true })
})
const put = (dir: string, files: Record<string, string>) => {
  mkdirSync(dir, { recursive: true })
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
}

describe('migrateLegacyData', () => {
  it('copies Prism files and Local State from the 2.x folder once, leaving the old folder untouched', () => {
    const root = appData()
    put(join(root, 'Prism'), { 'settings.json': '{"version":2}', 'anthropic.key': 'sealed', 'history.enc': 'sealed', 'Local State': '{}', 'notes.txt': 'x', 'history.enc.1.bak': 'old' })
    expect(migrateLegacyData(root, PRODUCT_INFO.spectrum)).toBe('Prism')
    const target = join(root, 'Prism Spectrum')
    expect(readdirSync(target).sort()).toEqual(['Local State', 'anthropic.key', 'history.enc', MIGRATION_MARKER, 'settings.json'].sort())
    expect(JSON.parse(readFileSync(join(target, MIGRATION_MARKER), 'utf8'))).toMatchObject({ from: 'Prism' })
    expect(readdirSync(join(root, 'Prism')).length).toBe(6)
    expect(readdirSync(root).some((n) => n.includes('.migrating-'))).toBe(false)
    // İkinci açılışta yeniden kopyalanmaz.
    expect(migrateLegacyData(root, PRODUCT_INFO.spectrum)).toBeNull()
  })

  it('does not adopt a folder of the same name without a Prism signature', () => {
    const root = appData()
    put(join(root, 'Prism'), { 'settings.json': '{"theme":"dark"}', 'window-state.json': '{}' })
    expect(migrateLegacyData(root, PRODUCT_INFO.spectrum)).toBeNull()
    expect(readdirSync(root)).toEqual(['Prism'])
  })

  it('does nothing for Ray', () => {
    const root = appData()
    put(join(root, 'Prism'), { 'anthropic.key': 'sealed' })
    expect(migrateLegacyData(root, PRODUCT_INFO.ray)).toBeNull()
  })
})
