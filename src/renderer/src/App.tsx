import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { History as HistoryIcon, Minimize2, Pin, PinOff, Settings2, X } from 'lucide-react'
import { FAMILY_INFO, FAMILY_SHORT, MODELS } from '@shared/catalog'
import type { SettingsView, WindowMode } from '@shared/types'
import { useFlow } from './flow'
import { History } from './components/History'
import { Pill } from './components/Pill'
import { Logo } from './components/Prism'
import { Settings } from './components/Settings'
import { Setup } from './components/Setup'
import { Analyzing, Compose, Result, Review, stageKey } from './components/Views'
import { reportError } from './errors'

export default function App() {
  const [mode, setMode] = useState<WindowMode>('panel')
  const [pinned, setPinned] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [unseen, setUnseen] = useState(false)
  const [view, setView] = useState<SettingsView | null>(null)
  // Açılışta hiç sağlayıcı yoksa kurulum ekranı, kişi "Başla" diyene kadar kalır.
  const [setup, setSetup] = useState(false)
  const modeRef = useRef(mode)
  modeRef.current = mode

  const flow = useFlow(() => {
    if (modeRef.current === 'pill') setUnseen(true)
  })
  const { s, patch } = flow

  const applySettings = useCallback((v: SettingsView) => {
    setPinned(v.alwaysOnTop)
    setView(v)
    return v
  }, [])

  useEffect(() => {
    const w = window.prism.window
    w.getState()
      .then((st) => {
        setMode(st.mode)
        setPinned(st.pinned)
      })
      .catch(reportError('window'))
    window.prism.settings
      .get()
      .then((v) => {
        applySettings(v)
        setSetup(!v.engine)
        patch({ surface: v.defaultSurface, family: v.defaultFamily })
      })
      .catch(reportError('settings'))
    const offMode = w.onMode((m) => {
      setMode(m)
      if (m === 'panel') setUnseen(false)
    })
    const offPin = w.onPinned(setPinned)
    const offOpen = window.prism.ui.onOpen((target) => {
      setHistoryOpen(target === 'history')
      setSettingsOpen(target === 'settings')
    })
    const offChanged = window.prism.settings.onChanged(() => {
      window.prism.settings.get().then(applySettings).catch(reportError('settings'))
    })
    return () => {
      offMode()
      offPin()
      offOpen()
      offChanged()
    }
  }, [applySettings, patch])

  const closeHistory = useCallback(() => setHistoryOpen(false), [])
  const busy = s.stage === 'analyzing' || s.stage === 'generating'
  const hue = s.choice ? MODELS[s.choice.model].hue : s.family !== 'auto' ? FAMILY_INFO[s.family].hue : undefined
  const targets = view?.targets ?? {}

  if (mode === 'pill') {
    return <Pill busy={busy} badge={unseen} onOpen={() => window.prism.window.setMode('panel')} />
  }

  return (
    <div className={`shell ${busy ? 'busy' : ''}`} style={{ '--aura-b': hue }}>
      <div className="grain" />
      <div className="aura a" />
      <div className="aura b" />

      <header className="header">
        <div className="brand">
          <Logo />
          Prism
          <small>{setup ? 'Kurulum' : FAMILY_SHORT[s.family].replace('✦ ', '')}</small>
        </div>
        <div className="spacer" />
        <button
          className={`icon-btn ${pinned ? 'on' : ''}`}
          title={pinned ? 'Her zaman üstte: açık' : 'Her zaman üstte: kapalı'}
          onClick={async () => setPinned(await window.prism.window.togglePin())}
        >
          {pinned ? <Pin size={15} /> : <PinOff size={15} />}
        </button>
        <button className={`icon-btn ${historyOpen ? 'on' : ''}`} title="Geçmiş" onClick={() => setHistoryOpen((v) => !v)}>
          <HistoryIcon size={15} />
        </button>
        <button className="icon-btn" title="Küçült" onClick={() => window.prism.window.setMode('pill')}>
          <Minimize2 size={15} />
        </button>
        <button className="icon-btn" title="Ayarlar" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={15} />
        </button>
        <button className="icon-btn close" title="Gizle (tray'de çalışmaya devam eder)" onClick={() => window.prism.window.hide()}>
          <X size={16} />
        </button>
      </header>

      <main className="body">
        <AnimatePresence initial={false}>
          {setup && view && <Setup key="setup" view={view} onChanged={applySettings} onDone={() => setSetup(false)} />}
          {!setup && stageKey(s) === 'compose' && <Compose key="compose" flow={flow} targets={targets} />}
          {!setup && stageKey(s) === 'analyzing' && <Analyzing key="analyzing" flow={flow} engine={view?.engine ?? null} />}
          {!setup && stageKey(s) === 'review' && s.analysis && <Review key="review" flow={flow} targets={targets} />}
          {!setup && stageKey(s) === 'result' && s.choice && <Result key="result" flow={flow} />}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {settingsOpen && <Settings key="settings" onClose={() => setSettingsOpen(false)} onChanged={applySettings} />}
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

      <ResizeGrip />
    </div>
  )
}

function ResizeGrip() {
  const active = useRef(false)
  const api = window.prism.window
  return (
    <svg
      className="grip"
      viewBox="0 0 16 16"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        active.current = true
        api.dragStart('resize')
      }}
      onPointerMove={() => active.current && api.dragMove()}
      onPointerUp={() => {
        active.current = false
        api.dragEnd()
      }}
    >
      <path d="M14 6 6 14M14 10l-4 4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
