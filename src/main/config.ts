import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROVIDERS, PROVIDER_INFO } from '@shared/catalog'
import type { Settings } from '@shared/types'

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
  notifyWhenHidden: true
}

export const userFile = (name: string) => join(app.getPath('userData'), name)

function readRaw(path: string): any {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function writeJson(name: string, data: unknown) {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(userFile(name), JSON.stringify(data, null, 2))
}

export function readUserJson<T>(name: string, fallback: T): T {
  const raw = readRaw(userFile(name))
  return raw && typeof raw === 'object' ? { ...fallback, ...raw } : fallback
}

/**
 * v1 ayarları (yalnızca Claude hedefi + Vertex motoru) v2'ye taşınır. Mevcut kullanıcının akışı aynen sürsün diye
 * varsayılan ekosistem Claude kalır ve Claude, key gerektirmeyen (uygulama ile kullanılan) aile sayılır.
 */
function migrate(raw: any): Settings {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULTS)
  if ((raw.version ?? 1) >= 2) {
    return { ...DEFAULTS, ...raw, vertex: { ...DEFAULTS.vertex, ...raw.vertex }, engineModels: { ...raw.engineModels } }
  }
  const { analysisModel, generationModel, defaultSurface, ...rest } = raw
  return {
    ...DEFAULTS,
    ...rest,
    version: 2,
    engineModels:
      analysisModel || generationModel
        ? { vertex: { analysis: analysisModel || 'gemini-4-argon', generation: generationModel || 'gemini-4-argon' } }
        : {},
    vertex: { ...DEFAULTS.vertex },
    defaultFamily: 'claude',
    appFamilies: ['claude'],
    defaultSurface: !defaultSurface || defaultSurface === 'claude-code' ? 'agent' : defaultSurface
  }
}

let settings: Settings | null = null

export function getSettings(): Settings {
  if (settings) return settings
  const raw = readRaw(userFile('settings.json'))
  // v1, ayarlar hiç değiştirilmediyse settings.json yazmazdı. Geçmiş ya da key dosyası olup v2'nin model listesi
  // yoksa bu kurulum yine v1'den geliyordur; yeni kullanıcı sayılırsa Claude akışı kaybolur.
  const legacy = raw === null && !existsSync(userFile('models.json')) && ['history.json', 'vertex.key'].some((f) => existsSync(userFile(f)))
  settings = migrate(legacy ? { version: 1 } : raw)
  // .env'deki Vertex projesi bir kez ayarlara yazılır; kurulu sürüm geliştirme .env'ini görmez.
  const envProject = envValues().VERTEX_PROJECT_ID
  const fromV1 = legacy || (raw !== null && (raw.version ?? 1) < 2)
  const needsWrite = fromV1 || (raw !== null && !settings.vertex.project && !!envProject)
  if (fromV1) backupV1()
  if (!settings.vertex.project && envProject) settings.vertex.project = envProject
  if (needsWrite) writeJson('settings.json', settings)
  return settings
}

// v1 dosyaları göçten önce bir kez yedeklenir; eski sürüme dönülürse elle geri konabilir.
function backupV1() {
  for (const name of ['settings.json', 'history.json']) {
    const backup = userFile(name.replace('.json', '.v1.json'))
    if (existsSync(userFile(name)) && !existsSync(backup)) copyFileSync(userFile(name), backup)
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const cur = getSettings()
  settings = {
    ...cur,
    ...patch,
    vertex: { ...cur.vertex, ...patch.vertex },
    engineModels: { ...cur.engineModels, ...patch.engineModels }
  }
  writeJson('settings.json', settings)
  return settings
}

// --- Ortam değişkenleri ---------------------------------------------------------
// Sıra: süreç ortamı → kullanıcı klasöründeki .env → proje kökündeki .env (yalnızca geliştirmede paketin içinde olur).

function parseEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}

const ENV_NAMES = [...PROVIDERS.map((p) => PROVIDER_INFO[p].env), 'GOOGLE_API_KEY', 'VERTEX_PROJECT_ID', 'VERTEX_LOCATION']

export function envValues(): Record<string, string> {
  const files = [join(app.getAppPath(), '.env'), userFile('.env')]
  const fromFiles = Object.assign({}, ...files.map(parseEnv))
  const fromProcess = Object.fromEntries(ENV_NAMES.filter((k) => process.env[k]).map((k) => [k, process.env[k] as string]))
  return { ...fromFiles, ...fromProcess }
}

export function knowledgeDir() {
  return app.isPackaged ? join(process.resourcesPath, 'knowledge') : join(app.getAppPath(), 'knowledge')
}
