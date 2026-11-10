// "Tüm verilerimi sil": Prism'in kendi dosyaları (shared/userdata.ts) verilen klasörlerden silinir. Key ve geçmiş
// gibi içerikler silinmeden önce sıfırlarla ezilir (vault.ts wipeFile). Kısmi silme sessiz geçmez: silinemeyen ya da
// silindikten sonra hâlâ duran her dosyanın adı döner (adlar sabittir; içerik ya da key asla dönmez).
import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { isOwnDataFile } from '@shared/userdata'
import { logWarn } from './log'
import { wipeFile } from './vault'

function ownFiles(dir: string): string[] {
  return readdirSync(dir).filter(isOwnDataFile)
}

/** Silinemeyen dosyaların adlarını döndürür; boş dizi her şeyin silindiği anlamına gelir. */
export function wipeOwnData(dirs: readonly string[]): string[] {
  const failed = new Set<string>()
  for (const dir of new Set(dirs)) {
    if (!existsSync(dir)) continue
    let names: string[]
    try {
      names = ownFiles(dir)
    } catch (e) {
      logWarn('wipe', 'veri klasörü okunamadı', e)
      failed.add(basename(dir))
      continue
    }
    for (const name of names) {
      const path = join(dir, name)
      try {
        const st = lstatSync(path)
        // Bağlantının hedefi ezilmez (klasör dışındaki bir dosyayı sıfırlamasın); yalnızca bağlantı kaldırılır.
        if (st.isSymbolicLink()) rmSync(path, { force: true })
        else if (st.isFile()) wipeFile(path)
        else failed.add(name)
      } catch (e) {
        logWarn('wipe', `${name} silinemedi`, e)
        failed.add(name)
      }
    }
    // Silme sırasında yeniden yazılmış ya da hiç gitmemiş dosya kalmadığını doğrula.
    try {
      for (const name of ownFiles(dir)) failed.add(name)
    } catch (e) {
      logWarn('wipe', 'veri klasörü doğrulanamadı', e)
      failed.add(basename(dir))
    }
  }
  return [...failed]
}
