/**
 * D6: Prism Spectrum replaces the Prism 2.x install. On Windows the installer does it (same uninstall GUID, old login
 * entry removed in build/installer.nsh). macOS and Linux have no installer step that can reach the old app, so the
 * running app handles them: Linux removes the 2.x autostart entry, macOS offers once to move Prism.app to the Trash.
 * Only exact 2.x artifacts are touched (legacy-files.ts); anything that does not match is left alone.
 */
import { dialog, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { LEGACY_OFFER_MARKER } from '@shared/legacy'
import { userFile, writeFileAtomic } from './config'
import { legacyMacApps } from './legacy-files'
import { logWarn } from './log'

const roots = (home: string) => ['/Applications', join(home, 'Applications')]

/** macOS: asks once; the outcome is recorded so a "Keep" is not asked again. */
export async function offerLegacyAppRemoval(home: string, productName: string): Promise<void> {
  if (existsSync(userFile(LEGACY_OFFER_MARKER))) return
  if (!legacyMacApps(roots(home)).length) return
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Move to Trash', 'Keep'],
    defaultId: 1,
    cancelId: 1,
    message: `${productName} replaces Prism 2.x. Move the old Prism app to the Trash?`,
    detail:
      'If Prism 2.x is running, quit it first, and turn off its Launch at login so it does not start from the Trash.\n\n' +
      'Its data folder is not touched. You can put the app back from the Trash.'
  })
  const moved: string[] = []
  const failed: string[] = []
  if (response === 0) {
    // Checked again: the dialog may have been open for a long time and the path may now hold something else.
    for (const app of legacyMacApps(roots(home))) {
      try {
        await shell.trashItem(app)
        moved.push(app)
      } catch (e) {
        logWarn('legacy', 'could not move the 2.x app to the Trash', e)
        failed.push(app)
      }
    }
  }
  if (failed.length) {
    await dialog.showMessageBox({ type: 'warning', message: 'The old Prism app could not be moved to the Trash.', detail: failed.join('\n') })
    return // Not recorded, so the offer comes back on the next start.
  }
  writeFileAtomic(LEGACY_OFFER_MARKER, JSON.stringify({ answered: new Date().toISOString(), keep: response !== 0, moved }))
}
