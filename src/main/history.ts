// History: each analysis opens an entry, and every write made from that analysis is added to it. Newest first, at most LIMIT entries.
// Prompts may contain personal or confidential information: history is kept in userData/history.enc, encrypted with the operating system's
// keyring. If there is no keyring nothing is written to disk; it is held only in memory for this session.

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
// The previous history could not be opened on this system, so it was set aside (the UI reports this once per session).
let reset = false
// Deleted records: so a write still in progress at that moment does not reopen the entry when it finishes.
const deleted = new Set<string>()

/** Records are validated one by one; a corrupt record must not take down the rest of the history. complete: no record was skipped. */
function parseEntries(raw: unknown, source: string): { entries: HistoryEntry[]; complete: boolean } {
  if (!Array.isArray(raw)) {
    logWarn('history', `${source} is not a list, ignored`)
    return { entries: [], complete: false }
  }
  const valid: HistoryEntry[] = []
  let dropped = 0
  for (const item of raw) {
    const parsed = HistoryEntrySchema.safeParse(item)
    if (parsed.success) valid.push(parsed.data)
    else dropped++
  }
  if (dropped) logWarn('history', `${dropped} records in ${source} are not in the expected format, skipped`)
  return { entries: valid, complete: dropped === 0 }
}

type EncryptedRead = { kind: 'ok'; entries: HistoryEntry[] } | { kind: 'undecryptable' } | { kind: 'unavailable' }

/**
 * Reads the encrypted history. "undecryptable" means only that the file that was read could not be decrypted; a read error, a parse error or
 * a failed backup counts as "unavailable" and the file is left alone (the keyring may be locked, the disk full, the file locked).
 */
function readEncrypted(path = userFile('history.enc')): EncryptedRead {
  let sealed: Buffer
  try {
    sealed = readFileSync(path)
  } catch (e) {
    logWarn('history', 'could not read encrypted history; file left in place, history is memory-only this session', e)
    return { kind: 'unavailable' }
  }
  let text: string
  try {
    text = unseal(sealed)
  } catch (e) {
    logWarn('history', 'could not decrypt encrypted history', e)
    return { kind: 'undecryptable' }
  }
  let parsed: { entries: HistoryEntry[]; complete: boolean }
  try {
    parsed = parseEntries(JSON.parse(text) as unknown, 'history.enc')
  } catch (e) {
    logWarn('history', 'encrypted history is not in the expected format; file left in place, history is memory-only this session', e)
    return { kind: 'unavailable' }
  }
  // So skipped records are not lost on the next write: the file is backed up in its encrypted form as is.
  if (!parsed.complete) {
    // If the backup fails (disk full, lock) the file stays in place and this session continues in memory mode; no record is lost.
    try {
      copyFileSync(path, `${path}.${Date.now()}.bak`)
      logWarn('history', 'backed up encrypted history because of skipped records')
    } catch (e) {
      logWarn('history', 'could not back up for skipped records; history is memory-only this session', e)
      return { kind: 'unavailable' }
    }
  }
  return { kind: 'ok', entries: parsed.entries }
}

/**
 * If a history set aside earlier can be opened again with this key (e.g. on Linux the desktop session and keyring backend
 * changed and then changed back), the newest one is restored. Tried when the current history is empty; a non-empty history is never overwritten.
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
      logWarn('history', 'history that was set aside opened with this key and was restored')
      return r.entries
    } catch (e) {
      logWarn('history', 'could not restore the history that was set aside', e)
      return null
    }
  }
  return null
}

const LEGACY_FILES = ['history.json', 'history.v1.json', 'history.json.tmp'] as const

/**
 * The plain-text history of old versions is read once. Valid records move to the encrypted history; the raw
 * contents of the files (so unreadable or malformed records are not lost) also go into an encrypted archive. Then
 * the plain-text copies are overwritten with zeros and deleted; no plain-text history is left on disk.
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
      logWarn('history', 'could not parse plain-text history; raw contents are being archived encrypted', e)
    }
  }
  archiveLegacy(raw)
  for (const name of present) wipeFile(userFile(name))
  return migrated
}

/** The raw contents of old files are kept encrypted in history.legacy.enc; if a previous archive exists, they are appended to it. */
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
      // The previous archive cannot be opened (the keyring may have changed): it is set aside in its encrypted form and a new archive starts.
      logWarn('history', 'could not open old history archive; backed it up and started a new one', e)
      try {
        copyFileSync(path, `${path}.${Date.now()}.bak`)
      } catch (backupError) {
        // It must not be overwritten without a backup: the error propagates and the migration is retried on the next launch.
        logWarn('history', 'could not back up the old history archive', backupError)
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
    logWarn('history', `${vault.reason} History will be kept for this session only`)
    storage = 'memory'
    return (entries = [])
  }
  const read: EncryptedRead = existsSync(userFile('history.enc')) ? readEncrypted() : { kind: 'ok', entries: [] }
  let current: HistoryEntry[] | null = read.kind === 'ok' ? read.entries : null
  if (read.kind === 'undecryptable' && vaultRoundTrips() && setAsideUnreadable()) {
    // The keyring works but the file does not decrypt: it was written with another key (e.g. the rename from 2.x to Spectrum).
    // The file was set aside rather than deleted; history starts from scratch and the UI says so (owner decision, R3 backup behavior).
    reset = true
    current = []
  } else if (current !== null && current.length === 0) {
    current = restoreSetAside() ?? current
  }
  if (current === null) {
    // This session continues in memory mode so the file that cannot be opened is not overwritten.
    storage = 'memory'
    return (entries = [])
  }
  storage = 'encrypted'
  entries = current
  let legacy: HistoryEntry[] = []
  try {
    legacy = migrateLegacy()
  } catch (e) {
    // If the archive could not be written, the old files stay in place undeleted; the migration is retried on the next launch.
    logWarn('history', 'could not migrate old history, files left in place', e)
  }
  if (legacy.length) {
    const known = new Set(current.map((e) => e.id))
    entries.push(...legacy.filter((e) => !known.has(e.id)))
    persist()
  }
  return entries
}

/** Sets aside the encrypted history that cannot be decrypted as `history.enc.unreadable-<time>`; true if successful. */
function setAsideUnreadable(): boolean {
  const path = userFile('history.enc')
  try {
    renameSync(path, `${path}.unreadable-${Date.now()}`)
    logWarn('history', 'encrypted history cannot be decrypted on this system; file set aside, history starts over')
    return true
  } catch (e) {
    logWarn('history', 'could not set aside the undecryptable history; history is memory-only this session', e)
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

/** If history recording is off, nothing is written and no id is returned. */
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
  // An id supplied by the UI is trusted only if it belongs to the same prompt's entry; another record is never overwritten.
  let entry = req.historyId ? load().find((e) => e.id === req.historyId && e.prompt === req.prompt) : undefined
  if (!entry) {
    // A write whose analysis was deleted, never saved or does not match: it opens its own entry with a new id.
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
  // In memory mode the encrypted file on disk cannot be updated: a record thought deleted must not come back in the next session.
  if (storage === 'memory' && existsSync(userFile('history.enc'))) throw new UserError(msg('err.historyLocked'))
  deleted.add(id)
  entries = load().filter((e) => e.id !== id)
  persist()
}

/** "Clear history" also deletes the archive migrated from old versions and the encrypted backups; no prompt is left on disk. */
export function clearHistory() {
  for (const e of load()) deleted.add(e.id)
  entries = []
  persist()
  // In memory mode (keyring locked or file could not be opened) persist does not write to disk; the file is still deleted.
  wipeFile(userFile('history.enc'))
  const archive = userFile('history.legacy.enc')
  wipeFile(archive)
  const dir = dirname(archive)
  for (const name of readdirSync(dir)) {
    if (/^history\.(enc|legacy\.enc)\.\d+\.bak$|^history\.enc\.unreadable-\d+$|^history\.(enc|legacy\.enc)\.[0-9a-f]{12}\.tmp$/.test(name)) wipeFile(join(dir, name))
  }
}
