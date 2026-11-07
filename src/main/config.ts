import { app } from 'electron'
import { randomBytes } from 'node:crypto'
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import type { z } from 'zod'
import type { ProviderId } from '@shared/catalog'
import { SettingsPatchSchema, SettingsSchema } from '@shared/schemas'
import type { Settings } from '@shared/types'
import { envValues } from './env'
import { logWarn } from './log'

const DEFAULTS: Settings = {
  version: 2,
  engineProvider: 'auto',
  engineModels: {},
  vertex: { project: '', location: 'global' },
  defaultFamily: 'auto',
  appFamilies: [],
  replyLanguage: 'tr',
  defaultSurface: 'agent',
  alwaysOnTop: true,
  hotkey: 'CommandOrControl+Shift+Space',
  launchAtLogin: false,
  notifyWhenHidden: true,
  saveHistory: true,
  contentProtection: false
}

/** userData içindeki sabit dosya adları; dışarıdan gelen bir ad buraya hiç girmez. */
export type UserFileName =
  | 'settings.json'
  | 'settings.v1.json'
  | 'history.json'
  | 'history.v1.json'
  | 'history.enc'
  | 'history.legacy.enc'
  | 'history.json.tmp'
  | 'models.json'
  | 'window-state.json'
  | `${ProviderId}.key`

export const userFile = (name: UserFileName) => join(app.getPath('userData'), name)

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

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

/**
 * Ayarlar alan alan doğrulanır: tek bir bozuk alan bütün ayarları sıfırlamasın.
 * Geçersiz alan varsayılana döner ve kaydı düşülür (değeri değil, yalnızca alan adı).
 */
function sanitize(raw: Record<string, unknown>): Settings {
  const bad: string[] = []
  const field = <T>(key: keyof Settings, schema: z.ZodType<T>, fallback: T): T => {
    if (raw[key] === undefined) return fallback
    const parsed = schema.safeParse(raw[key])
    if (parsed.success) return parsed.data
    bad.push(key)
    return fallback
  }
  const d = structuredClone(DEFAULTS)
  const s = SettingsSchema.shape
  const out: Settings = {
    version: field('version', s.version, d.version),
    engineProvider: field('engineProvider', s.engineProvider, d.engineProvider),
    engineModels: field('engineModels', s.engineModels, d.engineModels),
    vertex: field('vertex', s.vertex, d.vertex),
    defaultFamily: field('defaultFamily', s.defaultFamily, d.defaultFamily),
    appFamilies: field('appFamilies', s.appFamilies, d.appFamilies),
    replyLanguage: field('replyLanguage', s.replyLanguage, d.replyLanguage),
    defaultSurface: field('defaultSurface', s.defaultSurface, d.defaultSurface),
    alwaysOnTop: field('alwaysOnTop', s.alwaysOnTop, d.alwaysOnTop),
    hotkey: field('hotkey', s.hotkey, d.hotkey),
    launchAtLogin: field('launchAtLogin', s.launchAtLogin, d.launchAtLogin),
    notifyWhenHidden: field('notifyWhenHidden', s.notifyWhenHidden, d.notifyWhenHidden),
    saveHistory: field('saveHistory', s.saveHistory, d.saveHistory),
    contentProtection: field('contentProtection', s.contentProtection, d.contentProtection)
  }
  if (bad.length) logWarn('config', `settings.json içindeki geçersiz alanlar varsayılana döndü: ${bad.join(', ')}`)
  return out
}

/**
 * v1 ayarları (yalnızca Claude hedefi + Vertex motoru) v2'ye taşınır. Mevcut kullanıcının akışı aynen sürsün diye
 * varsayılan ekosistem Claude kalır ve Claude, key gerektirmeyen (uygulama ile kullanılan) aile sayılır.
 */
function migrate(raw: unknown): Settings {
  if (!isRecord(raw)) return structuredClone(DEFAULTS)
  const version = typeof raw.version === 'number' ? raw.version : 1
  if (version >= 2) return sanitize({ ...raw, vertex: { ...DEFAULTS.vertex, ...(isRecord(raw.vertex) ? raw.vertex : {}) } })
  const { analysisModel, generationModel, defaultSurface, ...rest } = raw
  const model = (v: unknown) => (typeof v === 'string' && v ? v : 'gemini-4-argon')
  return sanitize({
    ...rest,
    version: 2,
    engineModels:
      analysisModel || generationModel ? { vertex: { analysis: model(analysisModel), generation: model(generationModel) } } : {},
    vertex: { ...DEFAULTS.vertex },
    defaultFamily: 'claude',
    appFamilies: ['claude'],
    defaultSurface: !defaultSurface || defaultSurface === 'claude-code' ? 'agent' : defaultSurface
  })
}

let settings: Settings | null = null

export function getSettings(): Settings {
  if (settings) return settings
  const raw = readJsonFile('settings.json')
  // v1, ayarlar hiç değiştirilmediyse settings.json yazmazdı. Geçmiş ya da key dosyası olup v2'nin model listesi
  // yoksa bu kurulum yine v1'den geliyordur; yeni kullanıcı sayılırsa Claude akışı kaybolur.
  const legacy =
    raw === null &&
    !existsSync(userFile('models.json')) &&
    (['history.json', 'vertex.key'] as const).some((f) => existsSync(userFile(f)))
  const rawVersion = isRecord(raw) && typeof raw.version === 'number' ? raw.version : 1
  const next = migrate(legacy ? { version: 1 } : raw)
  // .env'deki Vertex projesi bir kez ayarlara yazılır; kurulu sürüm geliştirme .env'ini görmez.
  const envProject = envValues().VERTEX_PROJECT_ID
  const fromV1 = legacy || (raw !== null && rawVersion < 2)
  const projectFromEnv = !next.vertex.project && !!envProject && SettingsSchema.shape.vertex.shape.project.safeParse(envProject).success
  if (fromV1) backupV1()
  if (projectFromEnv && envProject) next.vertex.project = envProject
  settings = next
  if (fromV1 || (raw !== null && projectFromEnv)) writeJson('settings.json', settings)
  return settings
}

// v1 ayar dosyası göçten önce bir kez yedeklenir; eski sürüme dönülürse elle geri konabilir.
// Geçmiş yedeği tutulmaz: geçmiş artık şifreli saklanıyor (history.ts) ve düz metin kopya bırakılmaz.
function backupV1() {
  const backup = userFile('settings.v1.json')
  if (existsSync(userFile('settings.json')) && !existsSync(backup)) copyFileSync(userFile('settings.json'), backup)
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
  // Birleşik sonuç da şemadan geçer; diske yalnızca geçerli ayar yazılır. Yazım başarısız olursa bellekteki ayar da değişmez.
  const parsed = SettingsSchema.parse(next)
  writeJson('settings.json', parsed)
  settings = parsed
  return settings
}

export function knowledgeDir() {
  return app.isPackaged ? join(process.resourcesPath, 'knowledge') : join(app.getAppPath(), 'knowledge')
}
