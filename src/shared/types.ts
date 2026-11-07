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

/** Prism'in analiz/yazım için çağırdığı motor. */
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
  /** Önerinin seçildiği aday havuzu. */
  pool?: ModelId[]
  usage?: Usage
  elapsedMs?: number
  engine?: EngineRef
  /** Analizin kaydedildiği geçmiş girdisi; yazımlar bu girdiye eklenir. */
  historyId?: string
}

export interface Usage {
  promptTokens: number
  outputTokens: number
  thoughtsTokens: number
}

export interface AnalyzeRequest {
  /** İptal için istek kimliği (engine.cancel). */
  id: string
  prompt: string
  surface: Surface
  /** Hedef ekosistem; 'auto' ise doğrulanmış key'lerden ve uygulamalardan oluşan havuzdan seçilir. */
  family: FamilyChoice
  /** Elle seçim yapıldıysa analiz yalnızca soruları üretir, öneri bilgi amaçlı kalır. */
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
  /** Analiz sırasında seçili ekosistem (eski kayıtlarda yok). */
  family?: FamilyChoice
  analysis: Analysis
  answers: Answer[]
  /** Eskiden yeniye; sonuncusu en güncel yazım. */
  outputs: HistoryOutput[]
}

/** encrypted: işletim sisteminin anahtarlığıyla şifreli dosyada; memory: anahtarlık yok, yalnızca bu oturumda. */
export type HistoryStorage = 'encrypted' | 'memory'

export interface HistoryList {
  entries: HistoryEntry[]
  storage: HistoryStorage
}

export type ReplyLanguage = 'tr' | 'en' | 'none'

export interface EngineModels {
  analysis: string
  generation: string
}

export interface Settings {
  version: number
  /** 'auto': Vertex tanımlıysa Vertex, değilse ilk tanımlı sağlayıcı. */
  engineProvider: ProviderId | 'auto'
  engineModels: Partial<Record<ProviderId, EngineModels>>
  vertex: { project: string; location: string }
  defaultFamily: FamilyChoice
  /** Key olmadan (abonelik / uygulama ile) kullanılan hedef aileler; çapraz öneri havuzuna girer. */
  appFamilies: Family[]
  replyLanguage: ReplyLanguage
  defaultSurface: Surface
  alwaysOnTop: boolean
  hotkey: string
  launchAtLogin: boolean
  /** Pencere gizliyken biten yazım için sistem bildirimi. */
  notifyWhenHidden: boolean
}

/** Arayüzün gönderdiği ayar yaması (SettingsPatchSchema ile aynı biçim): Vertex proje ve konumu ayrı ayrı değişebilir. */
export type SettingsPatch = Partial<Omit<Settings, 'version' | 'vertex'>> & { vertex?: Partial<Settings['vertex']> }

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
  /** hint: maskeli gösterim (son 4 karakter); key'in kendisi arayüze inmez. */
  key: { present: boolean; source: 'saved' | 'env' | 'none'; hint: string; problem?: string }
  /** Vertex için proje ve konum tanımlı mı. */
  ready: boolean
  status: ProviderStatus | null
}

export type TargetAccess = 'key' | 'app'

export interface SettingsView extends Settings {
  providers: ProviderView[]
  /** Çözümlenmiş motor; hiç sağlayıcı yoksa null. */
  engine: { provider: ProviderId; analysis: string; generation: string } | null
  /** Hangi hedef modeller key ya da uygulama ile kullanılabilir. */
  targets: Partial<Record<ModelId, TargetAccess>>
}

export type WindowMode = 'pill' | 'panel'

export type StreamEvent =
  | { id: string; type: 'chunk'; text: string }
  | { id: string; type: 'done'; result: GenerateResult }
  | { id: string; type: 'error'; message: string }
