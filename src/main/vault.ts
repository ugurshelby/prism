// İşletim sisteminin anahtarlığıyla şifreleme (Windows DPAPI, macOS Keychain, Linux Secret Service / KWallet).
// API key'leri ve prompt geçmişi diske yalnızca bu yoldan yazılır. Güvenli depolama yoksa düz metne düşülmez.

import { safeStorage } from 'electron'
import { closeSync, existsSync, fstatSync, fsyncSync, lstatSync, openSync, rmSync, writeSync } from 'node:fs'
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
 * Anahtarlık şu an şifreleyip çözebiliyor mu. Kayıtlı bir dosya çözülemiyorsa bu ayrımı yapar: anahtarlık çalışıyorsa dosya
 * bu sistemde artık geçerli olmayan bir anahtarla yazılmıştır (ör. uygulamanın adı değişince macOS Keychain kaydı da
 * değişir); çalışmıyorsa anahtarlık geçici olarak kilitli ya da yoktur ve dosyaya dokunulmamalıdır.
 */
export function vaultRoundTrips(): boolean {
  if (!vaultState().ok) return false
  // Hata beklenen bir sonuçtur (kilitli anahtarlık): false döner, çağıran dosyayı yerinde bırakır.
  try {
    return safeStorage.decryptString(safeStorage.encryptString('prism-check')) === 'prism-check'
  } catch {
    return false
  }
}

/**
 * Dosyanın içeriğini silmeden önce sıfırlarla ezer. SSD ve kopyala-yaz dosya sistemlerinde eski bloklar
 * yine kalabilir; bu, düz metin dosyanın olağan yollarla geri okunmasını önlemek içindir.
 */
export function wipeFile(path: string) {
  if (!existsSync(path)) return
  // Sembolik ya da çoklu bağlantılı dosya ezilmez (klasör dışındaki aynı dosyayı sıfırlamasın); yalnızca bağlantı kaldırılır.
  const link = lstatSync(path)
  if (link.isSymbolicLink() || !link.isFile() || link.nlink > 1) return rmSync(path, { force: true })
  const fd = openSync(path, 'r+')
  try {
    const st = fstatSync(fd)
    // lstat ile open arasında dosya değiştirildiyse ezilmez.
    if (st.ino !== link.ino || st.nlink > 1) {
      closeSync(fd)
      return rmSync(path, { force: true })
    }
    const size = st.size
    const zeros = Buffer.alloc(Math.min(size, 1 << 20))
    for (let pos = 0; pos < size; pos += zeros.length) writeSync(fd, zeros, 0, Math.min(zeros.length, size - pos), pos)
    // Sıfırlar silmeden önce diske işlensin; yoksa üzerine yazma hiç diske inmeyebilir.
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  rmSync(path, { force: true })
}
