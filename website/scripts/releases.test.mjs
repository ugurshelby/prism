// `npm --prefix website test` (node --test): elle yazılmış örneklerle etiket ayrıştırma ve adres doğrulama.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isReleaseUrl, parseApiResponse, parseStored, parseTag } from './releases.mjs'

const BASE = 'https://github.com/ugurshelby/prism/releases'
const asset = (tag, name, url) => ({ name, size: 1234, browser_download_url: url ?? `${BASE}/download/${tag}/${name}`, digest: 'sha256:abcdef' })
const release = (tag, extra = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  published_at: '2026-11-01T00:00:00Z',
  html_url: `${BASE}/tag/${tag}`,
  assets: [asset(tag, 'App-Setup.exe')],
  ...extra
})

test('etiketler: yeni ürün etiketleri ve eski Spectrum 2.x', () => {
  assert.deepEqual(parseTag('ray-v2.0.0'), { product: 'ray', version: '2.0.0' })
  assert.deepEqual(parseTag('spectrum-v3.0.0'), { product: 'spectrum', version: '3.0.0' })
  assert.deepEqual(parseTag('v2.2.0'), { product: 'spectrum', version: '2.2.0' })
})

test('etiketler: v1.*, ön sürüm eki ve diğer her şey atılır', () => {
  for (const tag of ['v1.0.0', 'v3.0.0', 'ray-v2.0.0-beta', 'ray-v2.0', 'lens-v1.0.0', 'xray-v2.0.0', 'v2.2.0-rc1', '', 'ray-v2.0.0\n']) {
    assert.equal(parseTag(tag), null, tag)
  }
  assert.equal(parseTag(undefined), null)
})

test('adresler: yalnızca bu deponun yayın sayfaları ve indirmeleri', () => {
  assert.equal(isReleaseUrl(`${BASE}/download/v2.2.0/x.exe`), true)
  for (const u of [
    'javascript:alert(1)',
    'http://github.com/ugurshelby/prism/releases/x',
    'https://evil.example/ugurshelby/prism/releases/x',
    'https://github.com.evil.example/ugurshelby/prism/releases/x',
    'https://github.com/other/prism/releases/x',
    'https://github.com/ugurshelby/prism/issues/1',
    'https://user:pw@github.com/ugurshelby/prism/releases/x',
    'https://github.com:8443/ugurshelby/prism/releases/x',
    'not a url',
    ''
  ]) {
    assert.equal(isReleaseUrl(u), false, u)
  }
  assert.equal(isReleaseUrl(null), false)
})

test('yanıt: ürün ayrı alan olarak yazılır, v1.*, taslak ve ön sürüm atılır', () => {
  const out = parseApiResponse([
    release('ray-v2.0.0'),
    release('spectrum-v3.0.0'),
    release('v2.2.0'),
    release('v1.0.0'),
    release('ray-v2.0.0-beta'),
    release('ray-v2.1.0', { draft: true }),
    release('spectrum-v3.1.0', { prerelease: true })
  ])
  assert.deepEqual(
    out.map((r) => [r.tag, r.product, r.version]),
    [
      ['ray-v2.0.0', 'ray', '2.0.0'],
      ['spectrum-v3.0.0', 'spectrum', '3.0.0'],
      ['v2.2.0', 'spectrum', '2.2.0']
    ]
  )
  assert.equal(out[0].assets[0].sha256, 'abcdef')
  assert.equal(out[0].url, `${BASE}/tag/ray-v2.0.0`)
})

test('yanıt: adresi geçersiz dosya atılır, yayın kalır; yayın adresi geçersizse yayın atılır', () => {
  const evil = [
    asset('ray-v2.0.0', 'ok.exe'),
    asset('ray-v2.0.0', 'js.exe', 'javascript:alert(1)'),
    asset('ray-v2.0.0', 'evil.exe', 'https://evil.example/ugurshelby/prism/releases/download/ray-v2.0.0/evil.exe')
  ]
  const out = parseApiResponse([release('ray-v2.0.0', { assets: evil }), release('spectrum-v3.0.0', { html_url: 'https://evil.example/x' })])
  assert.equal(out.length, 1)
  assert.deepEqual(out[0].assets.map((a) => a.name), ['ok.exe'])
})

test('yanıt: bozuk biçim açık hata verir', () => {
  assert.throws(() => parseApiResponse({}), /dizi bekleniyordu/)
  assert.throws(() => parseApiResponse([{ ...release('ray-v2.0.0'), draft: 'false' }]), /mantıksal/)
  assert.throws(() => parseApiResponse([{ ...release('ray-v2.0.0'), assets: 'x' }]), /assets dizi/)
  assert.throws(() => parseApiResponse([release('ray-v2.0.0', { assets: [{ name: 'a', size: '1', browser_download_url: BASE }] })]), /browser_download_url/)
  assert.throws(() => parseApiResponse([null]), /nesne bekleniyordu/)
})

test('kayıtlı veri: geçerli kayıt geçer, ürün-etiket uyumsuzluğu ve kötü adres reddedilir', () => {
  const stored = parseApiResponse([release('spectrum-v3.0.0')])
  assert.deepEqual(parseStored(stored), stored)
  assert.throws(() => parseStored([{ ...stored[0], product: 'ray' }]), /uyuşmuyor/)
  assert.throws(() => parseStored([{ ...stored[0], url: 'javascript:alert(1)' }]), /izinli değil/)
  assert.throws(() => parseStored([{ ...stored[0], assets: [{ ...stored[0].assets[0], url: 'https://evil.example/x' }] }]), /izinli değil/)
  assert.throws(() => parseStored({}), /dizi bekleniyordu/)
  assert.deepEqual(parseStored([]), [])
})
