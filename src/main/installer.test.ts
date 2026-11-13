import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// electron-builder derives the NSIS uninstall GUID as a UUIDv5 of the appId in this namespace (NsisTarget.js).
const NAMESPACE = '50e065bc-3134-11e6-9bab-38c9862bdaf3'

function uuidv5(name: string): string {
  const hash = createHash('sha1').update(Buffer.from(NAMESPACE.replaceAll('-', ''), 'hex')).update(name).digest()
  hash[6] = (hash[6]! & 0x0f) | 0x50
  hash[8] = (hash[8]! & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const build = join(__dirname, '..', '..', 'build')
const yml = (name: string) => readFileSync(join(build, `${name}.yml`), 'utf8')

describe('D6 installer identity', () => {
  it('Spectrum uses the 2.x uninstall GUID so it upgrades Prism 2.x in place', () => {
    expect(uuidv5('com.prism.spectrum')).toBe('eef3af9c-d08b-5a43-915a-7b72cde9672f')
    expect(yml('spectrum')).toContain(`guid: ${uuidv5('com.prompter.app')}`)
  })

  it('Ray keeps its own GUID (it is a new product, not the 2.x continuation)', () => {
    expect(yml('ray')).not.toMatch(/^\s*guid:/m)
  })

  it('the Spectrum deb replaces only the 2.x prism package', () => {
    expect(yml('spectrum')).toContain('- "--replaces=prism (<< 3.0.0)"')
    expect(yml('spectrum')).toContain('- "--conflicts=prism (<< 3.0.0)"')
  })

  it('only the Spectrum installer removes the 2.x login entry, and only when 2.x is gone', () => {
    const nsh = readFileSync(join(build, 'installer.nsh'), 'utf8')
    const start = nsh.indexOf('!macro customInstall')
    const macro = nsh.slice(start, nsh.indexOf('!macroend', start))
    expect(macro).toContain('!if "${APP_ID}" == "com.prism.spectrum"')
    expect(macro.indexOf('FileExists')).toBeGreaterThan(0)
    expect(macro.indexOf('FileExists')).toBeLessThan(macro.indexOf('DeleteRegValue'))
    expect(macro.split('"com.prompter.app"')).toHaveLength(3)
  })
})
