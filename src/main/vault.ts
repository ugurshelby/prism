// İşletim sisteminin anahtarlığıyla şifreleme (Windows DPAPI, macOS Keychain, Linux Secret Service / KWallet).
// API key'leri ve prompt geçmişi diske yalnızca bu yoldan yazılır. Güvenli depolama yoksa düz metne düşülmez.

import { safeStorage } from 'electron'
import { closeSync, existsSync, fstatSync, fsyncSync, openSync, rmSync, writeSync } from 'node:fs'
import { UserError } from './errors'
import { msg } from '@shared/messages'

export type VaultState = { ok: true } | { ok: false; reason: string }

// Linux'ta anahtarlık yoksa Electron sabit bir parolayla yazar; bu gerçek koruma değil. Yalnızca bilinen anahtarlık
// arka uçları kabul edilir, 'basic_text' ve 'unknown' reddedilir.
const LINUX_KEYRINGS: ReadonlySet<string> = new Set(['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'])

export function vaultState(): VaultState {
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, reason: msg('vault.unavailable') }
  if (process.platform === 'linux' && !LINUX_KEYRINGS.has(safeStorage.getSelectedStorageBackend())) {
    return { ok: false, reason: msg('vault.noKeyring') }
  }
  return { ok: true }
}

export function seal(text: string): Buffer {
  const state = vaultState()
  if (!state.ok) throw new UserError(state.reason)
  return safeStorage.encryptString(text)
}

export function unseal(data: Buffer): string {
  const state = vaultState()
  if (!state.ok) throw new UserError(state.reason)
  return safeStorage.decryptString(data)
}

/**
 * Dosyanın içeriğini silmeden önce sıfırlarla ezer. SSD ve kopyala-yaz dosya sistemlerinde eski bloklar
 * yine kalabilir; bu, düz metin dosyanın olağan yollarla geri okunmasını önlemek içindir.
 */
export function wipeFile(path: string) {
  if (!existsSync(path)) return
  const fd = openSync(path, 'r+')
  try {
    const size = fstatSync(fd).size
    const zeros = Buffer.alloc(Math.min(size, 1 << 20))
    for (let pos = 0; pos < size; pos += zeros.length) writeSync(fd, zeros, 0, Math.min(zeros.length, size - pos), pos)
    // Sıfırlar silmeden önce diske işlensin; yoksa üzerine yazma hiç diske inmeyebilir.
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  rmSync(path, { force: true })
}
