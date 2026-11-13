import { describe, expect, it } from 'vitest'
import { CHAIN_PLUS_ONE, IMPLEMENT_THEN_REVIEW, PARALLEL_DOCS, SINGLE, read, split, step, write } from './fixtures/lens/plans'
import { checkCoordination, checkPlan, claimsOverlap, findCycle, parallelPairs, renderCoordination, waves } from './lens'
import { LensPlanSchema } from './schemas'
import type { LensPlan } from './types'

const codes = (plan: LensPlan) => checkPlan(plan).issues.map((i) => i.code)

describe('checkPlan', () => {
  it('1. parallel steps on disjoint folders are ok, one wave of two', () => {
    expect(checkPlan(PARALLEL_DOCS)).toEqual({ ok: true, issues: [] })
    expect(waves(PARALLEL_DOCS)).toEqual([['s1', 's2']])
  })

  it('2. a file inside a folder another parallel step writes is an overlap', () => {
    const plan = split([step('s1', [write('src/app.ts')]), step('s2', [write('src/')])])
    expect(checkPlan(plan).ok).toBe(false)
    expect(codes(plan)).toContain('write_overlap')
  })

  it('3. overlap ignores case', () => {
    expect(claimsOverlap(write('SRC/App.ts'), write('src/app.ts'))).toBe(true)
  })

  it('4. prefixes compare by segment, not by string', () => {
    expect(claimsOverlap(write('src/ui/'), write('src/ui-kit/'))).toBe(false)
    expect(claimsOverlap(write('src/ui/'), write('src/ui/button.tsx'))).toBe(true)
  })

  it('5. resources overlap by name and never with a path', () => {
    const db = { kind: 'resource', name: 'db:schema', access: 'write' } as const
    expect(claimsOverlap(db, { ...db })).toBe(true)
    expect(claimsOverlap(db, write('db/'))).toBe(false)
  })

  it('6. the same file in sequence is fine', () => {
    const plan = split([step('s1', [write('src/app.ts')]), step('s2', [write('src/app.ts')], ['s1'])])
    expect(checkPlan(plan).ok).toBe(true)
  })

  it('7. parallel pairs of a chain plus one free step are exactly the pairs with s4', () => {
    expect(parallelPairs(CHAIN_PLUS_ONE)).toEqual([
      ['s1', 's4'],
      ['s2', 's4'],
      ['s3', 's4']
    ])
    expect(waves(CHAIN_PLUS_ONE)).toEqual([['s1', 's4'], ['s2'], ['s3']])
  })

  it('8. a cycle is an error with its path, and waves are not computed', () => {
    const plan = split([step('s1', [write('a/')], ['s2']), step('s2', [write('b/')], ['s1'])])
    expect(findCycle(plan.steps)).toEqual(['s1', 's2', 's1'])
    const check = checkPlan(plan)
    expect(check.ok).toBe(false)
    expect(check.issues.map((i) => i.code)).toEqual(['cycle'])
    expect(() => waves(plan)).toThrow()
  })

  it('9. four steps in one wave are too many', () => {
    const plan = split([step('s1', [write('a/')]), step('s2', [write('b/')]), step('s3', [write('c/')]), step('s4', [write('d/')])])
    expect(codes(plan)).toContain('too_many_parallel')
  })

  it('10. reading a file a parallel step writes is a warning only', () => {
    const plan = split([step('s1', [write('src/app.ts')]), step('s2', [write('docs/'), read('src/app.ts')])])
    const check = checkPlan(plan)
    expect(check.ok).toBe(true)
    expect(check.issues.map((i) => i.code)).toEqual(['read_write_overlap'])
  })

  it('11. a chat step that writes a folder is an error', () => {
    const plan = split([step('s1', [write('a/')]), step('s2', [write('b/')], [], { surface: 'chat' })])
    expect(codes(plan)).toContain('non_agent_step_writes')
  })

  it('an agent step without claims in a multi-step plan is an error', () => {
    expect(codes(split([step('s1', [write('a/')]), step('s2', [])]))).toContain('agent_step_without_claims')
  })

  it('a review step that writes files is a warning', () => {
    const plan: LensPlan = { ...IMPLEMENT_THEN_REVIEW, steps: [IMPLEMENT_THEN_REVIEW.steps[0]!, step('s2', [write('notes/')], ['s1'])] }
    expect(codes(plan)).toEqual(['review_step_writes'])
    expect(checkPlan(IMPLEMENT_THEN_REVIEW)).toEqual({ ok: true, issues: [] })
  })
})

describe('coordination', () => {
  it('12. every rendered section passes its own check; s4 names s1, s2 and s3', () => {
    for (const s of CHAIN_PLUS_ONE.steps) expect(checkCoordination(CHAIN_PLUS_ONE, s.id, renderCoordination(CHAIN_PLUS_ONE, s.id))).toEqual([])
    const s4 = renderCoordination(CHAIN_PLUS_ONE, 's4')
    for (const id of ['s1', 's2', 's3']) expect(s4).toContain(`- ${id} ·`)
    expect(s4).toContain('Do not edit: src/a/ (s1), src/b/ (s2), src/c/ (s3).')
  })

  it('names the order, the handoff and the scope', () => {
    const s3 = renderCoordination(CHAIN_PLUS_ONE, 's3')
    expect(s3).toContain('You are session s3 of 4')
    expect(s3).toContain('- s1 · Claude Sonnet 5.5 · Claude Code · finishes before you · "Step s1" · owns: src/a/')
    expect(s3).toContain('Before you start: s2 finishes before you and leaves "b is wired to a".')
    expect(s3).toContain('Your scope: edit only src/c/.')
    const s1 = renderCoordination(CHAIN_PLUS_ONE, 's1')
    expect(s1).toContain('Files owned by later sessions are also off limits: src/b/ (s2), src/c/ (s3).')
  })

  it('quotes model text without breaking out of the quotes', () => {
    const plan = split([step('s1', [write('a/')], [], { title: 'Say "hi"' }), step('s2', [write('b/')])])
    expect(renderCoordination(plan, 's2')).toContain(`"Say 'hi'"`)
  })

  it('13. a section missing the Do not edit line or a session line is caught', () => {
    const full = renderCoordination(PARALLEL_DOCS, 's2')
    const noDoNotEdit = full.split('\n').filter((l) => !l.startsWith('Do not edit:')).join('\n')
    expect(checkCoordination(PARALLEL_DOCS, 's2', noDoNotEdit).map((i) => i.steps)).toEqual([['s2', 's1']])
    const noLine = full.split('\n').filter((l) => !l.startsWith('- s1 ·')).join('\n')
    expect(checkCoordination(PARALLEL_DOCS, 's2', noLine)[0]?.code).toBe('coordination_missing')
  })

  it('14. a single plan has no section and needs no claims', () => {
    expect(renderCoordination(SINGLE, 's1')).toBe('')
    expect(checkPlan(SINGLE)).toEqual({ ok: true, issues: [] })
  })
})

describe('15. LensPlanSchema', () => {
  const ok = PARALLEL_DOCS
  const s1 = ok.steps[0]!
  const s2 = ok.steps[1]!
  const bad: Array<[string, unknown]> = [
    ['duplicate id', { ...ok, steps: [s1, { ...s2, id: 's1' }] }],
    ['ids out of order', { ...ok, steps: [{ ...s1, id: 's2' }, { ...s2, id: 's1' }] }],
    ['self dependency', { ...ok, steps: [s1, { ...s2, after: ['s2'] }] }],
    ['unknown dependency', { ...ok, steps: [s1, { ...s2, after: ['s5'] }] }],
    ['split with one step', { ...ok, steps: [s1] }],
    ['single with two steps', { ...ok, decision: 'single' }],
    ['../x', { ...ok, steps: [{ ...s1, claims: [write('../x')] }, s2] }],
    ['C:/x', { ...ok, steps: [{ ...s1, claims: [write('C:/x')] }, s2] }],
    ['a\\b', { ...ok, steps: [{ ...s1, claims: [write('a\\b')] }, s2] }],
    ['glob', { ...ok, steps: [{ ...s1, claims: [write('src/*.ts')] }, s2] }],
    ['newline in title', { ...ok, steps: [{ ...s1, title: 'a\nb' }, s2] }],
    ['absolute path', { ...ok, steps: [{ ...s1, claims: [write('/etc/passwd')] }, s2] }]
  ]

  it('accepts the fixtures', () => {
    for (const plan of [PARALLEL_DOCS, IMPLEMENT_THEN_REVIEW, CHAIN_PLUS_ONE, SINGLE]) expect(LensPlanSchema.safeParse(plan).success).toBe(true)
  })

  it.each(bad)('rejects %s', (_name, plan) => {
    expect(LensPlanSchema.safeParse(plan).success).toBe(false)
  })
})
