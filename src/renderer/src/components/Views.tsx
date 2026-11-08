import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Pencil,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Wand2,
  X
} from 'lucide-react'
import {
  FAMILY_DEFAULT_MODEL,
  FAMILY_INFO,
  FAMILY_SHORT,
  MODELS,
  PROVIDER_INFO,
  SURFACES,
  candidatePool,
  clampEffort,
  defaultEffortFor,
  effortText,
  modelsOf,
  preferredModel,
  setupNote,
  type Family,
  type FamilyChoice,
  type Surface
} from '@shared/catalog'
import type { SettingsView, TargetAccess } from '@shared/types'
import { parseGenerated } from '@shared/parse'
import type { Choice, FlowState, useFlow } from '../flow'
import { EffortPicker, Meter, ModelPicker, Segment } from './Pickers'
import { PrismLoader } from './Prism'
import { effortName, fmtNumber, surfaceHint, surfaceLabel, t, taskLabel, tk } from '../i18n'

type Flow = ReturnType<typeof useFlow>

const isMac = window.prism.platform === 'darwin'
const MOD = isMac ? '⌘' : 'Ctrl'

export const viewMotion = {
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(6px)' },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const }
}

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.06 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }
})

function ErrorBox({ message }: { message: string }) {
  return (
    <motion.div className="error" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <AlertTriangle size={16} style={{ flex: 'none', marginTop: 1 }} />
      <span>{message}</span>
    </motion.div>
  )
}

function useCtrlEnter(fn: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [fn, enabled])
}

const surfaceOptions = (family: FamilyChoice) => SURFACES.map((v) => ({ value: v, label: surfaceLabel(family, v) }))

/** Seçili ailelerden segment seçenekleri; birden çok aile varsa başta çapraz öneri. Tek ailede segment gösterilmez. */
const familyOptions = (families: readonly Family[]) =>
  (families.length > 1 ? (['auto', ...families] as FamilyChoice[]) : [...families]).map((f) => ({
    value: f,
    label: f === 'auto' ? t('family.autoShort') : FAMILY_SHORT[f],
    hue: f === 'auto' ? undefined : FAMILY_INFO[f].hue
  }))

const accessText = (a: TargetAccess) => t(`access.${a}`)

/** Seçili ekosistemde hangi modellere nasıl erişildiğini tek satırda özetler. */
function PoolHint({ family, families: selected, targets }: { family: FamilyChoice; families: readonly Family[]; targets: SettingsView['targets'] }) {
  const families = selected.filter((f) => family === 'auto' || f === family)
  const parts = families
    .map((f) => {
      const ids = modelsOf(f).filter((id) => targets[id])
      const kinds = [...new Set(ids.flatMap((id) => { const a = targets[id]; return a ? [accessText(a)] : [] }))].join(' + ')
      return ids.length ? { f, text: `${FAMILY_INFO[f].name} ${ids.length} · ${kinds}` } : null
    })
    .filter((p) => p !== null)
  const text =
    family === 'auto'
      ? parts.length
        ? null
        : t('pool.noneAuto')
      : parts.length
        ? null
        : t('pool.noneFamily', { family: FAMILY_INFO[family].name })
  return (
    <motion.div key={family} className="pool-hint" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
      {text ??
        parts.map((p) => (
          <span key={p.f}>
            <i style={{ background: FAMILY_INFO[p.f].hue }} />
            {p.text}
          </span>
        ))}
    </motion.div>
  )
}

// ---------------------------------------------------------------- Compose

export function Compose({ flow, families, targets = {} }: { flow: Flow; families: readonly Family[]; targets?: SettingsView['targets'] }) {
  const { s, patch, start } = flow
  const words = s.prompt.trim() ? s.prompt.trim().split(/\s+/).length : 0
  const pool = candidatePool(s.family, targets, families)
  useCtrlEnter(() => void start(), !!s.prompt.trim())

  // Ekosistem değişince elle seçilen model yeni havuzda yoksa havuzun önerilen modeline geçer.
  const setFamily = (family: FamilyChoice) => {
    const next = candidatePool(family, targets, families)
    const keep = next.includes(s.manual.model)
    const model = keep ? s.manual.model : family === 'auto' ? preferredModel(next) : FAMILY_DEFAULT_MODEL[family]
    patch({ family, manual: { model, effort: keep ? s.manual.effort : defaultEffortFor(model, s.surface) } })
  }

  return (
    <motion.div className="view" {...viewMotion}>
      <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} {...stagger(0)}>
        {families.length > 1 && <Segment<FamilyChoice> id="family" value={s.family} options={familyOptions(families)} onChange={setFamily} />}
        <PoolHint family={s.family} families={families} targets={targets} />
        <Segment<Surface> id="surface" value={s.surface} options={surfaceOptions(s.family)} onChange={(v) => patch({ surface: v })} />
      </motion.div>

      <motion.div className="composer" {...stagger(1)}>
        <textarea
          autoFocus
          value={s.prompt}
          onChange={(e) => patch({ prompt: e.target.value })}
          placeholder={t('compose.placeholder')}
          aria-label={t('compose.aria')}
        />
        <span className="meta">{words ? t('compose.words', { n: fmtNumber(words) }) : surfaceHint(s.family, s.surface)}</span>
      </motion.div>

      <motion.div className="row between" {...stagger(2)}>
        <span className="label">{t('compose.modelEffort')}</span>
        <div style={{ width: 210 }}>
          <Segment
            id="select-mode"
            value={s.selectMode}
            options={[
              { value: 'auto', label: t('compose.modeAuto') },
              { value: 'manual', label: t('compose.modeManual') }
            ]}
            onChange={(v) => patch({ selectMode: v })}
          />
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {s.selectMode === 'manual' && (
          <motion.div
            key="manual"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', flex: 'none' }}
          >
            <ModelPicker
              models={pool}
              access={targets}
              value={s.manual.model}
              onChange={(model) => patch({ manual: { model, effort: clampEffort(model, s.manual.effort) } })}
            />
            <EffortPicker
              model={s.manual.model}
              value={s.manual.effort}
              defaultEffort={defaultEffortFor(s.manual.model, s.surface)}
              onChange={(effort) => patch({ manual: { ...s.manual, effort } })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {s.error && <ErrorBox message={s.error} />}

      <motion.button className="cta sticky" disabled={!s.prompt.trim()} onClick={start} {...stagger(3)}>
        {s.selectMode === 'auto' ? <Sparkles size={17} /> : <Wand2 size={17} />}
        {s.selectMode === 'auto' ? t('compose.analyze') : t('compose.write')}
        <span className="kbd">{MOD} ↵</span>
      </motion.button>
    </motion.div>
  )
}

// ---------------------------------------------------------------- Analyzing

const STATUS = (cross: boolean) => [
  t('analyzing.intent'),
  t('analyzing.difficulty'),
  cross ? t('analyzing.families') : t('analyzing.cards'),
  t('analyzing.effort'),
  t('analyzing.unclear'),
  t('analyzing.final')
]

function useElapsed(since: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, Math.floor((now - since) / 1000))
}

export function Analyzing({ flow, engine }: { flow: Flow; engine: SettingsView['engine'] }) {
  const { s, cancel } = flow
  const elapsed = useElapsed(s.startedAt)
  const lines = STATUS(s.family === 'auto')
  const status = lines[Math.min(lines.length - 1, Math.floor(elapsed / 3))]

  return (
    <motion.div className="view centered" {...viewMotion} style={{ gap: 18 }}>
      <div className="quote">“{s.prompt.trim()}”</div>
      <PrismLoader />
      <div className="status-line">
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {status}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="elapsed">
        {t('time.seconds', { n: elapsed })}{engine && ` · ${PROVIDER_INFO[engine.provider].label} · ${engine.analysis}`}
      </div>
      <button className="ghost" onClick={cancel}>
        <X size={15} /> {t('common.cancel')}
      </button>
    </motion.div>
  )
}

// ---------------------------------------------------------------- Review

export function Review({ flow, targets }: { flow: Flow; targets?: SettingsView['targets'] }) {
  const { s, patch, write, answer, reset } = flow
  const a = s.analysis!
  const choice = s.choice ?? { model: a.recommendation.model, effort: a.recommendation.effort }
  const rec = a.recommendation
  const isRec = choice.model === rec.model && choice.effort === rec.effort
  const manual = s.selectMode === 'manual'
  const [editing, setEditing] = useState(false)
  const m = MODELS[choice.model]
  const choose = (c: Choice) => patch({ choice: { model: c.model, effort: clampEffort(c.model, c.effort) } })
  const pickable = a.pool?.length ? a.pool : modelsOf(s.family)
  const cross = new Set(pickable.map((id) => MODELS[id].family)).size > 1
  // Başka aileden bir modelin kısa adı ("Sol", "Argon") tek başına belirsiz; tam adı göster.
  const nameOf = (id: Choice['model']) => (MODELS[id].family === m.family ? MODELS[id].short : MODELS[id].name)
  useCtrlEnter(() => write())

  return (
    <motion.div className="view" {...viewMotion} style={{ '--hue': m.hue }}>
      <motion.div className="intent" {...stagger(0)}>
        <b>{t('review.understood')}</b> {a.intent}
      </motion.div>
      <motion.div className="chips" {...stagger(1)}>
        <span className="chip">{taskLabel(a.taskType)}</span>
        <span className="chip">{t(`complexity.${a.complexity}`)}</span>
        {cross && <span className="chip">{FAMILY_INFO[m.family].name}</span>}
        <span className="chip">{surfaceLabel(m.family, s.surface)}</span>
      </motion.div>

      <motion.div className="rec" layout {...stagger(2)}>
        <div className="kicker">
          {isRec ? <Sparkles size={12} /> : <SlidersHorizontal size={12} />}
          {isRec ? t('review.recommendation') : t('review.yourChoice')}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={choice.model}
            className="model"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.25 }}
          >
            {m.name}
          </motion.div>
        </AnimatePresence>
        <div className="effort-badge">
          <Meter key={`${choice.model}-${choice.effort}`} model={choice.model} effort={choice.effort} />
          <span>
            {FAMILY_INFO[m.family].effortLabel} <b style={{ color: 'var(--text)' }}>{effortName(effortText(choice.model, choice.effort))}</b>
          </span>
        </div>
        {isRec && (
          <>
            <div className="conf">
              <strong>{fmtNumber(rec.confidence, { style: 'percent' })}</strong>{t('review.confidence')}
            </div>
            <p className="reason">{rec.reasoning}</p>
            {rec.factors.length > 0 && (
              <div className="factors">
                {rec.factors.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
            )}
          </>
        )}
        {!isRec && (
          <p className="reason">
            {manual ? t('review.myRecommendation') : t('review.recommendation')}: {nameOf(rec.model)} · {effortName(effortText(rec.model, rec.effort))}.{' '}
            <button className="link" style={{ display: 'inline' }} onClick={() => choose({ model: rec.model, effort: rec.effort })}>
              <Undo2 size={12} style={{ verticalAlign: -2 }} /> {t('review.useRecommendation')}
            </button>
            <br />
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{rec.reasoning}</span>
          </p>
        )}
      </motion.div>

      {a.alternatives.length > 0 && !editing && (
        <motion.div className="alts" {...stagger(3)}>
          {a.alternatives
            .filter((alt) => !(alt.model === choice.model && alt.effort === choice.effort))
            .map((alt) => (
              <button
                key={`${alt.model}-${alt.effort}`}
                className="alt"
                style={{ '--hue': MODELS[alt.model].hue }}
                onClick={() => choose({ model: alt.model, effort: alt.effort })}
              >
                <span className="dot" />
                <span>
                  <div className="t">
                    {alt.label} · {nameOf(alt.model)} · {effortName(effortText(alt.model, alt.effort))}
                  </div>
                  <div className="d">{alt.tradeoff}</div>
                </span>
              </button>
            ))}
        </motion.div>
      )}

      <motion.div {...stagger(4)}>
        <button className="link" onClick={() => setEditing((v) => !v)}>
          <SlidersHorizontal size={13} /> {editing ? t('review.closePicker') : t('review.change')}
        </button>
      </motion.div>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', flex: 'none' }}
          >
            <ModelPicker models={pickable} access={targets} value={choice.model} onChange={(model) => choose({ ...choice, model })} />
            <EffortPicker
              model={choice.model}
              value={choice.effort}
              defaultEffort={defaultEffortFor(choice.model, s.surface)}
              onChange={(effort) => choose({ ...choice, effort })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {a.questions.length > 0 && (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} {...stagger(5)}>
          <span className="label">{t('review.questions')}</span>
          {a.questions.map((q, i) => (
            <motion.div key={q.id} className="question" {...stagger(6 + i)}>
              <div className="q">
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                {q.question}
              </div>
              {q.why && <div className="why">{q.why}</div>}
              <div className="options">
                {q.options.map((o) => (
                  <button
                    key={o}
                    className={`option ${s.answers[q.id]?.option === o ? 'on' : ''}`}
                    onClick={() => answer(q.id, { option: o })}
                  >
                    {o}
                  </button>
                ))}
              </div>
              <input
                className="free"
                placeholder={t('review.ownAnswer')}
                value={s.answers[q.id]?.text ?? ''}
                onChange={(e) => answer(q.id, { text: e.target.value })}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {s.error && <ErrorBox message={s.error} />}

      <div style={{ flex: 1 }} />
      <motion.div className="row sticky" {...stagger(8)}>
        <button className="ghost" onClick={reset} title={t('review.restart')} aria-label={t('review.restart')}>
          <ArrowLeft size={15} />
        </button>
        <button className="cta" style={{ flex: 1 }} onClick={() => write()}>
          <Wand2 size={17} />
          {isRec ? t('review.accept') : t('review.writeWith')}
          <span className="kbd">{MOD} ↵</span>
        </button>
      </motion.div>
    </motion.div>
  )
}

// ---------------------------------------------------------------- Generating / Result

function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('[[') ? (
          <span key={i} className="ph">
            {p}
          </span>
        ) : (
          p
        )
      )}
    </>
  )
}

function Sparks({ burst }: { burst: number }) {
  // Her yeni burst yeni bir kıvılcım dizisi üretir.
  const sparks = useMemo(
    () =>
      Array.from({ length: burst ? 12 : 0 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.4
        const dist = 38 + Math.random() * 36
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.6, c: ['#4fe3c1', '#ffd36e', '#ff8a4c', '#6cc9ff'][i % 4] }
      }),
    [burst]
  )
  if (!burst) return null
  return (
    <>
      {sparks.map((p, i) => (
        <motion.span
          key={`${burst}-${i}`}
          className="spark"
          style={{ background: p.c }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

function CopyMini({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="icon-btn"
      title={t('common.copy')}
      aria-label={t('common.copy')}
      onClick={async () => {
        await window.prism.clipboard.write(text)
        setDone(true)
        setTimeout(() => setDone(false), 1200)
      }}
    >
      {done ? <Check size={14} className="ok-text" /> : <Copy size={14} />}
    </button>
  )
}

export function Result({ flow }: { flow: Flow }) {
  const { s, write, reset, patch } = flow
  const choice = s.choice!
  const m = MODELS[choice.model]
  const generating = s.stage === 'generating'
  const live = parseGenerated(s.stream)
  const elapsed = useElapsed(s.startedAt)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [burst, setBurst] = useState(0)
  const [copied, setCopied] = useState(false)
  const note = setupNote(choice.model, choice.effort, s.surface, tk)

  useEffect(() => {
    if (s.result) setText(s.result.prompt)
  }, [s.result])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied, burst])

  const copy = async () => {
    await window.prism.clipboard.write(text)
    setBurst((c) => c + 1)
    setCopied(true)
  }

  const shown = generating ? live.prompt : text

  return (
    <motion.div className="view" {...viewMotion} style={{ '--hue': m.hue }}>
      <div className="row between">
        <div className="target">
          <span className="dot" />
          <b>{m.short}</b>
          <span>· {effortName(effortText(choice.model, choice.effort))} ·</span>
          <span>{surfaceLabel(m.family, s.surface)}</span>
        </div>
        <span
          className="stats"
          title={s.result?.engine ? t('result.writtenWith', { engine: `${PROVIDER_INFO[s.result.engine.provider].label} · ${s.result.engine.model}` }) : undefined}
        >
          {generating
            ? t('time.seconds', { n: elapsed })
            : s.result
              ? `${t('time.seconds', { n: fmtNumber(s.result.elapsedMs / 1000, { maximumFractionDigits: 1 }) })} · ${t('result.tokens', { n: fmtNumber(s.result.usage?.outputTokens ?? 0) })}`
              : ''}
        </span>
      </div>

      {generating && (
        <div className="progress">
          <i />
        </div>
      )}

      <div className={`prompt-box ${generating ? '' : 'done'}`}>
        {editing && !generating ? (
          <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        ) : (
          <pre>
            {shown ? <Highlighted text={shown} /> : <span style={{ color: 'var(--muted)' }}>{t('result.writing')}</span>}
            {generating && <span className="caret" />}
          </pre>
        )}
        {!generating && (
          <div className="box-tools">
            <button className={`icon-btn ${editing ? 'on' : ''}`} title={t('common.edit')} aria-label={t('common.edit')} onClick={() => setEditing((v) => !v)}>
              <Pencil size={13} />
            </button>
          </div>
        )}
      </div>

      {generating ? (
        <button className="ghost" onClick={flow.cancel}>
          <X size={15} /> {t('common.stop')}
        </button>
      ) : (
        <>
          <motion.button
            className={`cta copy ${copied ? 'copied' : ''}`}
            onClick={copy}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          >
            <Sparks burst={burst} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? 'ok' : 'copy'}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? t('result.copied') : t('result.copy')}
              </motion.span>
            </AnimatePresence>
          </motion.button>

          <motion.div className="card" {...stagger(1)}>
            <div className="title">{note.title}</div>
            {note.code && (
              <div className="code">
                {note.code}
                <CopyMini text={note.code} />
              </div>
            )}
            {note.lines.map((l) => (
              <div key={l} className="line">
                {l}
              </div>
            ))}
          </motion.div>

          {s.result && s.result.notes.length > 0 && (
            <motion.div className="card" {...stagger(2)}>
              <div className="title">{t('result.changes')}</div>
              <ul className="notes">
                {s.result.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </motion.div>
          )}

          <motion.div className="row" {...stagger(3)} style={{ flexWrap: 'wrap' }}>
            <button className="ghost" onClick={() => write()}>
              <RefreshCw size={14} /> {t('result.rewrite')}
            </button>
            {s.analysis && (
              <button className="ghost" onClick={() => patch({ stage: 'review' })}>
                <SlidersHorizontal size={14} /> {t('result.changeSetting')}
              </button>
            )}
            <button className="ghost" onClick={reset} style={{ marginLeft: 'auto' }}>
              {t('result.new')}
            </button>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}

export function stageKey(s: FlowState) {
  return s.stage === 'generating' ? 'result' : s.stage
}
