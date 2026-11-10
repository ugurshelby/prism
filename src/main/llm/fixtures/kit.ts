// Sağlayıcı istemci testleri için ortak yardımcılar: fixture okuma, ağsız fetch taklidi, hata yakalama.
// Yalnızca testler içe aktarır; üretim koduna girmez.
import { expect, vi } from 'vitest'
import { z } from 'zod'
import { assertProviderUrl } from '../http'
import { LlmError } from '../types'
import anthropicErrorAuth from './anthropic-error-auth.json'
import anthropicErrorRateLimit from './anthropic-error-rate-limit.json'
import anthropicMalformed from './anthropic-malformed.json'
import anthropicMessageStructured from './anthropic-message-structured.json'
import anthropicMessage from './anthropic-message.json'
import anthropicModels from './anthropic-models.json'
import anthropicStream from './anthropic-stream.json'
import googleErrorAuth from './google-error-auth.json'
import googleErrorNotFound from './google-error-not-found.json'
import googleErrorRateLimit from './google-error-rate-limit.json'
import googleGenerateStructured from './google-generate-structured.json'
import googleGenerate from './google-generate.json'
import googleMalformed from './google-malformed.json'
import googleModels from './google-models.json'
import googleStream from './google-stream.json'
import openaiErrorAuth from './openai-error-auth.json'
import openaiErrorRateLimit from './openai-error-rate-limit.json'
import openaiMalformed from './openai-malformed.json'
import openaiModels from './openai-models.json'
import openaiResponseStructured from './openai-response-structured.json'
import openaiResponse from './openai-response.json'
import openaiStream from './openai-stream.json'
import grokErrorAuth from './grok-error-auth.json'
import grokModels from './grok-models.json'

const FIXTURES: Record<string, unknown> = {
  'anthropic-error-auth.json': anthropicErrorAuth,
  'anthropic-error-rate-limit.json': anthropicErrorRateLimit,
  'anthropic-malformed.json': anthropicMalformed,
  'anthropic-message-structured.json': anthropicMessageStructured,
  'anthropic-message.json': anthropicMessage,
  'anthropic-models.json': anthropicModels,
  'anthropic-stream.json': anthropicStream,
  'google-error-auth.json': googleErrorAuth,
  'google-error-not-found.json': googleErrorNotFound,
  'google-error-rate-limit.json': googleErrorRateLimit,
  'google-generate-structured.json': googleGenerateStructured,
  'google-generate.json': googleGenerate,
  'google-malformed.json': googleMalformed,
  'google-models.json': googleModels,
  'google-stream.json': googleStream,
  'openai-error-auth.json': openaiErrorAuth,
  'openai-error-rate-limit.json': openaiErrorRateLimit,
  'openai-malformed.json': openaiMalformed,
  'openai-models.json': openaiModels,
  'openai-response-structured.json': openaiResponseStructured,
  'openai-response.json': openaiResponse,
  'openai-stream.json': openaiStream,
  'grok-error-auth.json': grokErrorAuth,
  'grok-models.json': grokModels
}

const EventsSchema = z.array(z.object({ event: z.string().optional(), data: z.unknown() }))

/** Gerçek bir key biçiminde değil; testlerin sızıntı denetimi için ayırt edilebilir sahte değer. */
export const KEY = 'Fake_Test_Value_For_Provider_0123456789'

/** Dosya adından fixture gövdesi; adlar statik içe aktarılır, çalışma zamanında dosya yolu kurulmaz. */
export const fixture = (name: string): Record<string, unknown> => z.record(z.string(), z.unknown()).parse(FIXTURES[name])

export const eventsOf = (name: string) => EventsSchema.parse(fixture(name).events)

export interface Seen {
  url: string
  method: string
  headers: Record<string, string>
  body: string
  redirect: string
}

/**
 * Genel fetch'i taklit eder. İşleyici bir yanıt döndürmezse (bilinmeyen adres) istek `unexpected` listesine yazılır
 * ve fetch hata fırlatır: hiçbir istek gerçek ağa çıkamaz.
 */
export function serve(handler: (url: string, req: Seen) => Response | undefined) {
  const seen: Seen[] = []
  const unexpected: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: URL | string, init: RequestInit) => {
      const u = String(url)
      const req: Seen = {
        url: u,
        method: init.method ?? 'GET',
        // Başlık adları küçük harfe indirilir.
        headers: Object.fromEntries(new Headers(init.headers)),
        body: typeof init.body === 'string' ? init.body : '',
        redirect: init.redirect ?? ''
      }
      seen.push(req)
      const res = handler(u, req)
      if (!res) {
        unexpected.push(u)
        return Promise.reject(new Error(`beklenmeyen istek: ${u}`))
      }
      return Promise.resolve(res)
    })
  )
  return { seen, unexpected }
}

/** Gönderilen JSON gövdesi; biçim `toMatchObject` ile denetlenir. */
export const sentBody = (req: Seen | undefined): unknown => JSON.parse(req?.body ?? 'null')

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers })

/** 429 yeniden denemesi testi hızlı bitsin diye 1 ms bekletir (Retry-After pozitif ve küçük). */
export const quick = { 'retry-after': '0.001' }

/** `{ event?, data }` listesinden SSE akışı üretir. */
export function sse(events: { event?: string; data: unknown }[]): Response {
  const text = events.map((e) => `${e.event ? `event: ${e.event}\n` : ''}data: ${JSON.stringify(e.data)}\n\n`).join('')
  return new Response(text, { headers: { 'content-type': 'text/event-stream' } })
}

export async function failure(p: Promise<unknown>): Promise<LlmError> {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e
  )
  if (!(err instanceof LlmError)) throw new Error('LlmError bekleniyordu')
  return err
}

/** Hata mesajı, yığın ve alanların hiçbir yerinde key geçmemeli. */
export const expectNoKey = (err: LlmError) => {
  expect(JSON.stringify([err.message, err.stack, err.status, err.kind])).not.toContain(KEY)
}

/** İstek izinli bir https sunucusuna gider; key adreste ve gövdede yoktur; yönlendirme kapalıdır. */
export function expectSafeRequest(req: Seen) {
  expect(() => assertProviderUrl(req.url)).not.toThrow()
  expect(req.url).not.toContain(KEY)
  expect(req.body).not.toContain(KEY)
  expect(req.redirect).toBe('error')
}

/** Anahtarı taşıyan başlıklar: key yalnızca belgelenen tek başlıkta olmalı. */
export const keyHeaders = (req: Seen): string[] => Object.entries(req.headers).flatMap(([k, v]) => (v.includes(KEY) ? [k] : []))

export const SCHEMA = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] }
export const CALL = { system: 'Sistem talimatı', user: 'Kullanıcı metni' }
