// Before the build: copies screenshots from the repo and fetches the release list from GitHub Releases.
// The response is validated in scripts/releases.mjs (shape, tags, URLs). Without a network or with a bad response, a local
// run warns and writes an empty list (the download page links to GitHub); in CI (CI=true) the build stops with a clear message.
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { REPO, parseApiResponse } from './releases.mjs'

const at = (p) => new URL(p, import.meta.url)

mkdirSync(at('../public/screenshots/'), { recursive: true })
for (const name of readdirSync(at('../../docs/screenshots/'))) {
  if (name.endsWith('.png')) copyFileSync(at(`../../docs/screenshots/${name}`), at(`../public/screenshots/${name}`))
}

let releases = []
try {
  // The repository is fixed so a fork build never shows another repo's releases (GITHUB_REPOSITORY is not read).
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'prism-website' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  // Read every page (at most 10 x 100 releases) so older versions are not dropped silently.
  const all = []
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, { headers, redirect: 'error' })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const batch = await res.json()
    if (!Array.isArray(batch)) throw new Error('GitHub API response is not an array')
    all.push(...batch)
    if (batch.length < 100) break
  }
  releases = parseApiResponse(all)
} catch (e) {
  if (process.env.CI) {
    console.error(`x Could not fetch releases or the response is malformed (${e.message}); build stopped in CI.`)
    process.exit(1)
  }
  console.warn(`! Could not fetch releases (${e.message}); download links will point to GitHub Releases.`)
}

mkdirSync(at('../src/data/'), { recursive: true })
writeFileSync(at('../src/data/releases.json'), JSON.stringify(releases, null, 2))
console.log(`ok: ${releases.length} releases, screenshots copied (${REPO})`)
