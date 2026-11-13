// "Delete all my data": Prism's own files (shared/userdata.ts) are deleted from the given folders. Contents such as keys and history
// are overwritten with zeros before deletion (vault.ts wipeFile). A partial wipe is never silent: the name of every file that could not be deleted or
// is still present after deletion is returned (names are fixed; contents or keys are never returned).
import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { isOwnDataFile } from '@shared/userdata'
import { logWarn } from './log'
import { wipeFile } from './vault'

function ownFiles(dir: string): string[] {
  return readdirSync(dir).filter(isOwnDataFile)
}

/** Returns the names of files that could not be deleted; an empty array means everything was deleted. */
export function wipeOwnData(dirs: readonly string[]): string[] {
  const failed = new Set<string>()
  for (const dir of new Set(dirs)) {
    if (!existsSync(dir)) continue
    let names: string[]
    try {
      names = ownFiles(dir)
    } catch (e) {
      logWarn('wipe', 'could not read data folder', e)
      failed.add(basename(dir))
      continue
    }
    for (const name of names) {
      const path = join(dir, name)
      try {
        const st = lstatSync(path)
        // The link's target is not overwritten (so a file outside the folder is not zeroed); only the link is removed.
        // A file with several links is not overwritten either: that would zero the same file outside the folder too.
        if (st.isSymbolicLink() || (st.isFile() && st.nlink > 1)) rmSync(path, { force: true })
        else if (st.isFile()) wipeFile(path)
        else failed.add(name)
      } catch (e) {
        logWarn('wipe', `${name} silinemedi`, e)
        failed.add(name)
      }
    }
    // Verify that no file was rewritten during deletion or never went away.
    try {
      for (const name of ownFiles(dir)) failed.add(name)
    } catch (e) {
      logWarn('wipe', 'could not verify data folder', e)
      failed.add(basename(dir))
    }
  }
  return [...failed]
}
