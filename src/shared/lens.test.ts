import { describe, expect, it } from 'vitest'
import { CHAIN_PLUS_ONE, IMPLEMENT_THEN_REVIEW, PARALLEL_DOCS, SINGLE, read, split, step, write } from './fixtures/lens/plans'
import { checkCoordination, checkPlan, claimsOverlap, findCycle, largestParallelSet, parallelPairs, renderCoordination, waves } from './lens'
import { LensPlanSchema, LensStepRequestSchema } from './schemas'
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

describe('critic round 1 (2026-11-13)', () => {
  const s1 = PARALLEL_DOCS.steps[0]!
  const s2 = PARALLEL_DOCS.steps[1]!
  const withS1 = (patch: object) => ({ ...PARALLEL_DOCS, steps: [{ ...s1, ...patch }, s2] })

  it.each([
    ['line separator', { title: `a${String.fromCodePoint(0x2028)}b` }],
    ['bidi override', { title: `safe${String.fromCodePoint(0x202E)}evil` }],
    ['Unicode tag', { title: 'x\u{E0041}' }],
    ['zero-width space', { handoff: `a${String.fromCodePoint(0x200B)}b` }],
    ['blank title', { title: '   ' }],
    ['bidi in goal', { goal: `do it${String.fromCodePoint(0x2066)}` }],
    ['trailing dot', { claims: [write('src/app.ts.')] }],
    ['trailing space', { claims: [write('src /')] }],
    ['reserved name', { claims: [write('src/nul.txt')] }],
    ['reserved folder', { claims: [write('com1/')] }]
  ])('the schema refuses %s', (_name, patch) => {
    expect(LensPlanSchema.safeParse(withS1(patch)).success).toBe(false)
  })

  it('a multi-line goal with ordinary text is fine', () => {
    expect(LensPlanSchema.safeParse(withS1({ goal: 'Line one.\nLine two: “quoted” – ok.' })).success).toBe(true)
  })

  it('the step request must name a step of its plan', () => {
    const req = { id: 'r1', prompt: 'p', plan: PARALLEL_DOCS, stepId: 's5', answers: [] }
    expect(LensStepRequestSchema.safeParse(req).success).toBe(false)
    expect(LensStepRequestSchema.safeParse({ ...req, stepId: 's2' }).success).toBe(true)
  })

  it('counts steps that can really run together, not wave sizes', () => {
    const plan = split([step('s1', [write('a/')]), step('s2', [write('b/')], ['s1']), step('s3', [write('c/')], ['s1']), step('s4', [write('d/')]), step('s5', [write('e/')])])
    expect(largestParallelSet(plan)).toEqual(['s2', 's3', 's4', 's5'])
    expect(codes(plan)).toContain('too_many_parallel')
  })

  it('a path that is only a substring of another Do-not-edit item is missing', () => {
    const plan = split([step('s1', [write('a/')]), step('s2', [write('src/a/')])])
    const section = renderCoordination(plan, 's2').replace('Do not edit: a/ (s1)', 'Do not edit: src/a/ (s1)')
    expect(checkCoordination(plan, 's2', section).map((i) => i.code)).toEqual(['coordination_missing'])
  })

  it('a title cannot stand in for the relation text', () => {
    const plan = split([step('s1', [write('a/')], [], { title: 'finishes before you' }), step('s2', [write('b/')], ['s1'])])
    const section = renderCoordination(plan, 's2').replace(' · finishes before you · "finishes', ' · runs in parallel with you · "finishes')
    expect(checkCoordination(plan, 's2', section)).not.toEqual([])
  })

  it('later sessions must be listed as off limits', () => {
    const section = renderCoordination(CHAIN_PLUS_ONE, 's1').replace(/\. Files owned by later sessions.*$/m, '.')
    expect(checkCoordination(CHAIN_PLUS_ONE, 's1', section).length).toBeGreaterThan(0)
  })

  it('curly quotes and backticks cannot close the quote', () => {
    const plan = split([step('s1', [write('a/')], [], { title: 'x” `y` «z»' }), step('s2', [write('b/')])])
    expect(renderCoordination(plan, 's2')).toContain(`"x' 'y' 'z'"`)
  })
})
