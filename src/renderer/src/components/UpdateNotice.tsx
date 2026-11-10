import { useEffect, useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { PRODUCT } from '@shared/product'
import type { UpdateView } from '@shared/types'
import { reportError } from '../errors'
import { t } from '../i18n'

const DISMISSED_KEY = 'prism.update.dismissed'

// Kapatılan sürüm yalnızca bu pencerede tutulur (gizli bilgi değil). Depolama kapalıysa okuma/yazma başarısız olur;
// bu durumda bildirim yalnızca bir sonraki açılışta yeniden görünür, başka bir şey bozulmaz.
function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}
function writeDismissed(version: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, version)
  } catch {
    // Depolama kullanılamıyor: yalnızca bu oturumda kapalı kalır.
  }
}

/** Ürünün daha yeni bir sürümü varsa başlığın altında sessiz, kapatılabilir bir şerit. */
export function UpdateNotice() {
  const [view, setView] = useState<UpdateView | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(readDismissed)

  useEffect(() => {
    const load = () => {
      window.prism.update.get().then(setView).catch(reportError('update'))
    }
    load()
    return window.prism.update.onChanged(load)
  }, [])

  // Denetim ayarlardan kapatıldıysa eski bulgu da gösterilmez.
  if (!view?.enabled || !view.latest || view.latest.version === dismissed) return null
  const { version } = view.latest
  const text = t('update.available', { product: PRODUCT.name, version })

  return (
    <div className="update-notice" role="status">
      <span className="msg" title={text}>
        {text}
      </span>
      <button className="link" onClick={() => window.prism.update.openRelease().catch(reportError('update'))}>
        {t('update.view')} <ArrowUpRight size={13} />
      </button>
      <button
        className="icon-btn"
        title={t('update.dismiss')}
        aria-label={t('update.dismiss')}
        onClick={() => {
          writeDismissed(version)
          setDismissed(version)
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
