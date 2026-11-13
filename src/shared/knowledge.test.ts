import { describe, expect, it } from 'vitest'
import { isStale, parseCard, type SourcesFile } from './knowledge'

const registry: SourcesFile = {
  version: 1,
  sources: {
    a: { kind: 'doc', title: 'A', publisher: 'P', url: 'https://example.com/a', retrieved: '2026-11-08' },
    b: { kind: 'eval', title: 'B', run: 'baseline', retrieved: '2026-11-08' }
  }
}

const card = (body: string, head = 'kind: model\nverified: 2026-11-08\nsources: a, b') => `---\n${head}\n---\n${body}`

describe('parseCard', () => {
  it('accepts sourced claims and strips markers', () => {
    const p = parseCard(card('# T\n\nIntro:\n- one [s:a]\n- two [s:a, b]\n- three [unverified]'), registry)
    expect(p.issues).toEqual([])
    expect(p.claims).toBe(3)
    expect(p.unverified).toBe(1)
    expect(p.body).toBe('# T\n\nIntro:\n- one\n- two\n- three (unverified)')
  })

  it('flags unsourced claims, unknown and unlisted sources', () => {
    const p = parseCard(card('- bare claim\n- [s:zzz] x', 'kind: model\nverified: 2026-11-08\nsources: a, nope'), registry)
        expect(p.issues.some((i) => i.includes('unsourced'))).toBe(true)
    expect(p.issues.some((i) => i.includes('unknown source: nope'))).toBe(true)
    expect(p.issues.some((i) => i.includes('[s:zzz]'))).toBe(true)
        expect(p.issues.some((i) => i.includes('unused: a'))).toBe(true)
  })

  it('does not count table headers, separators or code blocks as claims', () => {
    const p = parseCard(card('| L | U |\n|---|---|\n| low | x [s:a] |\n```\nnot a claim\n```\n- y [s:b]'), registry)
    expect(p.issues).toEqual([])
    expect(p.claims).toBe(2)
  })

  it('requires front matter and a valid date', () => {
        expect(parseCard('# no meta', registry).issues).toContain('no front matter block')
    expect(parseCard(card('x', 'kind: method\nverified: 2026-13-45\nsources:'), registry).issues.join()).toContain('verified')
  })

  it('lets method cards carry unsourced text', () => {
    expect(parseCard(card('Prism looks at intent.', 'kind: method\nverified: 2026-11-08\nsources:'), registry).issues).toEqual([])
  })

  it('reports stale cards after 90 days', () => {
    const meta = { kind: 'model' as const, verified: '2026-08-01', sources: [] }
    expect(isStale(meta, new Date('2026-11-08'))).toBe(true)
    expect(isStale(meta, new Date('2026-09-01'))).toBe(false)
  })
})
