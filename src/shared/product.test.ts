import { describe, expect, it } from 'vitest'
import { PRODUCTS, PRODUCT_INFO, legacySource } from './product'
import { settingsDefaults } from './settings'

const all = PRODUCTS.map((id) => PRODUCT_INFO[id])

describe('product identity', () => {
  it('gives every product its own appId, data folder, shortcut and tag prefix', () => {
    for (const key of ['appId', 'dataDir', 'defaultHotkey', 'tagPrefix'] as const) {
      expect(new Set(all.map((p) => p[key])).size).toBe(all.length)
    }
  })

  it('keeps the decided Ray and Spectrum identities', () => {
    expect(PRODUCT_INFO.ray).toMatchObject({ appId: 'com.prism.ray', dataDir: 'Prism Ray', defaultHotkey: 'CommandOrControl+Alt+Space', tagPrefix: 'ray-v' })
    expect(PRODUCT_INFO.spectrum).toMatchObject({
      appId: 'com.prism.spectrum',
      dataDir: 'Prism Spectrum',
      defaultHotkey: 'CommandOrControl+Shift+Space',
      tagPrefix: 'spectrum-v'
    })
  })

  it('keeps the data folder equal to the product name (installer.nsh deletes APPDATA/PRODUCT_NAME)', () => {
    for (const p of all) expect(p.dataDir).toBe(p.name)
  })

  it('never lets a product read another product folder as legacy data', () => {
    const dirs = new Set(all.map((p) => p.dataDir))
    for (const p of all) for (const d of p.legacyDataDirs) expect(dirs.has(d)).toBe(false)
    expect(all.filter((p) => p.legacyDataDirs.length > 0).map((p) => p.id)).toEqual(['spectrum'])
  })

  it('uses the product default shortcut for a new install', () => {
    expect(settingsDefaults(PRODUCT_INFO.ray).hotkey).toBe('CommandOrControl+Alt+Space')
    expect(settingsDefaults(PRODUCT_INFO.spectrum).hotkey).toBe('CommandOrControl+Shift+Space')
  })
})

describe('legacySource', () => {
  const none = { hasOwnData: false, hasSignature: false, migrated: false }
  const dirs = (map: Record<string, Partial<typeof none>>) => (d: string) => ({ ...none, ...map[d] })

  it('copies from the newest legacy folder that carries a Prism signature', () => {
    expect(legacySource(PRODUCT_INFO.spectrum, dirs({ Prism: { hasOwnData: true, hasSignature: true }, Prompter: { hasSignature: true } }))).toBe('Prism')
    expect(legacySource(PRODUCT_INFO.spectrum, dirs({ Prompter: { hasOwnData: true, hasSignature: true } }))).toBe('Prompter')
  })

  it('ignores a legacy folder without the signature (it may belong to another app)', () => {
    expect(legacySource(PRODUCT_INFO.spectrum, dirs({ Prism: { hasOwnData: true } }))).toBeNull()
  })

  it('never migrates over existing data, twice, or for Ray', () => {
    const legacy = { Prism: { hasOwnData: true, hasSignature: true } }
    expect(legacySource(PRODUCT_INFO.spectrum, dirs({ ...legacy, 'Prism Spectrum': { hasOwnData: true } }))).toBeNull()
    expect(legacySource(PRODUCT_INFO.spectrum, dirs({ ...legacy, 'Prism Spectrum': { migrated: true } }))).toBeNull()
    expect(legacySource(PRODUCT_INFO.ray, dirs(legacy))).toBeNull()
  })
})
