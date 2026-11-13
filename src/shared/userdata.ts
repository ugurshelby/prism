// "Delete all my data" deletes only files Prism wrote itself: settings and their backups, history and its
// encrypted backups, keys, the model cache, window and update state, leftover temp files,
// corrupt files set aside. Chromium cache folders and other files the user put there are left alone unless listed.
// Pure module: file work is in main/wipe.ts. When a new userData file (config.ts UserFileName) is added,
// it is added here too.
import { PROVIDERS } from './catalog'
import { LEGACY_OFFER_MARKER } from './legacy'

const BASES: ReadonlySet<string> = new Set([
    // Older versions could keep keys as plain text in userData/.env (env.ts leftoverEnvNames); that is deleted too.
  '.env',
  'settings.json',
  'history.json',
  'history.v1.json',
  'history.enc',
  'history.legacy.enc',
  'models.json',
  'window-state.json',
  'update-state.json',
    // One-time migration marker for Spectrum from 2.x (main/migrate.ts).
  'migrated.json',
    // macOS: the one-time offer to move the 2.x app to the Trash was answered (main/legacy-install.ts).
  LEGACY_OFFER_MARKER,
  ...PROVIDERS.map((p) => `${p}.key`)
])
const SETTINGS_BACKUP = /^settings\.v\d+\.json$/
// Suffixes that can follow the base name: the temp file of an atomic write (.<hex>.tmp), history.json.tmp, encrypted
// backups (.<n>.bak), the copy set aside when unreadable (.bozuk-<time>) and the encrypted history that cannot be decrypted on this system
// (.unreadable-<time>).
const SUFFIXES = [/\.[0-9a-f]{12}\.tmp$/, /\.tmp$/, /\.\d+\.bak$/, /\.bozuk-\d+$/, /\.unreadable-\d+$/]

const isBase = (name: string) => BASES.has(name) || SETTINGS_BACKUP.test(name)

export function isOwnDataFile(name: string): boolean {
  if (isBase(name)) return true
  return SUFFIXES.some((suffix) => {
    const m = suffix.exec(name)
    return !!m && isBase(name.slice(0, m.index))
  })
}
