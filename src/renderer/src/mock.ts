// A fake bridge for developing the UI in a browser, outside Electron. Not used in production.
import type { PrismApi } from '../../preload/api'
import { FAMILIES, PROVIDERS, defaultEffortFor, modelsOf, type Effort, type Family, type ModelId, type Surface } from '@shared/catalog'
import { PRODUCT, validFamilies } from '@shared/product'
import type { Analysis, HistoryEntry, ProviderView, SettingsView, StreamEvent } from '@shared/types'

const SAMPLE = `<prompt>
I'm building Prism, an Electron desktop widget that rewrites raw prompts for Claude models. The settings sheet needs a connection test that tells the user, within a few seconds, whether their Vertex AI key works.

Add a "Test connection" button to src/renderer/src/components/Settings.tsx that calls a new IPC handler in src/main/index.ts. The handler should send a minimal request to the configured analysis model and return { ok, ms, message }.

Requirements:
- Never send the API key to the renderer; it stays in the main process.
- Show the elapsed time on success and the Vertex error message on failure.
- Time out after 60 seconds.

When the change is done, run npm run typecheck and fix any errors before reporting back. Don't add tests or refactor unrelated code; if something else looks worth changing, mention it at the end. Write your messages to me in Turkish; keep code and identifiers as they are.
</prompt>
<notes>
- The target files and the IPC boundary were made explicit; written on the grounds that the key must not reach the UI.
- A verification step (typecheck) was added explicitly for medium effort.
- A scope paragraph was added: Sonnet tends to add unrequested tests/refactors.
</notes>`

const ANALYSIS: Analysis = {
  intent: 'You want a button in the settings panel that tests the Vertex connection; the key must not reach the UI.',
  taskType: 'agentic_coding',
  complexity: 'moderate',
  recommendation: {
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    confidence: 0.82,
    reasoning:
      'A well-scoped feature touching a few files. Sonnet 5.5 medium finishes well-defined work like this quickly and cheaply; Opus is overkill here.',
    factors: ['Well-defined feature', '2-3 files', 'Clear verification']
  },
  alternatives: [
    { model: 'claude-opus-5-5', effort: 'medium', label: 'Stronger', tradeoff: 'More careful with the IPC design, but twice the cost.' },
    { model: 'claude-haiku-5-5', effort: 'medium', label: 'Cheaper', tradeoff: 'Very fast, but may skip steps on multi-file work.' }
  ],
  questions: [
    {
      id: 'q1',
      question: 'Where should the test result appear?',
      why: 'The UI text will be written accordingly',
      options: ['Below the button', 'As a notification', 'In a status badge']
    },
    { id: 'q2', question: 'What should happen on error?', why: 'Error flow', options: ['Show the message', 'Retry button'] }
  ],
  elapsedMs: 2400,
  pool: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'],
  engine: { provider: 'vertex', model: 'gemini-4-argon' }
}

const provider = (id: ProviderView['id']): ProviderView =>
  id === 'vertex'
    ? {
        id,
        key: { present: true, source: 'env', hint: '••••a1b2' },
        ready: true,
        status: { ok: true, checkedAt: Date.now(), models: [{ id: 'gemini-4-argon' }, { id: 'gemini-3.8-flash' }, { id: 'gemini-3.5-flash-lite' }] }
      }
    : { id, key: { present: false, source: 'none', hint: '' }, ready: false, status: null }

let settings: SettingsView = {
  version: 3,
  families: [...FAMILIES],
  uiLanguage: 'en',
  setup: { done: true, step: 'shortcut' },
  hotkeyOk: true,
  engineProvider: 'auto',
  engineModels: {},
  vertex: { project: 'my-gcp-project', location: 'global' },
  defaultFamily: 'claude',
  appFamilies: ['claude'],
  replyLanguage: 'tr',
  defaultSurface: 'agent',
  alwaysOnTop: true,
  hotkey: 'CommandOrControl+Shift+Space',
  launchAtLogin: false,
  notifyWhenHidden: true,
  saveHistory: true,
  contentProtection: false,
  updateCheck: true,
  providers: PROVIDERS.map(provider),
  engine: { provider: 'vertex', analysis: 'gemini-4-argon', generation: 'gemini-4-argon' },
  targets: {
    'claude-opus-5-5': 'app',
    'claude-sonnet-5-5': 'app',
    'claude-haiku-5-5': 'app',
    'claude-fable-5-1': 'app',
    'gemini-4-argon': 'key',
    'gemini-3.8-flash': 'key',
    'gemini-3.5-flash-lite': 'key'
  }
}

const between = (text: string, open: string, close: string) => text.split(open)[1]?.split(close)[0]?.trim() ?? ''
const SAMPLE_PROMPT = between(SAMPLE, '<prompt>', '</prompt>')
const SAMPLE_NOTES = between(SAMPLE, '<notes>', '</notes>').split('\n').map((l) => l.slice(2))

function seedHistory(): HistoryEntry[] {
  const now = Date.now()
  const output = (model: ModelId, effort: Effort, minutesAgo: number) => ({
    id: crypto.randomUUID(),
    model,
    effort,
    createdAt: now - minutesAgo * 60_000,
    prompt: SAMPLE_PROMPT,
    notes: SAMPLE_NOTES,
    elapsedMs: 9100,
    engine: { provider: 'vertex' as const, model: 'gemini-4-argon' }
  })
  return [
    {
      id: 'h1',
      createdAt: now - 6 * 60_000,
      updatedAt: now - 5 * 60_000,
      prompt: 'ayarlar paneline vertex bağlantısını test eden bir buton ekle, key arayüze inmesin, hata olursa mesajı göster',
      surface: 'agent',
      analysis: ANALYSIS,
      answers: [{ question: ANALYSIS.questions[0]?.question ?? '', answer: 'Below the button' }],
      outputs: [output('claude-sonnet-5-5', 'medium', 6), output('claude-opus-5-5', 'medium', 5)]
    },
    {
      id: 'h2',
      createdAt: now - 3 * 3600_000,
      updatedAt: now - 3 * 3600_000,
      prompt: 'müşteri destek e-postalarını iade, kargo, teknik sorun ve diğer olarak sınıflandıran system prompt',
      surface: 'api',
      family: 'auto',
      analysis: { ...ANALYSIS, recommendation: { ...ANALYSIS.recommendation, model: 'gemini-3.5-flash-lite', effort: 'minimal' } },
      answers: [],
      outputs: [output('gemini-3.5-flash-lite', 'minimal', 180)]
    },
    {
      id: 'h3',
      createdAt: now - 26 * 3600_000,
      updatedAt: now - 26 * 3600_000,
      prompt: 'bu repo için mimari bir inceleme yap, zayıf noktaları ve önceliklendirilmiş bir iyileştirme planı çıkar',
      surface: 'agent',
      analysis: { ...ANALYSIS, recommendation: { ...ANALYSIS.recommendation, model: 'claude-opus-5-5', effort: 'high' } },
      answers: [],
      outputs: []
    }
  ]
}

const isFamily = (v: string): v is Family => (FAMILIES as readonly string[]).includes(v)

// Suggestions are picked from the models of the requested families: in Ray no model outside the selected family is suggested (like the real engine's pool).
function analysisFor(families: readonly Family[], surface: Surface): Analysis {
  if (families.includes('claude')) return ANALYSIS
  const pool = families.flatMap((f) => modelsOf(f))
  const [rec, ...rest] = pool
  if (!rec) return ANALYSIS
  return {
    ...ANALYSIS,
    recommendation: { ...ANALYSIS.recommendation, model: rec, effort: defaultEffortFor(rec, surface) },
    alternatives: rest.slice(0, 2).map((model, i) => ({ ...ANALYSIS.alternatives[i % ANALYSIS.alternatives.length]!, model, effort: defaultEffortFor(model, surface) }))
  }
}

export function installMock() {
  // Ray works with a single family: #family=gemini picks another one (default claude). Spectrum opens with four families.
  if (PRODUCT.familyMode === 'single') {
    const m = /family=(claude|openai|gemini|grok)/.exec(location.hash)
    const family = m?.[1] && isFamily(m[1]) ? m[1] : 'claude'
    settings = { ...settings, families: [family], defaultFamily: family }
  }
  // #setup: first-run setup screen when there is no provider.
  if (location.hash.includes('setup')) {
    settings = {
      ...settings,
      engine: null,
      targets: {},
      appFamilies: [],
      providers: PROVIDERS.map((id) => ({ id, key: { present: false, source: 'none', hint: '' }, ready: false, status: null }))
    }
  }
  let history = location.hash.includes('empty') ? [] : seedHistory()
  const showUpdate = location.hash.includes('update')
  const failDelete = location.hash.includes('deletefail')
  const mockLatest = { tag: `${PRODUCT.tagPrefix}9.9.9`, version: '9.9.9' }
  const streamListeners = new Set<(ev: StreamEvent) => void>()
  const timers = new Map<string, number>()
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const api: PrismApi = {
    settings: {
      get: async () => settings,
      set: async (patch) => {
        // Product rule in the main process: exactly one family in Ray, at least one family in Spectrum.
        if (patch.families && !validFamilies(PRODUCT, patch.families)) throw new Error(`This family selection is not valid for ${PRODUCT.name}.`)
        return (settings = { ...settings, ...patch, vertex: { ...settings.vertex, ...patch.vertex } })
      },
      test: async () => (await wait(900), { ok: true, ms: 900, engine: { provider: 'vertex', model: 'gemini-4-argon' } }),
      openKnowledge: async () => '',
      onChanged: () => () => {}
    },
    providers: {
      saveKey: async (id) => {
        await wait(1200)
        const view: ProviderView = {
          id,
          key: { present: true, source: 'saved', hint: '••••9z8y' },
          ready: true,
          status: { ok: true, checkedAt: Date.now(), models: [{ id: 'example-model' }] }
        }
        return (settings = {
          ...settings,
          engine: settings.engine ?? { provider: id, analysis: 'example-model', generation: 'example-model' },
          providers: settings.providers.map((p) => (p.id === id ? view : p))
        })
      },
      clearKey: async (id) => (settings = { ...settings, providers: settings.providers.map((p) => (p.id === id ? { id, key: { present: false, source: 'none', hint: '' }, ready: false, status: null } : p)) }),
      verify: async () => (await wait(900), settings)
    },
    engine: {
      analyze: async (req) => {
        await wait(location.hash.includes('slow') ? 60000 : 2600)
        const id = crypto.randomUUID()
        const now = Date.now()
        const analysis = analysisFor(req.family === 'auto' ? settings.families : [req.family], req.surface)
        history.unshift({ id, createdAt: now, updatedAt: now, prompt: req.prompt, surface: req.surface, family: req.family, analysis, answers: [], outputs: [] })
        return { ...analysis, historyId: id }
      },
      generate: async (req) => {
        let i = 0
        const t = window.setInterval(() => {
          const chunk = SAMPLE.slice(i, i + 14)
          i += 14
          if (chunk) streamListeners.forEach((l) => l({ id: req.id, type: 'chunk', text: chunk }))
          else {
            clearInterval(t)
            const result = { prompt: SAMPLE_PROMPT, notes: SAMPLE_NOTES, elapsedMs: 4200, usage: { promptTokens: 9000, outputTokens: 420, thoughtsTokens: 0 } }
            const entry = history.find((e) => e.id === req.historyId)
            if (entry) {
              entry.outputs.push({ ...result, id: crypto.randomUUID(), model: req.model, effort: req.effort, createdAt: Date.now() })
              entry.answers = req.answers
              entry.updatedAt = Date.now()
              history = [entry, ...history.filter((e) => e !== entry)]
            }
            streamListeners.forEach((l) => l({ id: req.id, type: 'done', result }))
          }
        }, 28)
        timers.set(req.id, t)
      },
      cancel: async (id) => clearInterval(timers.get(id)),
      onStream: (cb) => (streamListeners.add(cb), () => streamListeners.delete(cb))
    },
    history: {
      list: async () => ({ entries: structuredClone(history), storage: settings.saveHistory ? ('encrypted' as const) : ('off' as const) }),
      remove: async (id) => void (history = history.filter((e) => e.id !== id)),
      clear: async () => void (history = [])
    },
    window: {
      getState: async () => ({ mode: 'panel', pinned: settings.alwaysOnTop }),
      setMode: async () => {},
      togglePin: async () => (settings = { ...settings, alwaysOnTop: !settings.alwaysOnTop }).alwaysOnTop,
      hide: async () => {},
      quit: async () => {},
      dragStart: () => {},
      dragMove: () => {},
      dragEnd: () => {},
      onShown: () => () => {},
      onPillState: () => () => {},
      onPinned: () => () => {}
    },
    clipboard: { write: async (t) => navigator.clipboard.writeText(t).catch((e: unknown) => console.warn('[mock] clipboard write failed', e)) },
    ui: { onOpen: () => () => {} },
    // The fake bridge never touches the network: no updates, and deleting only clears the in-memory history.
    // For visual checks: #update shows a notice, #deletefail ends deletion with a partial error.
    update: {
      get: async () => ({ current: '0.0.0-mock', enabled: settings.updateCheck, checkedAt: null, latest: showUpdate ? mockLatest : null }),
      check: async () => ({ current: '0.0.0-mock', enabled: settings.updateCheck, checkedAt: Date.now(), latest: showUpdate ? mockLatest : null }),
      openRelease: async () => {},
      onChanged: () => () => {}
    },
    data: {
      deleteAll: async () => {
        if (failDelete) throw new Error('Could not remove the history file. Close other programs and try again.')
        history = []
        return true
      }
    },
    platform: 'win32'
  }
  window.prism = api
}
