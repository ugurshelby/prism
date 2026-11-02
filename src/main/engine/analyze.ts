import {
  EFFORTS,
  FAMILIES,
  FAMILY_INFO,
  MODELS,
  clampEffort,
  defaultEffortFor,
  isEffort,
  surfaceInfo,
  type Effort,
  type Family,
  type ModelId
} from '@shared/catalog'
import type { Analysis, AnalyzeRequest } from '@shared/types'
import { parseJson } from '../llm'
import { candidatePool, engineGenerate, fallbackModel } from '../providers'
import { card, familyCard, surfaceCard } from './knowledge'

export const TASK_TYPES = [
  'agentic_coding',
  'debugging',
  'code_review',
  'code_question',
  'architecture_design',
  'frontend_design',
  'writing',
  'editing',
  'analysis',
  'research',
  'data_extraction',
  'brainstorming',
  'chat_qa',
  'system_prompt',
  'other'
] as const

/** Model ve effort enum'ları aday havuzundan üretilir; model havuz dışına çıkamaz. */
function schemaFor(pool: ModelId[]) {
  const efforts = EFFORTS.filter((e) => pool.some((m) => MODELS[m].efforts.includes(e) || MODELS[m].defaultEffort.api === e))
  return {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'In Turkish, 1-2 sentences: what the person actually wants, stated precisely.'
      },
      task_type: { type: 'string', enum: [...TASK_TYPES] },
      complexity: { type: 'string', enum: ['trivial', 'moderate', 'complex', 'frontier'] },
      recommendation: {
        type: 'object',
        properties: {
          model: { type: 'string', enum: pool },
          effort: { type: 'string', enum: efforts },
          confidence: { type: 'number', description: 'Between 0 and 1.', minimum: 0, maximum: 1 },
          reasoning: {
            type: 'string',
            description: 'In Turkish, 2-3 sentences: why this model and this effort fit this task better than the neighbors.'
          },
          factors: {
            type: 'array',
            description: 'In Turkish, 2-4 very short signals from the prompt that drove the choice (max ~6 words each).',
            items: { type: 'string' }
          }
        },
        required: ['model', 'effort', 'confidence', 'reasoning', 'factors'],
        propertyOrdering: ['factors', 'model', 'effort', 'confidence', 'reasoning']
      },
      alternatives: {
        type: 'array',
        description: '0-2 meaningful alternatives (e.g. cheaper/faster, or stronger). Never repeat the recommendation.',
        items: {
          type: 'object',
          properties: {
            model: { type: 'string', enum: pool },
            effort: { type: 'string', enum: efforts },
            label: { type: 'string', description: 'In Turkish, 1-3 words, e.g. "Daha hızlı", "Daha güçlü".' },
            tradeoff: { type: 'string', description: 'In Turkish, one short sentence on what you gain and lose.' }
          },
          required: ['model', 'effort', 'label', 'tradeoff'],
          propertyOrdering: ['model', 'effort', 'label', 'tradeoff']
        }
      },
      questions: {
        type: 'array',
        description: '0-3 clarifying questions. Empty when the request is clear enough.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            question: { type: 'string', description: 'In Turkish, short and concrete.' },
            why: { type: 'string', description: 'In Turkish, a few words: what in the prompt depends on the answer.' },
            options: {
              type: 'array',
              description: 'In Turkish, 2-4 concise likely answers.',
              items: { type: 'string' }
            }
          },
          required: ['id', 'question', 'why', 'options'],
          propertyOrdering: ['id', 'question', 'why', 'options']
        }
      }
    },
    required: ['intent', 'task_type', 'complexity', 'recommendation', 'alternatives', 'questions'],
    propertyOrdering: ['intent', 'task_type', 'complexity', 'questions', 'recommendation', 'alternatives']
  }
}

const NOUN: Record<Family, string> = { claude: 'Claude', openai: 'OpenAI GPT', gemini: 'Gemini', grok: 'Grok' }

const CLAUDE_HINTS = `- Within Claude: Opus 5.5 is the default for work that needs judgment; don't drift to Fable 5.1 unless the task is genuinely frontier-hard or very long-horizon, and don't drift to Haiku unless the task is simple or mechanical.
- Claude effort defaults differ by surface (Claude Code starts Sonnet 5.5 at medium; the API starts it at high).`

function familyBlock(f: Family, req: AnalyzeRequest, wrap: boolean) {
  const surface = FAMILY_INFO[f].surfaces[req.surface].label
  const inner = `<models>
${familyCard(f, 'models')}
</models>

<effort>
${familyCard(f, 'effort')}
</effort>

<surface name="${surface}">
${surfaceCard(f, req.surface)}
</surface>`
  return wrap ? `<family name="${FAMILY_INFO[f].name}" vendor="${FAMILY_INFO[f].vendor}" setting="${FAMILY_INFO[f].effortLabel}">\n${inner}\n</family>` : inner
}

function candidateLine(id: ModelId, req: AnalyzeRequest) {
  const m = MODELS[id]
  const levels = m.efforts.length ? m.efforts.join(' | ') : `fixed (use \`${m.defaultEffort.api}\`)`
  const def = m.efforts.length ? `, default \`${defaultEffortFor(id, req.surface)}\`` : ''
  return `- \`${id}\` — ${m.name} (${FAMILY_INFO[m.family].vendor}) · levels: ${levels}${def} · $${m.price.input} / $${m.price.output} per MTok`
}

function systemPrompt(req: AnalyzeRequest, pool: ModelId[]) {
  const families = FAMILIES.filter((f) => pool.some((m) => MODELS[m].family === f))
  const cross = families.length > 1
  const target = cross ? 'target AI model (Claude, GPT, Gemini or Grok)' : `${NOUN[families[0]]} model`
  const manual = req.manual
    ? `\nThe person has already chosen ${MODELS[req.manual.model].name} at \`${req.manual.effort}\` effort and will use that. Still give your honest recommendation (it is shown only as a hint), but your main job here is the clarifying questions.\n`
    : ''
  return `You are the analysis stage of Prism, a desktop tool that turns a person's raw request into an excellent prompt for a ${target}. You don't write the prompt; you decide which model and effort level fit the request on the given surface, and what must be clarified first.

<vision>
${card('vision.md')}
</vision>
${cross ? `\n<routing>\n${card('routing.md')}\n</routing>\n` : ''}
${families.map((f) => familyBlock(f, req, cross)).join('\n\n')}

<candidates>
Recommend only from these models. The effort must be one the chosen model supports, in that model's own scale.
${pool.map((id) => candidateLine(id, req)).join('\n')}
</candidates>

How to recommend:
- Judge the task the person describes, not the length of their message. A short message can describe a hard task.
- Pick the cheapest model + effort that will do this specific task reliably well on this surface.
${families.includes('claude') ? `${CLAUDE_HINTS}\n` : ''}- Recommend the level that fits the task, not the default.
- confidence reflects how clear-cut the choice is. Alternatives should be real options a thoughtful engineer would consider, each with an honest trade-off.${cross ? ' They may come from another family when the trade-off is real.' : ''}

How to ask:
- The person prefers to answer a few questions before the prompt is written, but only questions that matter. Ask when the answer would materially change the prompt (scope, target, acceptance criteria, constraints, audience, output form) and can't be reasonably inferred.
- At most 3. Return none when the request is already clear.
- Never ask about the model or effort, or about things the target model can discover itself (a coding agent can read the repository, run commands and look at files).
- Each question gets 2-4 short answer options covering the likely answers; the person can also type their own.
${manual}
Language: every human-readable field is in Turkish. Keep model names, effort names and technical terms as they are.`
}

function userPrompt(req: AnalyzeRequest) {
  return `<surface>${surfaceInfo(req.family, req.surface).label}</surface>

<raw_prompt>
${req.prompt}
</raw_prompt>`
}

interface RawAnalysis {
  intent: string
  task_type: string
  complexity: Analysis['complexity']
  recommendation: { model: string; effort: string; confidence: number; reasoning: string; factors: string[] }
  alternatives: { model: string; effort: string; label: string; tradeoff: string }[]
  questions: { id: string; question: string; why: string; options: string[] }[]
}

function normalize(raw: RawAnalysis, pool: ModelId[], req: AnalyzeRequest): Analysis {
  const inPool = (m: string): m is ModelId => (pool as string[]).includes(m)
  const rec = raw.recommendation ?? ({} as RawAnalysis['recommendation'])
  const model: ModelId = inPool(rec.model) ? rec.model : fallbackModel(pool)
  const effort = clampEffort(model, isEffort(rec.effort) ? rec.effort : defaultEffortFor(model, req.surface))
  const confidence = rec.confidence > 1 ? rec.confidence / 10 : rec.confidence
  return {
    intent: raw.intent ?? '',
    taskType: raw.task_type ?? 'other',
    complexity: raw.complexity ?? 'moderate',
    recommendation: {
      model,
      effort,
      confidence: Math.min(1, Math.max(0, Number.isFinite(confidence) ? confidence : 0.7)),
      reasoning: rec.reasoning ?? '',
      factors: (rec.factors ?? []).slice(0, 4)
    },
    alternatives: (raw.alternatives ?? [])
      .filter((a) => inPool(a.model) && isEffort(a.effort))
      .map((a) => ({ ...a, model: a.model as ModelId, effort: clampEffort(a.model as ModelId, a.effort as Effort) }))
      .filter((a) => !(a.model === model && a.effort === effort))
      .slice(0, 2),
    questions: (raw.questions ?? [])
      .filter((q) => q.question)
      .slice(0, 3)
      .map((q, i) => ({ id: q.id || `q${i + 1}`, question: q.question, why: q.why ?? '', options: (q.options ?? []).slice(0, 4) })),
    pool
  }
}

export async function analyze(req: AnalyzeRequest): Promise<Analysis> {
  const started = Date.now()
  const pool = candidatePool(req.family)
  if (req.manual && !pool.includes(req.manual.model)) pool.push(req.manual.model)
  const call = {
    system: systemPrompt(req, pool),
    user: userPrompt(req),
    schema: schemaFor(pool),
    temperature: 0.3
  }
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, usage, engine } = await engineGenerate('analysis', call)
    try {
      return { ...normalize(parseJson<RawAnalysis>(text), pool, req), usage, engine, elapsedMs: Date.now() - started }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}
