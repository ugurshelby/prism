// Hand-written Lens plans for the checker tests and the mock bridge (.work/reports/lens-spec.md §4).
import type { Claim, LensPlan, LensStep, StepId } from '../../types'

export const write = (path: string): Claim => (path.endsWith('/') ? { kind: 'dir', path, access: 'write' } : { kind: 'file', path, access: 'write' })
export const read = (path: string): Claim => (path.endsWith('/') ? { kind: 'dir', path, access: 'read' } : { kind: 'file', path, access: 'read' })

export function step(id: StepId, claims: Claim[], after: StepId[] = [], extra: Partial<LensStep> = {}): LensStep {
  return {
    id,
    title: `Step ${id}`,
    goal: `Goal of ${id}.`,
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    surface: 'agent',
    claims,
    after,
    ...extra
  }
}

export const split = (steps: LensStep[], extra: Partial<LensPlan> = {}): LensPlan => ({
  decision: 'split',
  gains: ['independent_parallel'],
  blockers: [],
  reasoning: 'Independent parts with named, disjoint paths.',
  steps,
  ...extra
})

/** S1 of the desk run: settings toggle and API docs, in parallel on disjoint folders. */
export const PARALLEL_DOCS: LensPlan = split([
  step('s1', [write('src/renderer/settings/')], [], { title: 'Dark mode toggle in settings', model: 'claude-opus-5-5' }),
  step('s2', [write('docs/api/'), read('api/openapi.yaml')], [], { title: 'API reference docs', model: 'gpt-6-luna', effort: 'low' })
])

/** S2 of the desk run: implement, then a read-only review in another family. */
export const IMPLEMENT_THEN_REVIEW: LensPlan = split(
  [
    step('s1', [write('server/middleware/ratelimit.ts'), write('server/middleware/ratelimit.test.ts')], [], {
      title: 'Token-bucket rate limiting',
      handoff: 'ratelimit.ts and its tests pass'
    }),
    step('s2', [read('server/middleware/ratelimit.ts'), read('server/middleware/ratelimit.test.ts')], ['s1'], {
      title: 'Security review of the rate limiter',
      model: 'gpt-6.1-sol'
    })
  ],
  { gains: ['separate_review'] }
)

/** A chain s1 → s2 → s3 plus s4 parallel to all of them. */
export const CHAIN_PLUS_ONE: LensPlan = split([
  step('s1', [write('src/a/')]),
  step('s2', [write('src/b/')], ['s1'], { handoff: 'b is wired to a' }),
  step('s3', [write('src/c/')], ['s2']),
  step('s4', [write('docs/')])
])

export const SINGLE: LensPlan = {
  decision: 'single',
  gains: [],
  blockers: ['single_deliverable'],
  reasoning: 'One fix in one module.',
  steps: [step('s1', [])]
}
