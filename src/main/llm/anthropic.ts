// Anthropic Messages API istemcisi (Claude modelleri Prism'in motoru olarak).

import { z } from 'zod'
import { msg } from '@shared/messages'
import type { DiscoveredModel, Usage } from '@shared/types'
import { readJson, readSse, redact, send } from './http'
import { toStrict } from './schema'
import { LlmError, emptyUsage, type Credentials, type LlmCall, type LlmResult, type ProviderClient } from './types'

const BASE = 'https://api.anthropic.com/v1'
const LABEL = 'Anthropic'

const UsageSchema = z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() }).optional()

const MessageSchema = z.object({
  stop_reason: z.string().nullish(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).default([]),
  usage: UsageSchema
})

const StreamEventSchema = z.object({
  type: z.string(),
  message: z.object({ usage: UsageSchema }).optional(),
  delta: z.object({ type: z.string().optional(), text: z.string().optional(), stop_reason: z.string().nullish() }).optional(),
  usage: UsageSchema,
  error: z.object({ message: z.string().optional() }).optional()
})

const ModelsSchema = z.object({ data: z.array(z.object({ id: z.string(), display_name: z.string().optional() })).default([]) })

const headers = (key: string) => ({
  'content-type': 'application/json',
  'x-api-key': key,
  'anthropic-version': '2023-06-01'
})

// 5.x ailesi effort ve structured output'u destekler; temperature göndermiyoruz (Opus 5.5 reddediyor).
const supportsEffort = (model: string) => /^claude-(opus|sonnet|haiku|fable)-5/.test(model)

function body(call: LlmCall, stream: boolean) {
  const output_config = {
    ...(supportsEffort(call.model) ? { effort: 'medium' } : {}),
    ...(call.schema ? { format: { type: 'json_schema', schema: toStrict(call.schema) } } : {})
  }
  return {
    model: call.model,
    max_tokens: call.maxTokens ?? 32000,
    system: call.system,
    messages: [{ role: 'user', content: call.user }],
    ...(Object.keys(output_config).length ? { output_config } : {}),
    ...(stream ? { stream: true } : {})
  }
}

function checkStop(reason: string | null | undefined) {
  if (reason === 'max_tokens') throw new LlmError(msg('err.truncated'))
  if (reason === 'refusal') throw new LlmError(msg('err.refused'))
}

async function post(call: LlmCall, cred: Credentials, stream: boolean) {
  return send(
    `${BASE}/messages`,
    { headers: headers(cred.key), body: body(call, stream) },
    { label: LABEL, key: cred.key, signal: call.signal, timeoutMs: call.timeoutMs, stream }
  )
}

export const anthropic: ProviderClient = {
  async generate(call, cred): Promise<LlmResult> {
    const data = await readJson(await post(call, cred, false), MessageSchema, LABEL)
    checkStop(data.stop_reason)
    const text = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim()
    if (!text) throw new LlmError(msg('err.empty', { reason: data.stop_reason ?? msg('err.unknownReason') }))
    return {
      text,
      usage: { promptTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0, thoughtsTokens: 0 }
    }
  },

  async stream(call, cred, onText): Promise<LlmResult> {
    const res = await post(call, cred, true)
    let text = ''
    const usage: Usage = emptyUsage()
    let stop: string | null | undefined
    await readSse(
      res,
      StreamEventSchema,
      (ev) => {
        if (ev.type === 'message_start') usage.promptTokens = ev.message?.usage?.input_tokens ?? 0
        else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
          text += ev.delta.text
          onText(ev.delta.text)
        } else if (ev.type === 'message_delta') {
          stop = ev.delta?.stop_reason ?? stop
          usage.outputTokens = ev.usage?.output_tokens ?? usage.outputTokens
        } else if (ev.type === 'error') throw new LlmError(msg('err.providerError', { label: LABEL, detail: redact(ev.error?.message ?? msg('err.streamError'), cred.key).slice(0, 500) }))
      },
      call.signal
    )
    checkStop(stop)
    if (!text.trim()) throw new LlmError(msg('err.empty', { reason: stop ?? msg('err.unknownReason') }))
    return { text, usage }
  },

  async discover(cred): Promise<DiscoveredModel[]> {
    const res = await send(
      `${BASE}/models?limit=1000`,
      { method: 'GET', headers: headers(cred.key) },
      { label: LABEL, key: cred.key, timeoutMs: 30_000, attempts: 2 }
    )
    const data = await readJson(res, ModelsSchema, LABEL)
    return data.data.map((m) => ({ id: m.id, label: m.display_name }))
  }
}
