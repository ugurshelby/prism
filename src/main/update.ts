// Güncelleme bildirimi: günde en fazla bir kez GitHub yayın listesine key'siz bakılır, bu ürünün daha yeni sürümü
// varsa arayüze bildirilir. İndirme ve kurulum yok; kullanıcı yayın sayfasını açar.
// Bu yol sağlayıcı istemcilerinden ayrıdır (llm/http.ts'teki key'li izin listesine eklenmez): tek izinli adres
// api.github.com, yalnızca https, yönlendirme yok, kimlik bilgisi ya da çerez gönderilmez.
import { app, shell } from 'electron'
import { PRODUCT } from '@shared/product'
import type { UpdateView } from '@shared/types'
import {
  MAX_RESPONSE_BYTES,
  RELEASES_API_URL,
  ReleaseListSchema,
  UpdateStateSchema,
  checkDue,
  compareVersions,
  newerRelease,
  parseVersion,
  releasePageUrl,
  type UpdateState
} from '@shared/update'
import { getSettings, readUserJson, writeJson } from './config'
import { logWarn } from './log'

const UPDATE_HOST = 'api.github.com'
const TIMEOUT_MS = 10_000
// Saatlik bakış yalnızca "bir gün geçti mi" sorusudur; ağa günde en fazla bir kez çıkılır.
const TICK_MS = 60 * 60 * 1000
const FIRST_TICK_MS = 30_000

let state: UpdateState | null | undefined
let inflight: Promise<UpdateView> | null = null
let onChange: (() => void) | null = null

const loadState = (): UpdateState | null => (state ??= readUserJson('update-state.json', UpdateStateSchema.nullable(), null))

// Kaydedilmiş "en yeni" sürüm, uygulama o sürüme güncellendikten sonra artık bildirilmez.
function stillNewer(version: string): boolean {
  const v = parseVersion(version)
  const cur = parseVersion(app.getVersion())
  return !!v && !!cur && compareVersions(v, cur) > 0
}

export function updateView(): UpdateView {
  const s = loadState()
  const latest = s?.latest && stillNewer(s.latest.version) ? s.latest : null
  return { current: app.getVersion(), enabled: getSettings().updateCheck, checkedAt: s?.checkedAt ?? null, latest }
}

function assertUpdateUrl(raw: string): URL {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.hostname !== UPDATE_HOST || url.port || url.username || url.password) {
    throw new Error('güncelleme adresi izinli değil')
  }
  return url
}

async function fetchReleases() {
  const res = await fetch(assertUpdateUrl(RELEASES_API_URL), {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'prism-update-check' },
    redirect: 'error',
    credentials: 'omit',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return ReleaseListSchema.parse(JSON.parse(await readCapped(res)))
}

// Gövde parça parça okunur ve sınır aşılınca kesilir; content-length olmayan (sıkıştırılmış) yanıt da sınırlıdır.
async function readCapped(res: Response): Promise<string> {
  if (!res.body) throw new Error('yanıt gövdesi yok')
  const reader: ReadableStreamDefaultReader<Uint8Array> = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('yanıt çok büyük')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Yayın listesini getirir ve durumu kaydeder. Ağ ya da biçim hatası kayda geçer ve atılır; eski durum korunur. */
export function checkForUpdate(): Promise<UpdateView> {
  inflight ??= (async () => {
    try {
      const releases = await fetchReleases()
      const next: UpdateState = { checkedAt: Date.now(), latest: newerRelease(releases, PRODUCT.tagPrefix, app.getVersion()) }
      state = next
      // Durum yazılamazsa bildirim yine gösterilir; bir sonraki açılışta denetim yeniden yapılır.
      try {
        writeJson('update-state.json', next)
      } catch (e) {
        logWarn('update', 'güncelleme durumu yazılamadı', e)
      }
      onChange?.()
      return updateView()
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** Bilinen en yeni yayının sayfasını sistem tarayıcısında açar; adres doğrulanmış etiketten kurulur. */
export function openReleasePage(): void {
  const latest = updateView().latest
  const url = latest ? releasePageUrl(latest.tag, PRODUCT.tagPrefix) : null
  if (!url) return logWarn('update', 'açılacak yayın yok')
  shell.openExternal(url).catch((e: unknown) => logWarn('update', 'yayın sayfası açılamadı', e))
}

async function tick() {
  if (!getSettings().updateCheck || !checkDue(loadState()?.checkedAt ?? null, Date.now())) return
  // Otomatik denetimin hatası kullanıcıya gösterilmez; kayda geçer, ertesi saatte yeniden denenir.
  try {
    await checkForUpdate()
  } catch (e) {
    logWarn('update', 'güncelleme denetimi başarısız', e)
  }
}

/**
 * Otomatik denetimi başlatır. Geliştirme sürümü kendiliğinden ağa çıkmaz (sıfır maliyet ve sessiz geliştirme);
 * orada denetim yalnızca arayüzden açıkça istenirse yapılır.
 */
export function startUpdateChecks(changed: () => void) {
  onChange = changed
  if (!app.isPackaged) return
  setTimeout(() => void tick(), FIRST_TICK_MS)
  setInterval(() => void tick(), TICK_MS)
}
