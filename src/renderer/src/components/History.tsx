import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { FAMILIES, FAMILY_INFO, MODELS, PROVIDER_INFO, effortText, surfaceInfo, type Family } from '@shared/catalog'
import type { HistoryEntry, HistoryStorage } from '@shared/types'
import { t } from '../i18n'
import { Logo } from './Prism'

// Relative time is formatted per language; a new formatter is built when the language changes.
const rtf = () => new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

// A deleted or old model ID must not corrupt the entry.
const modelOf = (e: HistoryEntry) => MODELS[e.outputs.at(-1)?.model ?? e.analysis.recommendation.model] ?? MODELS['claude-opus-5-5']

function ago(ts: number) {
  const s = Math.round((ts - Date.now()) / 1000)
  if (s > -45) return t('time.justNow')
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month']
  ]
  let v = s
  for (const [n, unit] of steps) {
    if (Math.abs(v) < n) return rtf().format(Math.round(v), unit)
    v /= n
  }
  return rtf().format(Math.round(v), 'year')
}

function Item({
  entry,
  index,
  onOpen,
  onRewrite,
  onDelete
}: {
  entry: HistoryEntry
  index: number
  onOpen: () => void
  onRewrite: () => void
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const last = entry.outputs.at(-1)
  const model = modelOf(entry)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <motion.li
      layout
      className="h-item"
      style={{ '--hue': model.hue }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.035, duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, x: -24, scale: 0.98, transition: { duration: 0.2 } }}
    >
      <button className="h-body" onClick={onOpen} title={t('history.open')}>
        <div className="h-meta">
          <span className="dot" />
          {last ? (
            <b>
              {model.short} · {effortText(model.id, last.effort)}
            </b>
          ) : (
            <span className="h-only">{t('history.analysisOnly')}</span>
          )}
          <span>· {surfaceInfo(model.family, entry.surface).label}</span>
          {entry.outputs.length > 1 && <span className="h-count">×{entry.outputs.length}</span>}
          <span className="h-time">{ago(entry.updatedAt)}</span>
        </div>
        <div className="h-text">{entry.prompt}</div>
        <div className="h-sub">
          {FAMILY_INFO[model.family].name}
          {last?.engine && ` · ${PROVIDER_INFO[last.engine.provider]?.label ?? last.engine.provider} · ${last.engine.model}`}
        </div>
      </button>
      <div className="h-actions">
        {last && (
          <button
            className={`h-btn ${copied ? 'ok' : ''}`}
            onClick={async () => {
              await window.prism.clipboard.write(last.prompt)
              setCopied(true)
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t('result.copied') : t('common.copy')}
          </button>
        )}
        <button className="h-btn" onClick={onRewrite}>
          <RefreshCw size={13} />
          {last ? t('result.rewrite') : t('history.write')}
        </button>
        <button className="icon-btn h-del" title={t('common.delete')} aria-label={t('common.delete')} onClick={onDelete}>
          <Trash2 size={13} />
        </button>
      </div>
    </motion.li>
  )
}

export function History({
  onClose,
  onOpen,
  onRewrite
}: {
  onClose: () => void
  onOpen: (e: HistoryEntry) => void
  onRewrite: (e: HistoryEntry) => void
}) {
  const [items, setItems] = useState<HistoryEntry[] | null>(null)
  const [storage, setStorage] = useState<HistoryStorage>('encrypted')
  const [reset, setReset] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [family, setFamily] = useState<Family | 'all'>('all')

  useEffect(() => {
    window.prism.history
      .list()
      .then((list) => {
        setItems(list.entries)
        setStorage(list.storage)
        setReset(list.reset === true)
      })
      .catch((e: unknown) => {
        setItems([])
        setLoadError(e instanceof Error ? e.message : t('history.loadError'))
      })
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const present = useMemo(() => FAMILIES.filter((f) => items?.some((e) => modelOf(e).family === f)), [items])

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('en-US')
    return (items ?? []).filter(
      (e) =>
        (family === 'all' || modelOf(e).family === family) &&
        (!q ||
          [e.prompt, e.analysis.intent, e.outputs.at(-1)?.prompt ?? '', modelOf(e).name].some((term) =>
            term.toLocaleLowerCase('en-US').includes(q)
          ))
    )
  }, [items, query, family])

  const remove = async (id: string) => {
    setItems((list) => list?.filter((e) => e.id !== id) ?? null)
    await window.prism.history.remove(id)
  }

  return (
    <>
      <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="sheet left"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        <div className="head">
          <span>
            History {items && items.length > 0 && <span className="h-total">{items.length}</span>}
          </span>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {items && items.length > 0 && (
          <div className="h-search">
            <Search size={14} />
            <input placeholder={t('history.search')} aria-label={t('history.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}

        {present.length > 1 && (
          <div className="h-filter">
            {(['all', ...present] as const).map((f) => (
              <button
                key={f}
                className={family === f ? 'on' : ''}
                style={f === 'all' ? undefined : { '--hue': FAMILY_INFO[f].hue }}
                onClick={() => setFamily(f)}
              >
                {f !== 'all' && <i />}
                {f === 'all' ? t('history.all') : FAMILY_INFO[f].name}
              </button>
            ))}
          </div>
        )}

        <div className="content">
          {loadError && <span className="hint bad-text">{loadError}</span>}
          {items && items.length === 0 && (
            <motion.div className="h-empty" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
              <Logo size={34} />
              <b>{t('history.empty')}</b>
              <span>
                {storage === 'off'
                  ? t('history.offEmpty')
                  : t('history.emptyHint')}
              </span>
            </motion.div>
          )}
          {items && items.length > 0 && shown.length === 0 && (
            <span className="hint">{query ? t('history.noResults', { query }) : t('history.noneInFamily')}</span>
          )}
          <ul className="h-list">
            <AnimatePresence mode="popLayout">
              {shown.map((e, i) => (
                <Item
                  key={e.id}
                  entry={e}
                  index={i}
                  onOpen={() => onOpen(e)}
                  onRewrite={() => onRewrite(e)}
                  onDelete={() => remove(e.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </div>

        {reset && (
          <p className="hint" role="status">
            {t('history.reset')}
          </p>
        )}
        {items && items.length > 0 && (
          <div className="h-foot">
            <span className="hint">
              {storage === 'encrypted'
                ? t('history.encrypted')
                : storage === 'off'
                  ? t('history.off')
                  : t('history.memory')}
            </span>
            <button
              className={`link ${confirmClear ? 'bad-text' : ''}`}
              onClick={async () => {
                if (!confirmClear) return setConfirmClear(true)
                await window.prism.history.clear()
                setItems([])
                setConfirmClear(false)
              }}
              onBlur={() => setConfirmClear(false)}
            >
              <Trash2 size={12} /> {confirmClear ? t('history.confirmClear') : t('history.clear')}
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
}
