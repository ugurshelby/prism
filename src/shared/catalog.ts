// Target families, models, effort scales, surfaces and Prism's own engine providers.
// The main process and the UI use the same list.

export const FAMILIES = ['claude', 'openai', 'gemini', 'grok'] as const
export type Family = (typeof FAMILIES)[number]
/** 'auto': cross-family recommendation. */
export type FamilyChoice = Family | 'auto'

/** Union of the effort / reasoning / thinking levels of all families, low to high. */
export const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

export const SURFACES = ['agent', 'chat', 'api'] as const
export type Surface = (typeof SURFACES)[number]

/** The target tool's own name (a product name, not translated); the engine prompt uses this name too. Descriptions live in the UI dictionary. */
type SurfaceLabels = Record<Surface, { label: string }>

export interface FamilyInfo {
  id: Family
  name: string
  vendor: string
    /** The setting's name in the target tool and its docs. */
  effortLabel: string
  surfaces: SurfaceLabels
  hue: string
}

export const FAMILY_INFO: Record<Family, FamilyInfo> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    vendor: 'Anthropic',
    effortLabel: 'effort',
    surfaces: {
      agent: { label: 'Claude Code' },
      chat: { label: 'claude.ai' },
      api: { label: 'API' }
    },
    hue: '#ff9a5a'
  },
  openai: {
    id: 'openai',
    name: 'ChatGPT',
    vendor: 'OpenAI',
    effortLabel: 'reasoning effort',
    surfaces: {
      agent: { label: 'Codex' },
      chat: { label: 'ChatGPT' },
      api: { label: 'API' }
    },
    hue: '#7fd6a6'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    vendor: 'Google',
    effortLabel: 'thinking level',
    surfaces: {
      agent: { label: 'Antigravity' },
      chat: { label: 'Gemini' },
      api: { label: 'API' }
    },
    hue: '#6cb0ff'
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    vendor: 'xAI',
    effortLabel: 'reasoning effort',
    surfaces: {
      agent: { label: 'Grok Build' },
      chat: { label: 'Grok' },
      api: { label: 'API' }
    },
    hue: '#c9d1dc'
  }
}

/** Generic surface name when no family is selected (cross recommendation); it goes into the engine prompt, the UI translates it from its own dictionary. */
export const GENERIC_SURFACE: SurfaceLabels = {
  agent: { label: 'Coding agent' },
  chat: { label: 'Chat' },
  api: { label: 'API' }
}

export function surfaceInfo(family: FamilyChoice, surface: Surface) {
  return family === 'auto' ? GENERIC_SURFACE[surface] : FAMILY_INFO[family].surfaces[surface]
}

export const MODEL_IDS = [
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
  'gpt-6-astra',
  'gpt-6.1-sol',
  'gpt-6.1-terra',
  'gpt-6-luna',
  'gemini-4-carbon',
  'gemini-4-argon',
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'grok-4.7',
  'grok-4.3',
  'grok-build-0.1'
] as const
export type ModelId = (typeof MODEL_IDS)[number]

export type Latency = 'slow' | 'moderate' | 'fast' | 'fastest'

export interface TargetModel {
  id: ModelId
  family: Family
  name: string
  short: string
  latency: Latency
  price: { input: number; output: number }
    /** Supported levels, low to high. If empty the level is fixed (not adjustable). */
  efforts: readonly Effort[]
  defaultEffort: { api: Effort; agent: Effort }
  hue: string
}

const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export const MODELS: Record<ModelId, TargetModel> = {
  'claude-fable-5-1': {
    id: 'claude-fable-5-1',
    family: 'claude',
    name: 'Claude Fable 5.1',
    short: 'Fable 5.1',
    latency: 'slow',
    price: { input: 10, output: 50 },
    efforts: CLAUDE_EFFORTS,
    defaultEffort: { api: 'high', agent: 'high' },
    hue: '#f78fb3'
  },
  'claude-opus-5-5': {
    id: 'claude-opus-5-5',
    family: 'claude',
    name: 'Claude Opus 5.5',
    short: 'Opus 5.5',
    latency: 'moderate',
    price: { input: 4, output: 20 },
    efforts: CLAUDE_EFFORTS,
    defaultEffort: { api: 'medium', agent: 'medium' },
    hue: '#ff9a5a'
  },
  'claude-sonnet-5-5': {
    id: 'claude-sonnet-5-5',
    family: 'claude',
    name: 'Claude Sonnet 5.5',
    short: 'Sonnet 5.5',
    latency: 'fast',
    price: { input: 2, output: 10 },
    efforts: CLAUDE_EFFORTS,
    defaultEffort: { api: 'high', agent: 'medium' },
    hue: '#6cc9ff'
  },
  'claude-haiku-5-5': {
    id: 'claude-haiku-5-5',
    family: 'claude',
    name: 'Claude Haiku 5.5',
    short: 'Haiku 5.5',
    latency: 'fastest',
    price: { input: 0.1, output: 0.5 },
    efforts: CLAUDE_EFFORTS,
    defaultEffort: { api: 'medium', agent: 'medium' },
    hue: '#8be28f'
  },
  'gpt-6-astra': {
    id: 'gpt-6-astra',
    family: 'openai',
    name: 'GPT-6 Astra',
    short: 'Astra',
    latency: 'slow',
    price: { input: 10, output: 50 },
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
        // Codex starting level: Astra low, Luna high (codex-best-practices, 2026-11-10).
    defaultEffort: { api: 'medium', agent: 'low' },
    hue: '#b49cff'
  },
  'gpt-6.1-sol': {
    id: 'gpt-6.1-sol',
    family: 'openai',
    name: 'GPT-6.1 Sol',
    short: 'Sol',
    latency: 'moderate',
    price: { input: 2, output: 10 },
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffort: { api: 'medium', agent: 'medium' },
    hue: '#ffd36e'
  },
  'gpt-6.1-terra': {
    id: 'gpt-6.1-terra',
    family: 'openai',
    name: 'GPT-6.1 Terra',
    short: 'Terra',
    latency: 'fast',
    price: { input: 1, output: 5 },
    efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffort: { api: 'medium', agent: 'medium' },
    hue: '#7fd6a6'
  },
  'gpt-6-luna': {
    id: 'gpt-6-luna',
    family: 'openai',
    name: 'GPT-6 Luna',
    short: 'Luna',
    latency: 'fastest',
    price: { input: 0.1, output: 0.5 },
    efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffort: { api: 'medium', agent: 'high' },
    hue: '#9fb4ff'
  },
  'gemini-4-carbon': {
    id: 'gemini-4-carbon',
    family: 'gemini',
    name: 'Gemini 4 Carbon',
    short: 'Carbon',
    latency: 'slow',
    price: { input: 4, output: 20 },
    efforts: ['low', 'medium', 'high'],
    defaultEffort: { api: 'medium', agent: 'medium' },
    hue: '#8a6cff'
  },
  'gemini-4-argon': {
    id: 'gemini-4-argon',
    family: 'gemini',
    name: 'Gemini 4 Argon',
    short: 'Argon',
    latency: 'moderate',
    price: { input: 4, output: 20 },
    efforts: ['low', 'medium', 'high'],
    defaultEffort: { api: 'medium', agent: 'medium' },
    hue: '#6c8cff'
  },
  'gemini-4-hydrogen': {
    id: 'gemini-4-hydrogen',
    family: 'gemini',
    name: 'Gemini 4 Hydrogen',
    short: 'Hydrogen',
    latency: 'fast',
    price: { input: 1.5, output: 7.5 },
    efforts: ['low', 'medium', 'high', 'xhigh'],
    defaultEffort: { api: 'high', agent: 'high' },
    hue: '#5fd0ff'
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    family: 'gemini',
    name: 'Gemini 3.8 Flash',
    short: '3.8 Flash',
    latency: 'fast',
    price: { input: 1.5, output: 7.5 },
    efforts: ['low', 'medium', 'high'],
    defaultEffort: { api: 'medium', agent: 'medium' },
    hue: '#4fe3c1'
  },
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    family: 'gemini',
    name: 'Gemini 3.5 Flash-Lite',
    short: '3.5 Flash-Lite',
    latency: 'fastest',
    price: { input: 0.3, output: 2.5 },
    efforts: ['minimal', 'low', 'medium', 'high'],
    defaultEffort: { api: 'minimal', agent: 'minimal' },
    hue: '#a3e66b'
  },
  'grok-4.7': {
    id: 'grok-4.7',
    family: 'grok',
    name: 'Grok 4.7',
    short: 'Grok 4.7',
    latency: 'moderate',
    price: { input: 2, output: 6 },
    efforts: ['low', 'medium', 'high', 'xhigh'],
    defaultEffort: { api: 'high', agent: 'high' },
    hue: '#e2e8f0'
  },
  'grok-4.3': {
    id: 'grok-4.3',
    family: 'grok',
    name: 'Grok 4.3',
    short: 'Grok 4.3',
    latency: 'fast',
    price: { input: 1.25, output: 2.5 },
    efforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    defaultEffort: { api: 'low', agent: 'low' },
    hue: '#9aa7b8'
  },
  'grok-build-0.1': {
    id: 'grok-build-0.1',
    family: 'grok',
    name: 'Grok Build 0.1',
    short: 'Grok Build',
    latency: 'moderate',
    price: { input: 1, output: 2 },
    efforts: [],
    defaultEffort: { api: 'high', agent: 'high' },
    hue: '#ff7a7a'
  }
}

/** The family's first recommended model for manual selection. */
export const FAMILY_DEFAULT_MODEL: Record<Family, ModelId> = {
  claude: 'claude-opus-5-5',
  openai: 'gpt-6.1-sol',
  gemini: 'gemini-3.8-flash',
  grok: 'grok-4.7'
}

export const modelsOf = (family: FamilyChoice): ModelId[] =>
  MODEL_IDS.filter((id) => family === 'auto' || MODELS[id].family === family)

/**
  * Models the recommendation is chosen from: in a narrowed ecosystem the whole family; in cross mode the models of the selected families reachable by key or
  * app (all models of the selected families if none).
 */
export function candidatePool(
  family: FamilyChoice,
  access: Partial<Record<ModelId, unknown>>,
  families: readonly Family[] = FAMILIES
): ModelId[] {
  if (family !== 'auto') return modelsOf(family)
    // A cross recommendation stays within the families the person selected.
  const inFamilies = MODEL_IDS.filter((id) => families.includes(MODELS[id].family))
  const pool = inFamilies.filter((id) => access[id])
  return pool.length ? pool : inFamilies
}

/** Family names for narrow spots such as segments (the 'auto' label is in the UI dictionary). */
export const FAMILY_SHORT: Record<Family, string> = {
  claude: 'Claude',
  openai: 'GPT',
  gemini: 'Gemini',
  grok: 'Grok'
}

export const isModelId = (m: unknown): m is ModelId => (MODEL_IDS as readonly unknown[]).includes(m)
export const isEffort = (e: unknown): e is Effort => (EFFORTS as readonly unknown[]).includes(e)

/** Level names stay in English as in the target tools; descriptions are in the UI dictionary (effort.hint.*). */
export const EFFORT_INFO: Record<Effort, { label: string }> = {
  none: { label: 'None' },
  minimal: { label: 'Minimal' },
  low: { label: 'Low' },
  medium: { label: 'Medium' },
  high: { label: 'High' },
  xhigh: { label: 'xHigh' },
  max: { label: 'Max' }
}

export function defaultEffortFor(model: ModelId, surface: Surface): Effort {
  const d = MODELS[model].defaultEffort
  return surface === 'api' ? d.api : d.agent
}

/** Clamps a level to the nearest level the model supports (needed when switching between families). */
export function clampEffort(model: ModelId, effort: Effort): Effort {
  const m = MODELS[model]
  if (!m.efforts.length) return m.defaultEffort.api
  if (m.efforts.includes(effort)) return effort
  const i = EFFORTS.indexOf(effort)
  const dist = (e: Effort) => Math.abs(EFFORTS.indexOf(e) - i)
  return [...m.efforts].sort((a, b) => dist(a) - dist(b) || EFFORTS.indexOf(b) - EFFORTS.indexOf(a))[0] ?? m.defaultEffort.api
}

/** Short display: null if the level is fixed (the UI shows "fixed"). */
export const effortText = (model: ModelId, effort: Effort): Effort | null => (MODELS[model].efforts.length ? effort : null)

/** Translation function: the UI passes its own dictionary (keys `note.*`; coverage test in src/renderer/src/i18n). */
export type Translate = (key: string, vars?: Record<string, string | number>) => string

type Note = { title: string; lines: string[]; code?: string }

const json = (v: unknown) => JSON.stringify(v, null, 2)

// ChatGPT has no per-model picker: GPT-6 is selected and the Thinking slider is adjusted. Instant, Medium, High and
// Extra High run on GPT-6 Sol, Pro runs on GPT-6 Astra; Terra, Luna and GPT-6.1 Sol are not in chat (chatgpt-models-help,
// 2026-11-10). The closest chat setting is shown for these models.
const CHATGPT_THINKING: Partial<Record<Effort, string>> = { none: 'Instant', low: 'Instant', medium: 'Medium', high: 'High', xhigh: 'Extra High', max: 'Extra High' }

function chatgptNote(m: TargetModel, effort: Effort, t: Translate): Note {
  const title = t('note.chatgpt.title')
  if (m.id === 'gpt-6-astra') return { title, lines: [t('note.chatgpt.pick', { thinking: 'Pro' })] }
  const lines = [t('note.chatgpt.pick', { thinking: CHATGPT_THINKING[effort] ?? 'Medium' })]
    // OpenAI targets in the catalog other than Astra cannot be selected in chat; the prompt still works, and it says which model to open.
  return { title, lines: [...lines, t('note.chatgpt.notInChat', { model: m.name })] }
}

/** The "set it up like this in the target tool" note shown next to the copied prompt. */
export function setupNote(model: ModelId, effort: Effort, surface: Surface, t: Translate): Note {
  const m = MODELS[model]
  const fixed = !m.efforts.length
  const level = EFFORT_INFO[effort].label
  switch (m.family) {
    case 'claude':
      return claudeNote(m, effort, surface, t)
    case 'openai':
      if (surface === 'agent') {
        return { title: t('note.codex.title'), lines: [t('note.codex.line')], code: `model = "${m.id}"\nmodel_reasoning_effort = "${effort}"` }
      }
      if (surface === 'chat') return chatgptNote(m, effort, t)
      return {
        title: t('note.openaiApi.title'),
        lines: [t('note.openaiApi.line'), effort === 'none' ? '' : t('note.openaiApi.sampling')].filter(Boolean),
        code: json({
          model: m.id,
          reasoning: { effort },
          input: [
            { role: 'developer', content: '<prompt>' },
            { role: 'user', content: '<user input>' }
          ],
          max_output_tokens: effort === 'xhigh' || effort === 'max' ? 64000 : 32000
        })
      }
    case 'gemini':
      if (surface === 'agent') {
        return { title: t('note.antigravity.title'), lines: [t('note.antigravity.line', { model: m.name }), t('note.antigravity.thinking', { level })] }
      }
      if (surface === 'chat') {
        return { title: t('note.geminiApp.title'), lines: [t('note.pickModel', { model: m.name }), t('note.pickThinking', { level })] }
      }
      return {
        title: t('note.geminiApi.title'),
        lines: [t('note.geminiApi.line')],
        code: json({
          systemInstruction: { parts: [{ text: '<prompt>' }] },
          contents: [{ role: 'user', parts: [{ text: '<user input>' }] }],
          generationConfig: { thinkingConfig: { thinkingLevel: effort } }
        })
      }
    case 'grok':
      if (surface === 'agent') {
        return {
          title: t('note.grokBuild.title'),
          lines: fixed ? [t('note.grokBuild.fixed')] : [t('note.grokBuild.model', { id: m.id })],
          code: fixed ? undefined : `[models]\ndefault = "${m.id}"\ndefault_reasoning_effort = "${effort}"`
        }
      }
      if (surface === 'chat') {
        return {
          title: t('note.grokApp.title'),
          lines: [t('note.pickModel', { model: m.name }), fixed ? t('note.grokApp.fixed') : t('note.pickThinking', { level })]
        }
      }
      return {
        title: t('note.xaiApi.title'),
        lines: [t('note.xaiApi.line'), t('note.xaiApi.timeout')],
        code: json({
          model: m.id,
          ...(fixed ? {} : { reasoning: { effort } }),
          input: [
            { role: 'system', content: '<prompt>' },
            { role: 'user', content: '<user input>' }
          ],
          temperature: 0.7,
          top_p: 0.95
        })
      }
  }
}

function claudeNote(m: TargetModel, effort: Effort, surface: Surface, t: Translate): Note {
  if (surface === 'agent') {
    return {
      title: t('note.claudeCode.title'),
      lines: [effort === 'max' ? t('note.claudeCode.max') : t('note.claudeCode.saved')],
      code: `/model ${m.id}\n/effort ${effort}`
    }
  }
  if (surface === 'chat') {
    return {
      title: t('note.claudeApp.title'),
      lines: [t('note.pickModel', { model: m.name }), t('note.claudeApp.effort', { level: EFFORT_INFO[effort].label, fallback: m.defaultEffort.api })]
    }
  }
    // Opus 5.5 works well at 128k in agent work (Anthropic, prompting-claude-opus-5-5).
  const maxTokens = effort === 'xhigh' || effort === 'max' ? 128000 : effort === 'high' ? 32000 : 16000
  return {
    title: t('note.claudeApi.title'),
    lines: [t('note.claudeApi.line')],
    code: json({ model: m.id, max_tokens: maxTokens, output_config: { effort }, system: '<prompt>', messages: [] })
  }
}

// --- Prism's own engine (the LLM it calls for analysis + writing) ---------------

export const PROVIDERS = ['vertex', 'anthropic', 'gemini', 'openai', 'xai'] as const
export type ProviderId = (typeof PROVIDERS)[number]

export interface ProviderInfo {
  id: ProviderId
  label: string
    /** The target family reached with this key. */
  family: Family
  env: string
  keyUrl: string
    /** Preference order for analysis / writing; intersected with the discovered models. */
  engine: { analysis: string[]; generation: string[] }
}

export const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
  vertex: {
    id: 'vertex',
    label: 'Vertex AI',
    family: 'gemini',
    env: 'VERTEX_API_KEY',
    keyUrl: 'https://console.cloud.google.com/apis/credentials',
    engine: { analysis: ['gemini-4-argon', 'gemini-3.8-flash'], generation: ['gemini-4-argon', 'gemini-3.8-flash'] }
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    family: 'claude',
    env: 'ANTHROPIC_API_KEY',
    keyUrl: 'https://platform.claude.com/settings/keys',
    engine: { analysis: ['claude-sonnet-5-5', 'claude-opus-5-5'], generation: ['claude-opus-5-5', 'claude-sonnet-5-5'] }
  },
  gemini: {
    id: 'gemini',
    label: 'Google AI Studio',
        // The engine list is independent of the target catalog: gemini-3.6-flash is not offered as a target but can be an engine.
    family: 'gemini',
    env: 'GEMINI_API_KEY',
    keyUrl: 'https://aistudio.google.com/apikey',
    engine: {
      analysis: ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-3.6-flash'],
      generation: ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.6-flash']
    }
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    family: 'openai',
    env: 'OPENAI_API_KEY',
    keyUrl: 'https://platform.openai.com/api-keys',
    engine: { analysis: ['gpt-6.1-sol', 'gpt-6.1-terra'], generation: ['gpt-6-astra', 'gpt-6.1-sol'] }
  },
  xai: {
    id: 'xai',
    label: 'xAI',
    family: 'grok',
    env: 'XAI_API_KEY',
    keyUrl: 'https://console.x.ai',
    engine: { analysis: ['grok-4.7', 'grok-4.3'], generation: ['grok-4.7', 'grok-4.3'] }
  }
}

/** Does a discovered model ID correspond to this target model (including dated versions)? */
export const matchesTarget = (discovered: string, target: ModelId) =>
  discovered === target || discovered.startsWith(`${target}-`) || discovered.startsWith(`${target}@`)

/** The first of the default models of the pooled families; otherwise the pool's first model. In an empty pool the Claude default. */
export const preferredModel = (pool: ModelId[]): ModelId =>
  pool.find((m) => Object.values(FAMILY_DEFAULT_MODEL).includes(m)) ?? pool[0] ?? FAMILY_DEFAULT_MODEL.claude
