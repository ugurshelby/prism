// Prism 2.x (ya da daha eski Prompter) verisinin Spectrum'a bir kerelik taşınması (PLAN D6, 3b).
//
// Eski klasör yerinde kullanılmaz, kopyalanır: hâlâ kurulu bir 2.x ile aynı kilit ve dosyalar paylaşılmasın, kaldırıcı
// ve "Tüm verilerimi sil" Spectrum'un kendi klasörünü bilsin. Eski klasöre hiç yazılmaz. Yalnızca Prism'in kendi
// dosyaları (shared/userdata.ts) ve Chromium'un `Local State` dosyası kopyalanır: Windows'ta safeStorage anahtarı
// orada DPAPI ile saklanır, böylece key'ler ve geçmiş açılmaya devam eder. macOS'ta anahtar uygulama adına bağlı Keychain
// kaydındadır; orada kopyalanan key'ler okunamaz ve uygulama key'leri yeniden istemekle geçmişi kenara almayı açıkça söyler
// (owner kararı, R3 yedek davranışı).
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ProductInfo } from '@shared/product'
import { legacySource } from '@shared/product'
import { isOwnDataFile } from '@shared/userdata'
import { logWarn } from './log'

export const MIGRATION_MARKER = 'migrated.json'
const LOCAL_STATE = 'Local State'

// Geçici, yedek ve kenara alınmış dosyalar taşınmaz; yalnızca kullanılan veri. Düz metin `.env` (eski sürümlerin key'leri)
// ikinci bir yere çoğaltılmaz.
const isMigratable = (name: string) =>
  isOwnDataFile(name) && name !== '.env' && name !== MIGRATION_MARKER && !/\.(tmp|bak)$|\.bozuk-\d+$|\.unreadable-\d+$/.test(name)

// Prism'in settings.json'ı: sürüm numarası, kısayol ve aile/motor alanlarından biri. Aynı adlı başka bir uygulamanın
// ayar dosyası bu şekli taşımaz.
function looksLikePrismSettings(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
  const has = (k: string) => Object.hasOwn(raw, k)
  return (
    'version' in raw &&
    typeof raw.version === 'number' &&
    'hotkey' in raw &&
    typeof raw.hotkey === 'string' &&
    ['defaultFamily', 'families', 'analysisModel', 'engineProvider'].some(has)
  )
}

function regularFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((name) => {
    const st = lstatSync(join(dir, name))
    return st.isFile() && !st.isSymbolicLink()
  })
}

/** Klasörü salt okur: Prism verisi var mı, Prism'e özgü imza (key, şifreli geçmiş, sürümlü settings.json) var mı. */
export function inspectDir(dir: string): { hasOwnData: boolean; hasSignature: boolean; migrated: boolean } {
  const files = regularFiles(dir)
  const own = files.filter(isMigratable)
  let settingsLooksOurs = false
  if (own.includes('settings.json')) {
    // Okunamayan ya da başka biçimde bir settings.json imza sayılmaz; klasör başka bir uygulamanın olabilir.
    try {
      settingsLooksOurs = looksLikePrismSettings(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')))
    } catch {
      settingsLooksOurs = false
    }
  }
  return {
    hasOwnData: own.length > 0,
    hasSignature: own.some((f) => f.endsWith('.key') || f === 'history.enc') || settingsLooksOurs,
    migrated: files.includes(MIGRATION_MARKER)
  }
}

/** Göç işaretini yazar; `wiped` ise "Tüm verilerimi sil" sonrası göçün bir daha çalışmaması içindir. */
export function markMigrationDone(target: string, from: string) {
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, MIGRATION_MARKER), JSON.stringify({ from, at: new Date().toISOString() }))
}

// Önceki bir göç yarıda kesildiyse (çökme, güç kesilmesi) kalan geçici klasör silinir: içinde key ve geçmiş olabilir.
function removeLeftovers(appData: string, product: ProductInfo) {
  const prefix = `${product.dataDir}.migrating-`
  for (const name of readdirSync(appData).filter((n) => n.startsWith(prefix))) {
    rmSync(join(appData, name), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}

/**
 * Ürünün klasöründe veri yoksa ve Prism imzası taşıyan bir eski klasör varsa verileri bir kez kopyalar. Kopya önce geçici
 * bir klasöre yapılır, sonra dosyalar hedefe taşınır, en son işaret dosyası yazılır. Başarısızlıkta hedefe taşınan dosyalar
 * geri silinir ve uygulama boş verilerle açılır; bir sonraki açılış yeniden dener. Hiçbir hata açılışı durdurmaz.
 * Dönen değer kopyalanan eski klasörün adı ya da null.
 */
export function migrateLegacyData(appData: string, product: ProductInfo): string | null {
  if (!product.legacyDataDirs.length) return null
  const target = join(appData, product.dataDir)
  const moved: string[] = []
  let temp: string | null = null
  try {
    removeLeftovers(appData, product)
    const from = legacySource(product, (name) => inspectDir(join(appData, name)))
    if (!from) return null
    const source = join(appData, from)
    temp = `${target}.migrating-${Date.now()}`
    mkdirSync(temp, { recursive: true })
    const names = regularFiles(source).filter((n) => isMigratable(n) || n === LOCAL_STATE)
    for (const name of names) copyFileSync(join(source, name), join(temp, name))
    mkdirSync(target, { recursive: true })
    for (const name of names) {
      renameSync(join(temp, name), join(target, name))
      moved.push(name)
    }
    // Tek seferlik: işaret zaten varsa (başka bir kopya yazdıysa) üzerine yazılmaz.
    writeFileSync(join(target, MIGRATION_MARKER), JSON.stringify({ from, at: new Date().toISOString(), files: names.length }), { flag: 'wx' })
    return from
  } catch (e) {
    // Yarım taşınan dosyalar geri alınır: hedefte veri kalırsa bir sonraki açılış göçü yeniden denemez.
    for (const name of moved) if (name !== LOCAL_STATE) rmSync(join(target, name), { force: true })
    logWarn('migrate', 'eski sürüm verisi kopyalanamadı; uygulama boş verilerle açılıyor, bir sonraki açılışta yeniden denenecek', e)
    return null
  } finally {
    // Geçici klasör silinemezse (Windows kilidi) bir sonraki açılışta removeLeftovers yeniden dener.
    if (temp) {
      try {
        rmSync(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      } catch (e) {
        logWarn('migrate', 'geçici göç klasörü silinemedi; bir sonraki açılışta silinecek', e)
      }
    }
  }
}
