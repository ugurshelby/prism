// Ürün kavramı: dört ürün aynı çekirdekten derlenir; hangisinin derlendiği build sırasında seçilir
// (`PRISM_PRODUCT=ray npm run build`). Her ürünün kendi kimliği vardır (appId, userData, kilit, kısayol):
// iki ürün aynı makinede yan yana kurulabilir ve birbirinin verisine dokunmaz.
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
  /** Windows AppUserModelId ve yükleyici appId'si. */
  appId: string
  /** appData altındaki userData klasörünün adı; tek kopya kilidi de bu klasöre bağlıdır. */
  dataDir: string
  /** İlk kurulumdaki genel kısayol; ürünler aynı kısayolu kapmasın diye farklıdır. */
  defaultHotkey: string
  /** Önceki adlarla kurulmuş sürümlerin klasörleri (yalnızca Spectrum, 2.x'in devamı). */
  legacyDataDirs: readonly string[]
  /** Sürüm etiketinin öneki (`ray-v2.0.0`). */
  tagPrefix: string
}

// Kimlikler PLAN "Decided identities" tablosundan; Lens ve Iris'inki çıkışlarında kesinleşir.
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
    // 2.x kullanıcılarının alıştığı kısayol.
    defaultHotkey: 'CommandOrControl+Shift+Space',
    // Sıra önemlidir: önce en yeni eski ad (2.x "Prism"), sonra en eski ("Prompter").
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

/** Kullanılacak userData klasörünün adı: ürünün kendi klasöründe veri yoksa veri bulunan ilk eski klasör. */
export function pickDataDir(product: ProductInfo, hasData: (dirName: string) => boolean): string {
  if (hasData(product.dataDir)) return product.dataDir
  return product.legacyDataDirs.find(hasData) ?? product.dataDir
}
