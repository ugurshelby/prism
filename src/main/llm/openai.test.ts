import { afterEach, describe, expect, it, vi } from 'vitest'
import { openai, xai } from './openai'
import { CALL, KEY, SCHEMA, eventsOf, expectNoKey, expectSafeRequest, failure, fixture, json, keyHeaders, quick, sentBody, serve, sse } from './fixtures/kit'

const cred = { key: KEY }

afterEach(() => {
  vi.unstubAllGlobals()
})

// OpenAI and xAI use the same Responses API shape; only the host, system role and error bodies differ.
const CASES = [
  { name: 'openai', client: openai, model: 'gpt-6.1-sol', url: 'https://api.openai.com/v1/responses', role: 'developer', auth: 'openai-error-auth.json', authStatus: 401 },
  { name: 'xai', client: xai, model: 'grok-4.7', url: 'https://api.x.ai/v1/responses', role: 'system', auth: 'grok-error-auth.json', authStatus: 400 }
] as const

describe.each(CASES)('$name', ({ client, model, url, role, auth, authStatus }) => {
  const call = { ...CALL, model }

  it('request shape: allowlisted host, key only in the Authorization header', async () => {
    const s = serve(() => json(fixture('openai-response.json')))
    await client.generate(call, cred)
    const req = s.seen[0]
    if (!req) throw new Error('no request')
    expect(req.url).toBe(url)
    expectSafeRequest(req)
    expect(req.headers['authorization']).toBe(`Bearer ${KEY}`)
    expect(keyHeaders(req)).toEqual(['authorization'])
    expect(sentBody(req)).toMatchObject({ input: [{ role }, { role: 'user' }], store: false })
    expect(s.unexpected).toEqual([])
  })

  it('a normal response is converted to text and usage counts', async () => {
    serve(() => json(fixture('openai-response.json')))
    const r = await client.generate(call, cred)
    expect(r.text).toBe('Merhaba, bu bir deneme yanıtıdır.')
    expect(r.usage).toEqual({ promptTokens: 90, outputTokens: 60, thoughtsTokens: 25 })
  })

  it('structured response: request carries text.format.json_schema', async () => {
    const s = serve(() => json(fixture('openai-response-structured.json')))
    const r = await client.generate({ ...call, schema: SCHEMA }, cred)
    expect(JSON.parse(r.text)).toEqual({ answer: 'evet' })
    expect(sentBody(s.seen[0])).toMatchObject({ text: { format: { type: 'json_schema', strict: true } } })
  })

  it('key rejection is marked auth and not retried', async () => {
    const s = serve(() => json(fixture(auth), authStatus))
    const err = await failure(client.generate(call, cred))
    expect(err.kind).toBe('auth')
    expect(s.seen).toHaveLength(1)
    expectNoKey(err)
  })

  it('an error body echoing the key does not leak into the message', async () => {
    serve(() => json({ error: { message: `Incorrect API key provided: ${KEY}` } }, 401))
    expectNoKey(await failure(client.generate(call, cred)))
  })

  it('429 is retried up to 3 attempts, then throws a quota error', async () => {
    const s = serve(() => json(fixture('openai-error-rate-limit.json'), 429, quick))
    const err = await failure(client.generate(call, cred))
    expect(err.kind).toBe('quota')
    expect(s.seen).toHaveLength(3)
    expectNoKey(err)
  })

  it('a malformed body does not crash, it throws a typed error', async () => {
    serve(() => json(fixture('openai-malformed.json')))
    await failure(client.generate(call, cred))
    serve(() => new Response('<html>proxy page</html>'))
    await failure(client.generate(call, cred))
  })

  it('incomplete and failed responses are errors', async () => {
    serve(() => json({ ...fixture('openai-response.json'), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }))
    await failure(client.generate(call, cred))
    serve(() => json({ ...fixture('openai-response.json'), status: 'failed', error: { message: `broke ${KEY}` } }))
    expectNoKey(await failure(client.generate(call, cred)))
  })

  it('stream: chunks arrive in order, final text and usage are correct', async () => {
    const s = serve(() => sse(eventsOf('openai-stream.json')))
    const chunks: string[] = []
    const r = await client.stream(call, cred, (c) => chunks.push(c))
    expect(chunks).toEqual(['Bir ', 'iki ', 'üç.'])
    expect(r.text).toBe('Bir iki üç.')
    expect(r.usage).toEqual({ promptTokens: 55, outputTokens: 12, thoughtsTokens: 4 })
    expect(sentBody(s.seen[0])).toMatchObject({ stream: true })
  })

  it('an error event in the stream becomes a typed error without the key', async () => {
    serve(() => sse([{ event: 'error', data: { type: 'error', message: `busy ${KEY}` } }]))
    expectNoKey(await failure(client.stream(call, cred, () => undefined)))
  })
})

describe('discover', () => {
  it('openai: text models only, sorted newest to oldest', async () => {
    const s = serve(() => json(fixture('openai-models.json')))
    expect(await openai.discover(cred)).toEqual([{ id: 'gpt-6.1-sol' }, { id: 'gpt-6-luna' }])
    const req = s.seen[0]
    if (!req) throw new Error('no request')
    expect(req.url).toBe('https://api.openai.com/v1/models')
    expect(req.method).toBe('GET')
    expectSafeRequest(req)
  })

  it('xai: grok models, image and foreign models are dropped', async () => {
    const s = serve(() => json(fixture('grok-models.json')))
    expect(await xai.discover(cred)).toEqual([{ id: 'grok-4.7' }, { id: 'grok-4.3' }])
    expect(s.seen[0]?.url).toBe('https://api.x.ai/v1/models')
  })

  it('an invalid key throws an auth error', async () => {
    serve(() => json(fixture('openai-error-auth.json'), 401))
    expect((await failure(openai.discover(cred))).kind).toBe('auth')
  })
})

describe('fetch mock', () => {
  it('a request to an unknown URL is recorded and rejected', async () => {
    const s = serve(() => undefined)
    const err = await failure(openai.generate({ ...CALL, model: 'gpt-6.1-sol' }, cred))
    expect(s.unexpected).toEqual(['https://api.openai.com/v1/responses'])
    expectNoKey(err)
  })
})
