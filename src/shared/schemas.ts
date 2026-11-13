// Runtime schemas for all data crossing processes and on disk. The main process parses every argument from the UI
// and every file read from userData with these; a type annotation is not validation.

import { z } from 'zod'
import { zmsg } from './messages'
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

export const ProviderIdSchema = z.enum(PROVIDERS, zmsg('schema.provider'))
export const FamilySchema = z.enum(FAMILIES)
export const FamilyChoiceSchema = z.union([FamilySchema, z.literal('auto')])
export const SurfaceSchema = z.enum(SURFACES)
export const EffortSchema = z.enum(EFFORTS)
export const ModelIdSchema = z.enum(MODEL_IDS)
export const WindowModeSchema = z.enum(['pill', 'panel'])
export const ReplyLanguageSchema = z.enum(['tr', 'en', 'none'])
export const UiLanguageSchema = z.literal('en')
export const SetupStepSchema = z.enum(['families', 'engine', 'shortcut'])

/** Request and history IDs (UUID or plain names like selftest). They never enter a file name or path. */
export const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/, zmsg('schema.id'))

/**
  * API key: visible ASCII only, no whitespace. A key is never trimmed or altered under any condition;
  * whitespace or a line break that slips in while copying is rejected with an explicit error instead of corrupting the key.
 */
export const ApiKeySchema = z
  .string()
  .min(LIMITS.keyMin, zmsg('schema.keyShort'))
  .max(LIMITS.keyMax, zmsg('schema.keyLong'))
  .regex(/^[\x21-\x7E]+$/, zmsg('schema.keyChars'))

// Vertex project and location go into the request URL. If they were free text, the key could go to a server outside Google.
export const VertexProjectSchema = z
  .string()
  .regex(/^(|[a-z][a-z0-9-]{4,28}[a-z0-9]|\d{1,20})$/, zmsg('schema.project'))
export const VertexLocationSchema = z.string().regex(/^[a-z][a-z0-9-]{0,38}[a-z0-9]$/, zmsg('schema.location'))

/** Engine model ID returned by the provider or chosen in settings; it goes into the request URL. */
export const EngineModelIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/, zmsg('schema.model'))

export const HotkeySchema = z.string().regex(/^[\x21-\x7E]{1,64}$/, zmsg('schema.hotkey'))

export const EngineModelsSchema = z.object({ analysis: EngineModelIdSchema, generation: EngineModelIdSchema })

export const SettingsSchema = z.object({
  version: z.number().int().min(1).max(1_000_000),
  engineProvider: z.union([ProviderIdSchema, z.literal('auto')]),
  engineModels: z.partialRecord(ProviderIdSchema, EngineModelsSchema),
  vertex: z.object({ project: VertexProjectSchema, location: VertexLocationSchema }),
  defaultFamily: FamilyChoiceSchema,
  families: z.array(FamilySchema).min(1).max(FAMILIES.length),
  uiLanguage: UiLanguageSchema,
  setup: z.object({ done: z.boolean(), step: SetupStepSchema }),
  appFamilies: z.array(FamilySchema).max(FAMILIES.length),
  replyLanguage: ReplyLanguageSchema,
  defaultSurface: SurfaceSchema,
  alwaysOnTop: z.boolean(),
  hotkey: HotkeySchema,
  launchAtLogin: z.boolean(),
  notifyWhenHidden: z.boolean(),
  saveHistory: z.boolean(),
  contentProtection: z.boolean(),
  updateCheck: z.boolean()
})

/**
  * Fields the UI may change; an unknown field or the version field is rejected.
  * Vertex project and location can be sent separately: two consecutive patches must not overwrite each other's value.
 */
export const SettingsPatchSchema = SettingsSchema.omit({ version: true })
  .extend({ vertex: SettingsSchema.shape.vertex.partial().strict() })
  .partial()
  .strict()

const text = (max: number) => z.string().max(max, zmsg('schema.tooLong'))

export const AnalyzeRequestSchema = z
  .object({
    id: IdSchema,
    prompt: text(LIMITS.prompt).min(1, zmsg('schema.emptyPrompt')),
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
    prompt: text(LIMITS.prompt).min(1, zmsg('schema.emptyPrompt')),
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

// --- Files on disk ------------------------------------------------------------------

// Old records of a model removed from the catalog must not be deleted: the model ID on disk is checked for format only,
// the UI shows an ID it does not recognize with the default model (History.tsx → modelOf).
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
    // In v1 records the coding agent surface was 'claude-code'.
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

// A corrupt position file must not make the window unopenable: integers in a sensible range; otherwise the default position.
const coord = z.number().int().min(-100_000).max(100_000)
const size = z.number().int().min(1).max(20_000)
const PanelRect = z.object({ x: coord, y: coord, width: size, height: size })
const PillPoint = z.object({ x: coord, y: coord })
export const WindowStateSchema = z.object({
    // Per-screen position (key: screen ID). The old version's single panel/pill field is read too.
  displays: z
    .record(z.string().regex(/^\d{1,20}$/), z.object({ panel: PanelRect.optional(), pill: PillPoint.optional() }))
    .refine((o) => Object.keys(o).length <= 16, 'at most 16 displays')
    .optional(),
  panel: PanelRect.optional(),
  pill: PillPoint.optional()
})

/** Describes a schema error with field paths; the value the user entered does not go into the message. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ')
}
