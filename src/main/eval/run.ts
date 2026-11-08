// `npm run eval -- --label=<ad> [--only=a,b] [--suite=analysis|full] [--max-usd=4] [--max-tokens=3000000] [--concurrency=3]`
// Yalnızca geliştirme kopyasında, owner key'iyle yerelde çalışır; CI'da asla. Çıktılar .work/reports/eval/runs/ altına,
// key kalıpları maskelenerek yazılır.
import { app } from 'electron'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Effort } from '@shared/catalog'
import type { Analysis } from '@shared/types'
import { analyze } from '../engine/analyze'
import { generatePrompt } from '../engine/generate'
import { cardPaths, parsedCard } from '../engine/knowledge'
import { isStale } from '@shared/knowledge'
import { LlmError, generate } from '../llm'
import { updateSettings } from '../config'
import { credentials, overrideEngine, resolveEngine } from '../providers'
import { loadCases, scoreRecommendation, type EvalCase } from './cases'
import { JUDGE, judgePair, judgeQuestions, simulateAnswers, type PairVerdict } from './judge'
import { BudgetExceeded, Meter, mask } from './meter'

interface CaseResult {
  id: string
  analysis?: Pick<Analysis, 'intent' | 'taskType' | 'complexity' | 'recommendation' | 'questions'>
  rec?: { modelOk: boolean; effortOk: boolean }
  questions?: { recall: number | null; needed: number; useful: number; unneeded: number; asked: number; covered: string[] }
  answers?: { question: string; answer: string }[]
  writing?: {
    prompt: string
    rawSystem?: string
    raw: string
    prism: string
    verdicts: PairVerdict[]
    outcome: 'win' | 'tie' | 'loss'
    scoreDelta: number
  }
  error?: string
}

async function runTarget(meter: Meter, model: string, effort: Effort, system: string, user: string) {
  meter.check()
  try {
    const res = await generate('vertex', { model, effort, system, user, maxTokens: 32_768 }, credentials('vertex'))
    meter.add('target', model, res.usage)
    return res.text
  } catch (e) {
    // Kota, ağ ve zaman aşımı ölçüm hatasıdır (vaka yeniden koşulur); yalnızca modelin kendi başarısızlığı
    // (token sınırında kesilme, boş yanıt) ölçümün parçasıdır ve jüri onu kaybeden sayar.
    if (e instanceof BudgetExceeded || !(e instanceof LlmError) || e.status !== undefined || /zaman aşımı|Ağ hatası/.test(e.message)) throw e
    // Kesilen ya da boş dönen yanıt da faturalanır; kullanımı bilinmediği için en kötü durum (tam çıktı) sayılır.
    meter.add('target-failed', model, { promptTokens: 0, outputTokens: 32_768, thoughtsTokens: 0 })
    return `[hedef yanıt üretemedi: ${e.message}]`
  }
}

/** API yüzeyinde ham yol: kişi Prism olmadan hedef modelden system prompt'u ister, sonra onu kullanır. */
async function rawSystemPrompt(meter: Meter, c: EvalCase & { target: NonNullable<EvalCase['target']> }) {
  return runTarget(meter, c.target.model, c.target.effort, '', c.prompt)
}

/** İki sırayla karşılaştırma: iki sıra da aynı tarafı seçerse kazanç, aksi hâlde beraberlik. */
function combine(first: PairVerdict, second: PairVerdict) {
  // first: A = Prism, B = ham. second: A = ham, B = Prism.
  const prismWins = [first.winner === 'A', second.winner === 'B']
  const rawWins = [first.winner === 'B', second.winner === 'A']
  const outcome: 'win' | 'tie' | 'loss' = prismWins.every(Boolean) ? 'win' : rawWins.every(Boolean) ? 'loss' : 'tie'
  const scoreDelta = (first.score_a - first.score_b + (second.score_b - second.score_a)) / 2
  return { outcome, scoreDelta }
}

async function runCase(c: EvalCase, meter: Meter, suite: 'analysis' | 'full'): Promise<CaseResult> {
  const out: CaseResult = { id: c.id }
  meter.check()
  const a = await analyze({ id: `eval-${c.id}`, prompt: c.prompt, surface: c.surface, family: c.family })
  if (a.usage && a.engine) meter.add('analysis', a.engine.model, a.usage)
  out.analysis = { intent: a.intent, taskType: a.taskType, complexity: a.complexity, recommendation: a.recommendation, questions: a.questions }
  out.rec = scoreRecommendation(c, a.recommendation.model, a.recommendation.effort)

  const qv = await judgeQuestions(meter, c, a.questions)
  const count = (v: string) => qv.verdicts.filter((x) => x.verdict === v).length
  out.questions = {
    recall: c.mustAsk.length ? qv.covered.filter((t) => c.mustAsk.includes(t)).length / c.mustAsk.length : null,
    needed: count('needed'),
    useful: count('useful'),
    unneeded: count('unneeded'),
    asked: a.questions.length,
    covered: qv.covered
  }

  if (suite === 'analysis' || !c.target) return out
  const answers = await simulateAnswers(meter, c, a.questions)
  meter.check()
  const g = await generatePrompt(
    {
      id: `eval-${c.id}-gen`,
      prompt: c.prompt,
      surface: c.surface,
      model: c.target.model,
      effort: c.target.effort,
      answers,
      analysis: { intent: a.intent, taskType: a.taskType, complexity: a.complexity },
      family: c.family
    },
    () => undefined,
    new AbortController().signal
  )
  if (g.usage && g.engine) meter.add('generation', g.engine.model, g.usage)

  out.answers = answers
  const target = c.target
  let raw: string
  let prism: string
  let rawSystem: string | undefined
  if (c.surface === 'api') {
    // İki yol da sonunda aynı son kullanıcı mesajını karşılar; yalnızca system prompt'un kaynağı farklıdır.
    rawSystem = await rawSystemPrompt(meter, { ...c, target })
    ;[raw, prism] = await Promise.all([
      runTarget(meter, target.model, target.effort, rawSystem, c.input ?? ''),
      runTarget(meter, target.model, target.effort, g.prompt, c.input ?? '')
    ])
  } else {
    ;[raw, prism] = await Promise.all([
      runTarget(meter, target.model, target.effort, '', c.prompt),
      runTarget(meter, target.model, target.effort, '', g.prompt)
    ])
  }
  const [first, second] = await Promise.all([judgePair(meter, c, prism, raw), judgePair(meter, c, raw, prism)])
  out.writing = { prompt: g.prompt, rawSystem, raw, prism, verdicts: [first, second], ...combine(first, second) }
  return out
}

function summarize(label: string, results: CaseResult[], meter: Meter, stopped: string | null) {
  const ok = results.filter((r) => !r.error)
  const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-')
  const recs = ok.filter((r) => r.rec)
  const modelHit = recs.filter((r) => r.rec?.modelOk).length
  const bothHit = recs.filter((r) => r.rec?.modelOk && r.rec.effortOk).length
  const qs = ok.flatMap((r) => (r.questions ? [r.questions] : []))
  const withMust = qs.filter((q) => q.recall !== null)
  const recall = withMust.reduce((s, q) => s + (q.recall ?? 0), 0) / (withMust.length || 1)
  const asked = qs.reduce((s, q) => s + q.asked, 0)
  const unneeded = qs.reduce((s, q) => s + q.unneeded, 0)
  const needed = qs.reduce((s, q) => s + q.needed, 0)
  const writes = ok.flatMap((r) => (r.writing ? [r.writing] : []))
  const wins = writes.filter((w) => w.outcome === 'win').length
  const losses = writes.filter((w) => w.outcome === 'loss').length
  const delta = writes.reduce((s, w) => s + w.scoreDelta, 0) / (writes.length || 1)
  const lines = [
    `# Eval run: ${label}`,
    '',
    `Date: ${new Date().toISOString()} · engine: ${JSON.stringify(resolveEngine())} · judge: ${JUDGE.model}/${JUDGE.effort}`,
    `Cases: ${results.length} (errors: ${results.length - ok.length})${stopped ? ` · STOPPED: ${stopped}` : ''}`,
    `Estimated cost (list prices): ${meter.usd.toFixed(3)} USD · tokens: ${meter.tokens}`,
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Recommendation: model in expected set | ${modelHit}/${recs.length} (${pct(modelHit, recs.length)}) |`,
    `| Recommendation: model and effort | ${bothHit}/${recs.length} (${pct(bothHit, recs.length)}) |`,
    `| Questions: must-ask recall (cases with must-ask) | ${recall.toFixed(2)} over ${withMust.length} |`,
    `| Questions: asked / needed / unneeded | ${asked} / ${needed} / ${unneeded} |`,
    `| Questions: cases with no must-ask that still asked | ${qs.filter((q) => q.recall === null && q.asked > 0).length} of ${qs.length - withMust.length} |`,
    `| Writing: Prism vs raw (win / tie / loss) | ${wins} / ${writes.length - wins - losses} / ${losses} of ${writes.length} |`,
    `| Writing: mean judge score delta (Prism - raw) | ${delta.toFixed(2)} |`,
    '',
    '| Case | Rec | Effort | Q asked/unneeded | Recall | Writing |',
    '|---|---|---|---|---|---|'
  ]
  for (const r of results) {
    if (r.error) {
      lines.push(`| ${r.id} | error: ${r.error.slice(0, 80)} | | | | |`)
      continue
    }
    const rec = r.analysis?.recommendation
    lines.push(
      `| ${r.id} | ${rec?.model ?? '-'} ${r.rec?.modelOk ? 'ok' : 'MISS'} | ${rec?.effort ?? '-'} ${r.rec?.effortOk ? 'ok' : 'MISS'} | ${r.questions?.asked ?? 0}/${r.questions?.unneeded ?? 0} | ${r.questions?.recall ?? '-'} | ${r.writing ? `${r.writing.outcome} (${r.writing.scoreDelta.toFixed(1)})` : '-'} |`
    )
  }
  return lines.join('\n')
}

export async function runEval(argv: string[]) {
  if (app.isPackaged) throw new Error('eval yalnızca geliştirme kopyasında çalışır')
  const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  const label = (flag('label') ?? 'run').replace(/[^a-z0-9-]/gi, '')
  const suite = flag('suite') === 'analysis' ? 'analysis' : 'full'
  const only = flag('only')?.split(',')
  // Bayraklar doğrulanır: geçersiz değer tavanı kapatmasın ya da sıfır işçiyle "başarılı" boş koşu üretmesin.
  const int = (name: string, fallback: number, min: number, max: number) => {
    const n = Number(flag(name) ?? fallback)
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`--${name} ${min} ile ${max} arasında olmalı`)
    return n
  }
  const concurrency = Math.floor(int('concurrency', 3, 1, 4))
  const meter = new Meter(int('max-usd', 4, 0.01, 8), Math.floor(int('max-tokens', 3_000_000, 1000, 10_000_000)))

  overrideEngine('vertex')
  // Ölçümler aynı koşulda karşılaştırılsın: motorun insan okuyacağı alanları (sorular, notlar) Türkçe üretir.
  updateSettings({ uiLanguage: 'tr' })
  // ROADMAP: 90 günü geçen kart eval'den önce yeniden doğrulanır.
  const stale = cardPaths().filter((p) => isStale(parsedCard(p).meta, new Date()))
  if (stale.length) process.stdout.write(`UYARI: son doğrulaması 90 günü geçen kartlar: ${stale.join(', ')}\n`)
  const root = app.getAppPath()
  const all = loadCases(root)
  const unknown = only?.filter((id) => !all.some((c) => c.id === id)) ?? []
  if (unknown.length) throw new Error(`bilinmeyen vaka: ${unknown.join(', ')}`)
  const cases = all.filter((c) => !only || only.includes(c.id))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(root, '.work', 'reports', 'eval', 'runs', `${stamp}-${label}`)
  mkdirSync(dir, { recursive: true })
  const secrets = [credentials('vertex').key]
  const save = (name: string, data: unknown) => writeFileSync(join(dir, name), mask(typeof data === 'string' ? data : JSON.stringify(data, null, 2), secrets))
  // Konsola giden her satır da maskelenir (hata metinleri sağlayıcıdan gelir).
  const out = (text: string) => process.stdout.write(mask(text, secrets))
  // Harcama satırı koşu nasıl biterse bitsin (hata, tavan, kesinti) deftere yazılır.
  const ledger = () => {
    const models = [...new Set(meter.entries.map((e) => e.model))].join(', ')
    appendFileSync(
      join(root, '.work', 'reports', 'eval', 'budget.md'),
      `| ${stamp.slice(0, 10)} | vertex/${models} | eval ${label} (${meter.entries.length} calls) | ${meter.tokens} total | ${meter.usd.toFixed(2)} (list) | phase 1 eval |\n`
    )
  }
  process.on('exit', ledger)

  out(`eval ${label}: ${cases.length} vaka, suite=${suite}, tavan=${meter.maxUsd} USD\n`)
  const results: CaseResult[] = []
  let stopped: string | null = null
  const queue = [...cases]
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      if (stopped) {
        results.push({ id: c.id, error: `atlandı: ${stopped}` })
        continue
      }
      // Kota (429) ya da zaman aşımında vaka bir dakika sonra bir kez daha baştan koşulur; harcanan kısım sayaçta kalır.
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await runCase(c, meter, suite)
          results.push(r)
          out(`  ${c.id}: ${r.writing?.outcome ?? 'ok'} · ${meter.usd.toFixed(3)} USD\n`)
          break
        } catch (e) {
          if (e instanceof BudgetExceeded) stopped = e.message
          const transient = e instanceof LlmError && (e.kind === 'quota' || /zaman aşımı|Ağ hatası/.test(e.message))
          if (transient && attempt === 0 && !stopped) {
            out(`  ${c.id}: geçici hata, 60 sn sonra tekrar\n`)
            await new Promise((r) => setTimeout(r, 60_000))
            continue
          }
          const msg = e instanceof Error ? e.message : String(e)
          results.push({ id: c.id, error: msg })
          out(`  ${c.id}: HATA ${msg}\n`)
          break
        }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  results.sort((x, y) => cases.findIndex((c) => c.id === x.id) - cases.findIndex((c) => c.id === y.id))

  save('results.json', results)
  save('meter.json', meter.entries)
  const summary = summarize(label, results, meter, stopped)
  save('summary.md', summary)
  out(`\n${summary}\n\nkayıt: ${dir}\n`)
}
