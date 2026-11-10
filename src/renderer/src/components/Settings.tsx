import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Cpu, FolderOpen, Plug, Power, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react'
import { FAMILY_SHORT, PROVIDERS, PROVIDER_INFO, SURFACES, type FamilyChoice, type Surface } from '@shared/catalog'
import { PRODUCT } from '@shared/product'
import type { EngineRef, ReplyLanguage, SettingsPatch, SettingsView, UiLanguage, UpdateView } from '@shared/types'
import { cleanError } from '../errors'
import { fmtNumber, surfaceLabel, t } from '../i18n'
import { FamilyPicker, ProviderCard, ToggleRow } from './Fields'
import { Segment } from './Pickers'

export function Settings({
  onClose,
  onChanged,
  onRerunSetup
}: {
  onClose: () => void
  onChanged: (v: SettingsView) => void
  onRerunSetup: () => void
}) {
  const [v, setV] = useState<SettingsView | null>(null)
  const [hotkey, setHotkey] = useState('')
  const [test, setTest] = useState<{ ok: boolean; ms: number; message?: string; engine?: EngineRef } | 'running' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [upd, setUpd] = useState<{ state: 'idle' | 'checking' | 'error'; view?: UpdateView; message?: string }>({ state: 'idle' })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    window.prism.settings
      .get()
      .then((view) => {
        setV(view)
        setHotkey(view.hotkey)
      })
      .catch((e: unknown) => setError(cleanError(e)))
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const changed = (next: SettingsView) => {
    setV(next)
    onChanged(next)
  }

  const apply = async (patch: SettingsPatch) => {
    setError(null)
    try {
      changed(await window.prism.settings.set(patch))
    } catch (e) {
      setError(cleanError(e))
    }
  }

  const checkNow = async () => {
    setUpd({ state: 'checking' })
    try {
      setUpd({ state: 'idle', view: await window.prism.update.check() })
    } catch (e) {
      setUpd({ state: 'error', message: cleanError(e) })
    }
  }

  // Onaylanırsa ana süreç uygulamayı yeniden başlatır; vazgeçilirse false döner, kısmi silme hata olarak gelir.
  const deleteAll = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      if (!(await window.prism.data.deleteAll())) setConfirmDelete(false)
    } catch (e) {
      setDeleteError(cleanError(e))
    } finally {
      setDeleting(false)
    }
  }

  const ready = v?.providers.filter((p) => p.ready) ?? []
  const engine = v?.engine
  const engineModels = v?.providers.find((p) => p.id === engine?.provider)?.status?.models ?? []
  const setEngineModel = (role: 'analysis' | 'generation', model: string) => {
    if (!v || !engine || !model) return
    const cur = v.engineModels[engine.provider] ?? { analysis: engine.analysis, generation: engine.generation }
    void apply({ engineModels: { [engine.provider]: { ...cur, [role]: model } } })
  }
  const multi = PRODUCT.familyMode === 'multi' && (v?.families.length ?? 0) > 1

  return (
    <>
      <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        <div className="head">
          {t('settings.title')}
          <button className="icon-btn" onClick={onClose} title={t('common.close')} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        {v && (
          <div className="content">
            <div className="group">
              <span className="label">{t('settings.language')}</span>
              <Segment<UiLanguage>
                id="ui-lang"
                value={v.uiLanguage}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'tr', label: 'Türkçe' }
                ]}
                onChange={(uiLanguage) => apply({ uiLanguage })}
              />
              <span className="hint">{t('settings.languageHint')}</span>
            </div>

            <div className="group">
              <span className="label">{t('settings.families')}</span>
              <FamilyPicker product={PRODUCT} value={v.families} onChange={(families) => apply({ families })} />
              <span className="hint">
                {PRODUCT.familyMode === 'single' ? t('settings.familiesHintSingle', { product: PRODUCT.name }) : t('settings.familiesHintMulti')}
              </span>
            </div>

            <div className="group">
              <span className="label">{t('settings.providers')}</span>
              <span className="hint">{t('settings.providersHint')}</span>
              {PROVIDERS.map((id) => {
                const pv = v.providers.find((p) => p.id === id)
                return pv && <ProviderCard key={id} view={pv} settings={v} onChanged={changed} onSettings={apply} />
              })}
            </div>

            <div className="group">
              <span className="label">{t('settings.engine')}</span>
              <span className="hint">{t('settings.engineHint')}</span>
              <label className="field">
                <span>{t('settings.engineProvider')}</span>
                <select
                  className="input"
                  value={v.engineProvider}
                  onChange={(e) => {
                    const value = e.target.value
                    const choice = value === 'auto' ? value : PROVIDERS.find((p) => p === value)
                    if (choice) void apply({ engineProvider: choice })
                  }}
                >
                  <option value="auto">
                    {t('settings.engineAuto')}
                    {engine ? ` (${PROVIDER_INFO[engine.provider].label})` : ''}
                  </option>
                  {ready.map((p) => (
                    <option key={p.id} value={p.id}>
                      {PROVIDER_INFO[p.id].label}
                      {p.status?.ok ? '' : ` ${t('settings.notVerified')}`}
                    </option>
                  ))}
                </select>
              </label>
              {engine ? (
                <>
                  <label className="field">
                    <span>{t('settings.engineAnalysis')}</span>
                    <input
                      key={`a-${engine.provider}`}
                      className="input mono"
                      list="engine-models"
                      defaultValue={engine.analysis}
                      onBlur={(e) => e.target.value.trim() !== engine.analysis && setEngineModel('analysis', e.target.value.trim())}
                    />
                  </label>
                  <label className="field">
                    <span>{t('settings.engineGeneration')}</span>
                    <input
                      key={`g-${engine.provider}`}
                      className="input mono"
                      list="engine-models"
                      defaultValue={engine.generation}
                      onBlur={(e) => e.target.value.trim() !== engine.generation && setEngineModel('generation', e.target.value.trim())}
                    />
                  </label>
                  <datalist id="engine-models">
                    {engineModels.map((m) => (
                      <option key={m.id} value={m.id} />
                    ))}
                  </datalist>
                  <div className="row">
                    <button
                      className="ghost"
                      onClick={async () => {
                        setTest('running')
                        setTest(await window.prism.settings.test())
                      }}
                    >
                      <Plug size={14} /> {test === 'running' ? t('settings.engineTesting') : t('settings.engineTest')}
                    </button>
                  </div>
                  {test && test !== 'running' && (
                    <span className={`hint ${test.ok ? 'ok-text' : 'bad-text'}`} role="status">
                      {test.ok
                        ? t('settings.engineWorks', {
                            engine: test.engine ? `${PROVIDER_INFO[test.engine.provider].label} ${test.engine.model} · ` : '',
                            seconds: t('time.seconds', { n: fmtNumber(test.ms / 1000, { maximumFractionDigits: 1 }) })
                          })
                        : test.message}
                    </span>
                  )}
                </>
              ) : (
                <span className="hint bad-text">
                  <Cpu size={12} style={{ verticalAlign: -2 }} /> {t('settings.engineNone')}
                </span>
              )}
            </div>

            <div className="group">
              {multi && (
                <>
                  <span className="label">{t('settings.defaultFamily')}</span>
                  <Segment<FamilyChoice>
                    id="def-family"
                    value={v.defaultFamily}
                    options={[{ value: 'auto', label: t('family.autoShort') }, ...v.families.map((f) => ({ value: f, label: FAMILY_SHORT[f] }))]}
                    onChange={(defaultFamily) => apply({ defaultFamily })}
                  />
                  <span className="hint">{t('settings.defaultFamilyHint')}</span>
                </>
              )}
              {v.families.map((f) => (
                <ToggleRow
                  key={f}
                  label={t('settings.appFamily', { family: FAMILY_SHORT[f] })}
                  on={v.appFamilies.includes(f)}
                  onChange={(on) => apply({ appFamilies: on ? [...v.appFamilies, f] : v.appFamilies.filter((x) => x !== f) })}
                />
              ))}
            </div>

            <div className="group">
              <span className="label">{t('settings.replyLanguage')}</span>
              <Segment<ReplyLanguage>
                id="reply-lang"
                value={v.replyLanguage}
                options={[
                  { value: 'tr', label: t('settings.replyTr') },
                  { value: 'en', label: t('settings.replyEn') },
                  { value: 'none', label: t('settings.replyNone') }
                ]}
                onChange={(replyLanguage) => apply({ replyLanguage })}
              />
              <span className="hint">{t('settings.replyHint')}</span>
            </div>

            <div className="group">
              <span className="label">{t('settings.defaultSurface')}</span>
              <Segment<Surface>
                id="def-surface"
                value={v.defaultSurface}
                options={SURFACES.map((s) => ({ value: s, label: surfaceLabel(v.defaultFamily, s) }))}
                onChange={(defaultSurface) => apply({ defaultSurface })}
              />
            </div>

            <div className="group">
              <span className="label">{t('settings.window')}</span>
              <ToggleRow label={t('settings.alwaysOnTop')} on={v.alwaysOnTop} onChange={(alwaysOnTop) => apply({ alwaysOnTop })} />
              <ToggleRow label={t('settings.launchAtLogin')} on={v.launchAtLogin} onChange={(launchAtLogin) => apply({ launchAtLogin })} />
              <ToggleRow label={t('settings.notify')} on={v.notifyWhenHidden} onChange={(notifyWhenHidden) => apply({ notifyWhenHidden })} />
              <label className="field">
                <span>{t('settings.hotkey')}</span>
                <input
                  className="input mono"
                  value={hotkey}
                  onChange={(e) => setHotkey(e.target.value)}
                  onBlur={() => hotkey.trim() && hotkey !== v.hotkey && apply({ hotkey: hotkey.trim() })}
                />
              </label>
              {!v.hotkeyOk && (
                <span className="hint bad-text" role="alert">
                  {t('settings.hotkeyBlocked')}
                </span>
              )}
              {error && (
                <span className="hint bad-text" role="alert">
                  {error}
                </span>
              )}
            </div>

            <div className="group">
              <span className="label">{t('settings.privacy')}</span>
              <ToggleRow label={t('settings.saveHistory')} on={v.saveHistory} onChange={(saveHistory) => apply({ saveHistory })} />
              {window.prism.platform !== 'linux' && (
                <ToggleRow
                  label={t('settings.contentProtection')}
                  on={v.contentProtection}
                  onChange={(contentProtection) => apply({ contentProtection })}
                />
              )}
              <span className="hint">{t('settings.privacyHint')}</span>
            </div>

            <div className="group">
              <span className="label">{t('settings.updates')}</span>
              <ToggleRow label={t('settings.updateCheck')} on={v.updateCheck} onChange={(updateCheck) => apply({ updateCheck })} />
              <span className="hint">{t('settings.updateHint', { product: PRODUCT.name })}</span>
              <div className="row">
                <button className="ghost" onClick={checkNow} disabled={upd.state === 'checking'}>
                  <RefreshCw size={14} /> {upd.state === 'checking' ? t('settings.updateChecking') : t('settings.updateNow')}
                </button>
              </div>
              {upd.view && (
                <span className="hint ok-text" role="status">
                  {upd.view.latest
                    ? t('settings.updateFound', { version: upd.view.latest.version })
                    : t('settings.updateUpToDate', { version: upd.view.current })}
                </span>
              )}
              {upd.state === 'error' && (
                <span className="hint bad-text" role="alert">
                  {t('settings.updateFailed', { message: upd.message ?? '' })}
                </span>
              )}
            </div>

            <div className="group">
              <span className="label">{t('settings.data')}</span>
              <span className="hint">{t('settings.dataHint')}</span>
              {confirmDelete ? (
                <div
                  className="confirm"
                  role="alertdialog"
                  aria-labelledby="delete-title"
                  aria-describedby="delete-body"
                  onKeyDown={(e) => {
                    // Esc önce bu onayı kapatır; ayarlar sayfası açık kalır.
                    if (e.key === 'Escape' && !deleting) {
                      e.stopPropagation()
                      setConfirmDelete(false)
                    }
                  }}
                >
                  <b id="delete-title">{t('settings.deleteConfirmTitle')}</b>
                  <span id="delete-body" className="hint">
                    {t('settings.deleteConfirmBody', { product: PRODUCT.name })}
                  </span>
                  <div className="row">
                    <button className="ghost" autoFocus disabled={deleting} onClick={() => setConfirmDelete(false)}>
                      {t('common.cancel')}
                    </button>
                    <button className="ghost danger" disabled={deleting} onClick={deleteAll}>
                      <Trash2 size={14} /> {deleting ? t('settings.deleting') : t('settings.deleteConfirm')}
                    </button>
                  </div>
                  {deleteError && (
                    <span className="hint bad-text" role="alert">
                      {deleteError}
                    </span>
                  )}
                </div>
              ) : (
                <div className="row">
                  <button className="ghost danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} /> {t('settings.deleteAll')}
                  </button>
                </div>
              )}
            </div>

            <div className="group">
              <span className="label">{t('settings.knowledge')}</span>
              <span className="hint">{t('settings.knowledgeHint')}</span>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="ghost" onClick={() => window.prism.settings.openKnowledge()}>
                  <FolderOpen size={14} /> {t('settings.openFolder')}
                </button>
                <button className="ghost" onClick={onRerunSetup}>
                  <RotateCcw size={14} /> {t('settings.rerunSetup')}
                </button>
                <button className="ghost" style={{ marginLeft: 'auto' }} onClick={() => window.prism.window.quit()}>
                  <Power size={14} /> {t('settings.quit')}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}
