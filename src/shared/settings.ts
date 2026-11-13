// Settings file versions and migration. Pure module: file read/write, backups and .env are in config.ts.
//
// Rules (ROADMAP "Kurulum, güncelleme"):
// - Each version is migrated from the previous one step by step; before a migration config.ts takes a `settings.vN.json` backup.
// - Unrecognized fields are not dropped but put back on write: fields added by a newer version are not lost in an older version.
// - A file from a newer version is not downgraded: the version number is kept, known fields are read.
import type { z } from 'zod'
import { FAMILIES, type Family } from './catalog'
import type { ProductInfo } from './product'
import { SettingsSchema } from './schemas'
import type { Settings } from './types'

export const SETTINGS_VERSION = 3

const isFamily = (v: unknown): v is Family => (FAMILIES as readonly unknown[]).includes(v)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function settingsDefaults(product: ProductInfo): Settings {
  return {
    version: SETTINGS_VERSION,
    engineProvider: 'auto',
    engineModels: {},
    vertex: { project: '', location: 'global' },
    defaultFamily: product.familyMode === 'single' ? 'claude' : 'auto',
    families: product.familyMode === 'single' ? ['claude'] : [...FAMILIES],
    uiLanguage: 'en',
    setup: { done: false, step: 'families' },
    appFamilies: [],
    replyLanguage: 'en',
    defaultSurface: 'agent',
    alwaysOnTop: true,
    hotkey: product.defaultHotkey,
    launchAtLogin: false,
    notifyWhenHidden: true,
    saveHistory: true,
    contentProtection: false,
    updateCheck: true
  }
}

type Raw = Record<string, unknown>

/** v1 (Claude target only + Vertex engine) → v2. The existing user's flow stays on Claude. */
function v1to2(raw: Raw): Raw {
  const { analysisModel, generationModel, defaultSurface, ...rest } = raw
  const model = (v: unknown) => (typeof v === 'string' && v ? v : 'gemini-4-argon')
  return {
    ...rest,
    version: 2,
    engineModels: analysisModel || generationModel ? { vertex: { analysis: model(analysisModel), generation: model(generationModel) } } : {},
    vertex: { project: '', location: 'global', ...(isRecord(raw.vertex) ? raw.vertex : {}) },
    defaultFamily: 'claude',
    appFamilies: ['claude'],
    defaultSurface: !defaultSurface || defaultSurface === 'claude-code' ? 'agent' : defaultSurface
  }
}

/**
  * v2 → v3: adds family selection, UI language and setup state. The 2.x user worked with the Turkish UI and
  * had completed setup; their UI stays the same. In a multi-family product all families come selected (2.x behavior);
  * in a single-family product the default family, and Claude if there is none.
 */
function v2to3(raw: Raw, product: ProductInfo): Raw {
  const def = isFamily(raw.defaultFamily) ? raw.defaultFamily : null
  const families: Family[] = product.familyMode === 'single' ? [def ?? 'claude'] : [...FAMILIES]
  return {
    ...raw,
    version: 3,
    families,
    defaultFamily: product.familyMode === 'single' ? families[0] : raw.defaultFamily,
    setup: { done: true, step: 'shortcut' }
  }
}

const STEPS: Record<number, (raw: Raw, product: ProductInfo) => Raw> = { 1: v1to2, 2: v2to3 }

const KNOWN = new Set(Object.keys(SettingsSchema.shape))

export interface LoadedSettings {
  settings: Settings
    /** The version in the file (null if there is no file). */
  from: number | null
    /** Fields this version does not recognize; put back on write. */
  extras: Raw
    /** The file was written by a version newer than this app. */
  newer: boolean
    /** Names (not values) of invalid fields that fell back to the default. */
  invalid: string[]
    /** Raw values of known fields that a newer version wrote but this version cannot read; written back to disk unchanged until modified. */
  shadow: Raw
}

/** Field-by-field validation: one corrupt field must not reset all settings. */
function sanitize(raw: Raw, product: ProductInfo, invalid: string[]): Settings {
  const d = settingsDefaults(product)
  const s = SettingsSchema.shape
  const field = <K extends keyof Settings>(key: K, schema: z.ZodType<Settings[K]>): Settings[K] => {
    if (raw[key] === undefined) return d[key]
    const parsed = schema.safeParse(raw[key])
    if (parsed.success) return parsed.data
    invalid.push(key)
    return d[key]
  }
  const out: Settings = {
    version: field('version', s.version),
    engineProvider: field('engineProvider', s.engineProvider),
    engineModels: field('engineModels', s.engineModels),
    vertex: field('vertex', s.vertex),
    defaultFamily: field('defaultFamily', s.defaultFamily),
    families: field('families', s.families),
    // English only: an older 'tr' value is not an error, it is simply read as English.
    uiLanguage: 'en',
    setup: field('setup', s.setup),
    appFamilies: field('appFamilies', s.appFamilies),
    replyLanguage: field('replyLanguage', s.replyLanguage),
    defaultSurface: field('defaultSurface', s.defaultSurface),
    alwaysOnTop: field('alwaysOnTop', s.alwaysOnTop),
    hotkey: field('hotkey', s.hotkey),
    launchAtLogin: field('launchAtLogin', s.launchAtLogin),
    notifyWhenHidden: field('notifyWhenHidden', s.notifyWhenHidden),
    saveHistory: field('saveHistory', s.saveHistory),
    contentProtection: field('contentProtection', s.contentProtection),
    updateCheck: field('updateCheck', s.updateCheck)
  }
  return conform(out, product, invalid)
}

/** Product rules: the number of families must fit the product, the default family is one of the selected families (or 'auto' in a multi-family product). */
export function conform(s: Settings, product: ProductInfo, invalid: string[] = []): Settings {
  const d = settingsDefaults(product)
  let families = [...new Set(s.families)]
  if (product.familyMode === 'single' && families.length !== 1) {
    invalid.push('families')
    families = [families[0] ?? (s.defaultFamily !== 'auto' ? s.defaultFamily : d.families[0] ?? 'claude')]
  }
  const fallback = product.familyMode === 'single' ? (families[0] ?? 'claude') : 'auto'
  const keep = s.defaultFamily === 'auto' ? product.familyMode === 'multi' : families.includes(s.defaultFamily)
  const defaultFamily = keep ? s.defaultFamily : fallback
  return { ...s, families, defaultFamily }
}

// An unreadable setting must not silently turn privacy off: history saving and the network update check start off, content protection
// starts on. The user can turn them back on in settings.
const PRIVACY_CLOSED = { saveHistory: false, updateCheck: false, contentProtection: true } as const

/** On a corrupt file or invalid field, privacy settings are pulled to the closed values. */
export function failClosed(s: Settings, invalid: readonly string[], corrupt: boolean): Settings {
  const closed = (key: keyof typeof PRIVACY_CLOSED) => corrupt || invalid.includes(key)
  return {
    ...s,
    saveHistory: closed('saveHistory') ? PRIVACY_CLOSED.saveHistory : s.saveHistory,
    updateCheck: closed('updateCheck') ? PRIVACY_CLOSED.updateCheck : s.updateCheck,
    contentProtection: closed('contentProtection') ? PRIVACY_CLOSED.contentProtection : s.contentProtection
  }
}

export function loadSettings(raw: unknown, product: ProductInfo): LoadedSettings {
  const invalid: string[] = []
  if (raw === null) return { settings: settingsDefaults(product), from: null, extras: {}, newer: false, invalid, shadow: {} }
  if (!isRecord(raw)) return { settings: failClosed(settingsDefaults(product), [], true), from: null, extras: {}, newer: false, invalid: ['(file)'], shadow: {} }
    // An invalid version number counts as 1. A very large number also means "newer"; the migration loop is bounded by SETTINGS_VERSION.
  const ver = raw.version
  const from = typeof ver === 'number' && Number.isInteger(ver) && ver >= 1 && ver <= 1_000_000 ? ver : 1
  const newer = from > SETTINGS_VERSION
  let cur: Raw = { ...raw, version: from }
  for (let v = from; v < SETTINGS_VERSION; v++) {
    const step = STEPS[v]
    if (step) cur = step(cur, product)
  }
  const extras = Object.fromEntries(Object.entries(cur).filter(([k]) => !KNOWN.has(k)))
  // The removed language step of an unfinished older setup continues at the first remaining step.
  if (isRecord(cur.setup) && cur.setup.step === 'language') cur = { ...cur, setup: { ...cur.setup, step: 'families' } }
  const settings = failClosed(sanitize({ ...cur, version: newer ? from : SETTINGS_VERSION }, product, invalid), invalid, false)
    // So a field written by a newer version is not lost when this version cannot read it or changed it by a product rule:
    // its raw form is kept, only for a newer file.
  const view: Raw = { ...settings }
  const shadow: Raw = newer
    ? Object.fromEntries([...KNOWN].filter((k) => k !== 'version' && cur[k] !== undefined && stable(cur[k]) !== stable(view[k])).map((k) => [k, cur[k]]))
    : {}
  return { settings, from, extras, newer, invalid, shadow }
}

/**
  * The object to write to disk: unrecognized fields are put back, known fields hold this version's value. If `preserved` is given,
  * a field unreadable from the newer file is written in its raw form unless the user changed it (it equals the value at load time).
 */
export function serializeSettings(settings: Settings, extras: Raw, preserved?: { shadow: Raw; base: Settings }): Raw {
  const out: Raw = { ...extras, ...settings }
  if (!preserved) return out
  const base: Raw = { ...preserved.base }
  for (const [k, v] of Object.entries(preserved.shadow)) if (stable(out[k]) === stable(base[k])) out[k] = v
  return out
}

/** JSON independent of key order: the equality comparison must not trip on object order. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (isRecord(v)) return `{${Object.keys(v).toSorted().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'undefined'
}
