import { useCallback, useEffect, useRef, useState } from 'react'
import { MODELS, type Effort, type FamilyChoice, type ModelId, type Surface } from '@shared/catalog'
import type { Analysis, GenerateResult, HistoryEntry } from '@shared/types'
import { cleanError, reportError } from './errors'

export type Stage = 'compose' | 'analyzing' | 'review' | 'generating' | 'result'
export type Choice = { model: ModelId; effort: Effort }

export interface FlowState {
  stage: Stage
  prompt: string
  surface: Surface
  /** Hedef ekosistem; 'auto' aileler arası öneri. */
  family: FamilyChoice
  selectMode: 'auto' | 'manual'
  manual: Choice
  analysis: Analysis | null
  choice: Choice | null
  answers: Record<string, { option?: string; text: string }>
  stream: string
  result: GenerateResult | null
  error: string | null
  startedAt: number
}

const initial: FlowState = {
  stage: 'compose',
  prompt: '',
  surface: 'agent',
  family: 'auto',
  selectMode: 'auto',
  manual: { model: 'claude-opus-5-5', effort: 'medium' },
  analysis: null,
  choice: null,
  answers: {},
  stream: '',
  result: null,
  error: null,
  startedAt: 0
}

export function useFlow() {
  const [s, setS] = useState<FlowState>(initial)
  const ref = useRef(s)
  ref.current = s
  const analyzeSeq = useRef(0)
  const genId = useRef<string | null>(null)
  const analyzeId = useRef<string | null>(null)

  const patch = useCallback((p: Partial<FlowState>) => setS((prev) => ({ ...prev, ...p })), [])

  useEffect(
    () =>
      window.prism.engine.onStream((ev) => {
        if (ev.id !== genId.current) return
        if (ev.type === 'chunk') setS((prev) => ({ ...prev, stream: prev.stream + ev.text }))
        else if (ev.type === 'done') {
          genId.current = null
          setS((prev) => ({ ...prev, result: ev.result, stage: 'result' }))
        } else {
          genId.current = null
          setS((prev) => ({ ...prev, error: ev.message, stage: prev.analysis ? 'review' : 'compose' }))
        }
      }),
    []
  )

  // base: state henüz React'e işlenmeden yazım başlatmak için (geçmişten "yeniden yaz").
  const write = useCallback((override?: Choice, base?: FlowState) => {
    const cur = base ?? ref.current
    const choice = override ?? cur.choice ?? cur.manual
    // Önceki yazım hâlâ sürüyorsa (çift tıklama, Enter + tık) önce o durdurulur; iki ücretli istek birden koşmasın.
    if (genId.current) window.prism.engine.cancel(genId.current).catch(reportError('engine'))
    const id = crypto.randomUUID()
    genId.current = id
    const answers = (cur.analysis?.questions ?? []).map((q) => {
      const a = cur.answers[q.id]
      return { question: q.question, answer: [a?.option, a?.text].filter(Boolean).join(' — ') }
    })
    setS((prev) => ({ ...prev, choice, stage: 'generating', stream: '', result: null, error: null, startedAt: Date.now() }))
    window.prism.engine.generate({
      id,
      prompt: cur.prompt,
      surface: cur.surface,
      model: choice.model,
      effort: choice.effort,
      answers,
      analysis: cur.analysis
        ? { intent: cur.analysis.intent, taskType: cur.analysis.taskType, complexity: cur.analysis.complexity }
        : undefined,
      historyId: cur.analysis?.historyId,
      family: cur.family
    }).catch((e: unknown) => {
      if (genId.current !== id) return
      genId.current = null
      setS((prev) => ({ ...prev, stage: cur.analysis ? 'review' : 'compose', error: cleanError(e) }))
    })
  }, [])

  // Arayüzdeki iptal ana süreçteki analizi de durdurur: ücret işlemeye devam etmesin, sonuç geçmişe yazılmasın.
  const cancelAnalysis = () => {
    analyzeSeq.current++
    if (analyzeId.current) window.prism.engine.cancel(analyzeId.current).catch(reportError('engine'))
    analyzeId.current = null
  }

  const start = useCallback(async () => {
    const cur = ref.current
    if (!cur.prompt.trim()) return
    const seq = ++analyzeSeq.current
    const manual = cur.selectMode === 'manual' ? cur.manual : undefined
    patch({ stage: 'analyzing', error: null, analysis: null, answers: {}, result: null, startedAt: Date.now() })
    if (analyzeId.current) window.prism.engine.cancel(analyzeId.current).catch(reportError('engine'))
    const id = crypto.randomUUID()
    analyzeId.current = id
    try {
      const analysis = await window.prism.engine.analyze({ id, prompt: cur.prompt, surface: cur.surface, family: cur.family, manual })
      if (seq !== analyzeSeq.current) return
      const choice = manual ?? { model: analysis.recommendation.model, effort: analysis.recommendation.effort }
      setS((prev) => ({ ...prev, analysis, choice }))
      // Analiz henüz React durumuna işlenmedi; yazım analizi ve geçmiş kimliğini taşısın diye doğrudan verilir.
      if (manual && analysis.questions.length === 0) write(manual, { ...ref.current, analysis, choice: manual })
      else setS((prev) => ({ ...prev, stage: 'review' }))
    } catch (e) {
      if (seq !== analyzeSeq.current) return
      patch({ stage: 'compose', error: cleanError(e) })
    }
  }, [patch, write])

  const cancel = useCallback(() => {
    const cur = ref.current
    if (cur.stage === 'analyzing') {
      cancelAnalysis()
      patch({ stage: 'compose' })
    } else if (cur.stage === 'generating' && genId.current) {
      window.prism.engine.cancel(genId.current).catch(reportError('engine'))
      genId.current = null
      patch({ stage: cur.analysis ? 'review' : 'compose' })
    }
  }, [patch])

  const answer = useCallback((id: string, a: { option?: string; text?: string }) => {
    setS((prev) => {
      const old = prev.answers[id] ?? { text: '' }
      const option = a.option === undefined ? old.option : a.option === old.option ? undefined : a.option
      return { ...prev, answers: { ...prev.answers, [id]: { option, text: a.text ?? old.text } } }
    })
  }, [])

  const stopRunning = () => {
    cancelAnalysis()
    if (genId.current) window.prism.engine.cancel(genId.current).catch(reportError('engine'))
    genId.current = null
  }

  const reset = useCallback(() => {
    stopRunning()
    setS((prev) => ({ ...initial, surface: prev.surface, family: prev.family, selectMode: prev.selectMode, manual: prev.manual }))
  }, [])

  /** Geçmişteki bir girdiyi açar: yazımı varsa sonuç ekranına, yoksa öneri ekranına. */
  const load = useCallback((entry: HistoryEntry) => {
    stopRunning()
    setS(fromEntry(entry, ref.current))
  }, [])

  /** Geçmişteki girdiyi son kullanılan model ve effort ile yeniden yazar. */
  const rewrite = useCallback(
    (entry: HistoryEntry) => {
      stopRunning()
      const next = fromEntry(entry, ref.current)
      setS(next)
      write(next.choice!, next)
    },
    [write]
  )

  return { s, patch, start, write, cancel, answer, reset, load, rewrite }
}

function fromEntry(entry: HistoryEntry, prev: FlowState): FlowState {
  const last = entry.outputs.at(-1)
  const rec = entry.analysis.recommendation
  const model = last?.model ?? rec.model
  // Kaydedilen cevaplar "seçenek — serbest metin" biçiminde; soru kimliklerine geri dağıt.
  const answers: FlowState['answers'] = {}
  for (const q of entry.analysis.questions) {
    const a = entry.answers.find((x) => x.question === q.question)?.answer
    if (!a) continue
    const option = q.options.find((o) => a === o || a.startsWith(`${o} — `))
    answers[q.id] = option ? { option, text: a.slice(option.length).replace(/^ — /, '') } : { text: a }
  }
  return {
    ...prev,
    stage: last ? 'result' : 'review',
    prompt: entry.prompt,
    surface: entry.surface,
    // v1 kayıtlarında ekosistem yok; modelin ailesi kullanılır.
    family: entry.family ?? MODELS[model]?.family ?? prev.family,
    analysis: { ...entry.analysis, historyId: entry.id },
    choice: last ? { model: last.model, effort: last.effort } : { model: rec.model, effort: rec.effort },
    answers,
    stream: '',
    result: last ?? null,
    error: null,
    startedAt: Date.now()
  }
}

