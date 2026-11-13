import { describe, expect, it } from 'vitest'
import { isLegacyAutostart, isLegacyBundle } from './legacy'

// The exact text 2.2.0 wrote for an AppImage and for a deb install.
const entry = (exec: string) => `[Desktop Entry]\nType=Application\nName=Prism\nExec=${exec} --hidden\nX-GNOME-Autostart-enabled=true\n`

describe('isLegacyAutostart', () => {
  it('matches the 2.x entry', () => {
    expect(isLegacyAutostart(entry('"/home/a/Apps/Prism-2.2.0.AppImage"'))).toBe(true)
    expect(isLegacyAutostart(entry('"/opt/Prism/prism"'))).toBe(true)
  })

  it('leaves anything else alone', () => {
    expect(isLegacyAutostart(entry('"/opt/Prism/prism"').replace('Name=Prism', 'Name=Prism Spectrum'))).toBe(false)
    expect(isLegacyAutostart(entry('"/opt/Prism/prism"') + 'Comment=mine\n')).toBe(false)
    expect(isLegacyAutostart(entry('"/opt/Prism/prism"').replace(' --hidden', ''))).toBe(false)
    expect(isLegacyAutostart('[Desktop Entry]\nType=Application\nName=Prism\nExec=/usr/bin/other\n')).toBe(false)
    // Another app that happens to be called Prism and starts hidden.
    expect(isLegacyAutostart(entry('"/usr/bin/other-prism"'))).toBe(false)
  })
})

describe('isLegacyBundle', () => {
  it('matches only the 2.x bundle identifier', () => {
    expect(isLegacyBundle('<key>CFBundleIdentifier</key>\n\t<string>com.prompter.app</string>')).toBe(true)
    expect(isLegacyBundle('<key>CFBundleIdentifier</key><string>com.prism.spectrum</string>')).toBe(false)
    expect(isLegacyBundle('<key>CFBundleName</key><string>com.prompter.app</string>')).toBe(false)
  })
})
