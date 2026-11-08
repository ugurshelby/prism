// Ürün kavramı: dört ürün aynı çekirdekten derlenir; hangisinin derlendiği build sırasında seçilir
// (`PRISM_PRODUCT=ray npm run build`). Kimlik ayrımı (appId, userData, yükleyici) aşama 3'ün işidir.
import type { Family } from './catalog'

export const PRODUCTS = ['ray', 'spectrum', 'lens', 'iris'] as const
export type ProductId = (typeof PRODUCTS)[number]

export interface ProductInfo {
  id: ProductId
  /** Her yerde tam adıyla anılır (owner kararı 2026-11-06). */
  name: string
  /** single: kurulumda tek aile; multi: bir ya da daha çok aile. */
  familyMode: 'single' | 'multi'
  /** Bu çekirdekten derlenebiliyor mu (Lens ve Iris sonraki aşamalarda). */
  available: boolean
}

export const PRODUCT_INFO: Record<ProductId, ProductInfo> = {
  ray: { id: 'ray', name: 'Prism Ray', familyMode: 'single', available: true },
  spectrum: { id: 'spectrum', name: 'Prism Spectrum', familyMode: 'multi', available: true },
  lens: { id: 'lens', name: 'Prism Lens', familyMode: 'multi', available: false },
  iris: { id: 'iris', name: 'Prism Iris', familyMode: 'multi', available: false }
}

// Build sırasında electron.vite.config.ts tanımlar (define); adı Vite derleme sabiti geleneğine uyar.
// oxlint-disable-next-line no-underscore-dangle
declare const __PRISM_PRODUCT__: string

const isProduct = (v: unknown): v is ProductId => (PRODUCTS as readonly unknown[]).includes(v)

/** Derlenen ürün. Tanımsız ya da bilinmeyen değer derlemeyi değil açılışı durdurur: yanlış ürünle çalışmasın. */
export const PRODUCT: ProductInfo = (() => {
  const id: unknown = typeof __PRISM_PRODUCT__ === 'string' ? __PRISM_PRODUCT__ : undefined
  if (!isProduct(id) || !PRODUCT_INFO[id].available) throw new Error(`Bilinmeyen ya da hazır olmayan ürün: ${String(id)}`)
  return PRODUCT_INFO[id]
})()

/** Ürünün izin verdiği aile seçimi: Ray'de tam bir, diğerlerinde en az bir aile. */
export function validFamilies(product: ProductInfo, families: readonly Family[]): boolean {
  const unique = new Set(families).size === families.length
  return unique && (product.familyMode === 'single' ? families.length === 1 : families.length >= 1)
}
