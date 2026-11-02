// Tüm sağlayıcılar için ortak HTTPS + SSE yardımcıları. Key yalnızca başlıkta gider; hata metinlerinden ayıklanır.

import { LlmError } from './types'

export interface SendOptions {
  label: string
  key: string
  signal?: AbortSignal
  timeoutMs?: number
  /** Toplam deneme sayısı (429 / 5xx için). */
  attempts?: number
}

export function redact(text: string, key: string): string {
  return key && key.length >= 8 ? text.split(key).join('••••') : text
}

function errorMessage(data: any): string | undefined {
  const e = data?.error
  if (typeof e === 'string') return e
  return e?.message ?? data?.message ?? data?.detail
}

function friendly(label: string, status: number, message: string): string {
  if (status === 404) return `Model bulunamadı ya da erişim yok (404). Ayarlardaki model ID'sini kontrol et. ${message}`
  // Google AI Studio ve xAI geçersiz key'e 401 yerine 400 döndürür.
  const badKey = status === 401 || status === 403 || (status === 400 && /api key/i.test(message))
  if (badKey) return `${label} API key'i reddedildi (${status}). Ayarlardan key'i kontrol et.`
  if (status === 429) return `${label} kotası doldu (429). Biraz sonra tekrar dene.`
  return `${label} ${status}: ${message}`
}

export async function send(
  url: string,
  init: { method?: 'GET' | 'POST'; headers: Record<string, string>; body?: unknown },
  o: SendOptions
): Promise<Response> {
  const attempts = o.attempts ?? 3
  for (let attempt = 0; attempt < attempts; attempt++) {
    const signals = [AbortSignal.timeout(o.timeoutMs ?? 240_000)]
    if (o.signal) signals.push(o.signal)
    let res: Response
    try {
      res = await fetch(url, {
        method: init.method ?? 'POST',
        headers: init.headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.any(signals)
      })
    } catch (e: any) {
      if (o.signal?.aborted) throw new LlmError('İptal edildi.')
      if (e?.name === 'TimeoutError') throw new LlmError('İstek zaman aşımına uğradı.')
      throw new LlmError(`Ağ hatası: ${redact(String(e?.message ?? e), o.key)}`)
    }
    if ((res.status === 429 || res.status >= 500) && attempt < attempts - 1) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1) ** 2))
      continue
    }
    if (!res.ok) {
      const data: any = await res.json().catch(() => ({}))
      const message = redact(String(errorMessage(data) ?? res.statusText), o.key)
      throw new LlmError(friendly(o.label, res.status, message), res.status)
    }
    return res
  }
  throw new LlmError(`${o.label}: tekrar denemeleri tükendi.`)
}

/** `data:` satırlarını JSON olarak sırayla iletir. */
export async function readSse(res: Response, onData: (data: any) => void, signal?: AbortSignal) {
  if (!res.body) throw new LlmError('Akış gövdesi yok.')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    onData(JSON.parse(payload))
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      lines.forEach(handle)
    }
    if (buffer) handle(buffer)
  } catch (e) {
    if (signal?.aborted) throw new LlmError('İptal edildi.')
    throw e
  }
}
