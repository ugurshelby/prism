// Prism Lens plan checker (.work/reports/lens-spec.md §4). Pure: the renderer re-checks after an edit, main re-checks
// every plan that comes back from the renderer before a step is written. No Electron or Node imports.
import { MODELS, surfaceInfo } from './catalog'
import { LENS_LIMITS } from './schemas'
import type { Claim, LensCheck, LensIssue, LensPlan, LensStep, StepId } from './types'

/** Lower-case (Windows and macOS file systems ignore case) and without a trailing '/'. */
export function normalizeClaimPath(path: string): string {
  return path.toLowerCase().replace(/\/+$/, '')
}

const segments = (path: string) => normalizeClaimPath(path).split('/')
// Segment-wise prefix: 'src/ui' is a prefix of 'src/ui/a.ts' but not of 'src/ui-kit/a.ts'.
const isPrefix = (p: string[], q: string[]) => p.length <= q.length && p.every((s, i) => s === q[i])

/** file = file; a file under a dir; a dir inside a dir; resource = resource. A path never overlaps a resource. */
export function claimsOverlap(a: Claim, b: Claim): boolean {
  if (a.kind === 'resource' || b.kind === 'resource') return a.kind === 'resource' && b.kind === 'resource' && a.name === b.name
  const sa = segments(a.path)
  const sb = segments(b.path)
  if (a.kind === 'file' && b.kind === 'file') return isPrefix(sa, sb) && sa.length === sb.length
  if (a.kind === 'dir' && b.kind === 'file') return isPrefix(sa, sb)
  if (a.kind === 'file' && b.kind === 'dir') return isPrefix(sb, sa)
  return isPrefix(sa, sb) || isPrefix(sb, sa)
}

/** DFS over 'after'; returns the cycle as a path (s1 → s2 → s1) for the message, or null. */
export function findCycle(steps: readonly LensStep[]): StepId[] | null {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const state = new Map<StepId, 'open' | 'done'>()
  const stack: StepId[] = []
  const visit = (id: StepId): StepId[] | null => {
    if (state.get(id) === 'done') return null
    if (state.get(id) === 'open') return [...stack.slice(stack.indexOf(id)), id]
    state.set(id, 'open')
    stack.push(id)
    for (const dep of byId.get(id)?.after ?? []) {
      const found = visit(dep)
      if (found) return found
    }
    stack.pop()
    state.set(id, 'done')
    return null
  }
  for (const s of steps) {
    const found = visit(s.id)
    if (found) return found
  }
  return null
}

/** Transitive 'after' for every step. Callers run findCycle first. */
export function ancestors(steps: readonly LensStep[]): Map<StepId, Set<StepId>> {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const memo = new Map<StepId, Set<StepId>>()
  const of = (id: StepId): Set<StepId> => {
    const known = memo.get(id)
    if (known) return known
    const out = new Set<StepId>()
    memo.set(id, out)
    for (const dep of byId.get(id)?.after ?? []) {
      out.add(dep)
      for (const a of of(dep)) out.add(a)
    }
    return out
  }
  for (const s of steps) of(s.id)
  return memo
}

/** Pairs that can run at the same time: neither is an ancestor of the other. */
export function parallelPairs(plan: LensPlan): Array<[StepId, StepId]> {
  const anc = ancestors(plan.steps)
  const pairs: Array<[StepId, StepId]> = []
  plan.steps.forEach((a, i) => {
    for (const b of plan.steps.slice(i + 1)) {
      if (!anc.get(a.id)?.has(b.id) && !anc.get(b.id)?.has(a.id)) pairs.push([a.id, b.id])
    }
  })
  return pairs
}

/** Topological levels: a wave runs in parallel, the next wave after it. Throws on a cycle. */
export function waves(plan: LensPlan): StepId[][] {
  if (findCycle(plan.steps)) throw new Error('plan has a cycle')
  const byId = new Map(plan.steps.map((s) => [s.id, s]))
  const level = new Map<StepId, number>()
  const of = (id: StepId): number => {
    const known = level.get(id)
    if (known !== undefined) return known
    const deps = byId.get(id)?.after ?? []
    const l = deps.length ? Math.max(...deps.map(of)) + 1 : 0
    level.set(id, l)
    return l
  }
  const out: StepId[][] = []
  for (const s of plan.steps) (out[of(s.id)] ??= []).push(s.id)
  return out
}

const shown = (c: Claim) => (c.kind === 'resource' ? c.name : c.path)
// Model text goes into other sessions' prompts in double quotes; a '"' inside would end the quote.
const quoted = (text: string) => `"${text.replaceAll('"', "'")}"`
const unique = <T>(items: T[]): T[] => [...new Set(items)]
const writes = (s: LensStep) => unique(s.claims.filter((c) => c.access === 'write').map(shown))
const reads = (s: LensStep) => unique(s.claims.filter((c) => c.access === 'read').map(shown))

type Relation = 'before' | 'after' | 'parallel'

function relations(plan: LensPlan, stepId: StepId): Map<StepId, Relation> {
  const anc = ancestors(plan.steps)
  const out = new Map<StepId, Relation>()
  for (const o of plan.steps) {
    if (o.id === stepId) continue
    out.set(o.id, anc.get(stepId)?.has(o.id) ? 'before' : anc.get(o.id)?.has(stepId) ? 'after' : 'parallel')
  }
  return out
}

const RELATION_TEXT: Record<Relation, string> = {
  before: 'finishes before you',
  after: 'starts after you finish',
  parallel: 'runs in parallel with you'
}

/** The Coordination section Prism appends to a step's prompt; '' for a single-step plan. */
export function renderCoordination(plan: LensPlan, stepId: StepId): string {
  const me = plan.steps.find((s) => s.id === stepId)
  if (!me || plan.steps.length < 2) return ''
  const rel = relations(plan, stepId)
  const others = plan.steps.filter((s) => s.id !== stepId)
  const lines = [
    '## Coordination',
    `You are session ${me.id} of ${plan.steps.length} in one planned workflow on the same repository. Other sessions:`
  ]
  for (const o of others) {
    const owns = writes(o)
    const surface = surfaceInfo(MODELS[o.model].family, o.surface).label
    lines.push(`- ${o.id} · ${MODELS[o.model].name} · ${surface} · ${RELATION_TEXT[rel.get(o.id) ?? 'parallel']} · ${quoted(o.title)} · owns: ${owns.join(', ') || 'nothing (read only)'}`)
  }
  const mine = writes(me)
  const read = reads(me)
  lines.push(`Your scope: ${mine.length ? `edit only ${mine.join(', ')}.` : 'read only; edit nothing.'}${read.length ? ` You may read ${read.join(', ')}.` : ''}`)
  const owned = (r: Relation) => unique(others.filter((o) => rel.get(o.id) === r).flatMap((o) => writes(o).map((w) => `${w} (${o.id})`)))
  const parallel = owned('parallel')
  const later = owned('after')
  lines.push(
    `Do not edit: ${parallel.join(', ') || 'no files are owned by parallel sessions'}.` +
      (later.length ? ` Files owned by later sessions are also off limits: ${later.join(', ')}.` : '')
  )
  const direct = others.filter((o) => me.after.includes(o.id))
  if (direct.length) {
    lines.push(`Before you start: ${direct.map((o) => `${o.id} finishes before you${o.handoff ? ` and leaves ${quoted(o.handoff)}` : ''}`).join('; ')}.`)
  }
  lines.push("If the task needs a change outside your scope, don't make it: stop and report the file and why.")
  return lines.join('\n')
}

/** Checks that a Coordination section names what the plan requires; guards renderCoordination against drift. */
export function checkCoordination(plan: LensPlan, stepId: StepId, section: string): LensIssue[] {
  if (plan.steps.length < 2) return []
  const rel = relations(plan, stepId)
  const lines = section.split('\n')
  const doNotEdit = lines.find((l) => l.startsWith('Do not edit:')) ?? ''
  const issues: LensIssue[] = []
  const missing = (other: StepId, what: string) =>
    issues.push({ code: 'coordination_missing', severity: 'error', steps: [stepId, other], detail: `${stepId}: coordination misses ${what}` })
  for (const o of plan.steps) {
    const r = rel.get(o.id)
    if (!r || r === 'after') continue
    const line = lines.find((l) => l.startsWith(`- ${o.id} ·`))
    if (!line) missing(o.id, `the line for ${o.id}`)
    if (r === 'parallel') {
      for (const w of writes(o)) if (!doNotEdit.includes(w)) missing(o.id, `"${w}" of ${o.id} in "Do not edit"`)
    } else if (!line?.includes(RELATION_TEXT.before)) {
      missing(o.id, `that ${o.id} finishes before it`)
    }
  }
  return issues
}

const isPathWrite = (c: Claim) => c.access === 'write' && c.kind !== 'resource'

export function checkPlan(plan: LensPlan): LensCheck {
  const issues: LensIssue[] = []
  const add = (code: LensIssue['code'], severity: LensIssue['severity'], steps: StepId[], detail: string) =>
    issues.push({ code, severity, steps, detail })
  const byId = new Map(plan.steps.map((s) => [s.id, s]))

  const cycle = findCycle(plan.steps)
  if (cycle) {
    add('cycle', 'error', unique(cycle), `steps depend on each other: ${cycle.join(' → ')}`)
  } else {
    for (const [a, b] of parallelPairs(plan)) {
      const sa = byId.get(a)
      const sb = byId.get(b)
      if (!sa || !sb) continue
      for (const ca of sa.claims) {
        for (const cb of sb.claims) {
          if (!claimsOverlap(ca, cb)) continue
          if (ca.access === 'write' && cb.access === 'write') add('write_overlap', 'error', [a, b], `${a} and ${b} both edit ${shown(ca)} / ${shown(cb)}`)
          else if (ca.access !== cb.access) add('read_write_overlap', 'warning', [a, b], `${a} and ${b} read and edit ${shown(ca)} / ${shown(cb)} at the same time`)
        }
      }
    }
    for (const wave of waves(plan)) {
      if (wave.length > LENS_LIMITS.parallel) add('too_many_parallel', 'error', wave, `${wave.length} steps run at once; at most ${LENS_LIMITS.parallel}`)
    }
  }

  for (const s of plan.steps) {
    if (plan.steps.length > 1 && s.surface === 'agent' && !s.claims.length) add('agent_step_without_claims', 'error', [s.id], `${s.id} names no files or resources`)
    if (s.surface !== 'agent' && s.claims.some(isPathWrite)) add('non_agent_step_writes', 'error', [s.id], `${s.id} edits files on a ${s.surface} surface`)
  }

  if (plan.gains.includes('separate_review')) {
    const dependedOn = new Set(plan.steps.flatMap((s) => s.after))
    for (const s of plan.steps) {
      if (s.after.length && !dependedOn.has(s.id) && s.claims.some(isPathWrite)) add('review_step_writes', 'warning', [s.id], `review step ${s.id} edits files`)
    }
  }

  if (!cycle && plan.steps.length > 1) {
    for (const s of plan.steps) issues.push(...checkCoordination(plan, s.id, renderCoordination(plan, s.id)))
  }

  return { ok: !issues.some((i) => i.severity === 'error'), issues }
}
