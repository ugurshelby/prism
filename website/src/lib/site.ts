import releasesJson from '../data/releases.json'

export type Lang = 'en' | 'tr'
export const REPO = 'https://github.com/ugurshelby/prism'

/** Sitedeki bir sayfanın adresi; base (/prism) ve dil önekiyle. */
export function href(lang: Lang, path = '') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const clean = path.replace(/^\/|\/$/g, '')
  return `${base}${lang === 'tr' ? '/tr' : ''}/${clean ? `${clean}/` : ''}`
}

export const asset = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

// --- Sürümler (edition) ---------------------------------------------------------

export type GenId = 'ray' | 'spectrum' | 'lens' | 'iris'
export type GenStatus = 'available' | 'legacy' | 'current' | 'planned'
export const GENERATIONS: { id: GenId; major: number; name: string; status: GenStatus }[] = [
  { id: 'ray', major: 1, name: 'Ray', status: 'legacy' },
  { id: 'spectrum', major: 2, name: 'Spectrum', status: 'current' },
  { id: 'lens', major: 3, name: 'Lens', status: 'planned' },
  { id: 'iris', major: 4, name: 'Iris', status: 'planned' }
]
export const genOf = (version: string) => GENERATIONS.find((g) => g.major === Number(version.split('.')[0]))

// --- GitHub Releases -----------------------------------------------------------

export interface Asset {
  name: string
  url: string
  size: number
  sha256: string | null
}
export interface Release {
  tag: string
  version: string
  published: string
  url: string
  assets: Asset[]
}
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

export const releases = (releasesJson as Release[]).filter((r) => genOf(r.version)).sort(newer)
export const releasesOf = (id: GenId) => releases.filter((r) => genOf(r.version)?.id === id)
/** Ana sürümün (Spectrum) en yeni yayını; ana sayfadaki indirme düğmesi bunu verir. */
export const latest: Release | undefined = releasesOf('spectrum')[0] ?? releases[0]

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
export const date = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
