import releasesJson from '../data/releases.json'
import { parseStored, type Asset, type Release } from '../../scripts/releases.mjs'

export const REPO = 'https://github.com/ugurshelby/prism'

/** URL of a page on the site, including the base path (/prism). */
export function href(path = '') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const clean = path.replace(/^\/|\/$/g, '')
  return `${base}/${clean ? `${clean}/` : ''}`
}

export const asset = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

// --- Products -------------------------------------------------------------------

export type ProductId = 'ray' | 'spectrum' | 'lens' | 'iris'
export type ProductStatus = 'available' | 'soon' | 'planned'
export const PRODUCTS: { id: ProductId; name: string; released: boolean }[] = [
  { id: 'ray', name: 'Ray', released: true },
  { id: 'spectrum', name: 'Spectrum', released: true },
  { id: 'lens', name: 'Lens', released: false },
  { id: 'iris', name: 'Iris', released: false }
]
export const productName = (id: ProductId) => PRODUCTS.find((p) => p.id === id)?.name ?? id

// --- GitHub Releases -----------------------------------------------------------

export type { Asset, Release }
export type Platform = 'win' | 'macArm' | 'macIntel' | 'appimage' | 'deb'
export type Os = 'win' | 'mac' | 'linux'
export const OS_PLATFORMS: Record<Os, Platform[]> = { win: ['win'], mac: ['macArm', 'macIntel'], linux: ['appimage', 'deb'] }

const PATTERNS: Record<Platform, RegExp> = {
  win: /-x64\.exe$/,
  macArm: /mac-arm64\.dmg$/,
  macIntel: /mac-x64\.dmg$/,
  appimage: /\.AppImage$/,
  deb: /\.deb$/
}

const semver = (v: string) => v.split('.').map(Number)
const newer = (a: Release, b: Release) => {
  const [x, y] = [semver(a.version), semver(b.version)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]
  return 0
}

// releases.json is written (and validated) by sync.mjs before the build; the same checks run again here.
export const releases = parseStored(releasesJson).sort(newer)
export const releasesOf = (id: ProductId) => releases.filter((r) => r.product === id)
/** Whether a released product has a downloadable release; otherwise "soon" is shown. */
export const statusOf = (id: ProductId): ProductStatus =>
  PRODUCTS.find((p) => p.id === id)?.released ? (releasesOf(id).length ? 'available' : 'soon') : 'planned'
/** Newest release of the main product (Spectrum); the home page download button uses it. */
// The main button only downloads Spectrum; without a Spectrum release it goes to the download page (never falls back to another product).
export const latest: Release | undefined = releasesOf('spectrum')[0]

export function files(r: Release | undefined): Partial<Record<Platform, Asset>> {
  if (!r) return {}
  return Object.fromEntries(
    (Object.keys(PATTERNS) as Platform[]).flatMap((p) => {
      const a = r.assets.find((x) => PATTERNS[p].test(x.name))
      return a ? [[p, a]] : []
    })
  )
}

export const sums = (r: Release | undefined) => r?.assets.find((a) => a.name === 'SHA256SUMS.txt')
export const mb = (bytes: number) => `${Math.round(bytes / 1048576)} MB`
export const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
