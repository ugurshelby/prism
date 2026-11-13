// Shared HTTPS + SSE helpers for all providers. The key goes only in a header and only to allowlisted provider
// hosts; it is scrubbed from error text. Response bodies are parsed with a schema by the caller.

import { z } from 'zod'
import { msg } from '@shared/messages'
import { logWarn } from '../log'
import { LlmError, type LlmErrorKind } from './types'

export interface SendOptions {
  label: string
  key: string
  signal?: AbortSignal
  timeoutMs?: number
  /** Total number of attempts (for 429 / 5xx). */
  attempts?: number
  /** Streaming response: the timeout applies to the headers only; readSse's idle timeout guards the body. */
  stream?: boolean
}

// Requests carrying a key may only go to these hosts. Vertex regional endpoints look like <region>-aiplatform.googleapis.com.
const HOSTS = new Set(['api.anthropic.com', 'api.openai.com', 'api.x.ai', 'generativelanguage.googleapis.com', 'aiplatform.googleapis.com'])
const VERTEX_REGIONAL = /^[a-z0-9-]{2,40}-aiplatform\.googleapis\.com$/

/** If the URL is not https or not an allowlisted provider host, the request is never sent. */
export function assertProviderUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new LlmError(msg('err.badProviderUrl'))
  }
  const host = url.hostname
  const allowed = url.protocol === 'https:' && !url.username && !url.password && !url.port && (HOSTS.has(host) || VERTEX_REGIONAL.test(host))
  if (!allowed) throw new LlmError(msg('err.hostNotAllowed', { host }))
  return url
}

export function redact(text: string, key: string): string {
  return key ? text.split(key).join('••••') : text
}

const ErrorBodySchema = z.object({
  error: z
    .union([
      z.string(),
      z.object({ message: z.string(), details: z.array(z.object({ reason: z.string().max(80).optional() })).max(20).optional() })
    ])
    .optional(),
  message: z.string().optional(),
  detail: z.string().optional()
})

/** Structured reasons in Google error bodies (e.g. API_KEY_INVALID); key rejection is recognized even if the text changes. */
function errorReasons(data: unknown): string[] {
  const parsed = ErrorBodySchema.safeParse(data)
  const err = parsed.success ? parsed.data.error : undefined
  return typeof err === 'object' ? (err.details ?? []).flatMap((d) => (d.reason ? [d.reason] : [])) : []
}

function errorMessage(data: unknown): string | undefined {
  const parsed = ErrorBodySchema.safeParse(data)
  if (!parsed.success) return undefined
  const { error, message, detail } = parsed.data
  return (typeof error === 'string' ? error : error?.message) ?? message ?? detail
}

function errorKind(status: number, message: string, reasons: string[] = []): LlmErrorKind {
  if (status === 404) return 'not_found'
  // Google AI Studio, Vertex and xAI return 400 instead of 401 for an invalid key.
  if (reasons.some((r) => r.startsWith('API_KEY_'))) return 'auth'
  if (status === 401 || status === 403 || (status === 400 && /api[ _-]?key/i.test(message))) return 'auth'
  if (status === 429) return 'quota'
  return 'other'
}

function friendly(label: string, status: number, message: string, kind: LlmErrorKind): string {
  if (kind === 'not_found') return msg('err.notFound', { detail: message })
  if (kind === 'auth') return msg('err.keyRejected', { label, status, detail: message })
  if (kind === 'quota') return msg('err.quota', { label })
  return msg('err.status', { label, status, detail: message })
}

const MAX_ERROR_MESSAGE = 500
/** If no data arrives for this long during a stream, the connection is considered dropped. */
const STREAM_IDLE_MS = 120_000
/** Upper bound on buffered stream data without a line break; the response is treated as corrupt if exceeded. */
const MAX_SSE_LINE = 1 << 20

/** Abortable wait: if the user cancels, it stops without waiting out the retry. */
function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new LlmError(msg('err.cancelled')))
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', stop)
      resolve()
    }, ms)
    const stop = () => {
      clearTimeout(t)
      reject(new LlmError(msg('err.cancelled')))
    }
    signal?.addEventListener('abort', stop, { once: true })
  })
}

/** Retry-After may be seconds or a date; unreasonable values are ignored (waits at most 30 s). */
function retryDelay(res: Response, attempt: number): number {
  const header = res.headers.get('retry-after')
  const seconds = header === null ? NaN : Number(header)
  const fromHeader = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - Date.now() : NaN
  const fallback = 1500 * (attempt + 1) ** 2
  return Number.isFinite(fromHeader) && fromHeader > 0 ? Math.min(fromHeader, 30_000) : fallback
}

export async function send(
  url: string,
  init: { method?: 'GET' | 'POST'; headers: Record<string, string>; body?: unknown },
  o: SendOptions
): Promise<Response> {
  const target = assertProviderUrl(url)
  const attempts = o.attempts ?? 3
  for (let attempt = 0; attempt < attempts; attempt++) {
    // For streams the timeout applies only until the headers arrive; a long but still flowing write is not cut off.
    // For non-streaming responses the body is subject to the same limit: a server that sends headers and stalls on the body must not hang the request forever.
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), o.timeoutMs ?? 240_000)
    const signals = [timeout.signal]
    if (o.signal) signals.push(o.signal)
    let res: Response
    try {
      res = await fetch(target, {
        method: init.method ?? 'POST',
        headers: init.headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        // A redirect could carry the key to another host; provider APIs do not redirect.
        redirect: 'error',
        signal: AbortSignal.any(signals)
      })
    } catch (e) {
      if (o.signal?.aborted) throw new LlmError(msg('err.cancelled'))
      if (timeout.signal.aborted) throw new LlmError(msg('err.timeout'))
      throw new LlmError(msg('err.network', { detail: redact(e instanceof Error ? e.message : msg('err.networkUnknown'), o.key) }))
    } finally {
      if (o.stream) clearTimeout(timer)
      else timer.unref()
    }
    if ((res.status === 429 || res.status >= 500) && attempt < attempts - 1) {
      await res.body?.cancel()
      await sleep(retryDelay(res, attempt), o.signal)
      continue
    }
    if (!res.ok) {
      // The error body may not be JSON (e.g. a proxy page); the status text is used then.
      const data: unknown = await res.json().catch(() => null)
      const message = redact(errorMessage(data) ?? res.statusText, o.key).slice(0, MAX_ERROR_MESSAGE)
      const kind = errorKind(res.status, message, errorReasons(data))
      throw new LlmError(friendly(o.label, res.status, message, kind), res.status, kind)
    }
    return res
  }
  throw new LlmError(msg('err.retriesExhausted', { label: o.label }))
}

/** Parses the response body with a schema; an unexpected shape becomes an explicit error. */
export async function readJson<S extends z.ZodType>(res: Response, schema: S, label: string): Promise<z.infer<S>> {
  let data: unknown
  try {
    data = await res.json()
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new LlmError(msg('err.responseTimeout', { label }))
    throw new LlmError(msg('err.notJson', { label }))
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new LlmError(msg('err.badShape', { label }))
  return parsed.data
}

/** Passes `data:` lines through the schema and forwards them in order; events that do not match the schema are skipped. */
export async function readSse<S extends z.ZodType>(res: Response, schema: S, onData: (data: z.infer<S>) => void, signal?: AbortSignal) {
  if (!res.body) throw new LlmError(msg('err.noBody'))
  const reader: ReadableStreamDefaultReader<Uint8Array> = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    let json: unknown
    try {
      json = JSON.parse(payload)
    } catch {
      throw new LlmError(msg('err.badStreamJson'))
    }
    const parsed = schema.safeParse(json)
    // Providers may add new event types; an unrecognized event does not break the stream.
    if (parsed.success) onData(parsed.data)
  }
  let idle: ReturnType<typeof setTimeout> | undefined
  const stalled = () =>
    new Promise<never>((_, reject) => {
      idle = setTimeout(() => {
        void reader.cancel()
        reject(new LlmError(msg('err.streamStalled')))
      }, STREAM_IDLE_MS)
    })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), stalled()])
      clearTimeout(idle)
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      if (buffer.length > MAX_SSE_LINE) throw new LlmError(msg('err.longLine'))
      lines.forEach(handle)
    }
    if (buffer) handle(buffer)
  } catch (e) {
    // Whatever path the error takes, the connection is closed so the provider does not keep generating (and billing).
    reader.cancel().catch((err: unknown) => logWarn('llm', 'could not close stream', err))
    if (signal?.aborted) throw new LlmError(msg('err.cancelled'))
    if (e instanceof LlmError) throw e
    // The connection dropped while reading the stream: raw DOMException/TypeError never reach the UI.
    throw new LlmError(msg('err.streamBroken', { detail: e instanceof Error ? e.message : msg('err.unknown') }))
  } finally {
    clearTimeout(idle)
  }
}
