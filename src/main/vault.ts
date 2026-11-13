// Encryption with the operating system's keyring (Windows DPAPI, macOS Keychain, Linux Secret Service / KWallet).
// API keys and prompt history are written to disk only this way. If secure storage is missing, it never falls back to plain text.

import { safeStorage } from 'electron'
import { closeSync, existsSync, fstatSync, fsyncSync, lstatSync, openSync, rmSync, writeSync } from 'node:fs'
import { UserError } from './errors'
import { msg } from '@shared/messages'

export type VaultState = { ok: true } | { ok: false; reason: string }

// On Linux without a keyring Electron writes with a fixed password; that is not real protection. Only known keyring
// backends are accepted; 'basic_text' and 'unknown' are rejected.
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
 * Whether the keyring can currently encrypt and decrypt. This tells apart the case where a saved file cannot be decrypted: if the keyring works, the file
 * was written with a key that is no longer valid on this system (e.g. when the app is renamed the macOS Keychain entry
 * changes too); if it does not work, the keyring is temporarily locked or missing and the file must not be touched.
 */
export function vaultRoundTrips(): boolean {
  if (!vaultState().ok) return false
  // The error is an expected outcome (locked keyring): returns false and the caller leaves the file in place.
  try {
    return safeStorage.decryptString(safeStorage.encryptString('prism-check')) === 'prism-check'
  } catch {
    return false
  }
}

/**
 * Overwrites the file's contents with zeros before deleting. On SSDs and copy-on-write file systems old blocks
 * may still remain; this is to stop a plain-text file from being read back by ordinary means.
 */
export function wipeFile(path: string) {
  if (!existsSync(path)) return
  // A symlinked or multiply-linked file is not overwritten (so it does not zero the same file outside the folder); only the link is removed.
  const link = lstatSync(path)
  if (link.isSymbolicLink() || !link.isFile() || link.nlink > 1) return rmSync(path, { force: true })
  const fd = openSync(path, 'r+')
  try {
    const st = fstatSync(fd)
    // If the file was swapped between lstat and open, it is not overwritten.
    if (st.ino !== link.ino || st.nlink > 1) {
      closeSync(fd)
      return rmSync(path, { force: true })
    }
    const size = st.size
    const zeros = Buffer.alloc(Math.min(size, 1 << 20))
    for (let pos = 0; pos < size; pos += zeros.length) writeSync(fd, zeros, 0, Math.min(zeros.length, size - pos), pos)
    // Flush the zeros to disk before deleting; otherwise the overwrite may never reach the disk.
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  rmSync(path, { force: true })
}
