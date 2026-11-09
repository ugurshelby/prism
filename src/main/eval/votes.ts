// Jüri oylarını birleştirme (saf; testte Electron gerektirmez).

export type Juror = 'gemini' | 'deepseek'

export interface PairVerdict {
  winner: 'A' | 'B' | 'tie'
  score_a: number
  score_b: number
  reason: string
}

/** Bir oy: hangi jüri üyesi, hangi sıra (prismFirst: A = Prism) ve kararı. */
export interface Vote {
  juror: Juror
  prismFirst: boolean
  verdict: PairVerdict
}

/**
 * Oyları birleştirir. Her oy Prism için +1, karşı taraf için -1, beraberlik 0. Net oran ≥ 0.5 kazanç, ≤ -0.5 kayıp.
 * Tek jüri üyesi ve iki sırada bu, eski kurala denk düşer: iki sıra da aynı tarafı seçerse sonuç, aksi hâlde beraberlik.
 */
export function combineVotes(votes: Vote[]) {
  const sides = votes.map((v) => (v.verdict.winner === 'tie' ? 0 : (v.verdict.winner === 'A') === v.prismFirst ? 1 : -1))
  const net = sides.reduce<number>((s, x) => s + x, 0) / (votes.length || 1)
  const outcome: 'win' | 'tie' | 'loss' = net >= 0.5 ? 'win' : net <= -0.5 ? 'loss' : 'tie'
  const deltas = votes.map((v) => (v.prismFirst ? v.verdict.score_a - v.verdict.score_b : v.verdict.score_b - v.verdict.score_a))
  const scoreDelta = deltas.reduce((s, x) => s + x, 0) / (deltas.length || 1)
  return { outcome, scoreDelta }
}
