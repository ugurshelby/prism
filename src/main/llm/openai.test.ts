import { afterEach, describe, expect, it, vi } from 'vitest'
import { openai, xai } from './openai'
import { CALL, KEY, SCHEMA, eventsOf, expectNoKey, expectSafeRequest, failure, fixture, json, keyHeaders, quick, sentBody, serve, sse } from './fixtures/kit'

const cred = { key: KEY }

afterEach(() => {
  vi.unstubAllGlobals()
})

// OpenAI ve xAI aynı Responses API biçimini kullanır; yalnızca sunucu, sistem rolü ve hata gövdeleri farklıdır.
const CASES = [
  { name: 'openai', client: openai, model: 'gpt-6.1-sol', url: 'https://api.openai.com/v1/responses', role: 'developer', auth: 'openai-error-auth.json', authStatus: 401 },
  { name: 'xai', client: xai, model: 'grok-4.7', url: 'https://api.x.ai/v1/responses', role: 'system', auth: 'grok-error-auth.json', authStatus: 400 }
] as const

describe.each(CASES)('$name', ({ client, model, url, role, auth, authStatus }) => {
  const call = { ...CALL, model }

  it('istek biçimi: izinli sunucu, key yalnızca Authorization başlığında', async () => {
    const s = serve(() => json(fixture('openai-response.json')))
    await client.generate(call, cred)
    const req = s.seen[0]
    if (!req) throw new Error('istek yok')
    expect(req.url).toBe(url)
    expectSafeRequest(req)
    expect(req.headers['authorization']).toBe(`Bearer ${KEY}`)
    expect(keyHeaders(req)).toEqual(['authorization'])
    expect(sentBody(req)).toMatchObject({ input: [{ role }, { role: 'user' }], store: false })
    expect(s.unexpected).toEqual([])
  })

  it('normal yanıt metne ve kullanım sayılarına çevrilir', async () => {
    serve(() => json(fixture('openai-response.json')))
    const r = await client.generate(call, cred)
    expect(r.text).toBe('Merhaba, bu bir deneme yanıtıdır.')
    expect(r.usage).toEqual({ promptTokens: 90, outputTokens: 60, thoughtsTokens: 25 })
  })

  it('şemalı yanıt: istek text.format.json_schema taşır', async () => {
    const s = serve(() => json(fixture('openai-response-structured.json')))
    const r = await client.generate({ ...call, schema: SCHEMA }, cred)
    expect(JSON.parse(r.text)).toEqual({ answer: 'evet' })
    expect(sentBody(s.seen[0])).toMatchObject({ text: { format: { type: 'json_schema', strict: true } } })
  })

  it('key reddi auth olarak işaretlenir ve yeniden denenmez', async () => {
    const s = serve(() => json(fixture(auth), authStatus))
    const err = await failure(client.generate(call, cred))
    expect(err.kind).toBe('auth')
    expect(s.seen).toHaveLength(1)
    expectNoKey(err)
  })

  it('hata gövdesi key yankılasa da mesaja sızmaz', async () => {
    serve(() => json({ error: { message: `Incorrect API key provided: ${KEY}` } }, 401))
    expectNoKey(await failure(client.generate(call, cred)))
  })

  it('429 en fazla 3 denemeyle yeniden denenir, sonunda quota hatası verir', async () => {
    const s = serve(() => json(fixture('openai-error-rate-limit.json'), 429, quick))
    const err = await failure(client.generate(call, cred))
    expect(err.kind).toBe('quota')
    expect(s.seen).toHaveLength(3)
    expectNoKey(err)
  })

  it('bozuk gövde çökmez, tipli hata verir', async () => {
    serve(() => json(fixture('openai-malformed.json')))
    await failure(client.generate(call, cred))
    serve(() => new Response('<html>vekil sayfası</html>'))
    await failure(client.generate(call, cred))
  })

  it('yarım kalan ve başarısız yanıtlar hata olur', async () => {
    serve(() => json({ ...fixture('openai-response.json'), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }))
    await failure(client.generate(call, cred))
    serve(() => json({ ...fixture('openai-response.json'), status: 'failed', error: { message: `kırıldı ${KEY}` } }))
    expectNoKey(await failure(client.generate(call, cred)))
  })

  it('akış: parçalar sırayla gelir, son metin ve kullanım doğrudur', async () => {
    const s = serve(() => sse(eventsOf('openai-stream.json')))
    const chunks: string[] = []
    const r = await client.stream(call, cred, (c) => chunks.push(c))
    expect(chunks).toEqual(['Bir ', 'iki ', 'üç.'])
    expect(r.text).toBe('Bir iki üç.')
    expect(r.usage).toEqual({ promptTokens: 55, outputTokens: 12, thoughtsTokens: 4 })
    expect(sentBody(s.seen[0])).toMatchObject({ stream: true })
  })

  it('akış içindeki hata olayı key içermeyen tipli hataya dönüşür', async () => {
    serve(() => sse([{ event: 'error', data: { type: 'error', message: `meşgul ${KEY}` } }]))
    expectNoKey(await failure(client.stream(call, cred, () => undefined)))
  })
})

describe('discover', () => {
  it('openai: yalnızca metin modelleri, yeniden eskiye sıralı', async () => {
    const s = serve(() => json(fixture('openai-models.json')))
    expect(await openai.discover(cred)).toEqual([{ id: 'gpt-6.1-sol' }, { id: 'gpt-6-luna' }])
    const req = s.seen[0]
    if (!req) throw new Error('istek yok')
    expect(req.url).toBe('https://api.openai.com/v1/models')
    expect(req.method).toBe('GET')
    expectSafeRequest(req)
  })

  it('xai: grok modelleri, görüntü ve yabancı modeller elenir', async () => {
    const s = serve(() => json(fixture('grok-models.json')))
    expect(await xai.discover(cred)).toEqual([{ id: 'grok-4.7' }, { id: 'grok-4.3' }])
    expect(s.seen[0]?.url).toBe('https://api.x.ai/v1/models')
  })

  it('geçersiz key auth hatası verir', async () => {
    serve(() => json(fixture('openai-error-auth.json'), 401))
    expect((await failure(openai.discover(cred))).kind).toBe('auth')
  })
})

describe('fetch taklidi', () => {
  it('bilinmeyen adrese giden istek kayda geçer ve reddedilir', async () => {
    const s = serve(() => undefined)
    const err = await failure(openai.generate({ ...CALL, model: 'gpt-6.1-sol' }, cred))
    expect(s.unexpected).toEqual(['https://api.openai.com/v1/responses'])
    expectNoKey(err)
  })
})
