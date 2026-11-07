import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { FAMILIES, FAMILY_INFO, PROVIDERS } from '@shared/catalog'
import type { SettingsPatch, SettingsView } from '@shared/types'
import { Logo } from './Prism'
import { ProviderCard, Toggle } from './Settings'
import { viewMotion } from './Views'

/** İlk açılış: Prism'in motoru için en az bir sağlayıcı key'i ve kullanılan uygulamalar. */
export function Setup({
  view,
  onChanged,
  onDone
}: {
  view: SettingsView
  onChanged: (v: SettingsView) => void
  onDone: () => void
}) {
  const apply = async (patch: SettingsPatch) => onChanged(await window.prism.settings.set(patch))
  const ready = !!view.engine

  return (
    <motion.div className="view setup" {...viewMotion}>
      <div className="setup-hero">
        <Logo size={34} />
        <b>Prism’e hoş geldin</b>
        <span>
          Ham promptunu Claude, GPT, Gemini ya da Grok için yeniden yazar. Bunu yapmak için kendi çalıştırdığı bir modele
          ihtiyacı var: aşağıdan en az bir sağlayıcının API key’ini ekle.
        </span>
      </div>

      <div className="group">
        <span className="label">1 · Prism’in motoru</span>
        {PROVIDERS.map((id) => (
          <ProviderCard
            key={id}
            view={view.providers.find((p) => p.id === id)!}
            settings={view}
            onChanged={onChanged}
            onSettings={apply}
          />
        ))}
        <span className="hint">
          Key’ler yalnızca bu bilgisayarda, işletim sisteminin şifrelemesiyle saklanır; arayüze yalnızca son dört karakteri gelir.
        </span>
      </div>

      <div className="group">
        <span className="label">2 · Promptu nerede kullanacaksın?</span>
        <span className="hint">
          Key gerekmeden, uygulama ya da abonelikle kullandığın ekosistemleri işaretle. Çapraz öneri bunları da hesaba katar.
        </span>
        {FAMILIES.map((f) => (
          <div key={f} className="toggle-row">
            {FAMILY_INFO[f].name} · {FAMILY_INFO[f].surfaces.agent.label}
            <Toggle
              on={view.appFamilies.includes(f)}
              onChange={(on) => apply({ appFamilies: on ? [...view.appFamilies, f] : view.appFamilies.filter((x) => x !== f) })}
            />
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <button className="cta sticky" disabled={!ready} onClick={onDone}>
        {ready ? (
          <>
            Başla <ArrowRight size={16} />
          </>
        ) : (
          'Önce bir sağlayıcı ekle'
        )}
      </button>
    </motion.div>
  )
}
