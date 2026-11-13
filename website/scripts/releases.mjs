// Parsing and validation of the GitHub release list: pure functions, no network or files.
// sync.mjs (before the build) and src/lib/site.ts (during the build) share these rules; every link shown on the
// site has passed through here. No new dependency (hand-written checks, not zod).

export const REPO = 'ugurshelby/prism'

// New product tags and the pre-product Spectrum 2.x tags. Old v1.* tags and anything else are dropped.
const PRODUCT_TAG = /^(ray|spectrum)-v(\d+\.\d+\.\d+)$/
const LEGACY_SPECTRUM_TAG = /^v(2\.\d+\.\d+)$/

/** Product and version from a tag; an unrecognised tag returns null. */
export function parseTag(tag) {
  if (typeof tag !== 'string') return null
  const m = PRODUCT_TAG.exec(tag)
  if (m) return { product: m[1], version: m[2] }
  const legacy = LEGACY_SPECTRUM_TAG.exec(tag)
  return legacy ? { product: 'spectrum', version: legacy[1] } : null
}

/** Only this repository's release pages and downloads: https, github.com, under /ugurshelby/prism/releases/. */
export function isReleaseUrl(raw) {
  if (typeof raw !== 'string') return false
  let url
  try {
    url = new URL(raw)
  } catch {
    // An invalid URL is not safe; the caller drops the record.
    return false
  }
  return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && url.pathname.startsWith(`/${REPO}/releases/`)
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v) => typeof v === 'string'
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

function fail(where, what) {
  throw new Error(`Release data is malformed (${where}): ${what}`)
}

/**
 * Parses the GitHub /releases response. Throws if the response shape is malformed; individual releases are filtered:
 * drafts, prereleases, unrecognised tags, releases with an invalid URL and files with an invalid URL are dropped.
 */
export function parseApiResponse(json) {
  if (!Array.isArray(json)) fail('response', 'expected an array')
  const out = []
  json.forEach((r, i) => {
    const at = `release ${i}`
    if (!isObj(r)) fail(at, 'expected an object')
    if (!isStr(r.tag_name)) fail(at, 'tag_name must be a string')
    if (typeof r.draft !== 'boolean' || typeof r.prerelease !== 'boolean') fail(at, 'draft and prerelease must be booleans')
    if (!isStr(r.published_at)) fail(at, 'published_at must be a string')
    if (!isStr(r.html_url)) fail(at, 'html_url must be a string')
    if (!Array.isArray(r.assets)) fail(at, 'assets must be an array')
    const assets = r.assets.map((a, j) => {
      if (!isObj(a) || !isStr(a.name) || !isNum(a.size) || !isStr(a.browser_download_url)) fail(`${at}, file ${j}`, 'name, size and browser_download_url are required')
      if (a.digest != null && !isStr(a.digest)) fail(`${at}, file ${j}`, 'digest must be a string')
      return a
    })
    if (r.draft || r.prerelease) return
    const parsed = parseTag(r.tag_name)
    if (!parsed || !isReleaseUrl(r.html_url) || Number.isNaN(Date.parse(r.published_at))) return
    out.push({
      tag: r.tag_name,
      product: parsed.product,
      version: parsed.version,
      published: r.published_at,
      url: r.html_url,
      assets: assets
        .filter((a) => isReleaseUrl(a.browser_download_url))
        .map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size, sha256: a.digest?.startsWith('sha256:') ? a.digest.slice(7) : null }))
    })
  })
  return out
}

/** Same checks when reading releases.json (the format sync.mjs writes): product matches the tag, URLs are valid. */
export function parseStored(json) {
  if (!Array.isArray(json)) fail('releases.json', 'expected an array')
  return json.map((r, i) => {
    const at = `record ${i}`
    if (!isObj(r) || !isStr(r.tag) || !isStr(r.product) || !isStr(r.version) || !isStr(r.published) || !isStr(r.url) || !Array.isArray(r.assets)) {
      fail(at, 'tag, product, version, published, url and assets are required')
    }
    const parsed = parseTag(r.tag)
    if (!parsed || parsed.product !== r.product || parsed.version !== r.version) fail(at, 'tag, product and version do not match')
    if (!isReleaseUrl(r.url)) fail(at, 'release URL is not allowed')
    const assets = r.assets.map((a, j) => {
      if (!isObj(a) || !isStr(a.name) || !isNum(a.size) || !isStr(a.url) || !(a.sha256 === null || isStr(a.sha256))) fail(`${at}, file ${j}`, 'name, url, size and sha256 are required')
      if (!isReleaseUrl(a.url)) fail(`${at}, file ${j}`, 'download URL is not allowed')
      return { name: a.name, url: a.url, size: a.size, sha256: a.sha256 }
    })
    return { tag: r.tag, product: parsed.product, version: parsed.version, published: r.published, url: r.url, assets }
  })
}
