// Arayüz metinleri tek bir sözlükten gelir. İngilizce kaynak sözlüktür (en.ts); Türkçe aynı anahtarları
// taşımak zorundadır (tip denetimi). Dil ayarı değişince App yeniden çizilir, bileşenler t() ile okur.
import { FAMILY_INFO, type Effort, type FamilyChoice, type ModelId, type Surface } from '@shared/catalog'
import type { UiLanguage } from '@shared/types'
import { en, type Key } from './en'
import { tr } from './tr'

const DICTS: Record<UiLanguage, Record<Key, string>> = { en, tr }
let lang: UiLanguage = 'en'

export function setLanguage(next: UiLanguage) {
  lang = next
  document.documentElement.lang = next
}

export const language = () => lang

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s

export function t(key: Key, vars?: Record<string, string | number>): string {
  return fill(DICTS[lang][key], vars)
}

const isKey = (k: string): k is Key => Object.hasOwn(en, k)

/** Katalogdan türeyen anahtarlar (ör. setupNote) için; sözlükte olmayan anahtar olduğu gibi döner, kapsam testi yakalar. */
export function tk(key: string, vars?: Record<string, string | number>): string {
  return isKey(key) ? t(key, vars) : key
}

export const locale = () => (lang === 'tr' ? 'tr-TR' : 'en-US')
export const fmtNumber = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale(), opts).format(n)
export const fmtDate = (ms: number, opts?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(), opts).format(ms)

// --- Katalog metinleri --------------------------------------------------------------

export const familyLabel = (f: FamilyChoice) => (f === 'auto' ? t('family.auto') : FAMILY_INFO[f].name)
export const surfaceLabel = (f: FamilyChoice, s: Surface) => (f === 'auto' ? t(`surface.generic.${s}`) : FAMILY_INFO[f].surfaces[s].label)
export const surfaceHint = (f: FamilyChoice, s: Surface) => t(`surface.hint.${f}.${s}`)
export const modelTagline = (m: ModelId) => t(`model.tagline.${m}`)
export const effortHint = (e: Effort) => t(`effort.hint.${e}`)
/** Seviyesi sabit modelde (effortText null) "sabit" yazar. */
export const effortName = (e: Effort | null) => e ?? t('effort.fixed')


/** Modelin döndürdüğü görev türü tanınmıyorsa olduğu gibi gösterilir. */
export const taskLabel = (type: string) => tk(`task.${type}`).replace(/^task\./, '')
