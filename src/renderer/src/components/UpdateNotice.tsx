import { useEffect, useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { PRODUCT } from '@shared/product'
import type { UpdateView } from '@shared/types'
import { reportError } from '../errors'
import { t } from '../i18n'

const DISMISSED_KEY = 'prism.update.dismissed'

// The dismissed version is kept only in this window (not secret). If storage is disabled, reading/writing fails;
// in that case the notice simply reappears on the next launch, and nothing else breaks.
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
    // Storage unavailable: it stays dismissed only for this session.
  }
}

/** If a newer version of the product exists, a quiet, dismissible strip under the header. */
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

  // If the check was turned off in settings, the old finding is not shown either.
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
