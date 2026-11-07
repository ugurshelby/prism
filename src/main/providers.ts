// Sağlayıcı key'leri, model keşfi, hedef erişimi ve Prism'in motor seçimi.
// Key'ler ana süreçten çıkmaz: arayüze yalnızca maskeli hâli gider.

import { existsSync, readFileSync } from 'node:fs'
import {
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
import { ApiKeySchema, ModelsCacheSchema, VertexLocationSchema, VertexProjectSchema, describeIssues } from '@shared/schemas'
import type { EngineRef, ProviderStatus, ProviderView, SettingsView, TargetAccess } from '@shared/types'
import { getSettings, readUserJson, userFile, writeFileAtomic, writeJson } from './config'
import { envValues } from './env'
import { LlmError, client, generate, type Credentials, type LlmCall, type LlmResult } from './llm'
import { logWarn } from './log'
import { seal, unseal, vaultState, wipeFile } from './vault'

// --- Key saklama ------------------------------------------------------------------
// Arayüzden girilen key işletim sisteminin anahtarlığıyla şifrelenip userData/<sağlayıcı>.key'e yazılır (vault.ts).
// Sıra: kayıtlı key → ortam değişkeni → .env. Kayıtlı key okunamıyorsa sessizce .env'e düşülmez; açık hata verilir.

const keyFile = (p: ProviderId) => userFile(`${p}.key`)

type KeyState = { key: string; source: 'saved' | 'env' } | { key: null; source: 'none'; problem?: string }

// Çözülmüş kayıtlı key bellekte tutulur: her ayar görünümünde anahtarlığa tekrar tekrar gidilmez (macOS ve Linux'ta
// her çözme bir kilit açma isteğine dönüşebilir). Key kaydedilince ya da silinince geçersiz kılınır (forget).
const savedCache = new Map<ProviderId, KeyState | null>()

function savedKey(p: ProviderId): KeyState | null {
  if (savedCache.has(p)) return savedCache.get(p) ?? null
  const path = keyFile(p)
  let state: KeyState | null = null
  if (existsSync(path)) {
    try {
      state = { key: unseal(readFileSync(path)), source: 'saved' }
    } catch (e) {
      logWarn('providers', `${p} için kayıtlı key çözülemedi`, e)
      state = { key: null, source: 'none', problem: `${PROVIDER_INFO[p].label} için kayıtlı key okunamadı. Key'i yeniden kaydet.` }
    }
  }
  savedCache.set(p, state)
  return state
}

function envKey(p: ProviderId): string | undefined {
  const env = envValues()
  return env[PROVIDER_INFO[p].env] || (p === 'gemini' ? env.GOOGLE_API_KEY : undefined) || undefined
}

function keyOf(p: ProviderId): KeyState {
  const saved = savedKey(p)
  if (saved) return saved
  const env = envKey(p)
  return env ? { key: env, source: 'env' } : { key: null, source: 'none' }
}

function vertexTarget() {
  const s = getSettings().vertex
  const env = envValues()
  return { project: s.project || env.VERTEX_PROJECT_ID || '', location: s.location || env.VERTEX_LOCATION || 'global' }
}

const isReady = (p: ProviderId) => !!keyOf(p).key && (p !== 'vertex' || !!vertexTarget().project)

export function credentials(p: ProviderId): Credentials {
  const state = keyOf(p)
  const label = PROVIDER_INFO[p].label
  if (state.key === null) {
    throw new LlmError(state.problem ?? `${label} API key bulunamadı. Ayarlardan ekle ya da .env dosyasına ${PROVIDER_INFO[p].env} yaz.`)
  }
  // .env'den gelen key de aynı biçim kuralından geçer; bozuk key sağlayıcıya hiç gönderilmez.
  const format = ApiKeySchema.safeParse(state.key)
  if (!format.success) throw new LlmError(`${label} key'i geçersiz (${state.source === 'env' ? PROVIDER_INFO[p].env : 'kayıtlı key'}): ${describeIssues(format.error)}`)
  if (p !== 'vertex') return { key: state.key }
  const t = vertexTarget()
  if (!t.project) throw new LlmError("Vertex AI için proje ID'si eksik. Ayarlardan gir ya da .env dosyasına VERTEX_PROJECT_ID yaz.")
  // .env'deki proje ve konum da istek adresine girer; ayarlarla aynı kuraldan geçer.
  const project = VertexProjectSchema.safeParse(t.project)
  const location = VertexLocationSchema.safeParse(t.location)
  if (!project.success) throw new LlmError(describeIssues(project.error))
  if (!location.success) throw new LlmError(describeIssues(location.error))
  return { key: state.key, project: project.data, location: location.data }
}

export function saveKey(p: ProviderId, key: string) {
  const format = ApiKeySchema.safeParse(key)
  if (!format.success) throw new Error(describeIssues(format.error))
  const vault = vaultState()
  if (!vault.ok) throw new Error(`${vault.reason} Key güvenle saklanamıyor; sistem anahtarlığını kurup tekrar dene.`)
  writeFileAtomic(`${p}.key`, seal(format.data))
  forget(p)
}

export function clearKey(p: ProviderId) {
  wipeFile(keyFile(p))
  forget(p)
}

// --- Model keşfi (userData/models.json) -------------------------------------------

type Cache = Partial<Record<ProviderId, ProviderStatus>>
let cache: Cache | null = null
// Key her değiştiğinde artar: eski key'le başlamış bir doğrulama geç biterse yeni sonucun üstüne yazmasın.
const generation = new Map<ProviderId, number>()

const statuses = (): Cache => (cache ??= readUserJson('models.json', ModelsCacheSchema, {}))

function forget(p: ProviderId) {
  generation.set(p, (generation.get(p) ?? 0) + 1)
  savedCache.delete(p)
  inflight.delete(p)
  const all = statuses()
  delete all[p]
  // Key kaydedildi ya da silindi; model önbelleği yazılamasa bile bu işlem başarısız sayılmaz.
  try {
    writeJson('models.json', all)
  } catch (e) {
    logWarn('providers', 'models.json güncellenemedi', e)
  }
}

// Aynı sağlayıcı için süren doğrulama paylaşılır: art arda tıklama ücretli keşif isteklerini çoğaltmasın.
const inflight = new Map<ProviderId, Promise<ProviderStatus>>()

/** Key'i doğrular ve erişilen modelleri getirir; sonuç önbelleğe yazılır. */
export function verify(p: ProviderId): Promise<ProviderStatus> {
  const running = inflight.get(p)
  if (running) return running
  const job = runVerify(p).finally(() => {
    if (inflight.get(p) === job) inflight.delete(p)
  })
  inflight.set(p, job)
  return job
}

async function runVerify(p: ProviderId): Promise<ProviderStatus> {
  const started = generation.get(p) ?? 0
  let status: ProviderStatus
  try {
    const models = await client(p).discover(credentials(p))
    status = models.length
      ? { ok: true, checkedAt: Date.now(), models }
      : { ok: false, checkedAt: Date.now(), models, message: 'Bağlantı kuruldu ama erişilebilir metin modeli bulunamadı.' }
  } catch (e) {
    status = { ok: false, checkedAt: Date.now(), models: [], message: e instanceof Error ? e.message : 'Doğrulama başarısız.' }
  }
  if ((generation.get(p) ?? 0) !== started) return status
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
    const state = keyOf(id)
    return {
      id,
      key: { present: !!state.key, source: state.source, hint: hint(state.key), ...(state.key === null && state.problem ? { problem: state.problem } : {}) },
      ready: isReady(id),
      status: statuses()[id] ?? null
    }
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


// --- Motor ------------------------------------------------------------------------

let override: ProviderId | null = null

/** selftest için: ayarlardan bağımsız motor sağlayıcısı. */
export function overrideEngine(p: ProviderId | null) {
  override = p
}

function pickModel(p: ProviderId, role: 'analysis' | 'generation'): string {
  const prefs = PROVIDER_INFO[p].engine[role]
  // Katalogda her sağlayıcının en az bir tercih modeli tanımlı.
  const first = prefs[0] ?? ''
  const ids = verifiedModels(p).map((m) => m.id)
  return prefs.find((m) => ids.includes(m)) ?? prefs.find((m) => ids.some((id) => id.startsWith(m))) ?? ids[0] ?? first
}

/** Otomatik seçim: doğrulanmış sağlayıcılar önce (aralarında Vertex başta), sonra hazır olan ilk sağlayıcı. */
function autoProvider(): ProviderId | undefined {
  const ready = PROVIDERS.filter(isReady)
  const verified = ready.filter((p) => statuses()[p]?.ok)
  const pick = (list: ProviderId[]) => (list.includes('vertex') ? 'vertex' : list[0])
  return pick(verified) ?? pick(ready)
}

/** Kayıtlı ama okunamayan ilk key'in sorunu (anahtarlık kilitli, başka hesaptan taşınmış dosya). */
function savedKeyProblem(): string | undefined {
  for (const p of PROVIDERS) {
    const k = keyOf(p)
    if (k.key === null && k.problem) return k.problem
  }
  return undefined
}

/**
 * Kullanıcı bir sağlayıcı seçtiyse motor odur; key'i yoksa ya da okunamıyorsa çağrı açık bir hatayla durur.
 * Başka bir sağlayıcıya geçilmez: prompt, kullanıcının seçmediği bir sunucuya başka bir key'le gitmesin.
 */
export function resolveEngine(): SettingsView['engine'] {
  const s = getSettings()
  const wanted = override ?? (s.engineProvider === 'auto' ? null : s.engineProvider)
  const provider = wanted ?? autoProvider()
  if (!provider) return null
  const chosen = s.engineModels[provider]
  return {
    provider,
    analysis: chosen?.analysis || pickModel(provider, 'analysis'),
    generation: chosen?.generation || pickModel(provider, 'generation')
  }
}

function engineFor(role: 'analysis' | 'generation'): EngineRef & { cred: Credentials } {
  const auto = !override && getSettings().engineProvider === 'auto'
  // Otomatik seçimde okunamayan bir key varken başka sağlayıcıya geçilmez: kullanıcı o sağlayıcıyı kullandığını
  // sanırken prompt başka bir firmaya gitmesin. Önce key yeniden kaydedilmeli.
  const problem = auto ? savedKeyProblem() : undefined
  if (problem) throw new LlmError(problem)
  const e = resolveEngine()
  if (!e) throw new LlmError(savedKeyProblem() ?? 'Hiç sağlayıcı yapılandırılmamış. Ayarlar → Sağlayıcılar bölümünden bir API key ekle.')
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
