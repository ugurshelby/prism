import { describe, expect, it } from 'vitest'
import { PROVIDERS } from './catalog'
import { isOwnDataFile } from './userdata'

describe('isOwnDataFile', () => {
  it('matches every file Prism writes, with its temp, backup and quarantine forms', () => {
    for (const name of [
      'settings.json',
      'settings.v2.json',
      'history.enc',
      'history.enc.3.bak',
      'history.legacy.enc.1.bak',
      'history.json.tmp',
      'history.json',
      'history.v1.json',
      'models.json',
      'window-state.json',
      'update-state.json',
      'anthropic.key',
      'vertex.key',
      '.env',
      'settings.json.a1b2c3d4e5f6.tmp',
      'models.json.bozuk-1731200000000',
      'history.enc.unreadable-1731200000000'
    ]) {
      expect(isOwnDataFile(name), name).toBe(true)
    }
  })

  it('covers the key file of every provider in the catalog', () => {
    for (const p of PROVIDERS) expect(isOwnDataFile(`${p}.key`), p).toBe(true)
  })

  it('leaves other files alone', () => {
    for (const name of ['.env.local', 'Cookies', 'Local State', 'Preferences', 'notes.txt', 'xsettings.json', 'settings.json.bak', 'evil.key', '../settings.json']) {
      expect(isOwnDataFile(name), name).toBe(false)
    }
  })
})
