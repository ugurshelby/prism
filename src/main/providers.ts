// Sağlayıcı key'leri, model keşfi, hedef erişimi ve Prompter'ın motor seçimi.
// Key'ler ana süreçten çıkmaz: arayüze yalnızca maskeli hâli gider.

import { safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  FAMILY_DEFAULT_MODEL,
  MODELS,
  MODEL_IDS,
  PROVIDERS,
  PROVIDER_INFO,
  candidatePool as poolFor,
  matchesTarget,
  type FamilyChoice,
  type ModelId,
  type ProviderId
} from '@shared/catalog'
import type { EngineRef, ProviderStatus, ProviderView, SettingsView, TargetAccess } from '@shared/types'
import { envValues, getSettings, readUserJson, userFile, writeJson } from './config'
import { LlmError, client, generate, type Credentials, type LlmCall, type LlmResult } from './llm'

// --- Key saklama ------------------------------------------------------------------
// Arayüzden girilen key safeStorage (Windows DPAPI / macOS Keychain) ile şifrelenip userData/<sağlayıcı>.key'e yazılır.
// Sıra: kayıtlı key → ortam değişkeni → .env.

const keyFile = (p: ProviderId) => userFile(`${p}.key`)

function savedKey(p: ProviderId): string | null {
  const path = keyFile(p)
  if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(readFileSync(path))
  } catch {
    return null
  }
}

function envKey(p: ProviderId): string | null {
  const env = envValues()
  return env[PROVIDER_INFO[p].env] || (p === 'gemini' ? env.GOOGLE_API_KEY : '') || null
}

function keyOf(p: ProviderId): { key: string | null; source: 'saved' | 'env' | 'none' } {
  const saved = savedKey(p)
  if (saved) return { key: saved, source: 'saved' }
  const env = envKey(p)
  return { key: env, source: env ? 'env' : 'none' }
}

function vertexTarget() {
  const s = getSettings().vertex
  const env = envValues()
  return { project: s.project || env.VERTEX_PROJECT_ID || '', location: s.location || env.VERTEX_LOCATION || 'global' }
}

const isReady = (p: ProviderId) => !!keyOf(p).key && (p !== 'vertex' || !!vertexTarget().project)

export function credentials(p: ProviderId): Credentials {
  const { key } = keyOf(p)
  const label = PROVIDER_INFO[p].label
  if (!key) throw new LlmError(`${label} API key bulunamadı. Ayarlardan ekle ya da .env dosyasına ${PROVIDER_INFO[p].env} yaz.`)
  if (p !== 'vertex') return { key }
  const t = vertexTarget()
  if (!t.project) throw new LlmError("Vertex AI için proje ID'si eksik. Ayarlardan gir ya da .env dosyasına VERTEX_PROJECT_ID yaz.")
  return { key, ...t }
}

export function saveKey(p: ProviderId, key: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Bu sistemde güvenli depolama kullanılamıyor.')
  const path = keyFile(p)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, safeStorage.encryptString(key.trim()))
  forget(p)
}

export function clearKey(p: ProviderId) {
  rmSync(keyFile(p), { force: true })
  forget(p)
}

// --- Model keşfi (userData/models.json) -------------------------------------------

type Cache = Partial<Record<ProviderId, ProviderStatus>>
let cache: Cache | null = null

const statuses = (): Cache => (cache ??= readUserJson<Cache>('models.json', {}))

function forget(p: ProviderId) {
  delete statuses()[p]
  writeJson('models.json', statuses())
}

/** Key'i doğrular ve erişilen modelleri getirir; sonuç önbelleğe yazılır. */
export async function verify(p: ProviderId): Promise<ProviderStatus> {
  let status: ProviderStatus
  try {
    const models = await client(p).discover(credentials(p))
    status = models.length
      ? { ok: true, checkedAt: Date.now(), models }
      : { ok: false, checkedAt: Date.now(), models, message: 'Bağlantı kuruldu ama erişilebilir metin modeli bulunamadı.' }
  } catch (e: any) {
    status = { ok: false, checkedAt: Date.now(), models: [], message: e?.message ?? String(e) }
  }
  statuses()[p] = status
  writeJson('models.json', statuses())
  return status
}

/** Key'i olan ama hiç doğrulanmamış sağlayıcıları arka planda doğrular. */
export function verifyPending() {
  return Promise.all(PROVIDERS.filter((p) => isReady(p) && !statuses()[p]).map(verify))
}

function hint(key: string | null) {
  return key ? `••••${key.length > 8 ? key.slice(-4) : ''}` : ''
}

export function providerViews(): ProviderView[] {
  return PROVIDERS.map((id) => {
    const { key, source } = keyOf(id)
    return { id, key: { present: !!key, source, hint: hint(key) }, ready: isReady(id), status: statuses()[id] ?? null }
  })
}

// --- Hedef erişimi ve öneri havuzu ------------------------------------------------

const verifiedModels = (p: ProviderId) => {
  const s = statuses()[p]
  return s?.ok && keyOf(p).key ? s.models : []
}

/** Hedef model, doğrulanmış bir key ile mi yoksa key gerektirmeyen bir uygulama ile mi kullanılabilir. */
export function targetAccess(): Partial<Record<ModelId, TargetAccess>> {
  const apps = getSettings().appFamilies
  const verified = PROVIDERS.map((p) => ({ family: PROVIDER_INFO[p].family, models: verifiedModels(p) }))
  const out: Partial<Record<ModelId, TargetAccess>> = {}
  for (const id of MODEL_IDS) {
    const family = MODELS[id].family
    const viaKey = verified.some((v) => v.family === family && v.models.some((m) => matchesTarget(m.id, id)))
    if (viaKey) out[id] = 'key'
    else if (apps.includes(family)) out[id] = 'app'
  }
  return out
}

export const candidatePool = (family: FamilyChoice): ModelId[] => poolFor(family, targetAccess())

export const fallbackModel = (pool: ModelId[]) =>
  pool.find((m) => (Object.values(FAMILY_DEFAULT_MODEL) as ModelId[]).includes(m)) ?? pool[0]

// --- Motor ------------------------------------------------------------------------

let override: ProviderId | null = null

/** selftest için: ayarlardan bağımsız motor sağlayıcısı. */
export function overrideEngine(p: ProviderId | null) {
  override = p
}

function pickModel(p: ProviderId, role: 'analysis' | 'generation'): string {
  const prefs = PROVIDER_INFO[p].engine[role]
  const ids = verifiedModels(p).map((m) => m.id)
  if (!ids.length) return prefs[0]
  return prefs.find((m) => ids.includes(m)) ?? prefs.find((m) => ids.some((id) => id.startsWith(m))) ?? ids[0]
}

/** Vertex hazırsa Vertex (mevcut kurulum), değilse doğrulanmış ilk sağlayıcı. */
export function resolveEngine(): SettingsView['engine'] {
  const s = getSettings()
  const ready = PROVIDERS.filter(isReady)
  const wanted = override ?? (s.engineProvider === 'auto' ? null : s.engineProvider)
  const provider =
    wanted && ready.includes(wanted)
      ? wanted
      : ready.includes('vertex')
        ? 'vertex'
        : (ready.find((p) => statuses()[p]?.ok) ?? ready[0])
  if (!provider) return null
  const chosen = s.engineModels[provider]
  return {
    provider,
    analysis: chosen?.analysis || pickModel(provider, 'analysis'),
    generation: chosen?.generation || pickModel(provider, 'generation')
  }
}

function engineFor(role: 'analysis' | 'generation'): EngineRef & { cred: Credentials } {
  const e = resolveEngine()
  if (!e) {
    if (keyOf('vertex').key) credentials('vertex')
    throw new LlmError('Hiç sağlayıcı yapılandırılmamış. Ayarlar → Sağlayıcılar bölümünden bir API key ekle.')
  }
  return { provider: e.provider, model: e[role], cred: credentials(e.provider) }
}

export async function engineGenerate(
  role: 'analysis' | 'generation',
  call: Omit<LlmCall, 'model'>
): Promise<LlmResult & { engine: EngineRef }> {
  const { provider, model, cred } = engineFor(role)
  const result = await generate(provider, { ...call, model }, cred)
  return { ...result, engine: { provider, model } }
}

export async function engineStream(
  role: 'analysis' | 'generation',
  call: Omit<LlmCall, 'model'>,
  onText: (chunk: string) => void
): Promise<LlmResult & { engine: EngineRef }> {
  const { provider, model, cred } = engineFor(role)
  const result = await client(provider).stream({ ...call, model }, cred, onText)
  return { ...result, engine: { provider, model } }
}

export function settingsView(): SettingsView {
  return { ...getSettings(), providers: providerViews(), engine: resolveEngine(), targets: targetAccess() }
}
