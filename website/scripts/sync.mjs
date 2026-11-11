// Derlemeden önce: ekran görüntülerini depodan kopyalar ve GitHub Releases'tan sürüm listesini çeker.
// Yanıt scripts/releases.mjs'te doğrulanır (biçim, etiket, adresler). Ağ yoksa ya da yanıt bozuksa yerelde uyarı verilir
// ve liste boş yazılır (indirme sayfası GitHub'a yönlenir); CI'da (CI=true) derleme açık bir mesajla durur.
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { REPO, parseApiResponse } from './releases.mjs'

const at = (p) => new URL(p, import.meta.url)

mkdirSync(at('../public/screenshots/'), { recursive: true })
for (const name of readdirSync(at('../../docs/screenshots/'))) {
  if (name.endsWith('.png')) copyFileSync(at(`../../docs/screenshots/${name}`), at(`../public/screenshots/${name}`))
}

let releases = []
try {
  // Depo sabittir: bir fork derlemesi başka deponun yayınlarını göstermesin (GITHUB_REPOSITORY okunmaz).
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'prism-website' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=50`, { headers, redirect: 'error' })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  releases = parseApiResponse(await res.json())
} catch (e) {
  if (process.env.CI) {
    console.error(`✗ Sürümler alınamadı ya da yanıt bozuk (${e.message}); CI'da derleme durduruldu.`)
    process.exit(1)
  }
  console.warn(`! Sürümler alınamadı (${e.message}); indirme bağlantıları GitHub Releases'a yönlenecek.`)
}

mkdirSync(at('../src/data/'), { recursive: true })
writeFileSync(at('../src/data/releases.json'), JSON.stringify(releases, null, 2))
console.log(`✓ ${releases.length} sürüm, ekran görüntüleri kopyalandı (${REPO})`)
