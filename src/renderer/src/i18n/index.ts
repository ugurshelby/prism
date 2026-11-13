// All UI text comes from one English dictionary (en.ts); components read it through t(). English only
// (owner, 2026-11-13).
import { FAMILY_INFO, type Effort, type FamilyChoice, type ModelId, type Surface } from '@shared/catalog'
import { en, type Key } from './en'

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s

export function t(key: Key, vars?: Record<string, string | number>): string {
  return fill(en[key], vars)
}

const isKey = (k: string): k is Key => Object.hasOwn(en, k)

/** For keys derived from the catalog (e.g. setupNote); an unknown key is returned as is and the coverage test catches it. */
export function tk(key: string, vars?: Record<string, string | number>): string {
  return isKey(key) ? t(key, vars) : key
}

const LOCALE = 'en-US'
export const fmtNumber = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(LOCALE, opts).format(n)
export const fmtDate = (ms: number, opts?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, opts).format(ms)

// --- Catalog text --------------------------------------------------------------

export const familyLabel = (f: FamilyChoice) => (f === 'auto' ? t('family.auto') : FAMILY_INFO[f].name)
export const surfaceLabel = (f: FamilyChoice, s: Surface) => (f === 'auto' ? t(`surface.generic.${s}`) : FAMILY_INFO[f].surfaces[s].label)
export const surfaceHint = (f: FamilyChoice, s: Surface) => t(`surface.hint.${f}.${s}`)
export const modelTagline = (m: ModelId) => t(`model.tagline.${m}`)
export const effortHint = (e: Effort) => t(`effort.hint.${e}`)
/** Seviyesi sabit modelde (effortText null) "sabit" yazar. */
export const effortName = (e: Effort | null) => e ?? t('effort.fixed')


/** Modelin döndürdüğü görev türü tanınmıyorsa olduğu gibi gösterilir. */
export const taskLabel = (type: string) => tk(`task.${type}`).replace(/^task\./, '')
