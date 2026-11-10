// Derlemeden önce: ekran görüntülerini depodan kopyalar ve GitHub Releases'tan sürüm listesini çeker.
// Ağ yoksa ya da API hata verirse sürüm listesi boş yazılır; site yine derlenir, indirme sayfası GitHub'a yönlendirir.
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'

const at = (p) => new URL(p, import.meta.url)
const repo = process.env.GITHUB_REPOSITORY || 'ugurshelby/prism'

mkdirSync(at('../public/screenshots/'), { recursive: true })
for (const name of readdirSync(at('../../docs/screenshots/'))) {
  if (name.endsWith('.png')) copyFileSync(at(`../../docs/screenshots/${name}`), at(`../public/screenshots/${name}`))
}

let releases = []
try {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'prism-website' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=50`, { headers })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  releases = (await res.json())
    .filter((r) => !r.draft && !r.prerelease)
    .map((r) => ({
      tag: r.tag_name,
      // Etiket önekleri: ray-v*, spectrum-v* ve ürün öncesi v2.* (Spectrum'un eski etiketi).
      version: r.tag_name.replace(/^(?:[a-z]+-)?v/, ''),
      published: r.published_at,
      url: r.html_url,
      assets: r.assets.map((a) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
        sha256: a.digest?.startsWith('sha256:') ? a.digest.slice(7) : null
      }))
    }))
} catch (e) {
  console.warn(`! Sürümler alınamadı (${e.message}); indirme bağlantıları GitHub Releases'a yönlenecek.`)
}

mkdirSync(at('../src/data/'), { recursive: true })
writeFileSync(at('../src/data/releases.json'), JSON.stringify(releases, null, 2))
console.log(`✓ ${releases.length} sürüm, ekran görüntüleri kopyalandı (${repo})`)
