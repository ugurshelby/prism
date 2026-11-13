// Windows (ROADMAP "Window behavior"). There are two windows:
// - panel: opaque, frameless but with the OS's own border (thickFrame). It is resized natively from edges and corners,
//   and Windows Snap and double-click-on-title maximize work on their own. Mica on Windows 11,
//   vibrancy on macOS; a plain background on Linux (no compositor assumed).
// - pill: a small transparent orb. Dragging is handled in the main process (to tell a click from a drag); on release it snaps to
//   the screen edge with a spring motion and stays out of the taskbar and dock.
// The panel opens from the orb: it leans into the orb's corner and picks its opening direction itself if it does not fit on screen;
// when it closes the orb returns to the same corner. Positions are remembered per display.
import { app, BrowserWindow, screen, type BrowserWindowConstructorOptions, type Display, type Rectangle } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { clampToArea, panelFromPill as placePanel, pillFromPanel as placePill, snapToEdges, springProgress } from '@shared/geometry'
import { PRODUCT } from '@shared/product'
import { WindowStateSchema } from '@shared/schemas'
import type { PanelAnchor, PillState, WindowLook, WindowMode } from '@shared/types'
import { getSettings, readUserJson, writeJson } from './config'
import { devEnv } from './env'
import { logError, logWarn } from './log'

const PANEL = { width: 440, height: 640, minWidth: 380, minHeight: 480, maxWidth: 1200, maxHeight: 1600 }
const PILL = 84
const SNAP = 24
const MARGIN = 8

interface DisplayState {
  panel?: Rectangle
  pill?: { x: number; y: number }
}
interface WindowState {
  displays: Record<string, DisplayState>
}

let panel: BrowserWindow | null = null
let pill: BrowserWindow | null = null
let state: WindowState = { displays: {} }
let mode: WindowMode = 'panel'
let anchor: PanelAnchor = { h: 'right', v: 'top' }
let pillState: PillState = { busy: false, badge: false }

// Position saves come from drag events: to avoid writing to disk on every move they are batched over half a second.
// If the write fails (disk full, file lock) the app does not crash; the position is just not remembered.
let saveTimer: ReturnType<typeof setTimeout> | undefined
const save = () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushWindowState, 500)
}

/** Writes a pending position save immediately; if nothing is pending, the file is not touched. */
export function flushWindowState() {
  if (saveTimer === undefined) return
  clearTimeout(saveTimer)
  saveTimer = undefined
  try {
    writeJson('window-state.json', state)
  } catch (e) {
    logWarn('window', 'pencere konumu kaydedilemedi', e)
  }
}

// Closing the frameless window with Alt+F4 / Cmd+W hides it instead of destroying it; the app lives on in the tray.
// On a real quit (tray menu, app.quit) it is allowed to close.
let quitting = false
app.on('before-quit', () => {
  quitting = true
})

const key = (d: Display) => String(d.id)
const displayOf = (b: Rectangle) => screen.getDisplayMatching(b)
const slot = (d: Display): DisplayState => (state.displays[key(d)] ??= {})

/** Keeps the rectangle inside the work area of the display it matches (outside the taskbar and dock). */
const onScreen = (b: Rectangle): Rectangle => clampToArea(b, displayOf(b).workArea)

function defaultPanel(d: Display): Rectangle {
  const area = d.workArea
  return {
    width: PANEL.width,
    height: PANEL.height,
    x: area.x + area.width - PANEL.width - 32,
    y: area.y + Math.round((area.height - PANEL.height) / 2)
  }
}

export function windowLook(): WindowLook {
  if (process.platform === 'darwin') return 'vibrancy'
  // Mica exists on Windows 11 22H2 (build 22621) and later; a plain background before that.
  if (process.platform === 'win32') return Number(process.getSystemVersion().split('.')[2] ?? 0) >= 22621 ? 'mica' : 'solid'
  return 'solid'
}

function lookOptions(look: WindowLook): BrowserWindowConstructorOptions {
  if (look === 'mica') return { backgroundMaterial: 'mica', backgroundColor: '#00000000' }
  if (look === 'vibrancy') return { vibrancy: 'under-window', visualEffectState: 'active', transparent: true, backgroundColor: '#00000000' }
  return { backgroundColor: '#101218' }
}

const RENDERER_FILE = () => join(__dirname, '../renderer/index.html')

/** Whether this is the app's own UI: a packaged file or (in development only) the electron-vite server. */
export function isAppUrl(raw: string): boolean {
  // An address that cannot be parsed cannot be the app itself.
  if (!URL.canParse(raw)) return false
  const url = new URL(raw)
  const dev = devEnv().rendererUrl
  if (dev) return url.origin === new URL(dev).origin
  const expected = pathToFileURL(RENDERER_FILE())
  return url.protocol === 'file:' && url.host === '' && url.pathname === expected.pathname
}

const webPreferences = (): BrowserWindowConstructorOptions['webPreferences'] => ({
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  // Spellcheck is off: prompt text never goes to any dictionary service.
  spellcheck: false,
  // Developer tools cannot be opened in an installed build; the prompt and history in the UI must not be readable this way.
  devTools: !app.isPackaged
})

function load(win: BrowserWindow, view: 'panel' | 'pill', look: WindowLook) {
  const query = { view, look }
  const dev = devEnv().rendererUrl
  let devUrl: string | null = null
  if (dev) {
    const u = new URL(dev)
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v)
    devUrl = u.toString()
  }
  const loaded = devUrl ? win.loadURL(devUrl) : win.loadFile(RENDERER_FILE(), { query })
  loaded.catch((e: unknown) => logError('window', `could not load UI (${view})`, e))
}

function keepAlive(win: BrowserWindow) {
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win.hide()
  })
}

/** Main window: history, settings and the flow live here; it is hidden when switching to the pill but not destroyed (the draft stays in memory). */
export function getWindow() {
  return panel
}

/** Orb window (null if not opened yet). */
export const getPill = () => pill

export function createWindow(opts: { hidden?: boolean } = {}): BrowserWindow {
  // The old format (a single panel/pill field) counts as the primary display's entry.
  const raw = readUserJson('window-state.json', WindowStateSchema, {})
  state = { displays: raw.displays ?? {} }
  if (raw.panel || raw.pill) state.displays[key(screen.getPrimaryDisplay())] ??= { panel: raw.panel, pill: raw.pill }
  mode = 'panel'
  const primary = screen.getPrimaryDisplay()
  const bounds = onScreen(slot(primary).panel ?? defaultPanel(primary))
  const look = windowLook()

  panel = new BrowserWindow({
    ...bounds,
    minWidth: PANEL.minWidth,
    minHeight: PANEL.minHeight,
    maxWidth: PANEL.maxWidth,
    maxHeight: PANEL.maxHeight,
    frame: false,
    // Native border: needed for edge resizing, Snap and corner rounding on Windows 11.
    thickFrame: true,
    resizable: true,
    maximizable: true,
    minimizable: false,
    fullscreenable: false,
    show: false,
    title: PRODUCT.name,
    ...lookOptions(look),
    alwaysOnTop: getSettings().alwaysOnTop,
    webPreferences: webPreferences()
  })
  const win = panel
  applyPin(getSettings().alwaysOnTop)
  applyContentProtection(getSettings().contentProtection)
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('ready-to-show', () => {
    if (!opts.hidden) showPanel()
  })
  win.on('moved', remember)
  win.on('resized', remember)
  keepAlive(win)
  win.on('closed', () => {
    panel = null
  })
  load(win, 'panel', look)
  watchDisplays()
  return win
}

function createPill(): BrowserWindow {
  const win = new BrowserWindow({
    width: PILL,
    height: PILL,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    title: PRODUCT.name,
    alwaysOnTop: getSettings().alwaysOnTop,
    webPreferences: webPreferences()
  })
  pill = win
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setAlwaysOnTop(getSettings().alwaysOnTop, process.platform === 'darwin' ? 'floating' : 'screen-saver')
  win.setContentProtection(getSettings().contentProtection)
  win.webContents.on('did-finish-load', () => win.webContents.send('pill:state', pillState))
  keepAlive(win)
  win.on('closed', () => {
    pill = null
  })
  load(win, 'pill', 'solid')
  return win
}

function remember() {
  if (!panel || mode !== 'panel' || panel.isMaximized()) return
  const b = panel.getBounds()
  slot(displayOf(b)).panel = b
  save()
}

export function applyPin(on: boolean) {
  for (const w of [panel, pill]) w?.setAlwaysOnTop(on, process.platform === 'darwin' ? 'floating' : 'screen-saver')
  panel?.webContents.send('window:pinned', on)
}

/** Window content is invisible in screenshots and screen sharing (Windows, macOS; no effect on Linux). */
export function applyContentProtection(on: boolean) {
  for (const w of [panel, pill]) w?.setContentProtection(on)
}

/** Orb state: is it working, did a job finish while in orb form (badge). */
export function setPillState(next: Partial<PillState>) {
  pillState = { ...pillState, ...next }
  pill?.webContents.send('pill:state', pillState)
}

// --- Panel <-> orb ------------------------------------------------------------------

/** The panel leans into the orb's corner; it opens in the opposite direction from whichever half of the screen it is in. */
function panelFromPill(p: Rectangle): Rectangle {
  const d = displayOf(p)
  const placed = placePanel(p, slot(d).panel ?? defaultPanel(d), d.workArea)
  anchor = placed.anchor
  return placed.bounds
}

/** The orb returns to the corner the panel opened from. */
const pillFromPanel = (b: Rectangle): Rectangle => placePill(b, anchor, PILL, displayOf(b).workArea)

function showPanel() {
  if (!panel) return
  panel.show()
  panel.focus()
  setPillState({ badge: false })
  panel.webContents.send('window:shown', anchor)
}

export function setMode(next: WindowMode) {
  if (!panel || next === mode) return
  // An ongoing spring animation must not overwrite the new position.
  clearInterval(spring)
  drag = null
  if (next === 'pill') {
    const b = panel.isMaximized() ? panel.getNormalBounds() : panel.getBounds()
    slot(displayOf(b)).panel = b
    const win = pill ?? createPill()
    const target = pillFromPanel(b)
    win.setBounds(target)
    slot(displayOf(target)).pill = { x: target.x, y: target.y }
    mode = 'pill'
    win.showInactive()
    panel.hide()
  } else {
    const from = pill?.getBounds() ?? pillFromPanel(panel.getBounds())
    const target = panelFromPill(from)
    // macOS animates the window size itself; on Windows and Linux the content side animates it (window:shown).
    panel.setBounds(target, process.platform === 'darwin')
    mode = 'panel'
    showPanel()
    pill?.hide()
  }
  save()
}

export function getMode() {
  return mode
}

// --- Orb dragging ------------------------------------------------------------------

let drag: { cursor: Electron.Point; bounds: Rectangle } | null = null
let spring: ReturnType<typeof setInterval> | undefined

export function dragStart() {
  if (!pill) return
  clearInterval(spring)
  drag = { cursor: screen.getCursorScreenPoint(), bounds: pill.getBounds() }
}

export function dragMove() {
  if (!pill || !drag) return
  const p = screen.getCursorScreenPoint()
  // While dragging it also stays within the work area (taskbar, dock); the size is held fixed (so it does not drift across a DPI change).
  pill.setBounds(onScreen({ x: drag.bounds.x + p.x - drag.cursor.x, y: drag.bounds.y + p.y - drag.cursor.y, width: PILL, height: PILL }))
}

/** On release it snaps to the nearest edge; if `animate` is false (reduced motion) it is placed directly. */
export function dragEnd(animate: boolean) {
  if (!pill || !drag) return
  drag = null
  const win = pill
  const b = win.getBounds()
  const { x, y } = snapToEdges({ ...b, width: PILL, height: PILL }, displayOf(b).workArea, SNAP, MARGIN)
  const done = () => {
    slot(displayOf(win.getBounds())).pill = { x, y }
    save()
  }
  if (!animate || (x === b.x && y === b.y)) {
    win.setBounds({ x, y, width: PILL, height: PILL })
    return done()
  }
  // Critically damped spring: approaches fast, settles without overshoot. ~200 ms.
  const start = Date.now()
  spring = setInterval(() => {
    const t = Math.min(1, (Date.now() - start) / 200)
    const f = springProgress(t)
    if (win.isDestroyed()) return clearInterval(spring)
    win.setBounds({ x: Math.round(b.x + (x - b.x) * f), y: Math.round(b.y + (y - b.y) * f), width: PILL, height: PILL })
    if (t === 1) {
      clearInterval(spring)
      done()
    }
  }, 16)
}

// --- Display changes -------------------------------------------------------------

let watching = false
/** If a display is removed or the resolution changes, the windows are moved into a visible area. */
function watchDisplays() {
  if (watching) return
  watching = true
  const rescue = () => {
    for (const w of [panel, pill]) {
      if (!w || w.isDestroyed() || w.isMaximized()) continue
      const b = w.getBounds()
      const fixed = onScreen(b)
      if (fixed.x !== b.x || fixed.y !== b.y || fixed.width !== b.width || fixed.height !== b.height) w.setBounds(fixed)
    }
  }
  screen.on('display-removed', rescue)
  screen.on('display-metrics-changed', rescue)
}

// --- Show / hide -------------------------------------------------------------------

export function toggleVisible() {
  // If a window was destroyed some way (e.g. the UI closed it itself), the shortcut and tray reopen it.
  if (!panel) {
    createWindow()
    return
  }
  if (mode === 'pill') return setMode('panel')
  if (panel.isVisible() && panel.isFocused()) hidePanel()
  else showPanel()
}

/** Hides the panel; on macOS focus returns to the previous app (Windows and Linux do this themselves). */
export function hidePanel() {
  panel?.hide()
  if (process.platform === 'darwin' && mode === 'panel') app.hide()
}

export function revealPanel() {
  if (mode === 'pill') setMode('panel')
  else showPanel()
}
