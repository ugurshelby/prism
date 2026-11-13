// Fields shared by settings and the setup wizard.
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Check, ChevronDown, ExternalLink, KeyRound, RefreshCw } from 'lucide-react'
import { FAMILIES, FAMILY_INFO, PROVIDER_INFO, type Family } from '@shared/catalog'
import type { ProductInfo } from '@shared/product'
import type { ProviderView, SettingsPatch, SettingsView } from '@shared/types'
import { cleanError } from '../errors'
import { fmtNumber, t } from '../i18n'

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label}>
      <i />
    </button>
  )
}

/** Toggle with its row text: a screen reader reads the row text as the toggle's name. */
export function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      {label}
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  )
}

/**
  * Target family selection. In a single-family product (Ray) it acts like a radio button; in a multi-family product at least one family stays selected.
 */
export function FamilyPicker({ product, value, onChange }: { product: ProductInfo; value: readonly Family[]; onChange: (f: Family[]) => void }) {
  const single = product.familyMode === 'single'
  const toggle = (f: Family) => {
    if (single) return onChange([f])
    const next = value.includes(f) ? value.filter((x) => x !== f) : FAMILIES.filter((x) => x === f || value.includes(x))
    if (next.length) onChange(next)
  }
  return (
    <div className="families" role={single ? 'radiogroup' : 'group'} aria-label={t('settings.families')}>
      {FAMILIES.map((f) => {
        const on = value.includes(f)
        return (
          <button
            key={f}
            className={`family-card ${on ? 'on' : ''}`}
            style={{ '--hue': FAMILY_INFO[f].hue }}
            role={single ? 'radio' : 'checkbox'}
            aria-checked={on}
            onClick={() => toggle(f)}
          >
            <span className="dot" />
            <b>{FAMILY_INFO[f].name}</b>
            <span className="vendor">{FAMILY_INFO[f].vendor}</span>
            {on && <Check size={14} className="tick" />}
          </button>
        )
      })}
    </div>
  )
}

function statusOf(p: ProviderView): { color: string; text: string } {
  const source = t(`provider.source.${p.key.source === 'saved' ? 'saved' : 'env'}`)
  const hint = p.key.hint
  if (!p.key.present) return { color: 'var(--muted)', text: t('provider.status.none') }
  if (!p.ready) return { color: 'var(--danger)', text: t('provider.status.noProject', { hint }) }
  if (!p.status) return { color: 'var(--warn)', text: t('provider.status.unverified', { hint, source }) }
  if (!p.status.ok) return { color: 'var(--danger)', text: t('provider.status.error', { hint, source }) }
  return { color: 'var(--ok)', text: t('provider.status.ok', { hint, source, n: fmtNumber(p.status.models.length) }) }
}

export function ProviderCard({
  view,
  settings,
  onChanged,
  onSettings
}: {
  view: ProviderView
  settings: SettingsView
  onChanged: (v: SettingsView) => void
  onSettings: (patch: SettingsPatch) => void
}) {
  const info = PROVIDER_INFO[view.id]
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState<'save' | 'verify' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const st = statusOf(view)

  const run = async (kind: 'save' | 'verify', fn: () => Promise<SettingsView>) => {
    setBusy(kind)
    setError(null)
    try {
      onChanged(await fn())
      if (kind === 'save') setKey('')
    } catch (e) {
      setError(cleanError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="provider">
      <div className="provider-head">
        <b>{info.label}</b>
        <span className="provider-family">{FAMILY_INFO[info.family].name}</span>
        {/* The main process opens https links in the system browser. */}
        {!view.key.present && (
          <a className="link" href={info.keyUrl} target="_blank" rel="noreferrer">
            {t('provider.getKey')} <ExternalLink size={11} />
          </a>
        )}
        <span className="pill-status" style={{ marginLeft: 'auto' }}>
          <i style={{ background: st.color, boxShadow: `0 0 8px ${st.color}` }} />
          {st.text}
        </span>
      </div>

      {view.id === 'vertex' && (
        <div className="row">
          <input
            className="input mono"
            style={{ flex: 1 }}
            placeholder={t('provider.projectId')}
            aria-label={t('provider.projectId')}
            defaultValue={settings.vertex.project}
            onBlur={(e) => e.target.value.trim() !== settings.vertex.project && onSettings({ vertex: { project: e.target.value.trim() } })}
          />
          <input
            className="input mono"
            style={{ width: 110 }}
            placeholder="global"
            aria-label={t('provider.location')}
            defaultValue={settings.vertex.location}
            onBlur={(e) => onSettings({ vertex: { location: e.target.value.trim() || 'global' } })}
          />
        </div>
      )}

      <div className="row">
        <input
          className="input mono"
          style={{ flex: 1 }}
          type="password"
          autoComplete="off"
          aria-label={t('provider.keyLabel', { provider: info.label })}
          placeholder={view.key.present ? t('provider.replaceKey') : t('provider.keyPlaceholder', { env: info.env })}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && key.trim() && !busy && void run('save', () => window.prism.providers.saveKey(view.id, key))}
        />
        <button className="ghost" disabled={!key.trim() || !!busy} onClick={() => run('save', () => window.prism.providers.saveKey(view.id, key))}>
          <KeyRound size={14} /> {busy === 'save' ? t('provider.verifying') : t('provider.save')}
        </button>
      </div>

      {(view.key.present || view.status) && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {view.ready && (
            <button className="ghost" disabled={!!busy} onClick={() => run('verify', () => window.prism.providers.verify(view.id))}>
              <RefreshCw size={13} /> {busy === 'verify' ? t('provider.verifying') : t('provider.verify')}
            </button>
          )}
          {view.status?.ok && (
            <button className="link" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : undefined }} /> {t('provider.models')}
            </button>
          )}
          {view.key.source === 'saved' && (
            <button className="link" style={{ marginLeft: 'auto' }} onClick={() => run('verify', () => window.prism.providers.clearKey(view.id))}>
              {t('provider.deleteKey')}
            </button>
          )}
        </div>
      )}

      {view.key.problem && <span className="hint bad-text">{view.key.problem}</span>}
      {view.status && !view.status.ok && <span className="hint bad-text">{view.status.message}</span>}
      {error && (
        <span className="hint bad-text" role="alert">
          {error}
        </span>
      )}

      <AnimatePresence initial={false}>
        {open && view.status?.ok && (
          <motion.div className="provider-models" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {view.status.models.map((m) => (
              <span key={m.id}>{m.id}</span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
