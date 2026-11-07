import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { ChevronDown, Cpu, ExternalLink, FolderOpen, KeyRound, Plug, Power, RefreshCw, X } from 'lucide-react'
import {
  FAMILIES,
  FAMILY_INFO,
  PROVIDERS,
  PROVIDER_INFO,
  surfaceInfo,
  SURFACES,
  type FamilyChoice,
  type Surface
} from '@shared/catalog'
import type { EngineRef, ProviderView, ReplyLanguage, SettingsPatch, SettingsView } from '@shared/types'
import { cleanError } from '../errors'
import { Segment } from './Pickers'

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <i />
    </button>
  )
}


function statusOf(p: ProviderView): { color: string; text: string } {
  const source = p.key.source === 'saved' ? 'kayıtlı' : '.env'
  if (!p.key.present) return { color: 'var(--muted)', text: 'Key yok' }
  if (!p.ready) return { color: 'var(--danger)', text: `${p.key.hint} · proje ID eksik` }
  if (!p.status) return { color: '#ffd36e', text: `${p.key.hint} · ${source} · doğrulanmadı` }
  if (!p.status.ok) return { color: 'var(--danger)', text: `${p.key.hint} · ${source} · hata` }
  return { color: 'var(--ok)', text: `${p.key.hint} · ${source} · ${p.status.models.length} model` }
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
        {/* Ana süreç https bağlantılarını sistem tarayıcısında açar. */}
        {!view.key.present && (
          <a className="link" href={info.keyUrl} target="_blank" rel="noreferrer">
            Key al <ExternalLink size={11} />
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
            placeholder="Proje ID"
            defaultValue={settings.vertex.project}
            onBlur={(e) => e.target.value.trim() !== settings.vertex.project && onSettings({ vertex: { project: e.target.value.trim() } })}
          />
          <input
            className="input mono"
            style={{ width: 110 }}
            placeholder="global"
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
          placeholder={view.key.present ? 'Yeni key ile değiştir' : `${info.env} (şifreli saklanır)`}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button
          className="ghost"
          disabled={!key.trim() || !!busy}
          onClick={() => run('save', () => window.prism.providers.saveKey(view.id, key))}
        >
          <KeyRound size={14} /> {busy === 'save' ? 'Doğrulanıyor…' : 'Kaydet'}
        </button>
      </div>

      {(view.key.present || view.status) && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {view.ready && (
            <button className="ghost" disabled={!!busy} onClick={() => run('verify', () => window.prism.providers.verify(view.id))}>
              <RefreshCw size={13} /> {busy === 'verify' ? 'Doğrulanıyor…' : 'Doğrula ve modelleri getir'}
            </button>
          )}
          {view.status?.ok && (
            <button className="link" onClick={() => setOpen((v) => !v)}>
              <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : undefined }} /> Modeller
            </button>
          )}
          {view.key.source === 'saved' && (
            <button className="link" style={{ marginLeft: 'auto' }} onClick={() => run('verify', () => window.prism.providers.clearKey(view.id))}>
              Kayıtlı key’i sil
            </button>
          )}
        </div>
      )}

      {view.key.problem && <span className="hint bad-text">{view.key.problem}</span>}
      {view.status && !view.status.ok && <span className="hint bad-text">{view.status.message}</span>}
      {error && <span className="hint bad-text">{error}</span>}

      <AnimatePresence initial={false}>
        {open && view.status?.ok && (
          <motion.div
            className="provider-models"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {view.status.models.map((m) => (
              <span key={m.id}>{m.id}</span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Settings({ onClose, onChanged }: { onClose: () => void; onChanged: (v: SettingsView) => void }) {
  const [v, setV] = useState<SettingsView | null>(null)
  const [hotkey, setHotkey] = useState('')
  const [test, setTest] = useState<{ ok: boolean; ms: number; message?: string; engine?: EngineRef } | 'running' | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const ready = v?.providers.filter((p) => p.ready) ?? []
  const engine = v?.engine
  const engineModels = v?.providers.find((p) => p.id === engine?.provider)?.status?.models ?? []
  const setEngineModel = (role: 'analysis' | 'generation', model: string) => {
    if (!v || !engine || !model) return
    const cur = v.engineModels[engine.provider] ?? { analysis: engine.analysis, generation: engine.generation }
    void apply({ engineModels: { [engine.provider]: { ...cur, [role]: model } } })
  }

  return (
    <>
      <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="sheet"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        <div className="head">
          Ayarlar
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {v && (
          <div className="content">
            <div className="group">
              <span className="label">Sağlayıcılar</span>
              <span className="hint">
                Key’ler yalnızca bu bilgisayarda, işletim sisteminin şifrelemesiyle saklanır; arayüze yalnızca son dört karakteri
                gelir. Kaydedince bağlantı ve erişilen modeller doğrulanır.
              </span>
              {PROVIDERS.map((id) => (
                <ProviderCard
                  key={id}
                  view={v.providers.find((p) => p.id === id)!}
                  settings={v}
                  onChanged={changed}
                  onSettings={apply}
                />
              ))}
            </div>

            <div className="group">
              <span className="label">Prism motoru</span>
              <span className="hint">Analiz, öneri ve yazımı yapan model. Yalnızca key’i tanımlı sağlayıcılar seçilebilir.</span>
              <label className="field">
                <span>Sağlayıcı</span>
                <select
                  className="input"
                  value={v.engineProvider}
                  onChange={(e) => {
                    const value = e.target.value
                    const choice = value === 'auto' ? value : PROVIDERS.find((p) => p === value)
                    if (choice) void apply({ engineProvider: choice })
                  }}
                >
                  <option value="auto">Otomatik{engine ? ` (${PROVIDER_INFO[engine.provider].label})` : ''}</option>
                  {ready.map((p) => (
                    <option key={p.id} value={p.id}>
                      {PROVIDER_INFO[p.id].label}
                      {p.status?.ok ? '' : ' (doğrulanmadı)'}
                    </option>
                  ))}
                </select>
              </label>
              {engine ? (
                <>
                  <label className="field">
                    <span>Analiz (öneri + sorular)</span>
                    <input
                      key={`a-${engine.provider}`}
                      className="input mono"
                      list="engine-models"
                      defaultValue={engine.analysis}
                      onBlur={(e) => e.target.value.trim() !== engine.analysis && setEngineModel('analysis', e.target.value.trim())}
                    />
                  </label>
                  <label className="field">
                    <span>Yazım (prompt üretimi)</span>
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
                      <Plug size={14} /> {test === 'running' ? 'Deneniyor…' : 'Motoru test et'}
                    </button>
                  </div>
                  {test && test !== 'running' && (
                    <span className={`hint ${test.ok ? 'ok-text' : 'bad-text'}`}>
                      {test.ok
                        ? `Çalışıyor · ${test.engine ? `${PROVIDER_INFO[test.engine.provider].label} ${test.engine.model} · ` : ''}${(test.ms / 1000).toFixed(1)} sn`
                        : test.message}
                    </span>
                  )}
                </>
              ) : (
                <span className="hint bad-text">
                  <Cpu size={12} style={{ verticalAlign: -2 }} /> Motor için en az bir sağlayıcıya key ekle.
                </span>
              )}
            </div>

            <div className="group">
              <span className="label">Hedef ekosistem</span>
              <Segment<FamilyChoice>
                id="def-family"
                value={v.defaultFamily}
                options={[
                  { value: 'auto', label: '✦ Çapraz' },
                  ...FAMILIES.map((f) => ({ value: f, label: f === 'openai' ? 'GPT' : FAMILY_INFO[f].name }))
                ]}
                onChange={(defaultFamily) => apply({ defaultFamily })}
              />
              <span className="hint">
                Çapraz öneri, doğrulanmış key’lerin modelleri ile aşağıda işaretlediğin uygulamalar arasından seçer.
              </span>
              {FAMILIES.map((f) => (
                <div key={f} className="toggle-row">
                  {FAMILY_INFO[f].name} uygulamasını key olmadan kullanıyorum
                  <Toggle
                    on={v.appFamilies.includes(f)}
                    onChange={(on) =>
                      apply({ appFamilies: on ? [...v.appFamilies, f] : v.appFamilies.filter((x) => x !== f) })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="group">
              <span className="label">Modelin sana yanıt dili</span>
              <Segment<ReplyLanguage>
                id="lang"
                value={v.replyLanguage}
                options={[
                  { value: 'tr', label: 'Türkçe' },
                  { value: 'en', label: 'English' },
                  { value: 'none', label: 'Belirtme' }
                ]}
                onChange={(replyLanguage) => apply({ replyLanguage })}
              />
              <span className="hint">Prompt her zaman İngilizce yazılır; bu ayar içine bir dil satırı ekler.</span>
            </div>

            <div className="group">
              <span className="label">Varsayılan yüzey</span>
              <Segment<Surface>
                id="def-surface"
                value={v.defaultSurface}
                options={SURFACES.map((s) => ({ value: s, label: surfaceInfo(v.defaultFamily, s).label }))}
                onChange={(defaultSurface) => apply({ defaultSurface })}
              />
            </div>

            <div className="group">
              <span className="label">Pencere</span>
              <div className="toggle-row">
                Her zaman üstte
                <Toggle on={v.alwaysOnTop} onChange={(alwaysOnTop) => apply({ alwaysOnTop })} />
              </div>
              <div className="toggle-row">
                Oturum açılışında başlat (tray’de gizli)
                <Toggle on={v.launchAtLogin} onChange={(launchAtLogin) => apply({ launchAtLogin })} />
              </div>
              <div className="toggle-row">
                Pencere gizliyken prompt hazır olunca bildir
                <Toggle on={v.notifyWhenHidden} onChange={(notifyWhenHidden) => apply({ notifyWhenHidden })} />
              </div>
              <label className="field">
                <span>Göster / gizle kısayolu</span>
                <input
                  className="input mono"
                  value={hotkey}
                  onChange={(e) => setHotkey(e.target.value)}
                  onBlur={() => hotkey.trim() && hotkey !== v.hotkey && apply({ hotkey: hotkey.trim() })}
                />
              </label>
              {error && <span className="hint bad-text">{error}</span>}
            </div>

            <div className="group">
              <span className="label">Gizlilik</span>
              <div className="toggle-row">
                Geçmişi kaydet (bu bilgisayarda şifreli)
                <Toggle on={v.saveHistory} onChange={(saveHistory) => apply({ saveHistory })} />
              </div>
              {window.prism.platform !== 'linux' && (
                <div className="toggle-row">
                  Pencereyi ekran görüntüsü ve ekran paylaşımından gizle
                  <Toggle on={v.contentProtection} onChange={(contentProtection) => apply({ contentProtection })} />
                </div>
              )}
              <span className="hint">
                Geçmiş kapalıyken yeni promptlar hiçbir yere yazılmaz; önceki kayıtlar Geçmiş ekranından silinebilir.
              </span>
            </div>

            <div className="group">
              <span className="label">Bilgi tabanı</span>
              <span className="hint">
                Öneri ve yazım, knowledge/ klasöründeki kartlara dayanır. Düzenlediğin kart bir sonraki istekte kullanılır.
              </span>
              <div className="row">
                <button className="ghost" onClick={() => window.prism.settings.openKnowledge()}>
                  <FolderOpen size={14} /> Klasörü aç
                </button>
                <button className="ghost" style={{ marginLeft: 'auto' }} onClick={() => window.prism.window.quit()}>
                  <Power size={14} /> Çıkış
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}
