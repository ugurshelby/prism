// Tüm sağlayıcılar için ortak HTTPS + SSE yardımcıları. Key yalnızca başlıkta ve yalnızca izinli sağlayıcı
// sunucularına gider; hata metinlerinden ayıklanır. Yanıt gövdeleri çağıran tarafta şemayla ayrıştırılır.

import { z } from 'zod'
import { logWarn } from '../log'
import { LlmError, type LlmErrorKind } from './types'

export interface SendOptions {
  label: string
  key: string
  signal?: AbortSignal
  timeoutMs?: number
  /** Toplam deneme sayısı (429 / 5xx için). */
  attempts?: number
  /** Akış yanıtı: zaman aşımı yalnızca başlıklara uygulanır, gövdeyi readSse'nin boşta kalma süresi denetler. */
  stream?: boolean
}

// Key taşıyan istekler yalnızca bu sunuculara gidebilir. Vertex bölgesel uç noktaları <bölge>-aiplatform.googleapis.com biçimindedir.
const HOSTS = new Set(['api.anthropic.com', 'api.openai.com', 'api.x.ai', 'generativelanguage.googleapis.com', 'aiplatform.googleapis.com'])
const VERTEX_REGIONAL = /^[a-z0-9-]{2,40}-aiplatform\.googleapis\.com$/

/** Adres https değilse ya da izinli bir sağlayıcı sunucusu değilse istek hiç gönderilmez. */
export function assertProviderUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new LlmError('Geçersiz sağlayıcı adresi.')
  }
  const host = url.hostname
  const allowed = url.protocol === 'https:' && !url.username && !url.password && !url.port && (HOSTS.has(host) || VERTEX_REGIONAL.test(host))
  if (!allowed) throw new LlmError(`İzin verilmeyen sağlayıcı adresi: ${host}`)
  return url
}

export function redact(text: string, key: string): string {
  return key ? text.split(key).join('••••') : text
}

const ErrorBodySchema = z.object({
  error: z.union([z.string(), z.object({ message: z.string() })]).optional(),
  message: z.string().optional(),
  detail: z.string().optional()
})

function errorMessage(data: unknown): string | undefined {
  const parsed = ErrorBodySchema.safeParse(data)
  if (!parsed.success) return undefined
  const { error, message, detail } = parsed.data
  return (typeof error === 'string' ? error : error?.message) ?? message ?? detail
}

function errorKind(status: number, message: string): LlmErrorKind {
  if (status === 404) return 'not_found'
  // Google AI Studio, Vertex ve xAI geçersiz key'e 401 yerine 400 döndürür.
  if (status === 401 || status === 403 || (status === 400 && /api[ _-]?key/i.test(message))) return 'auth'
  if (status === 429) return 'quota'
  return 'other'
}

function friendly(label: string, status: number, message: string, kind: LlmErrorKind): string {
  if (kind === 'not_found') return `Model bulunamadı ya da erişim yok (404). Ayarlardaki model ID'sini kontrol et. ${message}`
  if (kind === 'auth') return `${label} API key'i reddedildi (${status}). Ayarlardan key'i kontrol et.`
  if (kind === 'quota') return `${label} kotası doldu (429). Biraz sonra tekrar dene.`
  return `${label} ${status}: ${message}`
}

const MAX_ERROR_MESSAGE = 500
/** Akış sırasında bu kadar süre hiç veri gelmezse bağlantı kopmuş sayılır. */
const STREAM_IDLE_MS = 120_000
/** Satır sonu gelmeden biriken akış verisinin üst sınırı; aşılırsa yanıt bozuk sayılır. */
const MAX_SSE_LINE = 1 << 20

/** İptal edilebilir bekleme: kullanıcı iptal ederse tekrar denemeyi beklemeden durur. */
function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new LlmError('İptal edildi.'))
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', stop)
      resolve()
    }, ms)
    const stop = () => {
      clearTimeout(t)
      reject(new LlmError('İptal edildi.'))
    }
    signal?.addEventListener('abort', stop, { once: true })
  })
}

/** Retry-After saniye ya da tarih olabilir; makul olmayan değer yok sayılır (en fazla 30 sn beklenir). */
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
    // Akışta zaman aşımı yalnızca başlıklar gelene kadar geçerlidir; uzun ama akmaya devam eden yazım kesilmez.
    // Akışsız yanıtta gövde de aynı süreye tabidir: başlığı gönderip gövdede takılan sunucu isteği sonsuza asmasın.
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
        // Yönlendirme key'i başka bir sunucuya taşıyabilir; sağlayıcı API'leri yönlendirme yapmaz.
        redirect: 'error',
        signal: AbortSignal.any(signals)
      })
    } catch (e) {
      if (o.signal?.aborted) throw new LlmError('İptal edildi.')
      if (timeout.signal.aborted) throw new LlmError('İstek zaman aşımına uğradı.')
      throw new LlmError(`Ağ hatası: ${redact(e instanceof Error ? e.message : 'bağlantı kurulamadı', o.key)}`)
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
      // Hata gövdesi JSON olmayabilir (ör. vekil sunucu sayfası); o durumda durum metni kullanılır.
      const data: unknown = await res.json().catch(() => null)
      const message = redact(errorMessage(data) ?? res.statusText, o.key).slice(0, MAX_ERROR_MESSAGE)
      const kind = errorKind(res.status, message)
      throw new LlmError(friendly(o.label, res.status, message, kind), res.status, kind)
    }
    return res
  }
  throw new LlmError(`${o.label}: tekrar denemeleri tükendi.`)
}

/** Yanıt gövdesini şemayla ayrıştırır; beklenmeyen biçim açık bir hataya dönüşür. */
export async function readJson<S extends z.ZodType>(res: Response, schema: S, label: string): Promise<z.infer<S>> {
  let data: unknown
  try {
    data = await res.json()
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new LlmError(`${label}: yanıt zaman aşımına uğradı ya da iptal edildi.`)
    throw new LlmError(`${label}: yanıt JSON değil.`)
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new LlmError(`${label}: yanıt beklenen biçimde değil.`)
  return parsed.data
}

/** `data:` satırlarını şemadan geçirip sırayla iletir; şemaya uymayan olay atlanır. */
export async function readSse<S extends z.ZodType>(res: Response, schema: S, onData: (data: z.infer<S>) => void, signal?: AbortSignal) {
  if (!res.body) throw new LlmError('Akış gövdesi yok.')
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
      throw new LlmError('Akışta geçersiz JSON.')
    }
    const parsed = schema.safeParse(json)
    // Sağlayıcılar yeni olay türleri ekleyebilir; tanınmayan olay akışı bozmaz.
    if (parsed.success) onData(parsed.data)
  }
  let idle: ReturnType<typeof setTimeout> | undefined
  const stalled = () =>
    new Promise<never>((_, reject) => {
      idle = setTimeout(() => {
        void reader.cancel()
        reject(new LlmError('Sağlayıcı yanıt akışı durdu (2 dakika veri gelmedi). Tekrar dene.'))
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
      if (buffer.length > MAX_SSE_LINE) throw new LlmError('Akışta beklenmeyen biçimde uzun satır.')
      lines.forEach(handle)
    }
    if (buffer) handle(buffer)
  } catch (e) {
    // Hata hangi yoldan gelirse gelsin bağlantı kapatılır; sağlayıcı boşuna üretmeye (ve ücret yazmaya) devam etmesin.
    reader.cancel().catch((err: unknown) => logWarn('llm', 'akış kapatılamadı', err))
    if (signal?.aborted) throw new LlmError('İptal edildi.')
    if (e instanceof LlmError) throw e
    // Akış okunurken bağlantı koptu: ham DOMException/TypeError arayüze gitmez.
    throw new LlmError(`Yanıt akışı kesildi: ${e instanceof Error ? e.message : 'bilinmeyen hata'}`)
  } finally {
    clearTimeout(idle)
  }
}
