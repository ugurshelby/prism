import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'
import './styles.css'
import '@products/themes.css'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PRODUCT } from '@shared/product'
import { installMock } from './mock'

// A fake bridge for developing the UI in a browser (outside Electron). In an installed build, a missing bridge does not
// silently open with fake data: if preload failed to load, an explicit error is thrown.
if (!window.prism) {
  if (!import.meta.env.DEV) throw new Error('Prism bridge failed to load (preload).')
  installMock()
}

// The main process opens the window with ?view=panel|pill&look=mica|vibrancy|solid. An unrecognized value means panel and solid look.
const params = new URLSearchParams(location.search)
const view = params.get('view') === 'pill' ? 'pill' : 'panel'
const look = params.get('look')
document.documentElement.dataset.product = PRODUCT.id
document.documentElement.dataset.look = look === 'mica' || look === 'vibrancy' ? look : 'solid'
document.documentElement.dataset.view = view
document.documentElement.dataset.platform = window.prism.platform

const Root = view === 'pill' ? (await import('./components/Pill')).PillApp : (await import('./App')).default

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* If prefers-reduced-motion is on, all motion animations are disabled (instant transitions only). */}
    <MotionConfig reducedMotion="user">
      <Root />
    </MotionConfig>
  </StrictMode>
)
