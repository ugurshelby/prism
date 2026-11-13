import type { Effort, Family, FamilyChoice, ModelId, ProviderId, Surface } from './catalog'

export interface Question {
  id: string
  question: string
  why: string
  options: string[]
}

export interface Alternative {
  model: ModelId
  effort: Effort
  label: string
  tradeoff: string
}

/** The engine Prism calls for analysis/writing. */
export interface EngineRef {
  provider: ProviderId
  model: string
}

export interface Analysis {
  intent: string
  taskType: string
  complexity: 'trivial' | 'moderate' | 'complex' | 'frontier'
  recommendation: {
    model: ModelId
    effort: Effort
    confidence: number
    reasoning: string
    factors: string[]
  }
  alternatives: Alternative[]
  questions: Question[]
    /** The candidate pool the recommendation was chosen from. */
  pool?: ModelId[]
  usage?: Usage
  elapsedMs?: number
  engine?: EngineRef
    /** The history entry where the analysis was saved; generations are added to this entry. */
  historyId?: string
}

export interface Usage {
  promptTokens: number
  outputTokens: number
  thoughtsTokens: number
}

export interface AnalyzeRequest {
    /** Request ID for cancellation (engine.cancel). */
  id: string
  prompt: string
  surface: Surface
    /** Target ecosystem; if 'auto', chosen from the pool made of verified keys and apps. */
  family: FamilyChoice
    /** If chosen manually the analysis only produces questions, the recommendation stays informational. */
  manual?: { model: ModelId; effort: Effort }
}

export interface Answer {
  question: string
  answer: string
}

export interface GenerateRequest {
  id: string
  prompt: string
  surface: Surface
  model: ModelId
  effort: Effort
  answers: Answer[]
  analysis?: Pick<Analysis, 'intent' | 'taskType' | 'complexity'>
  historyId?: string
  family?: FamilyChoice
}

export interface GenerateResult {
  prompt: string
  notes: string[]
  usage?: Usage
  elapsedMs: number
  engine?: EngineRef
}

export interface HistoryOutput extends GenerateResult {
  id: string
  model: ModelId
  effort: Effort
  createdAt: number
}

export interface HistoryEntry {
  id: string
  createdAt: number
  updatedAt: number
  prompt: string
  surface: Surface
    /** The ecosystem selected during the analysis (absent in old records). */
  family?: FamilyChoice
  analysis: Analysis
  answers: Answer[]
    /** Oldest to newest; the last is the most current generation. */
  outputs: HistoryOutput[]
}

/** encrypted: encrypted on disk; memory: this session only (no keyring or it is locked); off: recording disabled. */
export type HistoryStorage = 'encrypted' | 'memory' | 'off'

export interface HistoryList {
  entries: HistoryEntry[]
  storage: HistoryStorage
    /** The previous history could not be opened on this system and was set aside (e.g. the key changed in a migration from an older version); history started over. */
  reset?: boolean
}

export type ReplyLanguage = 'tr' | 'en' | 'none'

/** UI language; the language of the generated prompt (ReplyLanguage) is a separate setting. */
/** The UI is English only (owner, 2026-11-13). The field stays in settings so older files still load. */
export type UiLanguage = 'en'

/** Steps of the setup wizard; if closed midway, it resumes from the step where it stopped. */
export type SetupStep = 'families' | 'engine' | 'shortcut'

export interface EngineModels {
  analysis: string
  generation: string
}

export interface Settings {
  version: number
    /** 'auto': Vertex if defined, otherwise the first defined provider. */
  engineProvider: ProviderId | 'auto'
  engineModels: Partial<Record<ProviderId, EngineModels>>
  vertex: { project: string; location: string }
  defaultFamily: FamilyChoice
    /** Target families chosen at setup; the UI and the recommendation pool use only these (exactly one family in Ray). */
  families: Family[]
  uiLanguage: UiLanguage
  setup: { done: boolean; step: SetupStep }
    /** Target families used without a key (via subscription / app); they enter the cross-recommendation pool. */
  appFamilies: Family[]
  replyLanguage: ReplyLanguage
  defaultSurface: Surface
  alwaysOnTop: boolean
  hotkey: string
  launchAtLogin: boolean
    /** System notification for a generation that finishes while the window is hidden. */
  notifyWhenHidden: boolean
    /** If off, new analyses and generations are never written to history (and not kept in memory either). */
  saveHistory: boolean
    /** Prevents the window from appearing in screenshots and screen sharing (Windows, macOS). */
  contentProtection: boolean
    /** Once a day GitHub is checked for a new version of this product (no key, release list only). */
  updateCheck: boolean
}

/** Settings patch the UI sends (same shape as SettingsPatchSchema): the Vertex project and location can change separately. */
export type SettingsPatch = Partial<Omit<Settings, 'version' | 'vertex'>> & { vertex?: Partial<Settings['vertex']> }

/** Update notification state sent to the UI. */
export interface UpdateView {
  current: string
  enabled: boolean
    /** Time of the last successful check (ms); null if never checked. */
  checkedAt: number | null
  latest: { tag: string; version: string } | null
}

export interface DiscoveredModel {
  id: string
  label?: string
}

export interface ProviderStatus {
  ok: boolean
  checkedAt: number
  message?: string
  models: DiscoveredModel[]
}

export interface ProviderView {
  id: ProviderId
    /** hint: masked display (last 4 characters); the key itself never reaches the UI. */
  key: { present: boolean; source: 'saved' | 'env' | 'none'; hint: string; problem?: string }
    /** Whether the Vertex project and location are defined. */
  ready: boolean
  status: ProviderStatus | null
}

export type TargetAccess = 'key' | 'app'

export interface SettingsView extends Settings {
  providers: ProviderView[]
    /** Resolved engine; null if there is no provider. */
  engine: { provider: ProviderId; analysis: string; generation: string } | null
    /** Which target models are usable by key or app. */
  targets: Partial<Record<ModelId, TargetAccess>>
    /** Whether the global shortcut could be registered with the OS (Wayland or another app may block it). */
  hotkeyOk: boolean
}

export type WindowMode = 'pill' | 'panel'

/** Which corner the panel anchored to when opened from the orb; the content animation starts from this corner. */
export interface PanelAnchor {
  h: 'left' | 'right'
  v: 'top' | 'bottom'
}

/** State the orb window shows: the main process computes it from the job count and finished generations. */
export interface PillState {
  busy: boolean
  badge: boolean
}

/** OS-specific look of the panel (CSS receives it via body[data-look]). */
export type WindowLook = 'mica' | 'vibrancy' | 'solid'

export type StreamEvent =
  | { id: string; type: 'chunk'; text: string }
  | { id: string; type: 'done'; result: GenerateResult }
  | { id: string; type: 'error'; message: string }
