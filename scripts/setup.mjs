// İlk kurulum yardımcısı: `npm install` sonrası `npm run setup`.
// Node sürümünü denetler, Electron ikilisi inmemişse indirir ve .env şablonunu kopyalar. Key'lere dokunmaz.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const ok = (msg) => console.log(`✓ ${msg}`)

const major = Number(process.versions.node.split('.')[0])
if (major < 22) {
  console.error(`✗ Node ${process.versions.node} bulundu; Prism için Node 22 veya üstü gerekiyor.`)
  process.exit(1)
}
ok(`Node ${process.versions.node}`)

if (!existsSync(at('node_modules/electron'))) {
  console.error('✗ Bağımlılıklar kurulmamış. Önce `npm install` çalıştır.')
  process.exit(1)
}

// npm script'leri kapalıysa (ör. ignore-scripts) Electron ikilisi inmemiş olur.
if (!existsSync(at('node_modules/electron/path.txt'))) {
  console.log('… Electron ikilisi indiriliyor')
  execFileSync(process.execPath, [at('node_modules/electron/install.js')], { cwd: root, stdio: 'inherit' })
}
ok('Electron hazır')

if (existsSync(at('.env'))) ok('.env zaten var (dokunulmadı)')
else {
  copyFileSync(at('.env.example'), at('.env'))
  ok('.env.example → .env kopyalandı')
}

console.log(`
Sıradaki adımlar:
  1. Kullandığın sağlayıcının key'ini .env dosyasına yaz ya da uygulamayı açıp Ayarlar → Sağlayıcılar'dan ekle.
  2. npm run dev
  3. (İsteğe bağlı) npm run selftest -- --discover   → key'leri doğrular, erişilen modelleri listeler.`)
