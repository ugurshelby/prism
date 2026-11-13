import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { History as HistoryIcon, Minimize2, Pin, PinOff, Settings2, X } from 'lucide-react'
import { FAMILIES, FAMILY_INFO, MODELS } from '@shared/catalog'
import { PRODUCT } from '@shared/product'
import type { PanelAnchor, SettingsView } from '@shared/types'
import { useFlow } from './flow'
import { familyLabel, t } from './i18n'
import { History } from './components/History'
import { Logo } from './components/Prism'
import { Settings } from './components/Settings'
import { Setup } from './components/Setup'
import { UpdateNotice } from './components/UpdateNotice'
import { Analyzing, Compose, Result, Review, stageKey } from './components/Views'
import { reportError } from './errors'

export default function App() {
  const [pinned, setPinned] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [view, setView] = useState<SettingsView | null>(null)
  const [setup, setSetup] = useState(false)
  // Each time the panel is shown, the content slides in from the corner it is anchored to (on Windows and Linux the window
  // size cannot be animated; on macOS the main process animates it). With reduced motion, MotionConfig turns the animation off.
  const [shown, setShown] = useState<{ n: number; anchor: PanelAnchor }>({ n: 0, anchor: { h: 'right', v: 'top' } })
  const settingsRef = useRef(settingsOpen || historyOpen)
  settingsRef.current = settingsOpen || historyOpen

  const flow = useFlow()
  const { s, patch } = flow

  const applySettings = useCallback((v: SettingsView) => {
    setPinned(v.alwaysOnTop)
    setView(v)
    return v
  }, [])

  useEffect(() => {
    const w = window.prism.window
    w.getState()
      .then((st) => setPinned(st.pinned))
      .catch(reportError('window'))
    window.prism.settings
      .get()
      .then((v) => {
        applySettings(v)
        // If setup is unfinished or the engine disappeared later (key deleted), the wizard opens.
        setSetup(!v.setup.done || !v.engine)
        patch({ surface: v.defaultSurface, family: v.defaultFamily })
      })
      .catch(reportError('settings'))
    // When opened by the shortcut, the caret goes to the text field; the draft stays in memory, so it is not lost.
    const offShown = w.onShown((anchor) => {
      setShown((e) => ({ n: e.n + 1, anchor }))
      requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus())
    })
    // Esc hides the panel; if a page (settings, history) is open, that closes first.
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !settingsRef.current && !e.defaultPrevented) w.hide().catch(reportError('window'))
    }
    window.addEventListener('keydown', esc)
    const offPin = w.onPinned(setPinned)
    const offOpen = window.prism.ui.onOpen((target) => {
      setHistoryOpen(target === 'history')
      setSettingsOpen(target === 'settings')
    })
    const offChanged = window.prism.settings.onChanged(() => {
      window.prism.settings.get().then(applySettings).catch(reportError('settings'))
    })
    return () => {
      offShown()
      window.removeEventListener('keydown', esc)
      offPin()
      offOpen()
      offChanged()
    }
  }, [applySettings, patch])

  // In Prism Ray the accent is the color of the single selected family (src/products/ray/theme.css).
  const firstFamily = view?.families[0]
  useEffect(() => {
    if (firstFamily) document.documentElement.style.setProperty('--family-hue', FAMILY_INFO[firstFamily].hue)
  }, [firstFamily])

  // If the family selection changes, the flow's family must not fall outside the selected families.
  useEffect(() => {
    if (!view) return
    const ok = s.family === 'auto' ? view.families.length > 1 : view.families.includes(s.family)
    if (!ok) patch({ family: view.defaultFamily })
  }, [view, s.family, patch])

  const closeHistory = useCallback(() => setHistoryOpen(false), [])
  const busy = s.stage === 'analyzing' || s.stage === 'generating'
  const hue = s.choice ? MODELS[s.choice.model].hue : s.family !== 'auto' ? FAMILY_INFO[s.family].hue : undefined
  const targets = view?.targets ?? {}
  const families = view?.families ?? FAMILIES

  return (
    <div
      key={shown.n}
      className={`shell ${busy ? 'busy' : ''} enter-${shown.anchor.v}-${shown.anchor.h}`}
      style={{ '--aura-b': hue }}
    >
      <div className="grain" />
      <div className="aura a" />
      <div className="aura b" />

      {/* The header area moves the window; double-clicking lets the OS maximize and restore it. */}
      <header className="header">
        <div className="brand">
          <Logo />
          {PRODUCT.name}
          <small>{setup ? t('app.setupBadge') : familyLabel(s.family)}</small>
        </div>
        <div className="spacer" />
        <button
          className={`icon-btn ${pinned ? 'on' : ''}`}
          title={pinned ? t('app.pinOn') : t('app.pinOff')}
          aria-label={pinned ? t('app.pinOn') : t('app.pinOff')}
          aria-pressed={pinned}
          onClick={async () => setPinned(await window.prism.window.togglePin())}
        >
          {pinned ? <Pin size={15} /> : <PinOff size={15} />}
        </button>
        <button
          className={`icon-btn ${historyOpen ? 'on' : ''}`}
          title={t('app.history')}
          aria-label={t('app.history')}
          aria-pressed={historyOpen}
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <HistoryIcon size={15} />
        </button>
        <button className="icon-btn" title={t('app.minimize')} aria-label={t('app.minimize')} onClick={() => window.prism.window.setMode('pill')}>
          <Minimize2 size={15} />
        </button>
        <button className="icon-btn" title={t('app.settings')} aria-label={t('app.settings')} onClick={() => setSettingsOpen(true)}>
          <Settings2 size={15} />
        </button>
        <button className="icon-btn close" title={t('app.hide')} aria-label={t('app.hide')} onClick={() => window.prism.window.hide()}>
          <X size={16} />
        </button>
      </header>

      {!setup && <UpdateNotice />}

      <main className="body">
        <AnimatePresence initial={false}>
          {setup && view && <Setup key="setup" view={view} onChanged={applySettings} onDone={() => setSetup(false)} />}
          {!setup && stageKey(s) === 'compose' && <Compose key="compose" flow={flow} families={families} targets={targets} />}
          {!setup && stageKey(s) === 'analyzing' && <Analyzing key="analyzing" flow={flow} engine={view?.engine ?? null} />}
          {!setup && stageKey(s) === 'review' && s.analysis && <Review key="review" flow={flow} targets={targets} />}
          {!setup && stageKey(s) === 'result' && s.choice && <Result key="result" flow={flow} />}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {settingsOpen && (
          <Settings
            key="settings"
            onClose={() => setSettingsOpen(false)}
            onChanged={applySettings}
            onRerunSetup={() => {
              setSettingsOpen(false)
              window.prism.settings
                .set({ setup: { done: false, step: 'families' } })
                .then((v) => {
                  applySettings(v)
                  setSetup(true)
                })
                .catch(reportError('settings'))
            }}
          />
        )}
        {historyOpen && (
          <History
            key="history"
            onClose={closeHistory}
            onOpen={(entry) => {
              flow.load(entry)
              closeHistory()
            }}
            onRewrite={(entry) => {
              flow.rewrite(entry)
              closeHistory()
            }}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

