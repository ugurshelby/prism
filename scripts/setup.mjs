// First-run setup helper: `npm run setup` after `npm install`.
// Checks the Node version, downloads the Electron binary if missing and copies the .env template. Never touches keys.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const ok = (msg) => console.log(`✓ ${msg}`)

const major = Number(process.versions.node.split('.')[0])
if (major < 22) {
  console.error(`✗ Node ${process.versions.node} found; Prism needs Node 22 or newer.`)
  process.exit(1)
}
ok(`Node ${process.versions.node}`)

if (!existsSync(at('node_modules/electron'))) {
  console.error('✗ Dependencies are not installed. Run `npm install` first.')
  process.exit(1)
}

// With npm scripts disabled (e.g. ignore-scripts) the Electron binary is not downloaded.
if (!existsSync(at('node_modules/electron/path.txt'))) {
  console.log('… Downloading the Electron binary')
  execFileSync(process.execPath, [at('node_modules/electron/install.js')], { cwd: root, stdio: 'inherit' })
}
ok('Electron ready')

if (existsSync(at('.env'))) ok('.env already exists (left untouched)')
else {
  copyFileSync(at('.env.example'), at('.env'))
  ok('.env.example → .env copied')
}

console.log(`
Next steps:
  1. Put your provider's key in the .env file, or open the app and add it under Settings → Providers.
  2. npm run dev
  3. (Optional) npm run selftest -- --discover   → validates the keys and lists reachable models.`)
