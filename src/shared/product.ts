// Product concept: four products are built from the same core; which one is built is chosen at build time
// (`PRISM_PRODUCT=ray npm run build`). Each product has its own identity (appId, userData, lock, shortcut):
// two products can be installed side by side on the same machine and never touch each other's data.
import type { Family } from './catalog'

export const PRODUCTS = ['ray', 'spectrum', 'lens', 'iris'] as const
export type ProductId = (typeof PRODUCTS)[number]

export interface ProductInfo {
  id: ProductId
    /** Always referred to by its full name (owner decision 2026-11-06). */
  name: string
    /** single: one family at setup; multi: one or more families. */
  familyMode: 'single' | 'multi'
    /** Can this be built from this core (Lens and Iris come in later phases). */
  available: boolean
    /** Windows AppUserModelId and the installer's appId. */
  appId: string
    /** Name of the userData folder under appData; the single-instance lock is tied to this folder too. */
  dataDir: string
    /** The global shortcut at first setup; it differs per product so products do not grab the same shortcut. */
  defaultHotkey: string
    /** Folders of versions installed under earlier names (Spectrum only, the continuation of 2.x). */
  legacyDataDirs: readonly string[]
    /** Prefix of the release tag (`ray-v2.0.0`). */
  tagPrefix: string
}

// Identities come from the PLAN "Decided identities" table; Lens and Iris are finalized when they ship.
export const PRODUCT_INFO: Record<ProductId, ProductInfo> = {
  ray: {
    id: 'ray',
    name: 'Prism Ray',
    familyMode: 'single',
    available: true,
    appId: 'com.prism.ray',
    dataDir: 'Prism Ray',
    defaultHotkey: 'CommandOrControl+Alt+Space',
    legacyDataDirs: [],
    tagPrefix: 'ray-v'
  },
  spectrum: {
    id: 'spectrum',
    name: 'Prism Spectrum',
    familyMode: 'multi',
    available: true,
    appId: 'com.prism.spectrum',
    dataDir: 'Prism Spectrum',
        // The shortcut 2.x users are used to.
    defaultHotkey: 'CommandOrControl+Shift+Space',
        // Order matters: the newest old name first (2.x "Prism"), then the oldest ("Prompter").
    legacyDataDirs: ['Prism', 'Prompter'],
    tagPrefix: 'spectrum-v'
  },
  lens: {
    id: 'lens',
    name: 'Prism Lens',
    familyMode: 'multi',
    available: false,
    appId: 'com.prism.lens',
    dataDir: 'Prism Lens',
    defaultHotkey: 'CommandOrControl+Alt+L',
    legacyDataDirs: [],
    tagPrefix: 'lens-v'
  },
  iris: {
    id: 'iris',
    name: 'Prism Iris',
    familyMode: 'multi',
    available: false,
    appId: 'com.prism.iris',
    dataDir: 'Prism Iris',
    defaultHotkey: 'CommandOrControl+Alt+I',
    legacyDataDirs: [],
    tagPrefix: 'iris-v'
  }
}

// Defined by electron.vite.config.ts at build time (define); the name follows the Vite build-constant convention.
// oxlint-disable-next-line no-underscore-dangle
declare const __PRISM_PRODUCT__: string

const isProduct = (v: unknown): v is ProductId => (PRODUCTS as readonly unknown[]).includes(v)

/** The product being built. An undefined or unknown value stops startup, not the build: it must not run as the wrong product. */
export const PRODUCT: ProductInfo = (() => {
  const id: unknown = typeof __PRISM_PRODUCT__ === 'string' ? __PRISM_PRODUCT__ : undefined
    if (!isProduct(id) || !PRODUCT_INFO[id].available) throw new Error(`Unknown or unavailable product: ${String(id)}`)
  return PRODUCT_INFO[id]
})()

/** The family selection the product allows: exactly one in Ray, at least one in the others. */
export function validFamilies(product: ProductInfo, families: readonly Family[]): boolean {
  const unique = new Set(families).size === families.length
  return unique && (product.familyMode === 'single' ? families.length === 1 : families.length >= 1)
}

export interface DirInfo {
    /** One of Prism's own files is present. */
  hasOwnData: boolean
    /** A Prism-specific signature (key file, encrypted history or a versioned settings.json): not another app's folder. */
  hasSignature: boolean
    /** This folder was migrated before. */
  migrated: boolean
}

/**
  * Source of the one-time migration: if the product's own folder has no data and no migration marker, the first old folder that carries the Prism signature
  * (from the newest name to the oldest). The product always uses its own folder; the old folder is only copied.
 */
export function legacySource(product: ProductInfo, inspect: (dirName: string) => DirInfo): string | null {
  if (!product.legacyDataDirs.length) return null
  const own = inspect(product.dataDir)
  if (own.hasOwnData || own.migrated) return null
  return product.legacyDataDirs.find((d) => inspect(d).hasSignature) ?? null
}
