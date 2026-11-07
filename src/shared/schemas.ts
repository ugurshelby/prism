// Süreçler arası ve diskteki her verinin çalışma anı şemaları. Ana süreç arayüzden gelen her argümanı
// ve userData'dan okunan her dosyayı bunlarla ayrıştırır; tip bildirimi doğrulama sayılmaz.

import { z } from 'zod'
import { EFFORTS, FAMILIES, MODEL_IDS, PROVIDERS, SURFACES, type Effort, type ModelId } from './catalog'

export const LIMITS = {
  prompt: 50_000,
  answer: 4_000,
  question: 1_000,
  answers: 10,
  clipboard: 200_000,
  keyMin: 20,
  keyMax: 512
} as const

export const ProviderIdSchema = z.enum(PROVIDERS, { error: 'Bilinmeyen sağlayıcı.' })
export const FamilySchema = z.enum(FAMILIES)
export const FamilyChoiceSchema = z.union([FamilySchema, z.literal('auto')])
export const SurfaceSchema = z.enum(SURFACES)
export const EffortSchema = z.enum(EFFORTS)
export const ModelIdSchema = z.enum(MODEL_IDS)
export const WindowModeSchema = z.enum(['pill', 'panel'])
export const DragKindSchema = z.enum(['move', 'resize'])
export const ReplyLanguageSchema = z.enum(['tr', 'en', 'none'])

/** İstek ve geçmiş kimlikleri (UUID ya da selftest gibi düz adlar). Dosya adına ya da yola girmez. */
export const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/, 'Geçersiz kimlik.')

/**
 * API key: yalnızca görünür ASCII, boşluksuz. Key hiçbir koşulda kırpılmaz ya da değiştirilmez;
 * kopyalanırken araya karışan boşluk ya da satır sonu, key'i bozmak yerine açık bir hatayla reddedilir.
 */
export const ApiKeySchema = z
  .string()
  .min(LIMITS.keyMin, 'Key çok kısa; tamamını yapıştırdığından emin ol.')
  .max(LIMITS.keyMax, 'Key çok uzun.')
  .regex(/^[\x21-\x7E]+$/, 'Key boşluk ya da görünmeyen karakter içeriyor; yalnızca key’in kendisini yapıştır.')

// Vertex proje ve konumu istek adresine girer. Serbest metin olursa key Google dışındaki bir sunucuya gidebilir.
export const VertexProjectSchema = z
  .string()
  .regex(/^(|[a-z][a-z0-9-]{4,28}[a-z0-9]|\d{1,20})$/, 'Geçersiz Google Cloud proje ID’si.')
export const VertexLocationSchema = z.string().regex(/^[a-z][a-z0-9-]{0,38}[a-z0-9]$/, 'Geçersiz Vertex konumu (ör. global, us-central1).')

/** Sağlayıcının döndürdüğü ya da ayarlarda seçilen motor model ID'si; istek adresine girer. */
export const EngineModelIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/, 'Geçersiz model ID’si.')

export const HotkeySchema = z.string().regex(/^[\x21-\x7E]{1,64}$/, 'Geçersiz kısayol.')

export const EngineModelsSchema = z.object({ analysis: EngineModelIdSchema, generation: EngineModelIdSchema })

export const SettingsSchema = z.object({
  version: z.number().int().min(1).max(100),
  engineProvider: z.union([ProviderIdSchema, z.literal('auto')]),
  engineModels: z.partialRecord(ProviderIdSchema, EngineModelsSchema),
  vertex: z.object({ project: VertexProjectSchema, location: VertexLocationSchema }),
  defaultFamily: FamilyChoiceSchema,
  appFamilies: z.array(FamilySchema).max(FAMILIES.length),
  replyLanguage: ReplyLanguageSchema,
  defaultSurface: SurfaceSchema,
  alwaysOnTop: z.boolean(),
  hotkey: HotkeySchema,
  launchAtLogin: z.boolean(),
  notifyWhenHidden: z.boolean()
})

/**
 * Arayüzün değiştirebildiği alanlar; bilinmeyen alan ya da sürüm alanı reddedilir.
 * Vertex proje ve konumu ayrı ayrı gönderilebilir: art arda gelen iki yama birbirinin değerini ezmesin.
 */
export const SettingsPatchSchema = SettingsSchema.omit({ version: true })
  .extend({ vertex: SettingsSchema.shape.vertex.partial().strict() })
  .partial()
  .strict()

const text = (max: number) => z.string().max(max, 'Metin çok uzun.')

export const AnalyzeRequestSchema = z
  .object({
    id: IdSchema,
    prompt: text(LIMITS.prompt).min(1, 'Prompt boş.'),
    surface: SurfaceSchema,
    family: FamilyChoiceSchema,
    manual: z.object({ model: ModelIdSchema, effort: EffortSchema }).strict().optional()
  })
  .strict()

export const AnswerSchema = z.object({ question: text(LIMITS.question), answer: text(LIMITS.answer) }).strict()

const ComplexitySchema = z.enum(['trivial', 'moderate', 'complex', 'frontier'])

export const GenerateRequestSchema = z
  .object({
    id: IdSchema,
    prompt: text(LIMITS.prompt).min(1, 'Prompt boş.'),
    surface: SurfaceSchema,
    model: ModelIdSchema,
    effort: EffortSchema,
    answers: z.array(AnswerSchema).max(LIMITS.answers),
    analysis: z
      .object({ intent: text(LIMITS.answer), taskType: text(64), complexity: ComplexitySchema })
      .strict()
      .optional(),
    historyId: IdSchema.optional(),
    family: FamilyChoiceSchema.optional()
  })
  .strict()

export const ClipboardTextSchema = text(LIMITS.clipboard)

// --- Diskteki dosyalar --------------------------------------------------------------

// Katalogdan kaldırılmış bir modelin eski kayıtları silinmesin: diskteki model ID'si yalnızca biçimce denetlenir,
// arayüz tanımadığı ID'yi varsayılan modelle gösterir (History.tsx → modelOf).
const StoredModelIdSchema = z.custom<ModelId>((v) => typeof v === 'string' && /^[A-Za-z0-9._:@-]{1,128}$/.test(v))
const StoredEffortSchema = z.custom<Effort>((v) => typeof v === 'string' && /^[a-z]{1,20}$/.test(v))

const UsageSchema = z.object({ promptTokens: z.number(), outputTokens: z.number(), thoughtsTokens: z.number() })
const EngineRefSchema = z.object({ provider: ProviderIdSchema, model: z.string() })

export const DiscoveredModelSchema = z.object({ id: z.string().max(200), label: z.string().max(200).optional() })

export const ProviderStatusSchema = z.object({
  ok: z.boolean(),
  checkedAt: z.number(),
  message: z.string().optional(),
  models: z.array(DiscoveredModelSchema)
})

export const ModelsCacheSchema = z.partialRecord(ProviderIdSchema, ProviderStatusSchema)

export const AnalysisSchema = z.object({
  intent: z.string(),
  taskType: z.string(),
  complexity: ComplexitySchema,
  recommendation: z.object({
    model: StoredModelIdSchema,
    effort: StoredEffortSchema,
    confidence: z.number(),
    reasoning: z.string(),
    factors: z.array(z.string())
  }),
  alternatives: z.array(z.object({ model: StoredModelIdSchema, effort: StoredEffortSchema, label: z.string(), tradeoff: z.string() })),
  questions: z.array(z.object({ id: z.string(), question: z.string(), why: z.string(), options: z.array(z.string()) })),
  pool: z.array(StoredModelIdSchema).optional(),
  usage: UsageSchema.optional(),
  elapsedMs: z.number().optional(),
  engine: EngineRefSchema.optional(),
  historyId: z.string().optional()
})

export const HistoryEntrySchema = z.object({
  id: IdSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  prompt: z.string(),
  // v1 kayıtlarında kodlama ajanı yüzeyi 'claude-code' idi.
  surface: z.preprocess((s) => (s === 'claude-code' ? 'agent' : s), SurfaceSchema),
  family: FamilyChoiceSchema.optional(),
  analysis: AnalysisSchema,
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
  outputs: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      notes: z.array(z.string()),
      usage: UsageSchema.optional(),
      elapsedMs: z.number(),
      engine: EngineRefSchema.optional(),
      model: StoredModelIdSchema,
      effort: StoredEffortSchema,
      createdAt: z.number()
    })
  )
})

// Bozuk bir konum dosyası pencereyi açılmaz hâle getirmesin: tam sayı ve makul aralık; tutmazsa varsayılan konum.
const coord = z.number().int().min(-100_000).max(100_000)
const size = z.number().int().min(1).max(20_000)
export const WindowStateSchema = z.object({
  panel: z.object({ x: coord, y: coord, width: size, height: size }).optional(),
  pill: z.object({ x: coord, y: coord }).optional()
})

/** Şema hatasını alan yollarıyla anlatır; kullanıcının girdiği değer mesaja girmez. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ')
}
