// Ürün başına derleme: `npm run build:ray`, `npm run build:spectrum`. Aynı çekirdek, farklı ürün sabiti
// (electron.vite.config.ts → __PRISM_PRODUCT__). Paketleme ve ürün kimliği (appId, userData) aşama 3'te.
import { spawnSync } from 'node:child_process'

const product = process.argv[2]
const known = ['ray', 'spectrum']
if (!known.includes(product)) {
  console.error(`Kullanım: node scripts/build-product.mjs <${known.join('|')}>`)
  process.exit(2)
}
const r = spawnSync('npx', ['electron-vite', 'build'], { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, PRISM_PRODUCT: product } })
if (r.error) console.error(r.error.message)
process.exit(r.status ?? 1)
