import { describe, expect, it } from 'vitest'
import { PRODUCTS, PRODUCT_INFO, pickDataDir } from './product'
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

describe('pickDataDir', () => {
  const has = (...dirs: string[]) => (d: string) => dirs.includes(d)

  it('prefers the product folder when it holds data', () => {
    expect(pickDataDir(PRODUCT_INFO.spectrum, has('Prism Spectrum', 'Prism', 'Prompter'))).toBe('Prism Spectrum')
  })

  it('falls back to the newest legacy folder for Spectrum only', () => {
    expect(pickDataDir(PRODUCT_INFO.spectrum, has('Prism', 'Prompter'))).toBe('Prism')
    expect(pickDataDir(PRODUCT_INFO.spectrum, has('Prompter'))).toBe('Prompter')
    expect(pickDataDir(PRODUCT_INFO.ray, has('Prism', 'Prompter'))).toBe('Prism Ray')
  })

  it('uses the product folder on a fresh machine', () => {
    expect(pickDataDir(PRODUCT_INFO.ray, has())).toBe('Prism Ray')
    expect(pickDataDir(PRODUCT_INFO.spectrum, has())).toBe('Prism Spectrum')
  })
})
