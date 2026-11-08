import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'
import './styles.css'
import '@products/themes.css'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PRODUCT } from '@shared/product'
import { installMock } from './mock'

// Tarayıcıda (Electron dışında) arayüz geliştirmek için sahte köprü. Kurulu sürümde köprü yoksa sessizce
// sahte veriyle açılmaz: preload yüklenemediyse açık bir hata verilir.
if (!window.prism) {
  if (!import.meta.env.DEV) throw new Error('Prism köprüsü yüklenemedi (preload).')
  installMock()
}

// Ana süreç pencereyi ?view=panel|pill&look=mica|vibrancy|solid ile açar. Tanınmayan değer panel ve düz görünümdür.
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
    {/* prefers-reduced-motion açıksa bütün motion animasyonları kapanır (yalnızca anında geçiş). */}
    <MotionConfig reducedMotion="user">
      <Root />
    </MotionConfig>
  </StrictMode>
)
