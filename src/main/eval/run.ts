// `npm run eval -- --label=<ad> [--only=a,b] [--suite=analysis|prompt|full] [--jury=gemini,deepseek] [--repeat=2] [--auto]
//   [--max-usd=4] [--max-tokens=3000000] [--concurrency=3]`
// Yalnızca geliştirme kopyasında, owner key'iyle yerelde çalışır; CI'da asla. Çıktılar .work/reports/eval/runs/ altına,
// key kalıpları maskelenerek yazılır.
// Suite: analysis = öneri + sorular; prompt = + yanıtlar, Prism promptu, "düzelt" taban çizgisi ve sadakat jürisi;
// full = + hedef modelde çalıştırma ve kör ikili karşılaştırma (ham ve "düzelt" yoluna karşı).
import { app } from 'electron'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODELS, type Effort, type ModelId } from '@shared/catalog'
import type { Analysis } from '@shared/types'
import { analyze } from '../engine/analyze'
import { generatePrompt } from '../engine/generate'
import { cardPaths, parsedCard } from '../engine/knowledge'
import { isStale } from '@shared/knowledge'
import { LlmError, generate } from '../llm'
import { updateSettings } from '../config'
import { credentials, overrideEngine, resolveEngine } from '../providers'
import { loadCases, scoreRecommendation, type EvalCase } from './cases'
import { FIXER, NO_INFO, fixPrompt, judgeFidelity, judgePair, judgeQuestions, jurorModel, simulateAnswers, type Fidelity } from './judge'
import { combineVotes, type Juror, type Vote } from './votes'
import { BudgetExceeded, Meter, mask } from './meter'

type Suite = 'analysis' | 'prompt' | 'full'
type Outcome = 'win' | 'tie' | 'loss'

interface FidelityResult {
  total: number
  /** Jüri üyelerinin ortalaması (0-1); madde yoksa null. */
  carried: number | null
  /** Jüri üyesi başına ortalama uydurma sayısı. */
  inventions: number
  perJuror: { juror: Juror; carried: number; inventions: string[] }[]
}

interface Comparison {
  outcome: Outcome
  scoreDelta: number
  votes: Vote[]
}

interface CaseResult {
  id: string
  round: number
  style?: EvalCase['style']
  analysis?: Pick<Analysis, 'intent' | 'taskType' | 'complexity' | 'recommendation' | 'questions'>
  rec?: { modelOk: boolean; effortOk: boolean }
  questions?: { recall: number | null; needed: number; useful: number; unneeded: number; asked: number; covered: string[] }
  answers?: { question: string; answer: string }[]
  prompt?: string
  fixed?: string
  fidelity?: { prism: FidelityResult; fixit: FidelityResult }
  writing?: { raw: string; prism: string; fixit: string; rawSystem?: string; fixSystem?: string; vsRaw: Comparison; vsFix: Comparison }
  auto?: { model: ModelId; effort: Effort; status: 'same' | 'skipped' | 'measured'; vsRaw?: Comparison }
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

/**
 * Prism'siz bir yolun hedefte vereceği yanıt. Sohbette istek doğrudan gönderilir; API yüzeyinde kişi önce hedef modelden
 * system prompt'u ister, sonra son kullanıcı mesajını onunla karşılar.
 */
async function runPlain(meter: Meter, c: EvalCase, model: string, effort: Effort, request: string) {
  if (c.surface !== 'api') return { text: await runTarget(meter, model, effort, '', request) }
  const system = await runTarget(meter, model, effort, '', request)
  return { system, text: await runTarget(meter, model, effort, system, c.input ?? '') }
}

const runPrism = (meter: Meter, c: EvalCase, model: string, effort: Effort, prompt: string) =>
  c.surface === 'api' ? runTarget(meter, model, effort, prompt, c.input ?? '') : runTarget(meter, model, effort, '', prompt)

/** Prism yanıtını karşı tarafa karşı her jüri üyesinde iki sırayla oylatır. */
async function compare(meter: Meter, jury: Juror[], c: EvalCase, prism: string, other: string): Promise<Comparison> {
  const votes = await Promise.all(
    jury.flatMap((juror) => [
      judgePair(meter, juror, c, prism, other).then((verdict): Vote => ({ juror, prismFirst: true, verdict })),
      judgePair(meter, juror, c, other, prism).then((verdict): Vote => ({ juror, prismFirst: false, verdict }))
    ])
  )
  return { ...combineVotes(votes), votes }
}

async function fidelity(meter: Meter, jury: Juror[], c: EvalCase, answers: { question: string; answer: string }[], prompt: string): Promise<FidelityResult> {
  // Kişinin verdiği bilgi: ham promptta söyledikleri ve soruların "bilmiyorum" dışındaki yanıtları.
  const informative = answers.filter((a) => a.answer.trim() && a.answer.trim() !== NO_INFO)
  const given = [...c.stated, ...informative.map((a) => `Answer to "${a.question}": ${a.answer}`)]
  const per = await Promise.all(jury.map((j) => judgeFidelity(meter, j, c.prompt, answers, given, prompt).then((f): [Juror, Fidelity] => [j, f])))
  const perJuror = per.map(([juror, f]) => {
    // Jüri bir maddeyi atlarsa taşınmamış sayılır; aralık dışı ya da yinelenen dizinler yok sayılır.
    const yes = new Set(f.items.filter((i) => i.carried && i.index >= 0 && i.index < given.length).map((i) => i.index))
    return { juror, carried: given.length ? yes.size / given.length : 1, inventions: f.inventions }
  })
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1)
  return {
    total: given.length,
    carried: given.length ? mean(perJuror.map((p) => p.carried)) : null,
    inventions: mean(perJuror.map((p) => p.inventions.length)),
    perJuror
  }
}

async function runCase(c: EvalCase, round: number, meter: Meter, suite: Suite, jury: Juror[], auto: boolean): Promise<CaseResult> {
  const out: CaseResult = { id: c.id, round, style: c.style }
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
  const target = c.target
  const answers = await simulateAnswers(meter, c, a.questions)
  out.answers = answers
  const write = async (model: ModelId, effort: Effort) => {
    meter.check()
    const g = await generatePrompt(
      {
        id: `eval-${c.id}-gen`,
        prompt: c.prompt,
        surface: c.surface,
        model,
        effort,
        answers,
        analysis: { intent: a.intent, taskType: a.taskType, complexity: a.complexity },
        family: c.family
      },
      () => undefined,
      new AbortController().signal
    )
    if (g.usage && g.engine) meter.add('generation', g.engine.model, g.usage)
    return g.prompt
  }
  const [prompt, fixed] = await Promise.all([write(target.model, target.effort), fixPrompt(meter, c.prompt)])
  out.prompt = prompt
  out.fixed = fixed
  const [fp, ff] = await Promise.all([fidelity(meter, jury, c, answers, prompt), fidelity(meter, jury, c, [], fixed)])
  out.fidelity = { prism: fp, fixit: ff }
  if (suite === 'prompt') return out

  const [raw, fix, prism] = await Promise.all([
    runPlain(meter, c, target.model, target.effort, c.prompt),
    runPlain(meter, c, target.model, target.effort, fixed),
    runPrism(meter, c, target.model, target.effort, prompt)
  ])
  const [vsRaw, vsFix] = await Promise.all([compare(meter, jury, c, prism, raw.text), compare(meter, jury, c, prism, fix.text)])
  out.writing = { raw: raw.text, prism, fixit: fix.text, rawSystem: raw.system, fixSystem: fix.system, vsRaw, vsFix }

  if (auto) {
    // Otomatik yol: önerilen model ve effort. Hedefle aynıysa elle seçim ölçümü onu da kapsar; hedef çalıştırma şimdilik
    // yalnızca Vertex (Gemini) modellerinde mümkün.
    const rec = a.recommendation
    if (rec.model === target.model && rec.effort === target.effort) out.auto = { model: rec.model, effort: rec.effort, status: 'same' }
    else if (MODELS[rec.model].family !== 'gemini') out.auto = { model: rec.model, effort: rec.effort, status: 'skipped' }
    else {
      const autoPrompt = await write(rec.model, rec.effort)
      const [r, p] = await Promise.all([runPlain(meter, c, rec.model, rec.effort, c.prompt), runPrism(meter, c, rec.model, rec.effort, autoPrompt)])
      out.auto = { model: rec.model, effort: rec.effort, status: 'measured', vsRaw: await compare(meter, jury, c, p, r.text) }
    }
  }
  return out
}

// --- Özet ---------------------------------------------------------------------------------

type Metric = [name: string, value: number | null, digits: number]

function metrics(results: CaseResult[]): Metric[] {
  const ok = results.filter((r) => !r.error)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
  const recs = ok.flatMap((r) => (r.rec ? [r.rec] : []))
  const qs = ok.flatMap((r) => (r.questions ? [{ ...r.questions, style: r.style }] : []))
  const asked = qs.reduce((s, q) => s + q.asked, 0)
  const clear = qs.filter((q) => q.style === 'clear')
  const fid = ok.flatMap((r) => (r.fidelity ? [r.fidelity] : []))
  const w = ok.flatMap((r) => (r.writing ? [r.writing] : []))
  const autos = ok.flatMap((r) => (r.auto?.vsRaw ? [r.auto.vsRaw] : []))
  const rate = (cs: Comparison[], o: Outcome) => (cs.length ? cs.filter((c) => c.outcome === o).length : null)
  const carried = (k: 'prism' | 'fixit') => mean(fid.flatMap((f) => (f[k].carried === null ? [] : [f[k].carried])))
  // Jüri uyumu: iki üye de oy verdiyse, kendi iki sıralı sonuçları aynı mı.
  const agreement = (() => {
    const pairs = w.flatMap((x) => [x.vsRaw, x.vsFix]).filter((c) => new Set(c.votes.map((v) => v.juror)).size > 1)
    const same = pairs.filter((c) => {
      const by = (j: Juror) => combineVotes(c.votes.filter((v) => v.juror === j)).outcome
      return by('gemini') === by('deepseek')
    })
    return pairs.length ? same.length / pairs.length : null
  })()
  return [
    ['(e) Recommendation: model in expected set', recs.length ? recs.filter((r) => r.modelOk).length / recs.length : null, 2],
    ['(e) Recommendation: model and effort', recs.length ? recs.filter((r) => r.modelOk && r.effortOk).length / recs.length : null, 2],
    ['(a) Must-ask recall', mean(qs.flatMap((q) => (q.recall === null ? [] : [q.recall]))), 2],
    ['(a) Unneeded question rate', asked ? qs.reduce((s, q) => s + q.unneeded, 0) / asked : null, 2],
    ['(a) Questions per case', qs.length ? asked / qs.length : null, 2],
    ['(a) Clear cases that still asked (of clear)', clear.length ? clear.filter((q) => q.asked > 0).length / clear.length : null, 2],
    ['(b) Info carried: Prism', carried('prism'), 2],
    ['(b) Stated info carried: fix-it baseline', carried('fixit'), 2],
    ['(c) Inventions per prompt: Prism', mean(fid.map((f) => f.prism.inventions)), 2],
    ['(c) Prism prompts with zero inventions (share)', fid.length ? fid.filter((f) => f.prism.inventions === 0).length / fid.length : null, 2],
    ['(c) Inventions per prompt: fix-it baseline', mean(fid.map((f) => f.fixit.inventions)), 2],
    ['(d) Prism vs raw: wins', rate(w.map((x) => x.vsRaw), 'win'), 0],
    ['(d) Prism vs raw: losses', rate(w.map((x) => x.vsRaw), 'loss'), 0],
    ['(d) Prism vs raw: mean score delta', mean(w.map((x) => x.vsRaw.scoreDelta)), 2],
    ['(d) Prism vs fix-it: wins', rate(w.map((x) => x.vsFix), 'win'), 0],
    ['(d) Prism vs fix-it: losses', rate(w.map((x) => x.vsFix), 'loss'), 0],
    ['(d) Prism vs fix-it: mean score delta', mean(w.map((x) => x.vsFix.scoreDelta)), 2],
    ['(d) Auto path vs raw: wins (measured cases)', rate(autos, 'win'), 0],
    ['(d) Auto path vs raw: losses', rate(autos, 'loss'), 0],
    ['(d) Auto path vs raw: mean score delta', mean(autos.map((x) => x.scoreDelta)), 2],
    ['Jury agreement (Gemini vs DeepSeek outcome)', agreement, 2],
    ['Writing cases measured', w.length, 0]
  ]
}

const fmt = (v: number | null, d: number) => (v === null ? '-' : v.toFixed(d))

function summarize(label: string, rounds: CaseResult[][], meter: Meter, jury: Juror[], stopped: string | null) {
  const all = rounds.flat()
  const per = rounds.map(metrics)
  const lines = [
    `# Eval run: ${label}`,
    '',
    `Date: ${new Date().toISOString()} · engine: ${JSON.stringify(resolveEngine())} · jury: ${jury.map(jurorModel).join(' + ')} · fixer: ${FIXER.model}/${FIXER.effort}`,
    `Cases: ${all.length / rounds.length} x ${rounds.length} round(s) (errors: ${all.filter((r) => r.error).length})${stopped ? ` · STOPPED: ${stopped}` : ''}`,
    `Estimated cost (list prices): ${meter.usd.toFixed(3)} USD · tokens: ${meter.tokens}`,
    '',
    `| Metric | ${rounds.map((_, i) => `Round ${i + 1}`).join(' | ')} | Mean | Spread (max-min) |`,
    `|---|${rounds.map(() => '---|').join('')}---|---|`
  ]
  per[0]?.forEach(([name, , digits], i) => {
    const vals = per.map((m) => m[i]?.[1] ?? null)
    const nums = vals.filter((x): x is number => x !== null)
    const mean = nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : null
    const spread = nums.length > 1 ? Math.max(...nums) - Math.min(...nums) : null
    lines.push(`| ${name} | ${vals.map((v) => fmt(v, digits)).join(' | ')} | ${fmt(mean, 2)} | ${fmt(spread, 2)} |`)
  })
  lines.push('', '| Case | Round | Rec | Q asked/unneeded | Recall | Carried (Prism / fix-it) | Inventions (Prism / fix-it) | vs raw | vs fix-it | Auto |', '|---|---|---|---|---|---|---|---|---|---|')
  const cmp = (c?: Comparison) => (c ? `${c.outcome} (${c.scoreDelta.toFixed(1)})` : '-')
  for (const r of [...all].sort((x, y) => x.id.localeCompare(y.id) || x.round - y.round)) {
    if (r.error) {
      lines.push(`| ${r.id} | ${r.round + 1} | error: ${r.error.slice(0, 80)} | | | | | | | |`)
      continue
    }
    const rec = r.analysis?.recommendation
    const f = r.fidelity
    lines.push(
      `| ${r.id} | ${r.round + 1} | ${rec?.model ?? '-'}/${rec?.effort ?? '-'} ${r.rec?.modelOk ? 'ok' : 'MISS'}${r.rec?.effortOk ? '' : ' effort-MISS'} | ${r.questions?.asked ?? 0}/${r.questions?.unneeded ?? 0} | ${fmt(r.questions?.recall ?? null, 2)} | ${f ? `${fmt(f.prism.carried, 2)} / ${fmt(f.fixit.carried, 2)}` : '-'} | ${f ? `${f.prism.inventions.toFixed(1)} / ${f.fixit.inventions.toFixed(1)}` : '-'} | ${cmp(r.writing?.vsRaw)} | ${cmp(r.writing?.vsFix)} | ${r.auto ? (r.auto.status === 'measured' ? cmp(r.auto.vsRaw) : r.auto.status) : '-'} |`
    )
  }
  // Uydurma örnekleri: optimizasyon döngüsü için en çok işe yarayan ham bilgi.
  const inv = all.flatMap((r) => (r.fidelity ? r.fidelity.prism.perJuror.flatMap((p) => p.inventions.map((x) => `- ${r.id} (r${r.round + 1}, ${p.juror}): ${x}`)) : []))
  if (inv.length) lines.push('', '## Prism inventions flagged', '', ...inv.slice(0, 80))
  return lines.join('\n')
}

export async function runEval(argv: string[]) {
  if (app.isPackaged) throw new Error('eval yalnızca geliştirme kopyasında çalışır')
  const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  const label = (flag('label') ?? 'run').replace(/[^a-z0-9-]/gi, '')
  const suiteFlag = flag('suite') ?? 'full'
  if (suiteFlag !== 'analysis' && suiteFlag !== 'prompt' && suiteFlag !== 'full') throw new Error('--suite analysis, prompt ya da full olmalı')
  const suite: Suite = suiteFlag
  const isJuror = (j: string): j is Juror => j === 'gemini' || j === 'deepseek'
  const jury = (flag('jury') ?? 'gemini').split(',')
  const jurors = [...new Set(jury.filter(isJuror))]
  if (!jurors.length || jurors.length !== new Set(jury).size) throw new Error('--jury gemini ve/veya deepseek olmalı')
  const auto = argv.includes('--auto')
  const only = flag('only')?.split(',')
  // Bayraklar doğrulanır: geçersiz değer tavanı kapatmasın ya da sıfır işçiyle "başarılı" boş koşu üretmesin.
  const int = (name: string, fallback: number, min: number, max: number) => {
    const n = Number(flag(name) ?? fallback)
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`--${name} ${min} ile ${max} arasında olmalı`)
    return n
  }
  const concurrency = Math.floor(int('concurrency', 3, 1, 4))
  const repeat = Math.floor(int('repeat', 1, 1, 3))
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
      `| ${stamp.slice(0, 10)} | vertex/${models} | eval ${label} ${suite} x${repeat} (${meter.entries.length} calls) | ${meter.tokens} total | ${meter.usd.toFixed(2)} (list) | eval hardening |\n`
    )
  }
  process.on('exit', ledger)

  out(`eval ${label}: ${cases.length} vaka x ${repeat}, suite=${suite}, jüri=${jurors.join('+')}, tavan=${meter.maxUsd} USD\n`)
  const rounds: CaseResult[][] = []
  let stopped: string | null = null
  for (let round = 0; round < repeat; round++) {
    const results: CaseResult[] = []
    const queue = [...cases]
    const worker = async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        if (stopped) {
          results.push({ id: c.id, round, error: `atlandı: ${stopped}` })
          continue
        }
        // Kota (429) ya da zaman aşımında vaka bir dakika sonra bir kez daha baştan koşulur; harcanan kısım sayaçta kalır.
        for (let attempt = 0; ; attempt++) {
          try {
            // Otomatik yol pahalıdır; yalnızca ilk turda ölçülür.
            const r = await runCase(c, round, meter, suite, jurors, auto && round === 0)
            results.push(r)
            out(`  r${round + 1} ${c.id}: ${r.writing ? `${r.writing.vsRaw.outcome}/${r.writing.vsFix.outcome}` : 'ok'} · ${meter.usd.toFixed(3)} USD\n`)
            break
          } catch (e) {
            if (e instanceof BudgetExceeded) stopped = e.message
            const transient = e instanceof LlmError && (e.kind === 'quota' || /zaman aşımı|Ağ hatası/.test(e.message))
            if (transient && attempt === 0 && !stopped) {
              out(`  r${round + 1} ${c.id}: geçici hata, 60 sn sonra tekrar\n`)
              await new Promise((r) => setTimeout(r, 60_000))
              continue
            }
            const msg = e instanceof Error ? e.message : String(e)
            results.push({ id: c.id, round, error: msg })
            out(`  r${round + 1} ${c.id}: HATA ${msg}\n`)
            break
          }
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))
    results.sort((x, y) => cases.findIndex((c) => c.id === x.id) - cases.findIndex((c) => c.id === y.id))
    rounds.push(results)
  }

  save('results.json', rounds)
  save('meter.json', meter.entries)
  const summary = summarize(label, rounds, meter, jurors, stopped)
  save('summary.md', summary)
  out(`\n${summary}\n\nkayıt: ${dir}\n`)
}
