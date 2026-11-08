// Eval vakaları: sabit ham promptlar, kişinin bildiği gizli bilgiler ve beklenen öneri aralığı.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { EFFORTS, MODEL_IDS, MODELS, type Effort, type ModelId } from '@shared/catalog'
import { FamilyChoiceSchema, SurfaceSchema } from '@shared/schemas'

const ModelIdSchema = z.enum(MODEL_IDS)
const EffortSchema = z.enum(EFFORTS)

const CaseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    taskType: z.string(),
    family: FamilyChoiceSchema,
    surface: SurfaceSchema,
    prompt: z.string().min(1),
    /** Jüri için: kişinin gerçekte istediği (İngilizce, tek cümle). */
    intent: z.string().min(1),
    /** Kişinin bildiği ama promptta olmayan bilgiler; soruları yanıtlayan simülasyon yalnızca bunları kullanır. */
    facts: z.array(z.string()),
    /** İyi bir analizin mutlaka sorması gereken konular (kısa tanımlar). */
    mustAsk: z.array(z.string()),
    expect: z.object({ models: z.array(ModelIdSchema).min(1), effort: z.tuple([EffortSchema, EffortSchema]) }),
    /** Varsa yazım ölçülür: ham prompt ile Prism çıktısı bu hedefte çalıştırılır. */
    target: z.object({ model: ModelIdSchema, effort: EffortSchema }).optional(),
    /** API yüzeyinde system prompt'un karşılayacağı örnek kullanıcı mesajı. */
    input: z.string().optional()
  })
  .refine((c) => c.surface !== 'api' || !c.target || c.input, { message: 'API vakasında hedef çalıştırılacaksa input gerekli' })
  .refine((c) => !c.target || MODELS[c.target.model].family === 'gemini', { message: 'Hedef çalıştırma şimdilik yalnızca Gemini (Vertex)' })

export type EvalCase = z.infer<typeof CaseSchema>

const FileSchema = z.object({ version: z.literal(1), cases: z.array(CaseSchema).min(1) })

export function loadCases(root: string): EvalCase[] {
  const parsed = FileSchema.parse(JSON.parse(readFileSync(join(root, 'eval', 'cases.json'), 'utf8')) as unknown)
  const ids = new Set(parsed.cases.map((c) => c.id))
  if (ids.size !== parsed.cases.length) throw new Error('eval/cases.json: yinelenen vaka kimliği')
  return parsed.cases
}

/** Önerilen model beklenen kümede mi, effort beklenen aralıkta mı (EFFORTS sırasına göre). */
export function scoreRecommendation(c: EvalCase, model: ModelId, effort: Effort) {
  const i = EFFORTS.indexOf(effort)
  const [lo, hi] = c.expect.effort
  const modelOk = c.expect.models.includes(model)
  // Sabit seviyeli modelde (Grok Build) effort seçimi yoktur; aralık denetlenmez.
  const effortOk = !MODELS[model].efforts.length || (i >= EFFORTS.indexOf(lo) && i <= EFFORTS.indexOf(hi))
  return { modelOk, effortOk }
}
