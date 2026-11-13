import { describe, expect, it } from 'vitest'
import { choiceNudge, pathRoots, splitNudge } from './nudge'

const hard = { complexity: 'complex', taskType: 'agentic_coding' } as const

describe('splitNudge', () => {
  const S1 = 'Add a dark-mode toggle in `src/renderer/settings/`. Separately, write docs for `api/openapi.yaml` into docs/api/.'

  it('fires for hard agent work on two or more named folders', () => {
    expect(pathRoots(S1)).toEqual(['src', 'api', 'docs'])
    expect(splitNudge({ prompt: S1, surface: 'agent', analysis: hard })).toBe(true)
  })

  it('fires for three or more enumerated items', () => {
    const list = 'Do these:\n- add login\n- add billing\n1) write the changelog'
    expect(splitNudge({ prompt: list, surface: 'agent', analysis: hard })).toBe(true)
  })

  it('stays quiet off the agent surface, for easy work, other task types or one folder', () => {
    expect(splitNudge({ prompt: S1, surface: 'chat', analysis: hard })).toBe(false)
    expect(splitNudge({ prompt: S1, surface: 'agent', analysis: { ...hard, complexity: 'moderate' } })).toBe(false)
    expect(splitNudge({ prompt: S1, surface: 'agent', analysis: { ...hard, taskType: 'writing' } })).toBe(false)
    expect(splitNudge({ prompt: 'Refactor src/a.ts and src/b.ts', surface: 'agent', analysis: hard })).toBe(false)
  })

  it('ignores URLs', () => {
    expect(pathRoots('See https://example.com/docs/a and http://x.org/b')).toEqual([])
  })
})

describe('choiceNudge', () => {
  const analysis = (model: 'gemini-3.8-flash' | 'claude-opus-5-5', confidence = 0.8, complexity: 'moderate' | 'complex' = 'moderate') => ({
    complexity,
    recommendation: { model, effort: 'medium' as const, confidence, reasoning: '', factors: [] }
  })

  it('pricier when the manual output price is at least twice the recommendation', () => {
    expect(choiceNudge(analysis('gemini-3.8-flash'), 'claude-fable-5-1')).toBe('pricier')
  })

  it('weaker only for hard work and a much cheaper model', () => {
    expect(choiceNudge(analysis('claude-opus-5-5', 0.8, 'complex'), 'claude-haiku-5-5')).toBe('weaker')
    expect(choiceNudge(analysis('claude-opus-5-5', 0.8, 'moderate'), 'claude-haiku-5-5')).toBeNull()
  })

  it('silent for the same model, low confidence or a close price', () => {
    expect(choiceNudge(analysis('claude-opus-5-5'), 'claude-opus-5-5')).toBeNull()
    expect(choiceNudge(analysis('gemini-3.8-flash', 0.5), 'claude-fable-5-1')).toBeNull()
    expect(choiceNudge(analysis('gemini-3.8-flash'), 'gemini-4-hydrogen')).toBeNull()
  })
})

describe('pathRoots false positives (critic round 1)', () => {
  it('ignores and/or, I/O, TCP/IP, client/server, dates and scheme-less hosts', () => {
    expect(pathRoots('and/or I/O TCP/IP client/server 11/13/2026 www.x.com/a')).toEqual([])
  })

  it('keeps folders, files and deeper paths', () => {
    expect(pathRoots('src/ui/ docs/api.md lib/a/b.')).toEqual(['src', 'docs', 'lib'])
  })
})
