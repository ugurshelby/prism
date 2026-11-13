// Provider keys, model discovery, target access and Prism's engine selection.
// Keys never leave the main process: only the masked form goes to the UI.

import { existsSync, readFileSync } from 'node:fs'
import { timingSafeEqual } from 'node:crypto'
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
import { envValues, leftoverEnvNames } from './env'
import { LlmError, client, generate, type Credentials, type LlmCall, type LlmResult } from './llm'
import { logWarn } from './log'
import { msg } from '@shared/messages'
import { UserError } from './errors'
import { rendererMessage } from './ipc'
import { seal, unseal, vaultState, wipeFile } from './vault'

// --- Key saklama ------------------------------------------------------------------
// A key entered in the UI is encrypted with the operating system's keyring and written to userData/<provider>.key (vault.ts).
// Order: saved key → (development only) environment variable → .env. If the saved key cannot be read, it does not silently
// fall back to .env; an explicit error is raised. An installed build does not read .env, and tells the user if an old .env is left.

const keyFile = (p: ProviderId) => userFile(`${p}.key`)

/** unreadable: a saved key exists but cannot be decrypted; automatic engine selection stops in that case. */
type KeyState = { key: string; source: 'saved' | 'env' } | { key: null; source: 'none'; problem?: string; unreadable?: boolean }

// The decrypted saved key is held in memory: the keyring is not hit again and again on every settings view (on macOS and Linux
// every decrypt can turn into an unlock prompt). Invalidated when the key is saved or deleted (forget).
const savedCache = new Map<ProviderId, KeyState | null>()

function savedKey(p: ProviderId): KeyState | null {
  if (savedCache.has(p)) return savedCache.get(p) ?? null
  const path = keyFile(p)
  let state: KeyState | null = null
  if (existsSync(path)) {
    try {
      state = { key: unseal(readFileSync(path)), source: 'saved' }
    } catch (e) {
      logWarn('providers', `could not decrypt the saved key for ${p}`, e)
      state = { key: null, source: 'none', unreadable: true, problem: msg('err.keyUnreadable', { label: PROVIDER_INFO[p].label }) }
    }
  }
  // An unreadable key is not cached: if the keyring is locked at launch, the next request retries.
  if (!(state?.key === null && state.unreadable)) savedCache.set(p, state)
  return state
}

function envKey(p: ProviderId): string | undefined {
  const env = envValues()
  return env[PROVIDER_INFO[p].env] || (p === 'gemini' ? env.GOOGLE_API_KEY : undefined) || undefined
}

/** Whether an installed build's .env in the user folder still holds this provider's key (name only). */
const leftoverKey = (p: ProviderId) =>
  leftoverEnvNames().some((n) => n === PROVIDER_INFO[p].env || (p === 'gemini' && n === 'GOOGLE_API_KEY'))

function keyOf(p: ProviderId): KeyState {
  const saved = savedKey(p)
  if (saved) return saved
  const env = envKey(p)
  if (env) return { key: env, source: 'env' }
  if (leftoverKey(p)) {
    return {
      key: null,
      source: 'none',
      problem: msg('err.keyLeftInEnv', { label: PROVIDER_INFO[p].label })
    }
  }
  return { key: null, source: 'none' }
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
    throw new LlmError(state.problem ?? msg('err.keyMissing', { label }))
  }
  // A key from .env goes through the same format rule; a malformed key is never sent to the provider.
  const format = ApiKeySchema.safeParse(state.key)
  if (!format.success) throw new LlmError(msg('err.keyInvalid', { label, source: state.source === 'env' ? PROVIDER_INFO[p].env : msg('err.savedKey'), detail: describeIssues(format.error) }))
  if (p !== 'vertex') return { key: state.key }
  const t = vertexTarget()
  if (!t.project) throw new LlmError(msg('err.vertexProjectMissing'))
  // The project and location from .env also go into the request address; they pass the same rule as the settings.
  const project = VertexProjectSchema.safeParse(t.project)
  const location = VertexLocationSchema.safeParse(t.location)
  if (!project.success) throw new LlmError(describeIssues(project.error))
  if (!location.success) throw new LlmError(describeIssues(location.error))
  return { key: state.key, project: project.data, location: location.data }
}

/** Saves the key; if the same key is already saved, does nothing and returns false. */
export function saveKey(p: ProviderId, key: string): boolean {
  const format = ApiKeySchema.safeParse(key)
  if (!format.success) throw new UserError(describeIssues(format.error))
  const vault = vaultState()
  if (!vault.ok) throw new UserError(msg('err.keyUnsafe', { reason: vault.reason }))
  // If the same key is saved again, the cached discovery result is kept; paid discovery requests are not repeated.
  if (sameSecret(savedKey(p)?.key ?? null, format.data)) return false
  writeFileAtomic(`${p}.key`, seal(format.data))
  forget(p)
  return true
}

/** Must be re-verified if there is no last verification or it failed (quota, network). */
export const needsVerify = (p: ProviderId) => !statuses()[p]?.ok

/** Constant-time comparison; a length difference also means not equal. */
function sameSecret(a: string | null, b: string) {
  if (a === null) return false
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  return x.length === y.length && timingSafeEqual(x, y)
}

/** "Delete all my data": decrypted keys in memory and the model cache are dropped; they are not used even after a partial wipe. */
export function forgetAllKeys() {
  for (const p of PROVIDERS) forget(p)
}

export function clearKey(p: ProviderId) {
  wipeFile(keyFile(p))
  forget(p)
}

// --- Model discovery (userData/models.json) -------------------------------------------

type Cache = Partial<Record<ProviderId, ProviderStatus>>
let cache: Cache | null = null
// Increases every time the key changes: a verification started with the old key that finishes late must not overwrite the new result.
const generation = new Map<ProviderId, number>()

const statuses = (): Cache => (cache ??= readUserJson('models.json', ModelsCacheSchema, {}))

function forget(p: ProviderId) {
  generation.set(p, (generation.get(p) ?? 0) + 1)
  savedCache.delete(p)
  inflight.delete(p)
  const all = statuses()
  delete all[p]
  // The key was saved or deleted; this operation is not counted as failed even if the model cache cannot be written.
  try {
    writeJson('models.json', all)
  } catch (e) {
    logWarn('providers', 'could not update models.json', e)
  }
}

// An in-progress verification for the same provider is shared: repeated clicks must not multiply paid discovery requests.
const inflight = new Map<ProviderId, Promise<ProviderStatus>>()

/** Verifies the key and fetches the reachable models; the result is written to the cache. */
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
      : { ok: false, checkedAt: Date.now(), models, message: msg('err.noTextModels') }
  } catch (e) {
    status = { ok: false, checkedAt: Date.now(), models: [], message: rendererMessage('providers:verify', e) }
  }
  if ((generation.get(p) ?? 0) !== started) return status
  statuses()[p] = status
  writeJson('models.json', statuses())
  return status
}

/** Verifies in the background the providers that have a key but were never verified. */
export function verifyPending() {
  return Promise.all(PROVIDERS.filter((p) => isReady(p) && !statuses()[p]).map(verify))
}

function hint(key: string | null) {
  return key ? `••••${key.length > 8 ? key.slice(-4) : ''}` : ''
}

export function providerViews(): ProviderView[] {
  return PROVIDERS.map((id) => {
    const state = keyOf(id)
    // Even if the key was saved, if a plain-text copy is left in .env the user is told to delete it.
    const problem =
      state.key === null
        ? state.problem
        : state.source === 'saved' && leftoverKey(id)
          ? msg('err.keyAlsoInEnv')
          : undefined
    return {
      id,
      key: { present: !!state.key, source: state.source, hint: hint(state.key), ...(problem ? { problem } : {}) },
      ready: isReady(id),
      status: statuses()[id] ?? null
    }
  })
}

// --- Target access and the suggestion pool ------------------------------------------------

const verifiedModels = (p: ProviderId) => {
  const s = statuses()[p]
  return s?.ok && keyOf(p).key ? s.models : []
}

/** Whether the target model can be used with a verified key or with an app that needs no key. */
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

export const candidatePool = (family: FamilyChoice): ModelId[] => poolFor(family, targetAccess(), getSettings().families)


// --- Motor ------------------------------------------------------------------------

let override: ProviderId | null = null

/** For selftest: the engine provider independent of settings. */
export function overrideEngine(p: ProviderId) {
  override = p
}

function pickModel(p: ProviderId, role: 'analysis' | 'generation'): string {
  const prefs = PROVIDER_INFO[p].engine[role]
  // Every provider has at least one preferred model defined in the catalog.
  const first = prefs[0] ?? ''
  const ids = verifiedModels(p).map((m) => m.id)
  return prefs.find((m) => ids.includes(m)) ?? prefs.find((m) => ids.some((id) => id.startsWith(m))) ?? ids[0] ?? first
}

/** Automatic selection: verified providers first (Vertex first among them), then the first provider that is ready. */
function autoProvider(): ProviderId | undefined {
  const ready = PROVIDERS.filter(isReady)
  const verified = ready.filter((p) => statuses()[p]?.ok)
  const pick = (list: ProviderId[]) => (list.includes('vertex') ? 'vertex' : list[0])
  return pick(verified) ?? pick(ready)
}

/** The problem of the first key that is saved but unreadable (keyring locked, file moved from another account). */
function savedKeyProblem(): string | undefined {
  for (const p of PROVIDERS) {
    const k = keyOf(p)
    if (k.key === null && k.unreadable && k.problem) return k.problem
  }
  return undefined
}

/**
 * If the user chose a provider, the engine is that one; if it has no key or cannot be read, the call stops with an explicit error.
 * It never switches to another provider: the prompt must not go to a server the user did not choose, with another key.
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
  // In automatic selection, while an unreadable key exists, it does not switch to another provider: the prompt must not go to
  // another company while the user thinks they are using that provider. The key must be re-saved first.
  const problem = auto ? savedKeyProblem() : undefined
  if (problem) throw new LlmError(problem)
  const e = resolveEngine()
  if (!e) throw new LlmError(savedKeyProblem() ?? msg('err.noProvider'))
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

let hotkeyOk = true
/** Reports the result each time index.ts registers the shortcut; the UI shows a warning and an alternative if registration failed. */
export function setHotkeyOk(ok: boolean) {
  hotkeyOk = ok
}

export function settingsView(): SettingsView {
  return { ...getSettings(), providers: providerViews(), engine: resolveEngine(), targets: targetAccess(), hotkeyOk }
}
