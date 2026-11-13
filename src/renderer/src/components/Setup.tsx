// İlk açılış sihirbazı (ROADMAP "Her üründe ortak kurulum"): dil → aileler → motor key'i → kısayol.
// Her adımda geri dönülebilir, Enter ileri götürür, yarıda kapatılırsa kalınan adımdan devam edilir
// (adım settings.setup.step'e yazılır), geçerli bir seçim varsa adım atlanabilir.
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { PROVIDERS } from '@shared/catalog'
import { PRODUCT } from '@shared/product'
import type { SettingsPatch, SettingsView, SetupStep } from '@shared/types'
import { cleanError } from '../errors'
import { t } from '../i18n'
import { FamilyPicker, ProviderCard, ToggleRow } from './Fields'
import { Logo } from './Prism'
import { viewMotion } from './Views'

const STEPS: SetupStep[] = ['families', 'engine', 'shortcut']

export function Setup({ view, onChanged, onDone }: { view: SettingsView; onChanged: (v: SettingsView) => void; onDone: () => void }) {
  const [step, setStep] = useState<SetupStep>(view.setup.step)
  const [hotkey, setHotkey] = useState(view.hotkey)
  const [error, setError] = useState<string | null>(null)
  const index = STEPS.indexOf(step)

  const apply = async (patch: SettingsPatch) => {
    setError(null)
    try {
      onChanged(await window.prism.settings.set(patch))
      return true
    } catch (e) {
      setError(cleanError(e))
      return false
    }
  }

  // Motor adımında key yoksa ilerlenemez; diğer adımlarda geçerli bir varsayılan hep vardır.
  const canNext = step !== 'engine' || !!view.engine

  const go = async (next: number) => {
    const target = STEPS[next]
    if (target) {
      setStep(target)
      await apply({ setup: { done: false, step: target } })
      return
    }
    // Son adım: kısayol değiştiyse önce kaydedilir; kayıt başarısızsa (başka uygulama kullanıyor) sihirbaz kapanmaz.
    if (hotkey.trim() && hotkey.trim() !== view.hotkey && !(await apply({ hotkey: hotkey.trim() }))) return
    if (await apply({ setup: { done: true, step } })) onDone()
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'Enter' && !typing && canNext) {
        e.preventDefault()
        void go(index + 1)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  return (
    <motion.div className="view setup" {...viewMotion}>
      <div className="setup-hero">
        <Logo size={30} />
        <b>{t('setup.welcome', { product: PRODUCT.name })}</b>
      </div>

      <ol className="steps" aria-label={t('setup.progress', { n: index + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <li key={s} className={i < index ? 'done' : i === index ? 'current' : ''} aria-current={i === index ? 'step' : undefined}>
            <span className="n">{i < index ? <Check size={11} /> : i + 1}</span>
            <span className="t">{t(`setup.step.${s}`)}</span>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} className="setup-step" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
          {step === 'families' && (
            <div className="group">
              <span className="hint">{PRODUCT.familyMode === 'single' ? t('setup.familiesSingle', { product: PRODUCT.name }) : t('setup.familiesMulti')}</span>
              <FamilyPicker product={PRODUCT} value={view.families} onChange={(families) => apply({ families })} />
            </div>
          )}

          {step === 'engine' && (
            <div className="group">
              <span className="hint">{t('setup.engineHint')}</span>
              {PROVIDERS.map((id) => {
                const pv = view.providers.find((p) => p.id === id)
                return pv && <ProviderCard key={id} view={pv} settings={view} onChanged={onChanged} onSettings={(p) => void apply(p)} />
              })}
              <span className="hint">{t('settings.providersHint')}</span>
            </div>
          )}

          {step === 'shortcut' && (
            <div className="group">
              <label className="field">
                <span>{t('settings.hotkey')}</span>
                <input className="input mono" value={hotkey} onChange={(e) => setHotkey(e.target.value)} autoFocus />
              </label>
              <span className="hint">{t('setup.hotkeyHint')}</span>
              <ToggleRow label={t('settings.launchAtLogin')} on={view.launchAtLogin} onChange={(launchAtLogin) => apply({ launchAtLogin })} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <span className="hint bad-text" role="alert">
          {error}
        </span>
      )}

      <div style={{ flex: 1 }} />
      <div className="row sticky">
        <button className="ghost" disabled={index === 0} onClick={() => go(index - 1)} title={t('common.back')} aria-label={t('common.back')}>
          <ArrowLeft size={15} />
        </button>
        {/* Motor hazırsa kalan adımların hepsinin geçerli varsayılanı var: kurulum burada bitirilebilir. */}
        {view.engine && index < STEPS.length - 1 && (
          <button className="ghost" onClick={async () => (await apply({ setup: { done: true, step } })) && onDone()}>
            {t('setup.skip')}
          </button>
        )}
        <button className="cta" style={{ flex: 1 }} disabled={!canNext} onClick={() => go(index + 1)}>
          {index === STEPS.length - 1 ? t('setup.finish') : canNext ? t('common.next') : t('setup.needEngine')}
          {canNext && <ArrowRight size={16} />}
        </button>
      </div>
    </motion.div>
  )
}
