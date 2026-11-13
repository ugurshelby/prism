import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { legacyMacApps, removeLegacyAutostart } from './legacy-files'

const ENTRY = '[Desktop Entry]\nType=Application\nName=Prism\nExec="/opt/Prism/prism" --hidden\nX-GNOME-Autostart-enabled=true\n'
const plist = (id: string) => `<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>${id}</string></dict></plist>`

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prism-legacy-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

// Symlinks need a privilege on Windows; those cases run where the OS allows them.
const canLink = (() => {
  const dir = mkdtempSync(join(tmpdir(), 'prism-link-'))
  try {
    symlinkSync(dir, join(dir, 'l'), 'dir')
    return true
  } catch {
    // No symlink privilege (Windows without developer mode): the symlink tests are skipped.
    return false
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})()

describe('removeLegacyAutostart', () => {
  it('removes the exact 2.x entry and nothing else', () => {
    mkdirSync(join(root, 'autostart'))
    writeFileSync(join(root, 'autostart', 'prism.desktop'), ENTRY)
    writeFileSync(join(root, 'autostart', 'prism-spectrum.desktop'), ENTRY)
    expect(removeLegacyAutostart(root)).toBe(true)
    expect(existsSync(join(root, 'autostart', 'prism.desktop'))).toBe(false)
    expect(existsSync(join(root, 'autostart', 'prism-spectrum.desktop'))).toBe(true)
  })

  it('keeps an edited entry and is a no-op without one', () => {
    expect(removeLegacyAutostart(root)).toBe(false)
    mkdirSync(join(root, 'autostart'))
    writeFileSync(join(root, 'autostart', 'prism.desktop'), ENTRY + 'Comment=mine\n')
    expect(removeLegacyAutostart(root)).toBe(false)
    expect(existsSync(join(root, 'autostart', 'prism.desktop'))).toBe(true)
  })
})

describe('legacyMacApps', () => {
  const bundle = (dir: string, id: string) => {
    mkdirSync(join(dir, 'Prism.app', 'Contents'), { recursive: true })
    writeFileSync(join(dir, 'Prism.app', 'Contents', 'Info.plist'), plist(id))
  }

  it('finds only a 2.x bundle', () => {
    const a = join(root, 'a')
    const b = join(root, 'b')
    bundle(a, 'com.prompter.app')
    bundle(b, 'com.example.prism')
    expect(legacyMacApps([a, b, join(root, 'missing')])).toEqual([join(a, 'Prism.app')])
  })

  it.runIf(canLink)('skips a symlinked folder or bundle', () => {
    const real = join(root, 'real')
    bundle(real, 'com.prompter.app')
    const linkedRoot = join(root, 'linked')
    symlinkSync(real, linkedRoot, 'dir')
    const other = join(root, 'other')
    mkdirSync(other)
    symlinkSync(join(real, 'Prism.app'), join(other, 'Prism.app'), 'dir')
    expect(legacyMacApps([linkedRoot, other])).toEqual([])
  })
})
