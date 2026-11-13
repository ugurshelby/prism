// One-time migration of Prism 2.x (or older Prompter) data to Spectrum (PLAN D6, 3b).
//
// The old folder is copied, not used in place: so it shares no lock or files with a still-installed 2.x, and the uninstaller
// and "Delete all my data" know Spectrum's own folder. The old folder is never written. Only Prism's own
// files (shared/userdata.ts) and Chromium's `Local State` file are copied: on Windows the safeStorage key
// is kept there with DPAPI, so keys and history keep opening. On macOS the key lives in a Keychain entry tied to the app name;
// the copied keys cannot be read there, and the app says explicitly that it asks for the keys again and sets the history aside
// (owner decision, R3 backup behavior).
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ProductInfo } from '@shared/product'
import { legacySource } from '@shared/product'
import { isOwnDataFile } from '@shared/userdata'
import { logWarn } from './log'

export const MIGRATION_MARKER = 'migrated.json'
const LOCAL_STATE = 'Local State'

// Temporary, backup and set-aside files are not migrated; only data in use. The plain-text `.env` (keys from old versions)
// is not duplicated to a second place.
const isMigratable = (name: string) =>
  isOwnDataFile(name) && name !== '.env' && name !== MIGRATION_MARKER && !/\.(tmp|bak)$|\.bozuk-\d+$|\.unreadable-\d+$/.test(name)

// Prism's settings.json: a version number, a shortcut and one of the family/engine fields. Another app with the same name
// does not have this shape in its settings file.
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

/** Reads the folder read-only: is there Prism data, is there a Prism-specific signature (key, encrypted history, versioned settings.json). */
export function inspectDir(dir: string): { hasOwnData: boolean; hasSignature: boolean; migrated: boolean } {
  const files = regularFiles(dir)
  const own = files.filter(isMigratable)
  let settingsLooksOurs = false
  if (own.includes('settings.json')) {
    // A settings.json that is unreadable or in another format does not count as a signature; the folder may belong to another app.
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

/** Writes the migration marker; `wiped` is so migration never runs again after "Delete all my data". */
export function markMigrationDone(target: string, from: string) {
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, MIGRATION_MARKER), JSON.stringify({ from, at: new Date().toISOString() }))
}

// If an earlier migration was cut short (crash, power loss), the leftover temp folder is deleted: it may contain keys and history.
function removeLeftovers(appData: string, product: ProductInfo) {
  const prefix = `${product.dataDir}.migrating-`
  for (const name of readdirSync(appData).filter((n) => n.startsWith(prefix))) {
    rmSync(join(appData, name), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}

/**
 * If the product's folder has no data and there is an old folder carrying the Prism signature, copies the data once. The copy is made first to a temp
 * folder, then the files are moved to the target, and the marker file is written last. On failure the files moved to the target
 * are deleted again and the app opens with empty data; the next launch retries. No error stops the launch.
 * The return value is the name of the old folder that was copied, or null.
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
    // One-time: if the marker already exists (another instance wrote it) it is not overwritten.
    writeFileSync(join(target, MIGRATION_MARKER), JSON.stringify({ from, at: new Date().toISOString(), files: names.length }), { flag: 'wx' })
    return from
  } catch (e) {
    // Half-migrated files are rolled back: if data stayed in the target, the next launch would not retry the migration.
    for (const name of moved) if (name !== LOCAL_STATE) rmSync(join(target, name), { force: true })
    logWarn('migrate', 'could not copy old-version data; the app is opening with empty data, will retry on the next launch', e)
    return null
  } finally {
    // If the temp folder cannot be deleted (Windows lock), removeLeftovers retries on the next launch.
    if (temp) {
      try {
        rmSync(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      } catch (e) {
        logWarn('migrate', 'could not delete temp migration folder; it will be deleted on the next launch', e)
      }
    }
  }
}
