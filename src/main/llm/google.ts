// Gemini client: Vertex AI (project path, global location) and Google AI Studio (Gemini API).
// Both use the same generateContent body; only the endpoint and key type differ.

import { z } from 'zod'
import { msg } from '@shared/messages'
import type { DiscoveredModel, Usage } from '@shared/types'
import { readJson, readSse, send } from './http'
import { toGemini } from './schema'
import { LlmError, emptyUsage, type Credentials, type LlmCall, type LlmResult, type ProviderClient } from './types'

type Kind = 'vertex' | 'gemini'

const LABEL: Record<Kind, string> = { vertex: 'Vertex', gemini: 'Gemini API' }

// Vertex model listing does not work with an API key; access is probed with one small request per model.
const VERTEX_PROBE = [
  'gemini-4-carbon',
  'gemini-4-argon',
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
]

// Only text-generating Gemini models are listed.
const NON_TEXT = /(tts|image|embedding|live|transcribe|robotics|omni|banana|aqa|imagen|veo|learnlm)/

const UsageSchema = z
  .object({ promptTokenCount: z.number().optional(), candidatesTokenCount: z.number().optional(), thoughtsTokenCount: z.number().optional() })
  .optional()

const CandidateSchema = z.object({
  finishReason: z.string().optional(),
  content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })).default([]) }).optional()
})

const GenerateSchema = z.object({
  candidates: z.array(CandidateSchema).default([]),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  usageMetadata: UsageSchema
})

const ModelsSchema = z.object({
  models: z
    .array(z.object({ name: z.string(), displayName: z.string().optional(), supportedGenerationMethods: z.array(z.string()).default([]) }))
    .default([])
})

// Path segments are encoded; the host also passes the allowlist in http.ts. Project and location are validated in providers.ts.
function endpoint(kind: Kind, cred: Credentials, model: string, method: string) {
  const m = encodeURIComponent(model)
  if (kind === 'gemini') return `https://generativelanguage.googleapis.com/v1beta/models/${m}:${method}`
  const location = cred.location || 'global'
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`
  const project = encodeURIComponent(cred.project ?? '')
  return `https://${host}/v1/projects/${project}/locations/${encodeURIComponent(location)}/publishers/google/models/${m}:${method}`
}

// Gemini 4 and 3.6+ ignore temperature/topP/topK and return a deprecation header; it will become a 400 later.
const NO_SAMPLING = /^gemini-(4|3\.[6-9])/

function body(call: LlmCall) {
  const sampling = NO_SAMPLING.test(call.model) ? {} : { temperature: call.temperature ?? 0.7, topP: 0.95 }
  return {
    ...(call.system ? { systemInstruction: { parts: [{ text: call.system }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: call.user }] }],
    generationConfig: {
      ...sampling,
      maxOutputTokens: call.maxTokens ?? 32768,
      responseMimeType: call.schema ? 'application/json' : 'text/plain',
      ...(call.schema ? { responseSchema: toGemini(call.schema) } : {})
    }
  }
}

function usageOf(meta: z.infer<typeof UsageSchema>): Usage {
  return {
    promptTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
    thoughtsTokens: meta?.thoughtsTokenCount ?? 0
  }
}

function textOf(candidate: z.infer<typeof CandidateSchema> | undefined): string {
  return (candidate?.content?.parts ?? [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text ?? '')
    .join('')
}

const headers = (key: string) => ({ 'Content-Type': 'application/json', 'x-goog-api-key': key })

async function post(kind: Kind, call: LlmCall, cred: Credentials, stream: boolean) {
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
  return send(
    endpoint(kind, cred, call.model, method),
    { headers: headers(cred.key), body: body(call) },
    { label: LABEL[kind], key: cred.key, signal: call.signal, timeoutMs: call.timeoutMs, stream }
  )
}

async function probe(cred: Credentials, model: string): Promise<boolean> {
  try {
    const res = await send(
      endpoint('vertex', cred, model, 'generateContent'),
      {
        headers: headers(cred.key),
        body: { contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 16 } }
      },
      { label: LABEL.vertex, key: cred.key, timeoutMs: 60_000, attempts: 1 }
    )
    await res.body?.cancel()
    return true
  } catch (e) {
    if (!(e instanceof LlmError) || e.kind === 'auth' || e.status === undefined) throw e
    // 429 is a quota issue, 400 is a parameter problem: the model exists.
    return e.status === 429 || e.status === 400
  }
}

function client(kind: Kind): ProviderClient {
  return {
    async generate(call, cred): Promise<LlmResult> {
      const res = await post(kind, call, cred, false)
      const data = await readJson(res, GenerateSchema, LABEL[kind])
      const cand = data.candidates[0]
      if (cand?.finishReason === 'MAX_TOKENS') throw new LlmError(msg('err.truncated'))
      const text = textOf(cand).trim()
      if (!text) throw new LlmError(msg('err.empty', { reason: cand?.finishReason ?? data.promptFeedback?.blockReason ?? msg('err.unknownReason') }))
      return { text, usage: usageOf(data.usageMetadata) }
    },

    async stream(call, cred, onText): Promise<LlmResult> {
      const res = await post(kind, call, cred, true)
      let text = ''
      let usage = emptyUsage()
      let finish: string | undefined
      await readSse(
        res,
        GenerateSchema,
        (data) => {
          const cand = data.candidates[0]
          const piece = textOf(cand)
          if (piece) {
            text += piece
            onText(piece)
          }
          if (cand?.finishReason) finish = cand.finishReason
          if (data.usageMetadata) usage = usageOf(data.usageMetadata)
        },
        call.signal
      )
      if (finish === 'MAX_TOKENS') throw new LlmError(msg('err.truncated'))
      if (!text.trim()) throw new LlmError(msg('err.empty', { reason: finish ?? msg('err.unknownReason') }))
      return { text, usage }
    },

    async discover(cred): Promise<DiscoveredModel[]> {
      if (kind === 'vertex') {
        if (!cred.project) throw new LlmError(msg('err.vertexProject'))
        const found: DiscoveredModel[] = []
        // At most 3 concurrent probes, to avoid quota errors.
        for (let i = 0; i < VERTEX_PROBE.length; i += 3) {
          const batch = VERTEX_PROBE.slice(i, i + 3)
          const ok = await Promise.all(batch.map((m) => probe(cred, m)))
          batch.forEach((m, j) => {
            if (ok[j]) found.push({ id: m })
          })
        }
        return found
      }
      const res = await send(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
        { method: 'GET', headers: headers(cred.key) },
        { label: LABEL.gemini, key: cred.key, timeoutMs: 30_000, attempts: 2 }
      )
      const data = await readJson(res, ModelsSchema, LABEL.gemini)
      return data.models
        .filter((m) => m.supportedGenerationMethods.includes('generateContent'))
        .map((m): DiscoveredModel => ({ id: m.name.replace(/^models\//, ''), label: m.displayName }))
        .filter((m) => m.id.startsWith('gemini') && !NON_TEXT.test(m.id))
    }
  }
}

export const vertex = client('vertex')
export const aiStudio = client('gemini')
