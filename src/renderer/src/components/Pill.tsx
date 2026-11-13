import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { PRODUCT } from '@shared/product'
import type { PillState, SettingsView } from '@shared/types'
import { reportError } from '../errors'
import { t } from '../i18n'
import { Logo } from './Prism'

const THRESHOLD = 4

/**
 * Küre penceresi: sürüklenebilir; tıklayınca panel açılır. Sürükleme ile tıklama birkaç piksellik eşikle ayrılır,
 * konum güncellemesi kare hızına bağlanır (ana süreç pencereyi imlece göre taşır).
 */
export function PillApp() {
  const [st, setSt] = useState<PillState>({ busy: false, badge: false })
  const [, setView] = useState<SettingsView | null>(null)
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const frame = useRef(0)
  const reduced = useReducedMotion() ?? false
  const api = window.prism.window

  useEffect(() => {
    const load = () =>
      window.prism.settings
        .get()
        .then((v) => {
          setView(v)
        })
        .catch(reportError('settings'))
    void load()
    const offState = api.onPillState(setSt)
    const offChanged = window.prism.settings.onChanged(() => void load())
    return () => {
      offState()
      offChanged()
    }
  }, [api])

  const open = () => api.setMode('panel').catch(reportError('window'))
  const label = st.busy ? t('pill.busy') : t('pill.open', { product: PRODUCT.name })

  return (
    <div className="pill-wrap">
      <motion.button
        className={`orb ${st.busy ? 'busy' : ''}`}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        whileHover={{ scale: 1.06 }}
        title={label}
        aria-label={label}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open()}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          start.current = { x: e.screenX, y: e.screenY, moved: false }
          api.dragStart()
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s) return
          if (!s.moved && Math.hypot(e.screenX - s.x, e.screenY - s.y) > THRESHOLD) s.moved = true
          if (s.moved && !frame.current) {
            frame.current = requestAnimationFrame(() => {
              frame.current = 0
              api.dragMove()
            })
          }
        }}
        onPointerUp={() => {
          const s = start.current
          start.current = null
          api.dragEnd(!reduced)
          if (s && !s.moved) void open()
        }}
      >
        <span className="halo" />
        <span className="ring" />
        <span className="core" />
        <span style={{ position: 'relative', display: 'grid' }}>
          <Logo size={26} />
        </span>
        {st.badge && <motion.span className="badge" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.5 }} />}
      </motion.button>
    </div>
  )
}
