// Update notice: at most once a day the GitHub release list is checked without a key, and if there is a newer version of this product
// the UI is notified. No download or install; the user opens the release page.
// This path is separate from the provider clients (it is not added to the keyed allowlist in llm/http.ts): the only allowed address is
// api.github.com, https only, no redirects, and no credentials or cookies are sent.
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
// The hourly check is only the question "has a day passed"; the network is hit at most once a day.
const TICK_MS = 60 * 60 * 1000
const FIRST_TICK_MS = 30_000

let state: UpdateState | null | undefined
let inflight: Promise<UpdateView> | null = null
let onChange: (() => void) | null = null

const loadState = (): UpdateState | null => (state ??= readUserJson('update-state.json', UpdateStateSchema.nullable(), null))

// A saved "latest" version is no longer announced after the app has been updated to that version.
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
    throw new Error('update URL is not allowed')
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

// The body is read in chunks and cut off when the limit is exceeded; a response without content-length (compressed) is also bounded.
async function readCapped(res: Response): Promise<string> {
  if (!res.body) throw new Error('response has no body')
  const reader: ReadableStreamDefaultReader<Uint8Array> = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('response too large')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Fetches the release list and saves the state. A network or format error is logged and thrown; the old state is kept. */
export function checkForUpdate(): Promise<UpdateView> {
  inflight ??= (async () => {
    try {
      const releases = await fetchReleases()
      const next: UpdateState = { checkedAt: Date.now(), latest: newerRelease(releases, PRODUCT.tagPrefix, app.getVersion()) }
      state = next
      // If the state cannot be written the notice is still shown; the check is repeated on the next launch.
      try {
        writeJson('update-state.json', next)
      } catch (e) {
        logWarn('update', 'could not write update state', e)
      }
      onChange?.()
      return updateView()
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** Opens the page of the latest known release in the system browser; the address is built from a validated tag. */
export function openReleasePage(): void {
  const latest = updateView().latest
  const url = latest ? releasePageUrl(latest.tag, PRODUCT.tagPrefix) : null
  if (!url) return logWarn('update', 'no release to open')
  shell.openExternal(url).catch((e: unknown) => logWarn('update', 'could not open release page', e))
}

async function tick() {
  if (!getSettings().updateCheck || !checkDue(loadState()?.checkedAt ?? null, Date.now())) return
  // An automatic check's error is not shown to the user; it is logged and retried in the next hour.
  try {
    await checkForUpdate()
  } catch (e) {
    logWarn('update', 'update check failed', e)
  }
}

/**
 * Starts the automatic check. A development build does not go online on its own (zero cost and quiet development);
 * there the check runs only if explicitly requested from the UI.
 */
export function startUpdateChecks(changed: () => void) {
  onChange = changed
  if (!app.isPackaged) return
  setTimeout(() => void tick(), FIRST_TICK_MS)
  setInterval(() => void tick(), TICK_MS)
}
