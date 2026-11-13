// D6 file checks without Electron, so they can be unit tested: the Prism 2.x artifacts Spectrum replaces on Linux and macOS.
import { lstatSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { isLegacyAutostart, isLegacyBundle } from '@shared/legacy'
import { logWarn } from './log'

const isMissing = (e: unknown) => e instanceof Error && 'code' in e && e.code === 'ENOENT'

// lstat, so a symlink is never followed: 'link' for a symlink, null when missing or unreadable.
function kind(path: string): 'file' | 'dir' | 'link' | 'other' | null {
  try {
    const s = lstatSync(path)
    return s.isSymbolicLink() ? 'link' : s.isFile() ? 'file' : s.isDirectory() ? 'dir' : 'other'
  } catch (e) {
    // Missing is the normal case; anything else is logged and treated as "not there".
    if (!isMissing(e)) logWarn('legacy', `could not inspect ${path}`, e)
    return null
  }
}

/** Linux: removes <config>/autostart/prism.desktop when it is exactly the 2.x entry. */
export function removeLegacyAutostart(configDir: string): boolean {
  if (kind(join(configDir, 'autostart')) !== 'dir') return false
  const file = join(configDir, 'autostart', 'prism.desktop')
  if (kind(file) !== 'file') return false
  try {
    if (!isLegacyAutostart(readFileSync(file, 'utf8'))) return false
    rmSync(file)
    return true
  } catch (e) {
    logWarn('legacy', 'could not remove the 2.x autostart entry', e)
    return false
  }
}

/**
 * macOS: 2.x bundles (Prism.app with CFBundleIdentifier com.prompter.app) in the given Applications folders. Every
 * step of the path is checked with lstat, so a symlinked folder, bundle, Contents or plist is skipped.
 */
export function legacyMacApps(roots: readonly string[]): string[] {
  return roots.flatMap((root) => {
    const app = join(root, 'Prism.app')
    const contents = join(app, 'Contents')
    const plist = join(contents, 'Info.plist')
    if (kind(root) !== 'dir' || kind(app) !== 'dir') return []
    if (kind(contents) !== 'dir' || kind(plist) !== 'file') return []
    try {
      if (isLegacyBundle(readFileSync(plist, 'utf8'))) return [app]
      // Another app named Prism, or a 2.x plist that is not XML: left alone, but visible in the log.
      logWarn('legacy', `${app} is not a Prism 2.x bundle, left alone`)
    } catch (e) {
      logWarn('legacy', `could not read ${plist}`, e)
    }
    return []
  })
}
