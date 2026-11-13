// Per-product build: `npm run build:ray`, `npm run build:spectrum`. Same core, different product constant
// (electron.vite.config.ts → __PRISM_PRODUCT__). `--dist <win|mac|linux|dir>` packages via build/<product>.yml.
import { spawnSync } from 'node:child_process'

const known = ['ray', 'spectrum']
const distFlags = { win: '--win', mac: '--mac', linux: '--linux', dir: '--dir' }
const [product, ...rest] = process.argv.slice(2)

function usage() {
  console.error(`Usage: node scripts/build-product.mjs <${known.join('|')}> [--dist <${Object.keys(distFlags).join('|')}>]`)
  process.exit(2)
}

if (!known.includes(product)) usage()
let dist = null
if (rest.length > 0) {
  if (rest.length !== 2 || rest[0] !== '--dist' || !Object.hasOwn(distFlags, rest[1])) usage()
  dist = rest[1]
}

// The argument array comes from fixed lists; no shell string concatenation.
function run(args, env) {
  const r = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...env } })
  if (r.error) console.error(r.error.message)
  return r.status ?? 1
}

const built = run(['electron-vite', 'build'], { PRISM_PRODUCT: product })
if (built !== 0 || dist === null) process.exit(built)
process.exit(run(['electron-builder', '--config', `build/${product}.yml`, distFlags[dist], '--publish', 'never'], {}))
