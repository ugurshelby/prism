// Ayar dosyasının sürümleri ve göçü. Saf modül: dosya okuma/yazma, yedek ve .env config.ts'te.
//
// Kurallar (ROADMAP "Kurulum, güncelleme"):
// - Her sürüm bir öncekinden adım adım taşınır; göçten önce config.ts `settings.vN.json` yedeğini alır.
// - Tanınmayan alanlar atılmaz, yazımda geri konur: daha yeni bir sürümün eklediği alanlar eski sürümde kaybolmaz.
// - Daha yeni bir sürümün dosyası eski sürüme indirilmez: sürüm numarası korunur, bilinen alanlar okunur.
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
    setup: { done: false, step: 'language' },
    appFamilies: [],
    replyLanguage: 'tr',
    defaultSurface: 'agent',
    alwaysOnTop: true,
    hotkey: 'CommandOrControl+Shift+Space',
    launchAtLogin: false,
    notifyWhenHidden: true,
    saveHistory: true,
    contentProtection: false
  }
}

type Raw = Record<string, unknown>

/** v1 (yalnızca Claude hedefi + Vertex motoru) → v2. Mevcut kullanıcının akışı Claude'da kalır. */
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
 * v2 → v3: aile seçimi, arayüz dili ve kurulum durumu eklenir. 2.x kullanıcısı Türkçe arayüzle çalışıyordu ve
 * kurulumu geçmişti; arayüzü aynı kalır. Çok aileli üründe bütün aileler seçili gelir (2.x davranışı);
 * tek aileli üründe varsayılan aile, o da yoksa Claude seçilir.
 */
function v2to3(raw: Raw, product: ProductInfo): Raw {
  const def = isFamily(raw.defaultFamily) ? raw.defaultFamily : null
  const families: Family[] = product.familyMode === 'single' ? [def ?? 'claude'] : [...FAMILIES]
  return {
    ...raw,
    version: 3,
    families,
    defaultFamily: product.familyMode === 'single' ? families[0] : raw.defaultFamily,
    uiLanguage: 'tr',
    setup: { done: true, step: 'shortcut' }
  }
}

const STEPS: Record<number, (raw: Raw, product: ProductInfo) => Raw> = { 1: v1to2, 2: v2to3 }

const KNOWN = new Set(Object.keys(SettingsSchema.shape))

export interface LoadedSettings {
  settings: Settings
  /** Dosyadaki sürüm (dosya yoksa null). */
  from: number | null
  /** Bu sürümün tanımadığı alanlar; yazımda geri konur. */
  extras: Raw
  /** Dosya bu uygulamadan daha yeni bir sürümle yazılmış. */
  newer: boolean
  /** Varsayılana dönen geçersiz alanların adları (değerleri değil). */
  invalid: string[]
  /** Daha yeni sürümün yazdığı ama bu sürümün okuyamadığı bilinen alanların ham değerleri; değişmedikçe diske aynen geri yazılır. */
  shadow: Raw
}

/** Alan alan doğrulama: tek bir bozuk alan bütün ayarları sıfırlamasın. */
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
    uiLanguage: field('uiLanguage', s.uiLanguage),
    setup: field('setup', s.setup),
    appFamilies: field('appFamilies', s.appFamilies),
    replyLanguage: field('replyLanguage', s.replyLanguage),
    defaultSurface: field('defaultSurface', s.defaultSurface),
    alwaysOnTop: field('alwaysOnTop', s.alwaysOnTop),
    hotkey: field('hotkey', s.hotkey),
    launchAtLogin: field('launchAtLogin', s.launchAtLogin),
    notifyWhenHidden: field('notifyWhenHidden', s.notifyWhenHidden),
    saveHistory: field('saveHistory', s.saveHistory),
    contentProtection: field('contentProtection', s.contentProtection)
  }
  return conform(out, product, invalid)
}

/** Ürün kuralları: aile sayısı ürüne uymalı, varsayılan aile seçili ailelerden biri (ya da çok aileli üründe 'auto'). */
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

export function loadSettings(raw: unknown, product: ProductInfo): LoadedSettings {
  const invalid: string[] = []
  if (raw === null) return { settings: settingsDefaults(product), from: null, extras: {}, newer: false, invalid, shadow: {} }
  if (!isRecord(raw)) return { settings: settingsDefaults(product), from: null, extras: {}, newer: false, invalid: ['(dosya)'], shadow: {} }
  // Geçersiz sürüm numarası 1 sayılır. Çok büyük numara da "daha yeni" demektir; göç döngüsü SETTINGS_VERSION ile sınırlıdır.
  const ver = raw.version
  const from = typeof ver === 'number' && Number.isInteger(ver) && ver >= 1 && ver <= 1_000_000 ? ver : 1
  const newer = from > SETTINGS_VERSION
  let cur: Raw = { ...raw, version: from }
  for (let v = from; v < SETTINGS_VERSION; v++) {
    const step = STEPS[v]
    if (step) cur = step(cur, product)
  }
  const extras = Object.fromEntries(Object.entries(cur).filter(([k]) => !KNOWN.has(k)))
  const settings = sanitize({ ...cur, version: newer ? from : SETTINGS_VERSION }, product, invalid)
  // Yeni sürümün yazdığı bir alanı bu sürüm okuyamadı ya da ürün kuralıyla değiştirdiyse değer kaybolmasın:
  // yalnızca daha yeni dosyada, ham hâli saklanır.
  const view: Raw = { ...settings }
  const shadow: Raw = newer
    ? Object.fromEntries([...KNOWN].filter((k) => k !== 'version' && cur[k] !== undefined && stable(cur[k]) !== stable(view[k])).map((k) => [k, cur[k]]))
    : {}
  return { settings, from, extras, newer, invalid, shadow }
}

/**
 * Diske yazılacak nesne: tanınmayan alanlar geri konur, bilinen alanlar bu sürümün değeridir. `preserved` verilirse,
 * daha yeni dosyadan okunamayan bir alan kullanıcı değiştirmediği sürece (yükleme anındaki değerle aynıysa) ham hâliyle yazılır.
 */
export function serializeSettings(settings: Settings, extras: Raw, preserved?: { shadow: Raw; base: Settings }): Raw {
  const out: Raw = { ...extras, ...settings }
  if (!preserved) return out
  const base: Raw = { ...preserved.base }
  for (const [k, v] of Object.entries(preserved.shadow)) if (stable(out[k]) === stable(base[k])) out[k] = v
  return out
}

/** Anahtar sırasından bağımsız JSON: eşitlik karşılaştırması nesne sırasına takılmasın. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (isRecord(v)) return `{${Object.keys(v).toSorted().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'undefined'
}
