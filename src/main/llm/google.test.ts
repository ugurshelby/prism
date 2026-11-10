import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiStudio, vertex } from './google'
import { CALL, KEY, SCHEMA, eventsOf, expectNoKey, expectSafeRequest, failure, fixture, json, keyHeaders, quick, sentBody, serve, sse } from './fixtures/kit'

const cred = { key: KEY, project: 'fake-project' }

afterEach(() => {
  vi.unstubAllGlobals()
})

// AI Studio ve Vertex aynı generateContent gövdesini kullanır; uç nokta farklıdır.
const CASES = [
  { name: 'gemini (AI Studio)', client: aiStudio, base: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash' },
  { name: 'vertex', client: vertex, base: 'https://aiplatform.googleapis.com/v1/projects/fake-project/locations/global/publishers/google/models/gemini-3.8-flash' }
] as const

describe.each(CASES)('$name', ({ client, base }) => {
  const call = { ...CALL, model: 'gemini-3.8-flash' }

  it('istek biçimi: izinli sunucu, key yalnızca x-goog-api-key başlığında', async () => {
    const s = serve(() => json(fixture('google-generate.json')))
    await client.generate(call, cred)
    const req = s.seen[0]
    if (!req) throw new Error('istek yok')
    expect(req.url).toBe(`${base}:generateContent`)
    expectSafeRequest(req)
    expect(req.headers['x-goog-api-key']).toBe(KEY)
    expect(keyHeaders(req)).toEqual(['x-goog-api-key'])
    expect(s.unexpected).toEqual([])
  })

  it('normal yanıt: düşünce parçası atılır, metin ve kullanım doğrudur', async () => {
    serve(() => json(fixture('google-generate.json')))
    const r = await client.generate(call, cred)
    expect(r.text).toBe('Merhaba, bu bir deneme yanıtıdır.')
    expect(r.usage).toEqual({ promptTokens: 64, outputTokens: 21, thoughtsTokens: 8 })
  })

  it('şemalı yanıt: istek responseSchema ve JSON mime türü taşır', async () => {
    const s = serve(() => json(fixture('google-generate-structured.json')))
    const r = await client.generate({ ...call, schema: SCHEMA }, cred)
    expect(JSON.parse(r.text)).toEqual({ answer: 'evet' })
    expect(sentBody(s.seen[0])).toMatchObject({ generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' } } })
  })

  it('400 API_KEY_INVALID auth olarak işaretlenir ve yeniden denenmez', async () => {
    const s = serve(() => json(fixture('google-error-auth.json'), 400))
    const err = await failure(client.generate(call, cred))
    expect(err.kind).toBe('auth')
    expect(s.seen).toHaveLength(1)
    expectNoKey(err)
  })

  it('hata gövdesi key yankılasa da mesaja sızmaz', async () => {
    serve(() => json({ error: { code: 403, message: `denied ${KEY}`, status: 'PERMISSION_DENIED' } }, 403))
    expectNoKey(await failure(client.generate(call, cred)))
  })

  it('429 en fazla 3 denemeyle yeniden denenir, sonunda quota hatası verir', async () => {
    const s = serve(() => json(fixture('google-error-rate-limit.json'), 429, quick))
    const err = await failure(client.generate(call, cred))
    expect(err.kind).toBe('quota')
    expect(s.seen).toHaveLength(3)
    expectNoKey(err)
  })

  it('404 not_found olarak işaretlenir', async () => {
    serve(() => json(fixture('google-error-not-found.json'), 404))
    expect((await failure(client.generate(call, cred))).kind).toBe('not_found')
  })

  it('bozuk gövde çökmez, tipli hata verir', async () => {
    serve(() => json(fixture('google-malformed.json')))
    await failure(client.generate(call, cred))
    serve(() => new Response('<html>vekil sayfası</html>'))
    await failure(client.generate(call, cred))
  })

  it('token sınırında kesilen yanıt hata olur', async () => {
    serve(() => json({ candidates: [{ content: { parts: [{ text: 'yarım' }] }, finishReason: 'MAX_TOKENS' }] }))
    await failure(client.generate(call, cred))
  })

  it('akış: parçalar sırayla gelir, son metin ve kullanım doğrudur', async () => {
    const s = serve(() => sse(eventsOf('google-stream.json')))
    const chunks: string[] = []
    const r = await client.stream(call, cred, (c) => chunks.push(c))
    expect(chunks).toEqual(['Bir ', 'iki ', 'üç.'])
    expect(r.text).toBe('Bir iki üç.')
    expect(r.usage).toEqual({ promptTokens: 30, outputTokens: 11, thoughtsTokens: 3 })
    expect(s.seen[0]?.url).toBe(`${base}:streamGenerateContent?alt=sse`)
  })
})

describe('gemini (AI Studio): discover', () => {
  it('yalnızca generateContent destekleyen metin modelleri listelenir', async () => {
    const s = serve(() => json(fixture('google-models.json')))
    expect(await aiStudio.discover(cred)).toEqual([{ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' }])
    const req = s.seen[0]
    if (!req) throw new Error('istek yok')
    expect(req.url.startsWith('https://generativelanguage.googleapis.com/v1beta/models')).toBe(true)
    expect(req.method).toBe('GET')
    expectSafeRequest(req)
  })

  it('geçersiz key auth hatası verir', async () => {
    serve(() => json(fixture('google-error-auth.json'), 400))
    expect((await failure(aiStudio.discover(cred))).kind).toBe('auth')
  })
})

describe('vertex: uç noktalar ve keşif', () => {
  it('bölgesel konum izinli bölgesel sunucuya gider', async () => {
    const s = serve(() => json(fixture('google-generate.json')))
    await vertex.generate({ ...CALL, model: 'gemini-3.8-flash' }, { ...cred, location: 'us-central1' })
    const req = s.seen[0]
    if (!req) throw new Error('istek yok')
    expect(req.url.startsWith('https://us-central1-aiplatform.googleapis.com/v1/projects/fake-project/locations/us-central1/')).toBe(true)
    expectSafeRequest(req)
  })

  it('model başına yoklar: var olan modeller bulunur, 404 elenir, 429 var sayılır', async () => {
    const s = serve((url) => {
      if (url.includes('/models/gemini-4-argon:')) return json(fixture('google-generate.json'))
      if (url.includes('/models/gemini-3.8-flash:')) return json(fixture('google-error-rate-limit.json'), 429)
      return json(fixture('google-error-not-found.json'), 404)
    })
    const found = await vertex.discover(cred)
    expect(found).toEqual([{ id: 'gemini-4-argon' }, { id: 'gemini-3.8-flash' }])
    // 9 yoklama; 429 yoklamada yeniden denenmez (attempts: 1).
    expect(s.seen).toHaveLength(9)
    s.seen.forEach(expectSafeRequest)
    expect(s.unexpected).toEqual([])
  })

  it('key reddi keşfi durdurur ve key sızdırmaz', async () => {
    serve(() => json({ error: { code: 400, message: `API key not valid ${KEY}`, status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }, 400))
    const err = await failure(vertex.discover(cred))
    expect(err.kind).toBe('auth')
    expectNoKey(err)
  })

  it('proje yoksa hiç istek göndermeden hata verir', async () => {
    const s = serve(() => undefined)
    await failure(vertex.discover({ key: KEY }))
    expect(s.seen).toHaveLength(0)
  })
})
