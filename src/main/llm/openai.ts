// OpenAI ve xAI istemcisi: ikisi de Responses API (POST /v1/responses) kullanır.

import type { DiscoveredModel, Usage } from '@shared/types'
import { readSse, send } from './http'
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

function body(kind: Kind, call: LlmCall, stream: boolean) {
  const c = CONF[kind]
  return {
    model: call.model,
    input: [
      { role: c.systemRole, content: call.system },
      { role: 'user', content: call.user }
    ],
    max_output_tokens: call.maxTokens ?? 32000,
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

function usageOf(u: any): Usage {
  return {
    promptTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    thoughtsTokens: u?.output_tokens_details?.reasoning_tokens ?? 0
  }
}

function incomplete(response: any): LlmError {
  const reason = response?.incomplete_details?.reason
  return new LlmError(reason === 'max_output_tokens' ? 'Yanıt token sınırında kesildi.' : `Yanıt yarım kaldı (${reason ?? 'bilinmiyor'}).`)
}

function textOf(response: any): { text: string; refusal: string } {
  const parts = (response.output ?? []).filter((i: any) => i.type === 'message').flatMap((i: any) => i.content ?? [])
  return {
    text: parts.filter((p: any) => p.type === 'output_text').map((p: any) => p.text).join(''),
    refusal: parts.filter((p: any) => p.type === 'refusal').map((p: any) => p.refusal).join('')
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
      { label: c.label, key: cred.key, signal: call.signal, timeoutMs: call.timeoutMs ?? (kind === 'xai' ? 600_000 : undefined) }
    )

  return {
    async generate(call, cred): Promise<LlmResult> {
      const data: any = await (await post(call, cred, false)).json()
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
      const data: any = await res.json()
      return (data.data ?? [])
        .map((m: any) => ({ id: String(m.id) }))
        .filter((m: DiscoveredModel) => c.models.test(m.id) && !c.nonText.test(m.id))
        .sort((a: DiscoveredModel, b: DiscoveredModel) => b.id.localeCompare(a.id))
    }
  }
}

export const openai = client('openai')
export const xai = client('xai')
