import { app } from 'electron'
import { randomBytes } from 'node:crypto'
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import type { z } from 'zod'
import type { ProviderId } from '@shared/catalog'
import { PRODUCT, validFamilies } from '@shared/product'
import { msg } from '@shared/messages'
import { SettingsPatchSchema, SettingsSchema } from '@shared/schemas'
import { SETTINGS_VERSION, conform, failClosed, loadSettings, serializeSettings } from '@shared/settings'
import type { Settings } from '@shared/types'
import { envValues } from './env'
import { logWarn } from './log'
import { UserError } from './errors'

/** Fixed file names inside userData; a name from outside never gets in here. */
export type UserFileName =
  | 'settings.json'
  | `settings.v${number}.json`
  | 'history.json'
  | 'history.v1.json'
  | 'history.enc'
  | 'history.legacy.enc'
  | 'history.json.tmp'
  | 'models.json'
  | 'window-state.json'
  | 'update-state.json'
  | `${ProviderId}.key`

export const userFile = (name: UserFileName) => join(app.getPath('userData'), name)


export type JsonRead = { status: 'missing' } | { status: 'ok'; value: unknown } | { status: 'corrupt' } | { status: 'io' }

/**
 * Reads and parses the file. A read error (lock, permission; e.g. antivirus) leaves the file alone: the next launch
 * tries again. Only a file that cannot be read as JSON is set aside.
 */
export function readJsonFileResult(name: UserFileName): JsonRead {
  const path = userFile(name)
  if (!existsSync(path)) return { status: 'missing' }
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (e) {
    logWarn('config', `${name} could not be read (file left in place)`, e)
    return { status: 'io' }
  }
  try {
    return { status: 'ok', value: JSON.parse(text) as unknown }
  } catch (e) {
    logWarn('config', `${name} is not JSON, set aside`, e)
    quarantine(name)
    return { status: 'corrupt' }
  }
}

/** Null if the file is missing or unreadable. */
export function readJsonFile(name: UserFileName): unknown {
  const r = readJsonFileResult(name)
  return r.status === 'ok' ? r.value : null
}

/** An unreadable file is not deleted but set aside, so user data is not lost. */
function quarantine(name: UserFileName) {
  const path = userFile(name)
  if (!existsSync(path)) return
  try {
    renameSync(path, `${path}.bozuk-${Date.now()}`)
  } catch (e) {
    logWarn('config', `${name} could not be set aside`, e)
  }
}

/**
 * To avoid leaving a half-written file, it is first written to a unique temp file, flushed to disk, then moved into place.
 * Files are readable only by the owner (0600; on Windows userData is already private to the user).
 */
// When "Delete all my data" starts, disk writes are shut off: in-memory history, settings or cache
// cannot write the deleted files back. They reopen when the app restarts.
let writesBlocked = false
export function blockWrites() {
  writesBlocked = true
}

export function writeFileAtomic(name: UserFileName, data: string | Buffer) {
  if (writesBlocked) throw new UserError(msg('err.writesBlocked'))
  mkdirSync(app.getPath('userData'), { recursive: true })
  const path = userFile(name)
  const tmp = `${path}.${randomBytes(6).toString('hex')}.tmp`
  try {
    const fd = openSync(tmp, 'w', 0o600)
    try {
      const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
      for (let pos = 0; pos < buf.length; ) pos += writeSync(fd, buf, pos, buf.length - pos, pos)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameWithRetry(tmp, path)
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

// On Windows an antivirus scanner or indexer can briefly hold the target file (EPERM/EBUSY/EACCES).
function renameWithRetry(from: string, to: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return renameSync(from, to)
    } catch (e) {
      const code = e instanceof Error && 'code' in e ? e.code : undefined
      if (attempt >= 4 || !(code === 'EPERM' || code === 'EBUSY' || code === 'EACCES')) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1))
    }
  }
}

export function writeJson(name: UserFileName, data: unknown) {
  writeFileAtomic(name, JSON.stringify(data, null, 2))
}

/** A file that does not match the schema falls back to defaults; fields that do not match are ignored. */
export function readUserJson<S extends z.ZodType>(name: UserFileName, schema: S, fallback: z.infer<S>): z.infer<S> {
  const raw = readJsonFile(name)
  if (raw === null) return fallback
  const parsed = schema.safeParse(raw)
  if (parsed.success) return parsed.data
  logWarn('config', `${name} is not in the expected format, defaults will be used`)
  return fallback
}

let settings: Settings | null = null
/** Fields this version does not recognize (from a newer version); put back on every write. */
let extras: Record<string, unknown> = {}
// Unreadable fields (raw) from a newer version and the values at load time; an unchanged field is written back to disk as is.
let preserved: { shadow: Record<string, unknown>; base: Settings } | undefined

export function getSettings(): Settings {
  if (settings) return settings
  const read = readJsonFileResult('settings.json')
  const raw = read.status === 'ok' ? read.value : null
  // The file existed but was unreadable or corrupt: privacy starts off, as if not a fresh install.
  const unreadable = read.status === 'corrupt' || read.status === 'io'
  // v1 did not write settings.json if settings were never changed. If a history or key file exists but v2's model list
  // does not, this install still comes from v1; counting it as a new user would lose the Claude flow.
  const legacy =
    raw === null &&
    !existsSync(userFile('models.json')) &&
    (['history.json', 'vertex.key'] as const).some((f) => existsSync(userFile(f)))
  const loaded = loadSettings(legacy ? { version: 1 } : raw, PRODUCT)
  if (loaded.invalid.length) logWarn('config', `invalid fields in settings.json reverted to defaults: ${loaded.invalid.join(', ')}`)
  const next = unreadable ? failClosed(loaded.settings, [], true) : loaded.settings
  extras = loaded.extras
  preserved = Object.keys(loaded.shadow).length ? { shadow: loaded.shadow, base: next } : undefined
  // The Vertex project from .env is written to settings once; an installed build does not see the development .env.
  const envProject = envValues().VERTEX_PROJECT_ID
  const migrated = loaded.from !== null && loaded.from < SETTINGS_VERSION
  const projectFromEnv = !next.vertex.project && !!envProject && SettingsSchema.shape.vertex.shape.project.safeParse(envProject).success
  // If the backup or migration write fails (file lock, read-only folder) the app still opens; settings stay in memory.
  try {
    if (migrated && loaded.from !== null) backup(loaded.from)
  } catch (e) {
    logWarn('config', 'could not back up settings', e)
  }
  if (projectFromEnv && envProject) next.vertex.project = envProject
  settings = next
  try {
    // If a corrupt file was set aside, the privacy-off settings are written right away so a second launch does not revert to defaults.
    if (legacy || migrated || read.status === 'corrupt' || (raw !== null && projectFromEnv)) writeJson('settings.json', serializeSettings(settings, extras, preserved))
  } catch (e) {
    logWarn('config', 'could not write migrated settings; continuing with in-memory settings', e)
  }
  return settings
}

// Before migration the old version's file is backed up once (settings.vN.json); it can be restored by hand if going back to an old version.
// No history backup is kept: history is now stored encrypted (history.ts) and no plain-text copy is left.
function backup(version: number) {
  const target = userFile(`settings.v${version}.json`)
  if (existsSync(userFile('settings.json')) && !existsSync(target)) copyFileSync(userFile('settings.json'), target)
}

/** A field explicitly sent as undefined means "do not change"; it does not delete the current value. */
const defined = (o: object | undefined): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined))

export function updateSettings(patch: z.infer<typeof SettingsPatchSchema>): Settings {
  const cur = getSettings()
  const next = {
    ...cur,
    ...defined(patch),
    vertex: { ...cur.vertex, ...defined(patch.vertex) },
    engineModels: { ...cur.engineModels, ...defined(patch.engineModels) }
  }
  // Product rule: exactly one family in Ray, at least one in the others. A selection that breaks the rule is rejected, not silently corrected.
  if (patch.families && !validFamilies(PRODUCT, patch.families)) throw new UserError(msg('err.familiesInvalid', { product: PRODUCT.name }))
  // The merged result also passes the schema; only valid settings are written to disk. If the write fails, the in-memory settings do not change either.
  const parsed = conform(SettingsSchema.parse(next), PRODUCT)
  writeJson('settings.json', serializeSettings(parsed, extras, preserved))
  settings = parsed
  return settings
}

export function knowledgeDir() {
  return app.isPackaged ? join(process.resourcesPath, 'knowledge') : join(app.getAppPath(), 'knowledge')
}
