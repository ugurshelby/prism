// Hedef aileler, modeller, effort ölçekleri, yüzeyler ve Prism'in kendi motor sağlayıcıları.
// Ana süreç ve arayüz aynı listeyi kullanır.

export const FAMILIES = ['claude', 'openai', 'gemini', 'grok'] as const
export type Family = (typeof FAMILIES)[number]
/** 'auto': aileler arası öneri (çapraz). */
export type FamilyChoice = Family | 'auto'

/** Tüm ailelerin effort / reasoning / thinking seviyelerinin birleşimi, düşükten yükseğe. */
export const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

export const SURFACES = ['agent', 'chat', 'api'] as const
export type Surface = (typeof SURFACES)[number]

type SurfaceLabels = Record<Surface, { label: string; hint: string }>

export interface FamilyInfo {
  id: Family
  name: string
  vendor: string
  /** Hedef araçta ve dokümanlarda ayarın adı. */
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
      agent: { label: 'Claude Code', hint: 'Repo içinde agentic kodlama' },
      chat: { label: 'Sohbet', hint: 'claude.ai / Desktop' },
      api: { label: 'API', hint: 'System prompt' }
    },
    hue: '#ff9a5a'
  },
  openai: {
    id: 'openai',
    name: 'ChatGPT',
    vendor: 'OpenAI',
    effortLabel: 'reasoning effort',
    surfaces: {
      agent: { label: 'Codex', hint: 'Repo içinde agentic kodlama' },
      chat: { label: 'ChatGPT', hint: 'chatgpt.com / uygulama' },
      api: { label: 'API', hint: 'Developer mesajı' }
    },
    hue: '#7fd6a6'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    vendor: 'Google',
    effortLabel: 'thinking level',
    surfaces: {
      agent: { label: 'Antigravity', hint: 'Repo içinde agentic kodlama' },
      chat: { label: 'Gemini', hint: 'gemini.google.com / uygulama' },
      api: { label: 'API', hint: 'System instruction' }
    },
    hue: '#6cb0ff'
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    vendor: 'xAI',
    effortLabel: 'reasoning effort',
    surfaces: {
      agent: { label: 'Grok Build', hint: 'Repo içinde agentic kodlama' },
      chat: { label: 'Grok', hint: 'grok.com / uygulama' },
      api: { label: 'API', hint: 'System prompt' }
    },
    hue: '#c9d1dc'
  }
}

/** Aile seçilmemişken (çapraz öneri) gösterilen yüzey adları. */
export const GENERIC_SURFACE: SurfaceLabels = {
  agent: { label: 'Kodlama ajanı', hint: 'Claude Code, Codex, Antigravity, Grok Build' },
  chat: { label: 'Sohbet', hint: 'Uygulama ya da web sohbeti' },
  api: { label: 'API', hint: 'System prompt' }
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
  'gemini-4-argon',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'grok-4.7',
  'grok-4.3',
  'grok-build-0.1'
] as const
export type ModelId = (typeof MODEL_IDS)[number]

export interface TargetModel {
  id: ModelId
  family: Family
  name: string
  short: string
  tagline: string
  latency: string
  price: { input: number; output: number }
  /** Desteklenen seviyeler, düşükten yükseğe. Boşsa seviye sabittir (ayarlanamaz). */
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
    tagline: 'En zor ve en uzun soluklu işler',
    latency: 'Yavaş',
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
    tagline: 'Ciddi işlerin çoğu için başlangıç noktası',
    latency: 'Orta',
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
    tagline: 'Hız ve zekânın en iyi dengesi',
    latency: 'Hızlı',
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
    tagline: 'Hızlı, ucuz, yüksek hacim',
    latency: 'En hızlı',
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
    tagline: 'OpenAI’nin en yetenekli modeli',
    latency: 'Yavaş',
    price: { input: 10, output: 50 },
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffort: { api: 'medium', agent: 'medium' },
    hue: '#b49cff'
  },
  'gpt-6.1-sol': {
    id: 'gpt-6.1-sol',
    family: 'openai',
    name: 'GPT-6.1 Sol',
    short: 'Sol',
    tagline: 'Astra’ya yakın, beşte bir fiyat',
    latency: 'Orta',
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
    tagline: 'Hızlı; yazım, görsel ve bilgisayar kullanımı',
    latency: 'Hızlı',
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
    tagline: 'Odaklı, yüksek hacimli işler',
    latency: 'En hızlı',
    price: { input: 0.1, output: 0.5 },
    efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffort: { api: 'low', agent: 'low' },
    hue: '#9fb4ff'
  },
  'gemini-4-argon': {
    id: 'gemini-4-argon',
    family: 'gemini',
    name: 'Gemini 4 Argon',
    short: 'Argon',
    tagline: 'En zor akıl yürütme, 1M bağlam',
    latency: 'Orta',
    price: { input: 4, output: 20 },
    efforts: ['low', 'medium', 'high'],
    defaultEffort: { api: 'medium', agent: 'medium' },
    hue: '#6c8cff'
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    family: 'gemini',
    name: 'Gemini 3.8 Flash',
    short: '3.8 Flash',
    tagline: 'Uzun soluklu ajan ve kodlama, uygun fiyat',
    latency: 'Hızlı',
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
    tagline: 'En hızlı ve en ucuz Gemini',
    latency: 'En hızlı',
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
    tagline: 'xAI’nin en yetenekli modeli, düşük fiyat',
    latency: 'Orta',
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
    tagline: 'Ucuz, 1M bağlam, hafif akıl yürütme',
    latency: 'Hızlı',
    price: { input: 1.25, output: 2.5 },
    efforts: ['none', 'low', 'medium', 'high'],
    defaultEffort: { api: 'low', agent: 'low' },
    hue: '#9aa7b8'
  },
  'grok-build-0.1': {
    id: 'grok-build-0.1',
    family: 'grok',
    name: 'Grok Build 0.1',
    short: 'Grok Build',
    tagline: 'Grok Build ajanının kodlama modeli',
    latency: 'Orta',
    price: { input: 1, output: 2 },
    efforts: [],
    defaultEffort: { api: 'high', agent: 'high' },
    hue: '#ff7a7a'
  }
}

/** Elle seçimde ailenin ilk önerilen modeli. */
export const FAMILY_DEFAULT_MODEL: Record<Family, ModelId> = {
  claude: 'claude-opus-5-5',
  openai: 'gpt-6.1-sol',
  gemini: 'gemini-3.8-flash',
  grok: 'grok-4.7'
}

export const modelsOf = (family: FamilyChoice): ModelId[] =>
  MODEL_IDS.filter((id) => family === 'auto' || MODELS[id].family === family)

/**
 * Önerinin seçileceği modeller: daraltılmış ekosistemde o ailenin tamamı; çaprazda key ya da uygulama ile
 * erişilebilenler (hiçbiri yoksa tüm katalog).
 */
export function candidatePool(family: FamilyChoice, access: Partial<Record<ModelId, unknown>>): ModelId[] {
  if (family !== 'auto') return modelsOf(family)
  const pool = MODEL_IDS.filter((id) => access[id])
  return pool.length ? pool : [...MODEL_IDS]
}

/** Segment gibi dar yerlerde kullanılan aile adları. */
export const FAMILY_SHORT: Record<FamilyChoice, string> = {
  auto: '✦ Çapraz',
  claude: 'Claude',
  openai: 'GPT',
  gemini: 'Gemini',
  grok: 'Grok'
}

export const isModelId = (m: unknown): m is ModelId => (MODEL_IDS as readonly unknown[]).includes(m)
export const isEffort = (e: unknown): e is Effort => (EFFORTS as readonly unknown[]).includes(e)

export const EFFORT_INFO: Record<Effort, { label: string; hint: string }> = {
  none: { label: 'None', hint: 'Akıl yürütme yok, en hızlı' },
  minimal: { label: 'Minimal', hint: 'Çok kısa düşünme, basit işler' },
  low: { label: 'Low', hint: 'Hızlı, dar kapsam' },
  medium: { label: 'Medium', hint: 'Günlük, net kapsamlı iş' },
  high: { label: 'High', hint: 'Doğrulama ve uç durumlar' },
  xhigh: { label: 'xHigh', hint: 'Uzun soluklu agentic iş' },
  max: { label: 'Max', hint: 'Sınır problemleri' }
}

export function defaultEffortFor(model: ModelId, surface: Surface): Effort {
  const d = MODELS[model].defaultEffort
  return surface === 'api' ? d.api : d.agent
}

/** Seviyeyi modelin desteklediği en yakın seviyeye çeker (aileler arası geçişte gerekir). */
export function clampEffort(model: ModelId, effort: Effort): Effort {
  const m = MODELS[model]
  if (!m.efforts.length) return m.defaultEffort.api
  if (m.efforts.includes(effort)) return effort
  const i = EFFORTS.indexOf(effort)
  const dist = (e: Effort) => Math.abs(EFFORTS.indexOf(e) - i)
  return [...m.efforts].sort((a, b) => dist(a) - dist(b) || EFFORTS.indexOf(b) - EFFORTS.indexOf(a))[0]
}

/** Kısa gösterim: seviye sabitse "sabit". */
export const effortText = (model: ModelId, effort: Effort) => (MODELS[model].efforts.length ? effort : 'sabit')

type Note = { title: string; lines: string[]; code?: string }

const json = (v: unknown) => JSON.stringify(v, null, 2)

/** Kopyalanan promptun yanında gösterilecek "hedef araçta böyle ayarla" notu. */
export function setupNote(model: ModelId, effort: Effort, surface: Surface): Note {
  const m = MODELS[model]
  const fixed = !m.efforts.length
  switch (m.family) {
    case 'claude':
      return claudeNote(m, effort, surface)
    case 'openai':
      if (surface === 'agent') {
        return {
          title: 'Codex ayarı',
          lines: ['Oturumda `/model` ile model ve reasoning effort seçilir; kalıcı ayar `~/.codex/config.toml` dosyasındadır.'],
          code: `model = "${m.id}"\nmodel_reasoning_effort = "${effort}"`
        }
      }
      if (surface === 'chat') {
        return {
          title: 'ChatGPT ayarı',
          lines: [
            `Model seçiciden ${m.name} modelini seç.`,
            `Düşünme / reasoning seçeneği varsa ${EFFORT_INFO[effort].label} düzeyine en yakın olanı seç.`
          ]
        }
      }
      return {
        title: 'Responses API isteği',
        lines: [
          'Prompt developer mesajına (ya da `instructions` alanına) girer. `max_output_tokens` reasoning + yanıtı birlikte kapsar.',
          effort === 'none' ? '' : 'Effort `none` değilken `temperature` / `top_p` gönderme.'
        ].filter(Boolean),
        code: json({
          model: m.id,
          reasoning: { effort },
          input: [
            { role: 'developer', content: '<prompt>' },
            { role: 'user', content: '<kullanıcı girdisi>' }
          ],
          max_output_tokens: effort === 'xhigh' || effort === 'max' ? 64000 : 32000
        })
      }
    case 'gemini':
      if (surface === 'agent') {
        return {
          title: 'Antigravity ayarı',
          lines: [
            `Model seçiciden (CLI'da \`/model\`) ${m.name} modelini seç.`,
            `Thinking level ayarı sunulmuyorsa varsayılan (${m.defaultEffort.agent}) kullanılır.`
          ]
        }
      }
      if (surface === 'chat') {
        return {
          title: 'Gemini ayarı',
          lines: [
            `Model seçiciden ${m.name} modeline karşılık gelen modu seç.`,
            `Düşünme ayarı varsa ${EFFORT_INFO[effort].label} düzeyine en yakın olanı seç.`
          ]
        }
      }
      return {
        title: 'Gemini API isteği',
        lines: [
          'Prompt `systemInstruction` alanına girer. `temperature` / `topP` / `topK` gönderme (Gemini 4 ve 3.6+ yok sayar).',
          'Interactions API kullanıyorsan: `generation_config.thinking_level`.'
        ],
        code: json({
          systemInstruction: { parts: [{ text: '<prompt>' }] },
          contents: [{ role: 'user', parts: [{ text: '<kullanıcı girdisi>' }] }],
          generationConfig: { thinkingConfig: { thinkingLevel: effort } }
        })
      }
    case 'grok':
      if (surface === 'agent') {
        return {
          title: 'Grok Build ayarı',
          lines: fixed
            ? ['Grok Build ajanı bu modelle çalışır; reasoning sabit, effort ayarı yok.']
            : [`Model seçimi sunuluyorsa ${m.id} seç.`, 'Grok Build ajanında effort ayarı yok; model varsayılanı kullanılır.']
        }
      }
      if (surface === 'chat') {
        return {
          title: 'Grok ayarı',
          lines: [
            `Model seçiciden ${m.name} modelini seç.`,
            fixed ? 'Reasoning sabit.' : `Düşünme modu varsa ${EFFORT_INFO[effort].label} düzeyine en yakın olanı seç.`
          ]
        }
      }
      return {
        title: 'xAI Responses API isteği',
        lines: [
          'Prompt `system` mesajına girer. Reasoning modellerine `presence_penalty`, `frequency_penalty`, `stop` gönderme (hata verir).',
          'İstemci zaman aşımını uzun tut; her istekte effort’u açıkça gönder.'
        ],
        code: json({
          model: m.id,
          ...(fixed ? {} : { reasoning: { effort } }),
          input: [
            { role: 'system', content: '<prompt>' },
            { role: 'user', content: '<kullanıcı girdisi>' }
          ],
          temperature: 0.7,
          top_p: 0.95
        })
      }
  }
}

function claudeNote(m: TargetModel, effort: Effort, surface: Surface): Note {
  if (surface === 'agent') {
    return {
      title: 'Claude Code ayarı',
      lines: [
        effort === 'max' ? '`max` yalnızca bu oturum için geçerli olur.' : 'Seviye bir sonraki oturumlar için de kaydedilir.'
      ],
      code: `/model ${m.id}\n/effort ${effort}`
    }
  }
  if (surface === 'chat') {
    return {
      title: 'Sohbet ayarı',
      lines: [
        `Model seçiciden ${m.name} modelini seç.`,
        `Uygulamada düşünme/effort ayarı varsa ${EFFORT_INFO[effort].label} yap; yoksa varsayılan (${m.defaultEffort.api}) kullanılır.`
      ]
    }
  }
  const maxTokens = effort === 'xhigh' || effort === 'max' ? 64000 : effort === 'high' ? 32000 : 16000
  return {
    title: 'API isteği',
    lines: ['Prompt `system` alanına girer. `max_tokens` düşünme + yanıtı birlikte kapsar.'],
    code: json({ model: m.id, max_tokens: maxTokens, output_config: { effort }, system: '<prompt>', messages: [] })
  }
}

// --- Prism'in kendi motoru (analiz + yazım için çağırdığı LLM) ---------------

export const PROVIDERS = ['vertex', 'anthropic', 'gemini', 'openai', 'xai'] as const
export type ProviderId = (typeof PROVIDERS)[number]

export interface ProviderInfo {
  id: ProviderId
  label: string
  /** Bu key'le erişilen hedef aile. */
  family: Family
  env: string
  keyUrl: string
  /** Analiz / yazım için tercih sırası; keşfedilen modellerle kesiştirilir. */
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

/** Keşfedilen bir model ID'si bu hedef modele mi karşılık geliyor (tarihli sürümler dahil)? */
export const matchesTarget = (discovered: string, target: ModelId) =>
  discovered === target || discovered.startsWith(`${target}-`) || discovered.startsWith(`${target}@`)
