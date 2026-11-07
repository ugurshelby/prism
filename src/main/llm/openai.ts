// OpenAI ve xAI istemcisi: ikisi de Responses API (POST /v1/responses) kullanır.

import { z } from 'zod'
import type { DiscoveredModel, Usage } from '@shared/types'
import { readJson, readSse, send } from './http'
import { toStrict } from './schema'
import { LlmError, emptyUsage, type Credentials, type LlmCall, type LlmResult, type ProviderClient } from './types'

type Kind = 'openai' | 'xai'

const CONF: Record<
  Kind,
  { base: string; label: string; systemRole: string; reasoning: RegExp; models: RegExp; nonText: RegExp }
> = {
  openai: {
    base: 'https://api.openai.com/v1',
    label: 'OpenAI',
    systemRole: 'developer',
    reasoning: /^(gpt-5|gpt-6|o\d)/,
    models: /^(gpt-|o\d|chatgpt-)/,
    nonText: /(embedding|tts|whisper|transcribe|dall-e|image|realtime|audio|moderation|sora|live|search|computer-use|cyber)/
  },
  xai: {
    base: 'https://api.x.ai/v1',
    label: 'xAI',
    systemRole: 'system',
    // Effort'u ayarlanabilen Grok modelleri; Grok Build ve 4.20 varyantları parametreyi almaz.
    reasoning: /^grok-4\.[3-7](?!\d)/,
    models: /^grok/,
    nonText: /(imagine|image|video|voice)/
  }
}

const UsageSchema = z
  .object({
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    output_tokens_details: z.object({ reasoning_tokens: z.number().optional() }).nullish()
  })
  .nullish()

const ResponseSchema = z.object({
  status: z.string().optional(),
  error: z.object({ message: z.string().optional() }).nullish(),
  incomplete_details: z.object({ reason: z.string().optional() }).nullish(),
  output: z
    .array(
      z.object({
        type: z.string(),
        content: z.array(z.object({ type: z.string(), text: z.string().optional(), refusal: z.string().optional() })).nullish()
      })
    )
    .default([]),
  usage: UsageSchema
})
type ResponseBody = z.infer<typeof ResponseSchema>

const StreamEventSchema = z.object({
  type: z.string(),
  delta: z.string().optional(),
  message: z.string().optional(),
  error: z.object({ message: z.string().optional() }).nullish(),
  response: ResponseSchema.partial().optional()
})

const ModelsSchema = z.object({ data: z.array(z.object({ id: z.string() })).default([]) })

function body(kind: Kind, call: LlmCall, stream: boolean) {
  const c = CONF[kind]
  return {
    model: call.model,
    input: [
      { role: c.systemRole, content: call.system },
      { role: 'user', content: call.user }
    ],
    max_output_tokens: call.maxTokens ?? 32000,
    // Prompt ve yanıt sağlayıcının tarafında saklanmasın.
    store: false,
    ...(c.reasoning.test(call.model) ? { reasoning: { effort: 'medium' } } : {}),
    // xAI örnekleme değerlerini her istekte açıkça göndermeyi öneriyor; OpenAI reasoning'de kabul etmiyor.
    ...(kind === 'xai' ? { temperature: 0.7, top_p: 0.95 } : {}),
    ...(call.schema
      ? { text: { format: { type: 'json_schema', name: 'prism_output', schema: toStrict(call.schema), strict: true } } }
      : {}),
    ...(stream ? { stream: true } : {})
  }
}

function usageOf(u: z.infer<typeof UsageSchema>): Usage {
  return {
    promptTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    thoughtsTokens: u?.output_tokens_details?.reasoning_tokens ?? 0
  }
}

function incomplete(response: Partial<ResponseBody> | undefined): LlmError {
  const reason = response?.incomplete_details?.reason
  return new LlmError(reason === 'max_output_tokens' ? 'Yanıt token sınırında kesildi.' : `Yanıt yarım kaldı (${reason ?? 'bilinmiyor'}).`)
}

function textOf(response: ResponseBody): { text: string; refusal: string } {
  const parts = response.output.filter((i) => i.type === 'message').flatMap((i) => i.content ?? [])
  return {
    text: parts
      .filter((p) => p.type === 'output_text')
      .map((p) => p.text ?? '')
      .join(''),
    refusal: parts
      .filter((p) => p.type === 'refusal')
      .map((p) => p.refusal ?? '')
      .join('')
  }
}

function client(kind: Kind): ProviderClient {
  const c = CONF[kind]
  const headers = (key: string) => ({ 'content-type': 'application/json', authorization: `Bearer ${key}` })
  const post = (call: LlmCall, cred: Credentials, stream: boolean) =>
    send(
      `${c.base}/responses`,
      { headers: headers(cred.key), body: body(kind, call, stream) },
      // xAI reasoning modelleri uzun sürebilir; zaman aşımı daha geniş.
      { label: c.label, key: cred.key, signal: call.signal, timeoutMs: call.timeoutMs ?? (kind === 'xai' ? 600_000 : undefined), stream }
    )

  return {
    async generate(call, cred): Promise<LlmResult> {
      const data = await readJson(await post(call, cred, false), ResponseSchema, c.label)
      if (data.status === 'incomplete') throw incomplete(data)
      if (data.status === 'failed') throw new LlmError(`${c.label}: ${data.error?.message ?? 'istek başarısız'}`)
      const { text, refusal } = textOf(data)
      if (!text.trim()) throw new LlmError(refusal ? `Model yanıtlamayı reddetti: ${refusal}` : `Boş yanıt (${data.status ?? 'bilinmiyor'}).`)
      return { text: text.trim(), usage: usageOf(data.usage) }
    },

    async stream(call, cred, onText): Promise<LlmResult> {
      const res = await post(call, cred, true)
      let text = ''
      let usage = emptyUsage()
      let refusal = ''
      await readSse(
        res,
        StreamEventSchema,
        (ev) => {
          if (ev.type === 'response.output_text.delta' && ev.delta) {
            text += ev.delta
            onText(ev.delta)
          } else if (ev.type === 'response.refusal.delta' && ev.delta) refusal += ev.delta
          else if (ev.type === 'response.completed') usage = usageOf(ev.response?.usage)
          else if (ev.type === 'response.incomplete') throw incomplete(ev.response)
          else if (ev.type === 'response.failed') throw new LlmError(`${c.label}: ${ev.response?.error?.message ?? 'istek başarısız'}`)
          else if (ev.type === 'error') throw new LlmError(`${c.label}: ${ev.message ?? ev.error?.message ?? 'akış hatası'}`)
        },
        call.signal
      )
      if (!text.trim()) throw new LlmError(refusal ? `Model yanıtlamayı reddetti: ${refusal}` : 'Boş yanıt.')
      return { text, usage }
    },

    async discover(cred): Promise<DiscoveredModel[]> {
      const res = await send(
        `${c.base}/models`,
        { method: 'GET', headers: headers(cred.key) },
        { label: c.label, key: cred.key, timeoutMs: 30_000, attempts: 2 }
      )
      const data = await readJson(res, ModelsSchema, c.label)
      return data.data
        .map((m): DiscoveredModel => ({ id: m.id }))
        .filter((m) => c.models.test(m.id) && !c.nonText.test(m.id))
        .sort((a, b) => b.id.localeCompare(a.id))
    }
  }
}

export const openai = client('openai')
export const xai = client('xai')
