import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { assertProviderUrl, readJson, redact, send } from './http'
import { LlmError } from './types'
import { msg } from '@shared/messages'

const KEY = 'Fake_Test_Value_For_Http_0123456789'

describe('assertProviderUrl', () => {
  it('accepts allowlisted provider hosts', () => {
    for (const u of [
      'https://api.anthropic.com/v1/messages',
      'https://api.openai.com/v1/responses',
      'https://api.x.ai/v1/chat/completions',
      'https://generativelanguage.googleapis.com/v1beta/models',
      'https://aiplatform.googleapis.com/v1/projects/p/locations/global',
      'https://us-central1-aiplatform.googleapis.com/v1/projects/p'
    ]) {
      expect(() => assertProviderUrl(u)).not.toThrow()
    }
  })

  it('rejects foreign hosts, http, userinfo and ports', () => {
    for (const u of [
      'http://api.anthropic.com/v1/messages',
      'https://evil.com/v1/messages',
      'https://api.anthropic.com.evil.com/',
      'https://evil.com/aiplatform.googleapis.com',
      'https://evil.com-aiplatform.googleapis.com.attacker.net/',
      'https://user:pass@api.openai.com/',
      'https://api.openai.com:8443/',
      'file:///etc/passwd',
      'not a url'
    ]) {
      expect(() => assertProviderUrl(u)).toThrow(LlmError)
    }
  })

  it('a Vertex location cannot redirect to another host via the URL path', () => {
    // An unvalidated location would have turned into https://evil.com/-aiplatform.googleapis.com/...
    expect(() => assertProviderUrl('https://evil.com/-aiplatform.googleapis.com/v1/projects/p')).toThrow(LlmError)
  })
})

describe('redact', () => {
  it('masks every occurrence of the key', () => {
    expect(redact(`a ${KEY} b ${KEY}`, KEY)).toBe('a •••• b ••••')
  })
  it('an empty key leaves the text unchanged', () => {
    expect(redact('metin', '')).toBe('metin')
  })
})

describe('send', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends no request to a disallowed URL', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(send('https://evil.com/x', { headers: {} }, { label: 'Test', key: KEY })).rejects.toThrow(LlmError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('disables redirects', async () => {
    const fetchMock = vi.fn(async (_url: URL, _init: RequestInit) => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await send('https://api.anthropic.com/v1/messages', { headers: {} }, { label: 'Test', key: KEY })
    expect(fetchMock.mock.calls[0]?.[1].redirect).toBe('error')
  })

  async function failure(p: Promise<unknown>): Promise<LlmError> {
    const err = await p.then(
      () => undefined,
      (e: unknown) => e
    )
    if (!(err instanceof LlmError)) throw new Error('LlmError bekleniyordu')
    return err
  }

  it('scrubs the key from the error body message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: `bad key ${KEY}` } }, { status: 418 })))
    const err = await failure(send('https://api.openai.com/v1/x', { headers: {} }, { label: 'OpenAI', key: KEY, attempts: 1 }))
    expect(err.message).not.toContain(KEY)
    expect(err.status).toBe(418)
  })

  it('marks a key rejection that arrives as 400 as auth', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'API key not valid. Please pass a valid API key.' } }, { status: 400 })))
    const err = await failure(send('https://aiplatform.googleapis.com/v1/x', { headers: {} }, { label: 'Vertex', key: KEY, attempts: 1 }))
    expect(err.kind).toBe('auth')
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Invalid JSON payload: responseSchema' } }, { status: 400 })))
    const other = await failure(send('https://aiplatform.googleapis.com/v1/x', { headers: {} }, { label: 'Vertex', key: KEY, attempts: 1 }))
    expect(other.kind).toBe('other')
  })

  it('scrubs the key from the network error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error(`connect failed ${KEY}`))))
    const err = await failure(send('https://api.openai.com/v1/x', { headers: {} }, { label: 'OpenAI', key: KEY }))
    expect(err.message).not.toContain(KEY)
  })
})

describe('send: retry', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('if cancelled while waiting after 429, it stops immediately', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '20' } })))
    const ctrl = new AbortController()
    const started = Date.now()
    const p = send('https://api.openai.com/v1/x', { headers: {} }, { label: 'OpenAI', key: KEY, signal: ctrl.signal })
    setTimeout(() => ctrl.abort(), 50)
    await expect(p).rejects.toThrow(msg('err.cancelled'))
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})

describe('readJson', () => {
  it('rejects a response that does not match the schema with an explicit error', async () => {
    const schema = z.object({ ok: z.literal(true) })
    await expect(readJson(Response.json({ ok: false }), schema, 'Test')).rejects.toThrow(msg('err.badShape', { label: 'Test' }))
    await expect(readJson(new Response('<html>'), schema, 'Test')).rejects.toThrow(msg('err.notJson', { label: 'Test' }))
    await expect(readJson(Response.json({ ok: true }), schema, 'Test')).resolves.toEqual({ ok: true })
  })
})
