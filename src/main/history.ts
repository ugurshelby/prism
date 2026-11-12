// Geçmiş: her analiz bir girdi açar, o analizden yapılan her yazım girdiye eklenir. En yeni en üstte, en fazla LIMIT girdi.
// Promptlar kişisel ya da gizli bilgi içerebilir: geçmiş userData/history.enc içinde işletim sisteminin anahtarlığıyla
// şifreli durur. Anahtarlık yoksa diske hiç yazılmaz, yalnızca bu oturumda bellekte tutulur.

import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, readdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { HistoryEntrySchema } from '@shared/schemas'
import type { Analysis, AnalyzeRequest, GenerateRequest, GenerateResult, HistoryEntry, HistoryList, HistoryStorage } from '@shared/types'
import { getSettings, userFile, writeFileAtomic } from './config'
import { msg } from '@shared/messages'
import { UserError } from './errors'
import { logWarn } from './log'
import { seal, unseal, vaultRoundTrips, vaultState, wipeFile } from './vault'

const LIMIT = 200

let entries: HistoryEntry[] | null = null
let storage: HistoryStorage = 'memory'
// Önceki geçmiş bu sistemde açılamadığı için kenara alındı (bu oturumda arayüz bir kez bildirir).
let reset = false
// Silinen kayıtlar: o sırada süren bir yazım bitince girdiyi yeniden açmasın.
const deleted = new Set<string>()

/** Kayıtlar tek tek doğrulanır; bozuk bir kayıt geri kalan geçmişi düşürmesin. complete: hiçbir kayıt atlanmadı. */
function parseEntries(raw: unknown, source: string): { entries: HistoryEntry[]; complete: boolean } {
  if (!Array.isArray(raw)) {
    logWarn('history', `${source} bir liste değil, yok sayıldı`)
    return { entries: [], complete: false }
  }
  const valid: HistoryEntry[] = []
  let dropped = 0
  for (const item of raw) {
    const parsed = HistoryEntrySchema.safeParse(item)
    if (parsed.success) valid.push(parsed.data)
    else dropped++
  }
  if (dropped) logWarn('history', `${source} içindeki ${dropped} kayıt beklenen biçimde değil, atlandı`)
  return { entries: valid, complete: dropped === 0 }
}

type EncryptedRead = { kind: 'ok'; entries: HistoryEntry[] } | { kind: 'undecryptable' } | { kind: 'unavailable' }

/**
 * Şifreli geçmişi okur. "undecryptable" yalnızca okunan dosyanın çözülemediği durumdur; okuma hatası, ayrıştırma hatası ya
 * da yedek alınamaması "unavailable" sayılır ve dosyaya dokunulmaz (anahtarlık kilitli, disk dolu, dosya kilitli olabilir).
 */
function readEncrypted(path = userFile('history.enc')): EncryptedRead {
  let sealed: Buffer
  try {
    sealed = readFileSync(path)
  } catch (e) {
    logWarn('history', 'şifreli geçmiş okunamadı; dosya yerinde bırakıldı, bu oturumda geçmiş yalnızca bellekte', e)
    return { kind: 'unavailable' }
  }
  let text: string
  try {
    text = unseal(sealed)
  } catch (e) {
    logWarn('history', 'şifreli geçmiş çözülemedi', e)
    return { kind: 'undecryptable' }
  }
  let parsed: { entries: HistoryEntry[]; complete: boolean }
  try {
    parsed = parseEntries(JSON.parse(text) as unknown, 'history.enc')
  } catch (e) {
    logWarn('history', 'şifreli geçmiş beklenen biçimde değil; dosya yerinde bırakıldı, bu oturumda geçmiş yalnızca bellekte', e)
    return { kind: 'unavailable' }
  }
  // Atlanan kayıtlar bir sonraki yazımda kaybolmasın: dosyanın şifreli hâli olduğu gibi yedeklenir.
  if (!parsed.complete) {
    // Yedek alınamazsa (disk dolu, kilit) dosya yerinde kalır ve bu oturum bellek kipinde sürer; kayıt kaybolmaz.
    try {
      copyFileSync(path, `${path}.${Date.now()}.bak`)
      logWarn('history', 'atlanan kayıtlar için şifreli geçmişin yedeği alındı')
    } catch (e) {
      logWarn('history', 'atlanan kayıtlar için yedek alınamadı; bu oturumda geçmiş yalnızca bellekte', e)
      return { kind: 'unavailable' }
    }
  }
  return { kind: 'ok', entries: parsed.entries }
}

/**
 * Daha önce kenara alınmış bir geçmiş bu anahtarla yeniden açılabiliyorsa (ör. Linux'ta masaüstü oturumu ve anahtarlık arka
 * ucu değişip geri döndü) en yenisi geri konur. Geçerli geçmiş boşken denenir; dolu geçmişin üzerine yazılmaz.
 */
function restoreSetAside(): HistoryEntry[] | null {
  const path = userFile('history.enc')
  const dir = dirname(path)
  const candidates = readdirSync(dir)
    .filter((n) => /^history\.enc\.unreadable-\d+$/.test(n))
    .toSorted()
    .toReversed()
  for (const name of candidates) {
    const r = readEncrypted(join(dir, name))
    if (r.kind !== 'ok') continue
    try {
      renameSync(join(dir, name), path)
      logWarn('history', 'kenara alınmış geçmiş bu anahtarla açıldı ve geri kondu')
      return r.entries
    } catch (e) {
      logWarn('history', 'kenara alınmış geçmiş geri konamadı', e)
      return null
    }
  }
  return null
}

const LEGACY_FILES = ['history.json', 'history.v1.json', 'history.json.tmp'] as const

/**
 * Eski sürümlerin düz metin geçmişi bir kez okunur. Geçerli kayıtlar şifreli geçmişe taşınır; dosyaların ham
 * içeriği de (okunamayan ya da biçimi tutmayan kayıtlar kaybolmasın diye) şifreli bir arşive alınır. Ardından
 * düz metin kopyalar sıfırlarla ezilip silinir; diskte düz metin geçmiş kalmaz.
 */
function migrateLegacy(): HistoryEntry[] {
  const present = LEGACY_FILES.filter((name) => existsSync(userFile(name)))
  if (!present.length) return []
  const raw: Record<string, string> = {}
  for (const name of present) raw[name] = readFileSync(userFile(name), 'utf8')
  let migrated: HistoryEntry[] = []
  if (raw['history.json'] !== undefined) {
    try {
      migrated = parseEntries(JSON.parse(raw['history.json']) as unknown, 'history.json').entries
    } catch (e) {
      logWarn('history', 'düz metin geçmiş ayrıştırılamadı; ham hâli şifreli arşive alınıyor', e)
    }
  }
  archiveLegacy(raw)
  for (const name of present) wipeFile(userFile(name))
  return migrated
}

/** Eski dosyaların ham içeriği history.legacy.enc içinde şifreli durur; önceki arşiv varsa üzerine eklenir. */
function archiveLegacy(raw: Record<string, string>) {
  const path = userFile('history.legacy.enc')
  const archive: Record<string, string> = {}
  if (existsSync(path)) {
    try {
      const parsed: unknown = JSON.parse(unseal(readFileSync(path)))
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') archive[k] = v
      }
    } catch (e) {
      // Önceki arşiv açılamıyor (anahtarlık değişmiş olabilir): şifreli hâliyle kenara alınır, yeni arşiv başlar.
      logWarn('history', 'eski geçmiş arşivi açılamadı, yedeklenip yenisi başlatıldı', e)
      try {
        copyFileSync(path, `${path}.${Date.now()}.bak`)
      } catch (backupError) {
        // Yedeksiz üzerine yazılmasın: hata yukarı gider, göç bir sonraki açılışta yeniden denenir.
        logWarn('history', 'eski geçmiş arşivinin yedeği alınamadı', backupError)
        throw backupError
      }
    }
  }
  const stamp = new Date().toISOString()
  for (const [name, text] of Object.entries(raw)) archive[`${stamp} ${name}`] = text
  writeFileAtomic('history.legacy.enc', seal(JSON.stringify(archive)))
}

function load(): HistoryEntry[] {
  if (entries) return entries
  const vault = vaultState()
  if (!vault.ok) {
    logWarn('history', `${vault.reason} Geçmiş yalnızca bu oturumda tutulacak`)
    storage = 'memory'
    return (entries = [])
  }
  const read: EncryptedRead = existsSync(userFile('history.enc')) ? readEncrypted() : { kind: 'ok', entries: [] }
  let current: HistoryEntry[] | null = read.kind === 'ok' ? read.entries : null
  if (read.kind === 'undecryptable' && vaultRoundTrips() && setAsideUnreadable()) {
    // Anahtarlık çalışıyor ama dosya çözülmüyor: başka bir anahtarla yazılmış (ör. 2.x'ten Spectrum'a ad değişimi).
    // Dosya silinmeden kenara alındı; geçmiş baştan başlar ve arayüz bunu söyler (owner kararı, R3 yedek davranışı).
    reset = true
    current = []
  } else if (current !== null && current.length === 0) {
    current = restoreSetAside() ?? current
  }
  if (current === null) {
    // Açılamayan dosyanın üzerine yazılmasın diye bu oturum bellek kipinde sürer.
    storage = 'memory'
    return (entries = [])
  }
  storage = 'encrypted'
  entries = current
  let legacy: HistoryEntry[] = []
  try {
    legacy = migrateLegacy()
  } catch (e) {
    // Arşiv yazılamadıysa eski dosyalar silinmeden yerinde kalır; göç bir sonraki açılışta yeniden denenir.
    logWarn('history', 'eski geçmiş taşınamadı, dosyalar yerinde bırakıldı', e)
  }
  if (legacy.length) {
    const known = new Set(current.map((e) => e.id))
    entries.push(...legacy.filter((e) => !known.has(e.id)))
    persist()
  }
  return entries
}

/** Çözülemeyen şifreli geçmişi `history.enc.unreadable-<zaman>` adıyla kenara alır; başarılıysa true. */
function setAsideUnreadable(): boolean {
  const path = userFile('history.enc')
  try {
    renameSync(path, `${path}.unreadable-${Date.now()}`)
    logWarn('history', 'şifreli geçmiş bu sistemde çözülemiyor; dosya kenara alındı, geçmiş yeniden başlıyor')
    return true
  } catch (e) {
    logWarn('history', 'çözülemeyen geçmiş kenara alınamadı; bu oturumda geçmiş yalnızca bellekte', e)
    return false
  }
}

function persist() {
  const list = load()
  list.sort((a, b) => b.updatedAt - a.updatedAt)
  list.splice(LIMIT)
  if (storage === 'encrypted') writeFileAtomic('history.enc', seal(JSON.stringify(list)))
}

export function listHistory(): HistoryList {
  const list = [...load()].sort((a, b) => b.updatedAt - a.updatedAt)
  return { entries: list, storage: getSettings().saveHistory ? storage : 'off', ...(reset ? { reset: true } : {}) }
}

/** Geçmiş kaydı kapalıysa hiçbir şey yazılmaz ve kimlik dönmez. */
export function recordAnalysis(req: AnalyzeRequest, analysis: Analysis): string | undefined {
  if (!getSettings().saveHistory) return undefined
  const now = Date.now()
  const entry: HistoryEntry = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    prompt: req.prompt,
    surface: req.surface,
    family: req.family,
    analysis,
    answers: [],
    outputs: []
  }
  load().push(entry)
  persist()
  return entry.id
}

export function recordOutput(req: GenerateRequest, result: GenerateResult) {
  if (!getSettings().saveHistory) return
  const now = Date.now()
  if (req.historyId && deleted.has(req.historyId)) return
  // Arayüzün verdiği kimliğe yalnızca aynı promptun girdisiyse güvenilir; başka bir kaydın üzerine yazılmaz.
  let entry = req.historyId ? load().find((e) => e.id === req.historyId && e.prompt === req.prompt) : undefined
  if (!entry) {
    // Analizi silinmiş, hiç kaydedilmemiş ya da eşleşmeyen bir yazım: kendi girdisini yeni bir kimlikle açar.
    entry = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      prompt: req.prompt,
      surface: req.surface,
      family: req.family,
      analysis: {
        intent: req.analysis?.intent ?? '',
        taskType: req.analysis?.taskType ?? 'other',
        complexity: req.analysis?.complexity ?? 'moderate',
        recommendation: { model: req.model, effort: req.effort, confidence: 0, reasoning: '', factors: [] },
        alternatives: [],
        questions: []
      },
      answers: [],
      outputs: []
    }
    load().push(entry)
  }
  entry.answers = req.answers
  entry.outputs.push({ ...result, id: randomUUID(), model: req.model, effort: req.effort, createdAt: now })
  entry.updatedAt = now
  persist()
}

export function deleteHistory(id: string) {
  load()
  // Bellek kipinde diskteki şifreli dosya güncellenemez: silinmiş sanılan kayıt sonraki oturumda geri gelmesin.
  if (storage === 'memory' && existsSync(userFile('history.enc'))) throw new UserError(msg('err.historyLocked'))
  deleted.add(id)
  entries = load().filter((e) => e.id !== id)
  persist()
}

/** "Geçmişi temizle" eski sürümlerden taşınan arşivi ve şifreli yedekleri de siler; diskte prompt kalmaz. */
export function clearHistory() {
  for (const e of load()) deleted.add(e.id)
  entries = []
  persist()
  // Bellek kipinde (anahtarlık kilitli ya da dosya açılamadı) persist diske yazmaz; dosya yine de silinir.
  wipeFile(userFile('history.enc'))
  const archive = userFile('history.legacy.enc')
  wipeFile(archive)
  const dir = dirname(archive)
  for (const name of readdirSync(dir)) {
    if (/^history\.(enc|legacy\.enc)\.\d+\.bak$|^history\.enc\.unreadable-\d+$|^history\.(enc|legacy\.enc)\.[0-9a-f]{12}\.tmp$/.test(name)) wipeFile(join(dir, name))
  }
}
