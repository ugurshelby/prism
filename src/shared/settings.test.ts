import { describe, expect, it } from 'vitest'
import { PRODUCT_INFO } from './product'
import { SETTINGS_VERSION, conform, loadSettings, serializeSettings, settingsDefaults } from './settings'

const ray = PRODUCT_INFO.ray
const spectrum = PRODUCT_INFO.spectrum

describe('loadSettings', () => {
  it('gives product defaults for a new install', () => {
    const r = loadSettings(null, ray)
    expect(r.settings).toEqual(settingsDefaults(ray))
    expect(r.settings.families).toEqual(['claude'])
    expect(r.settings.uiLanguage).toBe('en')
    expect(r.settings.setup.done).toBe(false)
    expect(loadSettings(null, spectrum).settings.families).toHaveLength(4)
  })

  it('migrates v1 through v2 to v3 and keeps the Claude flow', () => {
    const r = loadSettings({ version: 1, analysisModel: 'gemini-4-argon', defaultSurface: 'claude-code', hotkey: 'Alt+P' }, spectrum)
    expect(r.from).toBe(1)
    expect(r.settings.version).toBe(SETTINGS_VERSION)
    expect(r.settings.engineModels.vertex?.analysis).toBe('gemini-4-argon')
    expect(r.settings.defaultSurface).toBe('agent')
    expect(r.settings.defaultFamily).toBe('claude')
    expect(r.settings.hotkey).toBe('Alt+P')
    expect(r.settings.uiLanguage).toBe('tr')
    expect(r.settings.setup.done).toBe(true)
  })

  it('maps a 2.x user onto a single-family product by their default family', () => {
    const r = loadSettings({ version: 2, defaultFamily: 'gemini', appFamilies: [] }, ray)
    expect(r.settings.families).toEqual(['gemini'])
    expect(r.settings.defaultFamily).toBe('gemini')
    const auto = loadSettings({ version: 2, defaultFamily: 'auto' }, ray)
    expect(auto.settings.families).toEqual(['claude'])
    expect(auto.settings.defaultFamily).toBe('claude')
  })

  it('keeps unknown fields and never downgrades a newer file', () => {
    const r = loadSettings({ version: 9, futureField: { a: 1 }, hotkey: 'Alt+K', families: ['openai'], uiLanguage: 'tr' }, spectrum)
    expect(r.newer).toBe(true)
    expect(r.settings.version).toBe(9)
    expect(r.settings.hotkey).toBe('Alt+K')
    expect(r.extras).toEqual({ futureField: { a: 1 } })
    expect(serializeSettings(r.settings, r.extras)).toMatchObject({ version: 9, futureField: { a: 1 }, hotkey: 'Alt+K' })
  })

  it('writes back a newer file’s unreadable known field unless the user changed it', () => {
    const r = loadSettings({ version: 9, uiLanguage: 'de', hotkey: { chord: ['Alt', 'K'] } }, spectrum)
    expect(r.shadow).toEqual({ uiLanguage: 'de', hotkey: { chord: ['Alt', 'K'] } })
    const preserved = { shadow: r.shadow, base: r.settings }
    expect(serializeSettings(r.settings, r.extras, preserved)).toMatchObject({ uiLanguage: 'de', hotkey: { chord: ['Alt', 'K'] } })
    const changed = serializeSettings({ ...r.settings, uiLanguage: r.settings.uiLanguage === 'tr' ? 'en' : 'tr' }, r.extras, preserved)
    expect(changed).toMatchObject({ uiLanguage: r.settings.uiLanguage === 'tr' ? 'en' : 'tr', hotkey: { chord: ['Alt', 'K'] } })
    expect(loadSettings({ version: 3, uiLanguage: 'de' }, spectrum).shadow).toEqual({})
  })

  it('keeps product-rule changes of a newer file and never treats a huge version as v1', () => {
    const r = loadSettings({ version: 500, families: ['openai', 'gemini'], vertex: { location: 'global', project: 'p-1' } }, ray)
    expect(r.newer).toBe(true)
    expect(r.settings.families).toHaveLength(1)
    expect(r.shadow.families).toEqual(['openai', 'gemini'])
    // Anahtar sırası farklı ama değeri aynı iç içe alan "değişti" sayılmaz.
    const base = { ...r.settings, vertex: { location: 'global', project: 'p-1' } }
    const now = { ...r.settings, vertex: { project: 'p-1', location: 'global' } }
    expect(serializeSettings(now, r.extras, { shadow: r.shadow, base })).toMatchObject({ version: 500, families: ['openai', 'gemini'] })
  })

  it('resets only the invalid fields and names them', () => {
    const r = loadSettings({ version: 3, hotkey: 'Bad Key With Spaces', uiLanguage: 'de', families: ['gemini'] }, spectrum)
    expect(r.invalid.toSorted()).toEqual(['hotkey', 'uiLanguage'])
    expect(r.settings.families).toEqual(['gemini'])
  })

  it('treats a non-object file as unreadable', () => {
    expect(loadSettings([1, 2], spectrum).invalid).toEqual(['(dosya)'])
  })
})

describe('conform', () => {
  it('forces exactly one family on Ray and a default inside the selection', () => {
    const s = conform({ ...settingsDefaults(spectrum), families: ['openai', 'grok'], defaultFamily: 'auto' }, ray)
    expect(s.families).toEqual(['openai'])
    expect(s.defaultFamily).toBe('openai')
  })

  it('drops a default family that is no longer selected', () => {
    const s = conform({ ...settingsDefaults(spectrum), families: ['gemini'], defaultFamily: 'claude' }, spectrum)
    expect(s.defaultFamily).toBe('auto')
  })
})
