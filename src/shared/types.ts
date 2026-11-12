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

/** encrypted: diskte şifreli; memory: yalnızca bu oturumda (anahtarlık yok ya da kilitli); off: kayıt kapalı. */
export type HistoryStorage = 'encrypted' | 'memory' | 'off'

export interface HistoryList {
  entries: HistoryEntry[]
  storage: HistoryStorage
  /** Önceki geçmiş bu sistemde açılamadı ve kenara alındı (ör. eski sürümden göçte anahtar değişti); geçmiş yeniden başladı. */
  reset?: boolean
}

export type ReplyLanguage = 'tr' | 'en' | 'none'

/** Arayüz dili; üretilen promptun dili (ReplyLanguage) ayrı bir ayardır. */
export type UiLanguage = 'en' | 'tr'

/** Kurulum sihirbazının adımları; yarıda kapatılırsa kalınan adımdan devam edilir. */
export type SetupStep = 'language' | 'families' | 'engine' | 'shortcut'

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
  /** Kurulumda seçilen hedef aileler; arayüz ve öneri havuzu yalnızca bunları kullanır (Ray'de tam bir aile). */
  families: Family[]
  uiLanguage: UiLanguage
  setup: { done: boolean; step: SetupStep }
  /** Key olmadan (abonelik / uygulama ile) kullanılan hedef aileler; çapraz öneri havuzuna girer. */
  appFamilies: Family[]
  replyLanguage: ReplyLanguage
  defaultSurface: Surface
  alwaysOnTop: boolean
  hotkey: string
  launchAtLogin: boolean
  /** Pencere gizliyken biten yazım için sistem bildirimi. */
  notifyWhenHidden: boolean
  /** Kapalıysa yeni analiz ve yazımlar geçmişe hiç yazılmaz (bellekte de tutulmaz). */
  saveHistory: boolean
  /** Pencerenin ekran görüntüsü ve ekran paylaşımında görünmesini engeller (Windows, macOS). */
  contentProtection: boolean
  /** Günde bir kez GitHub'da bu ürünün yeni sürümüne bakılır (key'siz, yalnızca yayın listesi). */
  updateCheck: boolean
}

/** Arayüzün gönderdiği ayar yaması (SettingsPatchSchema ile aynı biçim): Vertex proje ve konumu ayrı ayrı değişebilir. */
export type SettingsPatch = Partial<Omit<Settings, 'version' | 'vertex'>> & { vertex?: Partial<Settings['vertex']> }

/** Güncelleme bildiriminin arayüze giden durumu. */
export interface UpdateView {
  current: string
  enabled: boolean
  /** Son başarılı denetimin zamanı (ms); hiç denetlenmediyse null. */
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
  /** Global kısayol işletim sistemine kaydedilebildi mi (Wayland ya da başka bir uygulama engelleyebilir). */
  hotkeyOk: boolean
}

export type WindowMode = 'pill' | 'panel'

/** Panel küreden açıldığında hangi köşeye yaslandığı; içerik animasyonu bu köşeden başlar. */
export interface PanelAnchor {
  h: 'left' | 'right'
  v: 'top' | 'bottom'
}

/** Küre penceresinin gösterdiği durum: ana süreç iş sayısından ve bitmiş yazımlardan hesaplar. */
export interface PillState {
  busy: boolean
  badge: boolean
}

/** Panelin işletim sistemine özgü görünümü (CSS bunu body[data-look] ile alır). */
export type WindowLook = 'mica' | 'vibrancy' | 'solid'

export type StreamEvent =
  | { id: string; type: 'chunk'; text: string }
  | { id: string; type: 'done'; result: GenerateResult }
  | { id: string; type: 'error'; message: string }
