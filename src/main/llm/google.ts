// Gemini istemcisi: Vertex AI (bkz. docs/vertex-ai-gemini-kurulumu.md) ve Google AI Studio (Gemini API).
// İkisi aynı generateContent gövdesini kullanır; yalnızca uç nokta ve key türü farklı.

import type { DiscoveredModel, Usage } from '@shared/types'
import { readSse, send } from './http'
import { toGemini } from './schema'
import { LlmError, emptyUsage, type Credentials, type LlmCall, type LlmResult, type ProviderClient } from './types'

type Kind = 'vertex' | 'gemini'

const LABEL: Record<Kind, string> = { vertex: 'Vertex', gemini: 'Gemini API' }

// Vertex'te model listeleme API key ile çalışmıyor; erişim model başına küçük bir istekle yoklanır.
const VERTEX_PROBE = [
  'gemini-4-argon',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
]

// Yalnızca metin üreten Gemini modelleri listelenir.
const NON_TEXT = /(tts|image|embedding|live|transcribe|robotics|omni|banana|aqa|imagen|veo|learnlm)/

function endpoint(kind: Kind, cred: Credentials, model: string, method: string) {
  if (kind === 'gemini') return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`
  const location = cred.location || 'global'
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`
  return `https://${host}/v1/projects/${cred.project}/locations/${location}/publishers/google/models/${model}:${method}`
}

function body(call: LlmCall) {
  return {
    systemInstruction: { parts: [{ text: call.system }] },
    contents: [{ role: 'user', parts: [{ text: call.user }] }],
    generationConfig: {
      temperature: call.temperature ?? 0.7,
      topP: 0.95,
      maxOutputTokens: call.maxTokens ?? 32768,
      responseMimeType: call.schema ? 'application/json' : 'text/plain',
      ...(call.schema ? { responseSchema: toGemini(call.schema) } : {})
    }
  }
}

function usageOf(meta: any): Usage {
  return {
    promptTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
    thoughtsTokens: meta?.thoughtsTokenCount ?? 0
  }
}

function textOf(candidate: any): string {
  return (candidate?.content?.parts ?? [])
    .filter((p: any) => typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('')
}

const headers = (key: string) => ({ 'Content-Type': 'application/json', 'x-goog-api-key': key })

async function post(kind: Kind, call: LlmCall, cred: Credentials, stream: boolean) {
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
  return send(
    endpoint(kind, cred, call.model, method),
    { headers: headers(cred.key), body: body(call) },
    { label: LABEL[kind], key: cred.key, signal: call.signal, timeoutMs: call.timeoutMs }
  )
}

async function probe(cred: Credentials, model: string): Promise<boolean> {
  try {
    await send(
      endpoint('vertex', cred, model, 'generateContent'),
      {
        headers: headers(cred.key),
        body: { contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 16 } }
      },
      { label: LABEL.vertex, key: cred.key, timeoutMs: 60_000, attempts: 1 }
    )
    return true
  } catch (e) {
    if (!(e instanceof LlmError) || e.status === 401 || e.status === 403 || e.status === undefined) throw e
    // 429 kota, 400 parametre sorunudur: model var demektir.
    return e.status === 429 || e.status === 400
  }
}

function client(kind: Kind): ProviderClient {
  return {
    async generate(call, cred): Promise<LlmResult> {
      const res = await post(kind, call, cred, false)
      const data: any = await res.json()
      const cand = data.candidates?.[0]
      if (cand?.finishReason === 'MAX_TOKENS') throw new LlmError('Yanıt token sınırında kesildi.')
      const text = textOf(cand).trim()
      if (!text) throw new LlmError(`Boş yanıt (${cand?.finishReason ?? data?.promptFeedback?.blockReason ?? 'bilinmiyor'}).`)
      return { text, usage: usageOf(data.usageMetadata) }
    },

    async stream(call, cred, onText): Promise<LlmResult> {
      const res = await post(kind, call, cred, true)
      let text = ''
      let usage = emptyUsage()
      let finish: string | undefined
      await readSse(
        res,
        (data) => {
          const cand = data.candidates?.[0]
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
      if (finish === 'MAX_TOKENS') throw new LlmError('Yanıt token sınırında kesildi.')
      if (!text.trim()) throw new LlmError(`Boş yanıt (${finish ?? 'bilinmiyor'}).`)
      return { text, usage }
    },

    async discover(cred): Promise<DiscoveredModel[]> {
      if (kind === 'vertex') {
        if (!cred.project) throw new LlmError('Vertex AI için proje ID gerekli.')
        const found: DiscoveredModel[] = []
        // Aynı anda en fazla 3 yoklama: kota hatası almamak için.
        for (let i = 0; i < VERTEX_PROBE.length; i += 3) {
          const batch = VERTEX_PROBE.slice(i, i + 3)
          const ok = await Promise.all(batch.map((m) => probe(cred, m)))
          batch.forEach((m, j) => ok[j] && found.push({ id: m }))
        }
        return found
      }
      const res = await send(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
        { method: 'GET', headers: headers(cred.key) },
        { label: LABEL.gemini, key: cred.key, timeoutMs: 30_000, attempts: 2 }
      )
      const data: any = await res.json()
      return (data.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m: any) => ({ id: String(m.name).replace(/^models\//, ''), label: m.displayName }))
        .filter((m: DiscoveredModel) => m.id.startsWith('gemini') && !NON_TEXT.test(m.id))
    }
  }
}

export const vertex = client('vertex')
export const aiStudio = client('gemini')
