import { describe, expect, it } from 'vitest'
import { loadCases } from './cases'

// Vaka dosyası şemaya uymalı; net vakalar soru beklememeli, yazım vakaları gizli bilgi taşımalı.
describe('eval/cases.json', () => {
  const cases = loadCases(process.cwd())

  it('şemaya uyar ve iki tür de var', () => {
    expect(cases.length).toBeGreaterThanOrEqual(25)
    expect(cases.some((c) => c.style === 'clear')).toBe(true)
    expect(cases.some((c) => c.style === 'messy')).toBe(true)
  })

  it('dağınık vakalar ham promptta somut bilgi verir', () => {
    for (const c of cases.filter((x) => x.style === 'messy')) expect(c.stated.length, c.id).toBeGreaterThan(0)
  })
})
