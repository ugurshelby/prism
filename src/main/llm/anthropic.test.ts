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
  it('istek biçimi: izinli sunucu, key yalnızca x-api-key başlığında', async () => {
    const s = serve(() => json(fixture('anthropic-message.json')))
    await anthropic.generate(call, cred)
    const req = s.seen[0]
    if (!req) throw new Error('istek yok')
    expect(req.url).toBe(URL_MESSAGES)
    expectSafeRequest(req)
    expect(req.headers['x-api-key']).toBe(KEY)
    expect(req.headers['anthropic-version']).toBe('2023-06-01')
    expect(keyHeaders(req)).toEqual(['x-api-key'])
    expect(s.unexpected).toEqual([])
  })

  it('normal yanıt metne ve kullanım sayılarına çevrilir', async () => {
    serve(() => json(fixture('anthropic-message.json')))
    const r = await anthropic.generate(call, cred)
    expect(r.text).toBe('Merhaba, bu bir deneme yanıtıdır.')
    expect(r.usage).toEqual({ promptTokens: 120, outputTokens: 34, thoughtsTokens: 0 })
  })

  it('şemalı yanıt: istek output_config.format taşır, metin JSON olarak gelir', async () => {
    const s = serve(() => json(fixture('anthropic-message-structured.json')))
    const r = await anthropic.generate({ ...call, schema: SCHEMA }, cred)
    expect(JSON.parse(r.text)).toEqual({ answer: 'evet' })
    expect(sentBody(s.seen[0])).toMatchObject({ output_config: { format: { type: 'json_schema' } } })
  })

  it('401 key reddi auth olarak işaretlenir ve yeniden denenmez', async () => {
    const s = serve(() => json(fixture('anthropic-error-auth.json'), 401))
    const err = await failure(anthropic.generate(call, cred))
    expect(err.kind).toBe('auth')
    expect(err.status).toBe(401)
    expect(s.seen).toHaveLength(1)
    expectNoKey(err)
  })

  it('hata gövdesi key yankılasa da mesaja sızmaz', async () => {
    serve(() => json({ type: 'error', error: { type: 'authentication_error', message: `invalid x-api-key ${KEY}` } }, 401))
    expectNoKey(await failure(anthropic.generate(call, cred)))
  })

  it('429 en fazla 3 denemeyle yeniden denenir, sonunda quota hatası verir', async () => {
    const s = serve(() => json(fixture('anthropic-error-rate-limit.json'), 429, quick))
    const err = await failure(anthropic.generate(call, cred))
    expect(err.kind).toBe('quota')
    expect(s.seen).toHaveLength(3)
    expectNoKey(err)
  })

  it('429 sonrası başarılı yanıt gelirse sonuç döner', async () => {
    let n = 0
    const s = serve(() => (n++ === 0 ? json(fixture('anthropic-error-rate-limit.json'), 429, quick) : json(fixture('anthropic-message.json'))))
    expect((await anthropic.generate(call, cred)).text).toContain('Merhaba')
    expect(s.seen).toHaveLength(2)
  })

  it('bozuk gövde çökmez, tipli hata verir', async () => {
    serve(() => json(fixture('anthropic-malformed.json')))
    expect((await failure(anthropic.generate(call, cred))).message).toContain('Anthropic')
    serve(() => new Response('<html>vekil sayfası</html>'))
    expect((await failure(anthropic.generate(call, cred))).message).toContain('Anthropic')
  })

  it('token sınırında kesilen yanıt hata olur', async () => {
    serve(() => json({ ...fixture('anthropic-message.json'), stop_reason: 'max_tokens' }))
    await failure(anthropic.generate(call, cred))
  })
})

describe('anthropic: stream', () => {
  it('parçalar sırayla gelir, son metin ve kullanım doğrudur', async () => {
    const s = serve(() => sse(eventsOf('anthropic-stream.json')))
    const chunks: string[] = []
    const r = await anthropic.stream(call, cred, (c) => chunks.push(c))
    expect(chunks).toEqual(['Bir ', 'iki ', 'üç.'])
    expect(r.text).toBe('Bir iki üç.')
    expect(r.usage).toEqual({ promptTokens: 77, outputTokens: 15, thoughtsTokens: 0 })
    expect(sentBody(s.seen[0])).toMatchObject({ stream: true })
  })

  it('akış içindeki hata olayı key içermeyen tipli hataya dönüşür', async () => {
    serve(() => sse([{ event: 'error', data: { type: 'error', error: { type: 'overloaded_error', message: `meşgul ${KEY}` } } }]))
    expectNoKey(await failure(anthropic.stream(call, cred, () => undefined)))
  })
})

describe('anthropic: discover', () => {
  it('model listesi kimlik ve etikete çevrilir; GET, key başlıkta', async () => {
    const s = serve(() => json(fixture('anthropic-models.json')))
    const found = await anthropic.discover(cred)
    expect(found).toEqual([
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' }
    ])
    const req = s.seen[0]
    if (!req) throw new Error('istek yok')
    expect(req.url.startsWith('https://api.anthropic.com/v1/models')).toBe(true)
    expect(req.method).toBe('GET')
    expectSafeRequest(req)
  })

  it('geçersiz key auth hatası verir', async () => {
    serve(() => json(fixture('anthropic-error-auth.json'), 401))
    expect((await failure(anthropic.discover(cred))).kind).toBe('auth')
  })
})

describe('fetch taklidi', () => {
  it('bilinmeyen adrese giden istek kayda geçer ve reddedilir', async () => {
    const s = serve((url) => (url === 'https://api.anthropic.com/v1/baska' ? json({}) : undefined))
    const err = await failure(anthropic.generate(call, cred))
    expect(s.unexpected).toEqual([URL_MESSAGES])
    expectNoKey(err)
  })
})
