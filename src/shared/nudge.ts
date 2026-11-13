// Smart Nudge (.work/reports/lens-spec.md §5.5): deterministic hints, no engine call. Pure, shared by the renderer.
import { MODELS, type ModelId, type Surface } from './catalog'
import type { Analysis } from './types'

const SPLIT_TASKS: ReadonlySet<string> = new Set(['agentic_coding', 'frontend_design', 'architecture_design'])
const URL = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi
// Path-like tokens with at least one '/': 'src/ui/', 'docs/api.md'. Filtered below so 'and/or' or a date does not count.
const PATH = /[A-Za-z0-9_@+-][A-Za-z0-9._@+-]*\/[A-Za-z0-9._@+/-]*/g
const ENUMERATED = /^\s*(?:[-*]|\d+[.)])\s+\S/

/** Distinct top-level folders the request names (first path segment, case-folded). */
export function pathRoots(prompt: string): string[] {
  const roots = (prompt.replace(URL, ' ').match(PATH) ?? [])
    .map((p) => p.replace(/\.+$/, ''))
    // A folder ('src/ui/'), a file ('docs/api.md') or a deeper path ('src/a/b'); not 'and/or', 'TCP/IP' or 'client/server'.
    .filter((p) => p.endsWith('/') || /\.[A-Za-z0-9]{1,8}$/.test(p) || p.split('/').filter(Boolean).length >= 3)
    .map((p) => (p.split('/')[0] ?? '').toLowerCase())
  return [...new Set(roots.filter((r) => r && r !== '.' && r !== '..' && !/^\d+$/.test(r)))]
}

const enumeratedItems = (prompt: string) => prompt.split(/\r?\n/).filter((l) => ENUMERATED.test(l)).length

/** Ray and Spectrum: the request looks like independent parallel coding work that Prism Lens could plan as sessions. */
export function splitNudge(input: { prompt: string; surface: Surface; analysis: Pick<Analysis, 'complexity' | 'taskType'> }): boolean {
  const { prompt, surface, analysis } = input
  if (surface !== 'agent') return false
  if (analysis.complexity !== 'complex' && analysis.complexity !== 'frontier') return false
  if (!SPLIT_TASKS.has(analysis.taskType)) return false
  return pathRoots(prompt).length >= 2 || enumeratedItems(prompt) >= 3
}

export type ChoiceNudge = 'pricier' | 'weaker' | null

/**
 * Manual mode: the hand-picked model is clearly pricier than the recommendation, or likely too weak for a hard task.
 * Catalog output price is a stated proxy, not a quality claim; the copy only names Prism's recommendation.
 */
export function choiceNudge(analysis: Pick<Analysis, 'complexity' | 'recommendation'>, manual: ModelId): ChoiceNudge {
  const rec = analysis.recommendation
  if (manual === rec.model || rec.confidence < 0.7) return null
  const picked = MODELS[manual].price.output
  const recommended = MODELS[rec.model].price.output
  // No price to compare (free or unknown): no nudge rather than a misleading one.
  if (!(picked > 0) || !(recommended > 0)) return null
  const ratio = picked / recommended
  if (ratio >= 2) return 'pricier'
  if ((analysis.complexity === 'complex' || analysis.complexity === 'frontier') && ratio <= 0.25) return 'weaker'
  return null
}
