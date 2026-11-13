// Shared helpers for provider client tests: fixture loading, network-free fetch mock, error capture.
// Imported by tests only; never enters production code.
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

/** Not a real key format; a distinguishable fake value so tests can check for leaks. */
export const KEY = 'Fake_Test_Value_For_Provider_0123456789'

/** Fixture body by file name; names are statically imported, no file path is built at runtime. */
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
 * Mocks the global fetch. If the handler returns no response (unknown URL), the request is recorded in the `unexpected` list
 * and fetch throws: no request can reach the real network.
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
        // Header names are lowercased.
        headers: Object.fromEntries(new Headers(init.headers)),
        body: typeof init.body === 'string' ? init.body : '',
        redirect: init.redirect ?? ''
      }
      seen.push(req)
      const res = handler(u, req)
      if (!res) {
        unexpected.push(u)
        return Promise.reject(new Error(`unexpected request: ${u}`))
      }
      return Promise.resolve(res)
    })
  )
  return { seen, unexpected }
}

/** The JSON body that was sent; its shape is checked with `toMatchObject`. */
export const sentBody = (req: Seen | undefined): unknown => JSON.parse(req?.body ?? 'null')

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers })

/** Waits 1 ms so the 429 retry test finishes fast (Retry-After is positive and small). */
export const quick = { 'retry-after': '0.001' }

/** Builds an SSE stream from a list of `{ event?, data }`. */
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

/** The key must not appear anywhere in the error message, stack or fields. */
export const expectNoKey = (err: LlmError) => {
  expect(JSON.stringify([err.message, err.stack, err.status, err.kind])).not.toContain(KEY)
}

/** The request goes to an allowlisted https host; the key is absent from URL and body; redirects are off. */
export function expectSafeRequest(req: Seen) {
  expect(() => assertProviderUrl(req.url)).not.toThrow()
  expect(req.url).not.toContain(KEY)
  expect(req.body).not.toContain(KEY)
  expect(req.redirect).toBe('error')
}

/** Headers carrying the key: the key must appear only in the single documented header. */
export const keyHeaders = (req: Seen): string[] => Object.entries(req.headers).flatMap(([k, v]) => (v.includes(KEY) ? [k] : []))

export const SCHEMA = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] }
export const CALL = { system: 'System instruction', user: 'User text' }
