import { app } from 'electron'
import { randomBytes } from 'node:crypto'
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import type { z } from 'zod'
import type { ProviderId } from '@shared/catalog'
import { PRODUCT, validFamilies } from '@shared/product'
import { msg, setMessageLanguage } from '@shared/messages'
import { SettingsPatchSchema, SettingsSchema } from '@shared/schemas'
import { SETTINGS_VERSION, conform, loadSettings, serializeSettings } from '@shared/settings'
import type { Settings } from '@shared/types'
import { envValues } from './env'
import { logWarn } from './log'
import { UserError } from './errors'

/** userData içindeki sabit dosya adları; dışarıdan gelen bir ad buraya hiç girmez. */
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
  | `${ProviderId}.key`

export const userFile = (name: UserFileName) => join(app.getPath('userData'), name)


/** Dosya yoksa null (beklenen durum). Bozuksa kayıt düşülür, dosya yedeklenir ve null döner. */
export function readJsonFile(name: UserFileName): unknown {
  const path = userFile(name)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch (e) {
    logWarn('config', `${name} okunamadı, varsayılanlar kullanılacak`, e)
    quarantine(name)
    return null
  }
}

/** Okunamayan dosya silinmez, kenara alınır; kullanıcı verisi kaybolmasın. */
function quarantine(name: UserFileName) {
  const path = userFile(name)
  if (!existsSync(path)) return
  try {
    renameSync(path, `${path}.bozuk-${Date.now()}`)
  } catch (e) {
    logWarn('config', `${name} kenara alınamadı`, e)
  }
}

/**
 * Yarım yazılmış dosya kalmasın diye önce benzersiz bir geçici dosyaya yazılır, diske işlenir, sonra yerine taşınır.
 * Dosyalar yalnızca sahibince okunabilir (0600; Windows'ta userData zaten kullanıcıya özeldir).
 */
export function writeFileAtomic(name: UserFileName, data: string | Buffer) {
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

// Windows'ta virüs tarayıcı ya da dizin oluşturucu hedef dosyayı kısa süre tutabilir (EPERM/EBUSY/EACCES).
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

/** Şemaya uymayan dosya varsayılana döner; şemaya uymayan alanlar yok sayılır. */
export function readUserJson<S extends z.ZodType>(name: UserFileName, schema: S, fallback: z.infer<S>): z.infer<S> {
  const raw = readJsonFile(name)
  if (raw === null) return fallback
  const parsed = schema.safeParse(raw)
  if (parsed.success) return parsed.data
  logWarn('config', `${name} beklenen biçimde değil, varsayılanlar kullanılacak`)
  return fallback
}

let settings: Settings | null = null
/** Bu sürümün tanımadığı alanlar (daha yeni bir sürümden); her yazımda geri konur. */
let extras: Record<string, unknown> = {}
// Daha yeni sürümün okunamayan alanları (ham) ve yükleme anındaki değerler; değişmeyen alan diske aynen geri yazılır.
let preserved: { shadow: Record<string, unknown>; base: Settings } | undefined

export function getSettings(): Settings {
  if (settings) return settings
  const raw = readJsonFile('settings.json')
  // v1, ayarlar hiç değiştirilmediyse settings.json yazmazdı. Geçmiş ya da key dosyası olup v2'nin model listesi
  // yoksa bu kurulum yine v1'den geliyordur; yeni kullanıcı sayılırsa Claude akışı kaybolur.
  const legacy =
    raw === null &&
    !existsSync(userFile('models.json')) &&
    (['history.json', 'vertex.key'] as const).some((f) => existsSync(userFile(f)))
  const loaded = loadSettings(legacy ? { version: 1 } : raw, PRODUCT)
  if (loaded.invalid.length) logWarn('config', `settings.json içindeki geçersiz alanlar varsayılana döndü: ${loaded.invalid.join(', ')}`)
  const next = loaded.settings
  extras = loaded.extras
  preserved = Object.keys(loaded.shadow).length ? { shadow: loaded.shadow, base: next } : undefined
  // .env'deki Vertex projesi bir kez ayarlara yazılır; kurulu sürüm geliştirme .env'ini görmez.
  const envProject = envValues().VERTEX_PROJECT_ID
  const migrated = loaded.from !== null && loaded.from < SETTINGS_VERSION
  const projectFromEnv = !next.vertex.project && !!envProject && SettingsSchema.shape.vertex.shape.project.safeParse(envProject).success
  // Yedek ya da göç yazımı başarısız olursa (dosya kilidi, salt okunur klasör) uygulama yine açılır; ayarlar bellekte sürer.
  try {
    if (migrated && loaded.from !== null) backup(loaded.from)
  } catch (e) {
    logWarn('config', 'ayar yedeği alınamadı', e)
  }
  if (projectFromEnv && envProject) next.vertex.project = envProject
  settings = next
  setMessageLanguage(next.uiLanguage)
  try {
    if (legacy || migrated || (raw !== null && projectFromEnv)) writeJson('settings.json', serializeSettings(settings, extras, preserved))
  } catch (e) {
    logWarn('config', 'taşınan ayarlar yazılamadı; bellekteki ayarlarla devam ediliyor', e)
  }
  return settings
}

// Göçten önce eski sürümün dosyası bir kez yedeklenir (settings.vN.json); eski sürüme dönülürse elle geri konabilir.
// Geçmiş yedeği tutulmaz: geçmiş artık şifreli saklanıyor (history.ts) ve düz metin kopya bırakılmaz.
function backup(version: number) {
  const target = userFile(`settings.v${version}.json`)
  if (existsSync(userFile('settings.json')) && !existsSync(target)) copyFileSync(userFile('settings.json'), target)
}

/** Açıkça undefined gönderilen alan "değiştirme" demektir; mevcut değeri silmez. */
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
  // Ürün kuralı: Ray'de tam bir aile, diğerlerinde en az bir aile. Kurala uymayan seçim sessizce düzeltilmez, reddedilir.
  if (patch.families && !validFamilies(PRODUCT, patch.families)) throw new UserError(msg('err.familiesInvalid', { product: PRODUCT.name }))
  // Birleşik sonuç da şemadan geçer; diske yalnızca geçerli ayar yazılır. Yazım başarısız olursa bellekteki ayar da değişmez.
  const parsed = conform(SettingsSchema.parse(next), PRODUCT)
  writeJson('settings.json', serializeSettings(parsed, extras, preserved))
  settings = parsed
  setMessageLanguage(parsed.uiLanguage)
  return settings
}

export function knowledgeDir() {
  return app.isPackaged ? join(process.resourcesPath, 'knowledge') : join(app.getAppPath(), 'knowledge')
}
