import { afterEach, describe, expect, it, vi } from 'vitest'
import { anthropic } from './anthropic'
import { CALL, KEY, SCHEMA, eventsOf, expectNoKey, expectSafeRequest, failure, fixture, json, keyHeaders, quick, sentBody, serve, sse } from './fixtures/kit'

const cred = { key: KEY }
const call = { ...CALL, model: 'claude-opus-5-5' }
const URL_MESSAGES = 'https://api.anthropic.com/v1/messages'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('anthropic: generate', () => {
  it('request shape: allowlisted host, key only in the x-api-key header', async () => {
    const s = serve(() => json(fixture('anthropic-message.json')))
    await anthropic.generate(call, cred)
    const req = s.seen[0]
    if (!req) throw new Error('no request')
    expect(req.url).toBe(URL_MESSAGES)
    expectSafeRequest(req)
    expect(req.headers['x-api-key']).toBe(KEY)
    expect(req.headers['anthropic-version']).toBe('2023-06-01')
    expect(keyHeaders(req)).toEqual(['x-api-key'])
    expect(s.unexpected).toEqual([])
  })

  it('a normal response is converted to text and usage counts', async () => {
    serve(() => json(fixture('anthropic-message.json')))
    const r = await anthropic.generate(call, cred)
    expect(r.text).toBe('Merhaba, bu bir deneme yanıtıdır.')
    expect(r.usage).toEqual({ promptTokens: 120, outputTokens: 34, thoughtsTokens: 0 })
  })

  it('structured response: request carries output_config.format, text arrives as JSON', async () => {
    const s = serve(() => json(fixture('anthropic-message-structured.json')))
    const r = await anthropic.generate({ ...call, schema: SCHEMA }, cred)
    expect(JSON.parse(r.text)).toEqual({ answer: 'evet' })
    expect(sentBody(s.seen[0])).toMatchObject({ output_config: { format: { type: 'json_schema' } } })
  })

  it('401 key rejection is marked auth and not retried', async () => {
    const s = serve(() => json(fixture('anthropic-error-auth.json'), 401))
    const err = await failure(anthropic.generate(call, cred))
    expect(err.kind).toBe('auth')
    expect(err.status).toBe(401)
    expect(s.seen).toHaveLength(1)
    expectNoKey(err)
  })

  it('an error body echoing the key does not leak into the message', async () => {
    serve(() => json({ type: 'error', error: { type: 'authentication_error', message: `invalid x-api-key ${KEY}` } }, 401))
    expectNoKey(await failure(anthropic.generate(call, cred)))
  })

  it('429 is retried up to 3 attempts, then throws a quota error', async () => {
    const s = serve(() => json(fixture('anthropic-error-rate-limit.json'), 429, quick))
    const err = await failure(anthropic.generate(call, cred))
    expect(err.kind).toBe('quota')
    expect(s.seen).toHaveLength(3)
    expectNoKey(err)
  })

  it('a successful response after 429 returns the result', async () => {
    let n = 0
    const s = serve(() => (n++ === 0 ? json(fixture('anthropic-error-rate-limit.json'), 429, quick) : json(fixture('anthropic-message.json'))))
    expect((await anthropic.generate(call, cred)).text).toContain('Merhaba')
    expect(s.seen).toHaveLength(2)
  })

  it('a malformed body does not crash, it throws a typed error', async () => {
    serve(() => json(fixture('anthropic-malformed.json')))
    expect((await failure(anthropic.generate(call, cred))).message).toContain('Anthropic')
    serve(() => new Response('<html>proxy page</html>'))
    expect((await failure(anthropic.generate(call, cred))).message).toContain('Anthropic')
  })

  it('a response cut off at the token limit is an error', async () => {
    serve(() => json({ ...fixture('anthropic-message.json'), stop_reason: 'max_tokens' }))
    await failure(anthropic.generate(call, cred))
  })
})

describe('anthropic: stream', () => {
  it('chunks arrive in order, final text and usage are correct', async () => {
    const s = serve(() => sse(eventsOf('anthropic-stream.json')))
    const chunks: string[] = []
    const r = await anthropic.stream(call, cred, (c) => chunks.push(c))
    expect(chunks).toEqual(['Bir ', 'iki ', 'üç.'])
    expect(r.text).toBe('Bir iki üç.')
    expect(r.usage).toEqual({ promptTokens: 77, outputTokens: 15, thoughtsTokens: 0 })
    expect(sentBody(s.seen[0])).toMatchObject({ stream: true })
  })

  it('an error event in the stream becomes a typed error without the key', async () => {
    serve(() => sse([{ event: 'error', data: { type: 'error', error: { type: 'overloaded_error', message: `busy ${KEY}` } } }]))
    expectNoKey(await failure(anthropic.stream(call, cred, () => undefined)))
  })
})

describe('anthropic: discover', () => {
  it('model list is mapped to id and label; GET, key in header', async () => {
    const s = serve(() => json(fixture('anthropic-models.json')))
    const found = await anthropic.discover(cred)
    expect(found).toEqual([
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' }
    ])
    const req = s.seen[0]
    if (!req) throw new Error('no request')
    expect(req.url.startsWith('https://api.anthropic.com/v1/models')).toBe(true)
    expect(req.method).toBe('GET')
    expectSafeRequest(req)
  })

  it('an invalid key throws an auth error', async () => {
    serve(() => json(fixture('anthropic-error-auth.json'), 401))
    expect((await failure(anthropic.discover(cred))).kind).toBe('auth')
  })
})

describe('fetch mock', () => {
  it('a request to an unknown URL is recorded and rejected', async () => {
    const s = serve((url) => (url === 'https://api.anthropic.com/v1/baska' ? json({}) : undefined))
    const err = await failure(anthropic.generate(call, cred))
    expect(s.unexpected).toEqual([URL_MESSAGES])
    expectNoKey(err)
  })
})
