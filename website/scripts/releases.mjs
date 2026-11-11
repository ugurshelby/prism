// GitHub yayın listesinin ayrıştırılması ve doğrulanması: saf işlevler, ağ ve dosya yok.
// sync.mjs (derleme öncesi) ve src/lib/site.ts (derleme sırasında) aynı kuralları kullanır; sitede gösterilen her
// bağlantı buradan geçmiş olur. Yeni bağımlılık yok (zod değil, elle yazılmış denetim).

export const REPO = 'ugurshelby/prism'

// Yeni ürün etiketleri ve ürün öncesi Spectrum 2.x etiketleri. Eski v1.* ve diğer her şey atılır.
const PRODUCT_TAG = /^(ray|spectrum)-v(\d+\.\d+\.\d+)$/
const LEGACY_SPECTRUM_TAG = /^v(2\.\d+\.\d+)$/

/** Etiketten ürün ve sürüm; tanınmayan etiket null döner. */
export function parseTag(tag) {
  if (typeof tag !== 'string') return null
  const m = PRODUCT_TAG.exec(tag)
  if (m) return { product: m[1], version: m[2] }
  const legacy = LEGACY_SPECTRUM_TAG.exec(tag)
  return legacy ? { product: 'spectrum', version: legacy[1] } : null
}

/** Yalnızca bu deponun yayın sayfaları ve indirmeleri: https, github.com, /ugurshelby/prism/releases/ altında. */
export function isReleaseUrl(raw) {
  if (typeof raw !== 'string') return false
  let url
  try {
    url = new URL(raw)
  } catch {
    // Geçersiz adres güvenli sayılmaz; çağıran kaydı atar.
    return false
  }
  return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && url.pathname.startsWith(`/${REPO}/releases/`)
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v) => typeof v === 'string'
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

function fail(where, what) {
  throw new Error(`Yayın verisi bozuk (${where}): ${what}`)
}

/**
 * GitHub /releases yanıtını ayrıştırır. Yanıtın biçimi bozuksa hata fırlatır; tek tek yayınlar ise süzülür:
 * taslak ve ön sürümler, tanınmayan etiketler, adresi geçersiz yayınlar ve adresi geçersiz dosyalar atılır.
 */
export function parseApiResponse(json) {
  if (!Array.isArray(json)) fail('yanıt', 'dizi bekleniyordu')
  const out = []
  json.forEach((r, i) => {
    const at = `yayın ${i}`
    if (!isObj(r)) fail(at, 'nesne bekleniyordu')
    if (!isStr(r.tag_name)) fail(at, 'tag_name metin olmalı')
    if (typeof r.draft !== 'boolean' || typeof r.prerelease !== 'boolean') fail(at, 'draft ve prerelease mantıksal olmalı')
    if (!isStr(r.published_at)) fail(at, 'published_at metin olmalı')
    if (!isStr(r.html_url)) fail(at, 'html_url metin olmalı')
    if (!Array.isArray(r.assets)) fail(at, 'assets dizi olmalı')
    const assets = r.assets.map((a, j) => {
      if (!isObj(a) || !isStr(a.name) || !isNum(a.size) || !isStr(a.browser_download_url)) fail(`${at}, dosya ${j}`, 'name, size ve browser_download_url gerekli')
      if (a.digest != null && !isStr(a.digest)) fail(`${at}, dosya ${j}`, 'digest metin olmalı')
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

/** releases.json'ı (sync.mjs'in yazdığı biçim) okurken aynı denetim: ürün etiketle tutarlı, adresler geçerli. */
export function parseStored(json) {
  if (!Array.isArray(json)) fail('releases.json', 'dizi bekleniyordu')
  return json.map((r, i) => {
    const at = `kayıt ${i}`
    if (!isObj(r) || !isStr(r.tag) || !isStr(r.product) || !isStr(r.version) || !isStr(r.published) || !isStr(r.url) || !Array.isArray(r.assets)) {
      fail(at, 'tag, product, version, published, url ve assets gerekli')
    }
    const parsed = parseTag(r.tag)
    if (!parsed || parsed.product !== r.product || parsed.version !== r.version) fail(at, 'etiket, ürün ve sürüm uyuşmuyor')
    if (!isReleaseUrl(r.url)) fail(at, 'yayın adresi izinli değil')
    const assets = r.assets.map((a, j) => {
      if (!isObj(a) || !isStr(a.name) || !isNum(a.size) || !isStr(a.url) || !(a.sha256 === null || isStr(a.sha256))) fail(`${at}, dosya ${j}`, 'name, url, size ve sha256 gerekli')
      if (!isReleaseUrl(a.url)) fail(`${at}, dosya ${j}`, 'indirme adresi izinli değil')
      return { name: a.name, url: a.url, size: a.size, sha256: a.sha256 }
    })
    return { tag: r.tag, product: parsed.product, version: parsed.version, published: r.published, url: r.url, assets }
  })
}
