import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { assertProviderUrl, readJson, redact, send } from './http'
import { LlmError } from './types'

const KEY = 'Fake_Test_Value_For_Http_0123456789'

describe('assertProviderUrl', () => {
  it('izinli sağlayıcı sunucularını kabul eder', () => {
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

  it('yabancı sunucuyu, http’yi, kullanıcı bilgisini ve portu reddeder', () => {
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

  it('Vertex konumu adres yoluyla başka sunucuya yönlendiremez', () => {
    // Doğrulanmamış bir konum: https://evil.com/-aiplatform.googleapis.com/... biçimine dönüşürdü.
    expect(() => assertProviderUrl('https://evil.com/-aiplatform.googleapis.com/v1/projects/p')).toThrow(LlmError)
  })
})

describe('redact', () => {
  it('key’in her geçtiği yeri maskeler', () => {
    expect(redact(`a ${KEY} b ${KEY}`, KEY)).toBe('a •••• b ••••')
  })
  it('boş key metni değiştirmez', () => {
    expect(redact('metin', '')).toBe('metin')
  })
})

describe('send', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('izinsiz adrese hiç istek göndermez', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(send('https://evil.com/x', { headers: {} }, { label: 'Test', key: KEY })).rejects.toThrow(LlmError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('yönlendirmeyi kapatır', async () => {
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

  it('hata gövdesindeki key’i mesajdan ayıklar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: `bad key ${KEY}` } }, { status: 418 })))
    const err = await failure(send('https://api.openai.com/v1/x', { headers: {} }, { label: 'OpenAI', key: KEY, attempts: 1 }))
    expect(err.message).not.toContain(KEY)
    expect(err.status).toBe(418)
  })

  it('ağ hatası mesajındaki key’i ayıklar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error(`connect failed ${KEY}`))))
    const err = await failure(send('https://api.openai.com/v1/x', { headers: {} }, { label: 'OpenAI', key: KEY }))
    expect(err.message).not.toContain(KEY)
  })
})

describe('send: tekrar deneme', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('429 sonrası beklemede iptal edilirse hemen durur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '20' } })))
    const ctrl = new AbortController()
    const started = Date.now()
    const p = send('https://api.openai.com/v1/x', { headers: {} }, { label: 'OpenAI', key: KEY, signal: ctrl.signal })
    setTimeout(() => ctrl.abort(), 50)
    await expect(p).rejects.toThrow('İptal edildi.')
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})

describe('readJson', () => {
  it('şemaya uymayan yanıtı açık bir hatayla reddeder', async () => {
    const schema = z.object({ ok: z.literal(true) })
    await expect(readJson(Response.json({ ok: false }), schema, 'Test')).rejects.toThrow(/beklenen biçimde değil/)
    await expect(readJson(new Response('<html>'), schema, 'Test')).rejects.toThrow(/JSON değil/)
    await expect(readJson(Response.json({ ok: true }), schema, 'Test')).resolves.toEqual({ ok: true })
  })
})
