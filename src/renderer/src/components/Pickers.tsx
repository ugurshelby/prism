import { motion } from 'motion/react'
import {
  EFFORT_INFO,
  FAMILIES,
  FAMILY_INFO,
  MODELS,
  type Effort,
  type ModelId
} from '@shared/catalog'
import type { TargetAccess } from '@shared/types'
import { effortHint, modelTagline, t } from '../i18n'

export function Segment<T extends string>({
  id,
  value,
  options,
  onChange
}: {
  id: string
  value: T
  options: { value: T; label: string; hue?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segment">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.value === value && (
            <motion.span layoutId={`seg-${id}`} className="thumb" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
          )}
          {o.hue && <i className="seg-dot" style={{ background: o.hue, boxShadow: o.value === value ? `0 0 8px ${o.hue}` : undefined }} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Claude cards in the v1 order (most used first); other families in catalog order.
const CLAUDE_ORDER: ModelId[] = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1']

function ordered(models: ModelId[]) {
  return [...models].sort((a, b) => {
    const fa = FAMILIES.indexOf(MODELS[a].family)
    const fb = FAMILIES.indexOf(MODELS[b].family)
    if (fa !== fb) return fa - fb
    const ia = CLAUDE_ORDER.indexOf(a)
    const ib = CLAUDE_ORDER.indexOf(b)
    return ia >= 0 && ib >= 0 ? ia - ib : 0
  })
}

export function ModelPicker({
  models,
  value,
  onChange,
  access
}: {
  models: ModelId[]
  value: ModelId
  onChange: (m: ModelId) => void
  access?: Partial<Record<ModelId, TargetAccess>>
}) {
  const list = ordered(models)
  const grouped = new Set(list.map((m) => MODELS[m].family)).size > 1
  return (
    <div className="models">
      {list.map((id, i) => {
        const m = MODELS[id]
        const selected = id === value
        const prev = list[i - 1]
        const first = grouped && (!prev || MODELS[prev].family !== m.family)
        const a = access?.[id]
        return [
          first && (
            <div key={`h-${m.family}`} className="models-group">
              {FAMILY_INFO[m.family].name}
            </div>
          ),
          <motion.button
            key={id}
            className={`model-card ${selected ? 'selected' : ''}`}
            style={{ '--hue': m.hue }}
            onClick={() => onChange(id)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {selected && <motion.span layoutId="model-glow" className="glow" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <div className="name">
              <span className="dot" />
              {m.short}
            </div>
            <div className="tag">{modelTagline(id)}</div>
            <div className="price">
              ${m.price.input} / ${m.price.output} · {t(`latency.${m.latency}`)}
            </div>
            {a && <span className={`access ${a}`}>{t(`access.${a}`)}</span>}
          </motion.button>
        ]
      })}
    </div>
  )
}

export function EffortPicker({
  model,
  value,
  onChange,
  defaultEffort
}: {
  model: ModelId
  value: Effort
  onChange: (e: Effort) => void
  defaultEffort?: Effort
}) {
  const levels = MODELS[model].efforts
  const label = FAMILY_INFO[MODELS[model].family].effortLabel
  if (!levels.length) return <div className="effort-hint">{t('effort.fixedNote', { label })}</div>
  const index = levels.indexOf(value)
  const top = Math.max(1, levels.length - 1)
  return (
    <div className="effort">
      <div className="effort-track">
        {levels.map((e, i) => (
          <button
            key={e}
            className={`effort-step ${e === value ? 'active' : ''} ${e === defaultEffort ? 'def' : ''}`}
            onClick={() => onChange(e)}
          >
            <span className="bar">
              <motion.i
                initial={false}
                animate={{ scaleX: i <= index ? 1 : 0, opacity: i <= index ? 0.55 + (i / top) * 0.45 : 0 }}
                transition={{ duration: 0.35, delay: i <= index ? i * 0.04 : 0, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
            {EFFORT_INFO[e].label}
          </button>
        ))}
      </div>
      <motion.div key={value} className="effort-hint" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
        {label} · {effortHint(value)}
      </motion.div>
    </div>
  )
}

export function Meter({ model, effort }: { model: ModelId; effort: Effort }) {
  const levels = MODELS[model].efforts
  const index = levels.indexOf(effort)
  return (
    <span className="meter">
      {(levels.length ? levels : [effort]).map((e, i) => (
        <motion.i
          key={e}
          className={i <= index || !levels.length ? 'on' : ''}
          initial={{ scaleX: 0.3, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.25 + i * 0.07, duration: 0.3 }}
        />
      ))}
    </span>
  )
}
