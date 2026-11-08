// Pencereler (ROADMAP "Pencere davranışı"). İki pencere vardır:
// - panel: opak, çerçevesiz ama işletim sisteminin kendi kenarlığıyla (thickFrame). Kenar ve köşelerden yerel olarak
//   boyutlandırılır, Windows Snap ve başlıkta çift tıklayıp büyütme kendiliğinden çalışır. Windows 11'de Mica,
//   macOS'ta vibrancy; Linux'ta düz arka plan (kompozitör varsayılmaz).
// - pill: saydam küçük küre. Sürükleme ana süreçte yapılır (tıklama ile sürüklemeyi ayırmak için), bırakınca ekran
//   kenarına yaylı bir hareketle yapışır, görev çubuğuna ya da dock'a girmez.
// Panel küreden açılır: kürenin bulunduğu köşeye yaslanır, ekrana sığmıyorsa açılma yönünü kendisi seçer;
// kapanınca küre aynı köşeye döner. Konumlar ekran başına hatırlanır.
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

// Konum kaydı sürükleme olaylarından gelir: her hareketde diske yazmamak için yarım saniye toplanır.
// Yazılamazsa (disk dolu, dosya kilidi) uygulama düşmez, yalnızca konum hatırlanmaz.
let saveTimer: ReturnType<typeof setTimeout> | undefined
const save = () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushWindowState, 500)
}

/** Bekleyen konum kaydını hemen yazar; bekleyen kayıt yoksa dosyaya dokunmaz. */
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

// Çerçevesiz pencere Alt+F4 / Cmd+W ile kapatılınca yok edilmez, gizlenir; uygulama tray'de yaşar.
// Gerçek çıkışta (tray menüsü, app.quit) kapanmasına izin verilir.
let quitting = false
app.on('before-quit', () => {
  quitting = true
})

const key = (d: Display) => String(d.id)
const displayOf = (b: Rectangle) => screen.getDisplayMatching(b)
const slot = (d: Display): DisplayState => (state.displays[key(d)] ??= {})

/** Dikdörtgen, eşleştiği ekranın çalışma alanı içinde kalsın (görev çubuğu ve dock dışı). */
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
  // Mica Windows 11 22H2 (yapı 22621) ve sonrasında var; öncesinde düz arka plan.
  if (process.platform === 'win32') return Number(process.getSystemVersion().split('.')[2] ?? 0) >= 22621 ? 'mica' : 'solid'
  return 'solid'
}

function lookOptions(look: WindowLook): BrowserWindowConstructorOptions {
  if (look === 'mica') return { backgroundMaterial: 'mica', backgroundColor: '#00000000' }
  if (look === 'vibrancy') return { vibrancy: 'under-window', visualEffectState: 'active', transparent: true, backgroundColor: '#00000000' }
  return { backgroundColor: '#101218' }
}

const RENDERER_FILE = () => join(__dirname, '../renderer/index.html')

/** Uygulamanın kendi arayüzü mü: paketli dosya ya da (yalnızca geliştirmede) electron-vite sunucusu. */
export function isAppUrl(raw: string): boolean {
  // Ayrıştırılamayan adres uygulamanın kendisi olamaz.
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
  // Yazım denetimi kapalı: prompt metni hiçbir sözlük servisine gitmez.
  spellcheck: false,
  // Kurulu sürümde geliştirici araçları açılamaz; arayüzdeki prompt ve geçmiş bu yoldan okunamasın.
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
  loaded.catch((e: unknown) => logError('window', `arayüz yüklenemedi (${view})`, e))
}

function keepAlive(win: BrowserWindow) {
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win.hide()
  })
}

/** Ana pencere: geçmiş, ayarlar ve akış burada; pill'e geçince gizlenir ama yok edilmez (taslak bellekte kalır). */
export function getWindow() {
  return panel
}

/** Küre penceresi (henüz açılmadıysa null). */
export const getPill = () => pill

export function createWindow(opts: { hidden?: boolean } = {}): BrowserWindow {
  // Eski biçim (tek panel/pill alanı) birincil ekranın kaydı sayılır.
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
    // Yerel kenarlık: kenardan boyutlandırma, Snap ve Windows 11'de köşe yuvarlama için gerekli.
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

/** Pencere içeriği ekran görüntüsünde ve ekran paylaşımında görünmez (Windows, macOS; Linux'ta etkisiz). */
export function applyContentProtection(on: boolean) {
  for (const w of [panel, pill]) w?.setContentProtection(on)
}

/** Küre durumu: çalışıyor mu, küre hâlindeyken biten iş var mı (rozet). */
export function setPillState(next: Partial<PillState>) {
  pillState = { ...pillState, ...next }
  pill?.webContents.send('pill:state', pillState)
}

// --- Panel ↔ küre ------------------------------------------------------------------

/** Panel, kürenin köşesine yaslanır; ekranın hangi yarısındaysa öbür yöne açılır. */
function panelFromPill(p: Rectangle): Rectangle {
  const d = displayOf(p)
  const placed = placePanel(p, slot(d).panel ?? defaultPanel(d), d.workArea)
  anchor = placed.anchor
  return placed.bounds
}

/** Küre, panelin açıldığı köşeye döner. */
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
  // Süren yay animasyonu yeni konumu ezmesin.
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
    // macOS pencere boyutunu kendisi canlandırır; Windows ve Linux'ta içerik tarafı canlandırır (window:shown).
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

// --- Küre sürükleme ------------------------------------------------------------------

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
  // Sürüklerken de çalışma alanı dışına (görev çubuğu, dock) taşmaz; boyut sabit tutulur (DPI geçişinde kaymasın).
  pill.setBounds(onScreen({ x: drag.bounds.x + p.x - drag.cursor.x, y: drag.bounds.y + p.y - drag.cursor.y, width: PILL, height: PILL }))
}

/** Bırakınca yakın kenara yapışır; `animate` false ise (azaltılmış hareket) doğrudan yerine konur. */
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
  // Kritik sönümlü yay: hızlı yaklaşır, aşmadan oturur. ~200 ms.
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

// --- Ekran değişiklikleri -------------------------------------------------------------

let watching = false
/** Ekran çıkarılır ya da çözünürlük değişirse pencereler görünür bir alana taşınır. */
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

// --- Göster / gizle -------------------------------------------------------------------

export function toggleVisible() {
  // Pencere bir yoldan yok edildiyse (ör. arayüzün kendisi kapattıysa) kısayol ve tray onu yeniden açar.
  if (!panel) {
    createWindow()
    return
  }
  if (mode === 'pill') return setMode('panel')
  if (panel.isVisible() && panel.isFocused()) hidePanel()
  else showPanel()
}

/** Paneli gizler; macOS'ta odak bir önceki uygulamaya döner (Windows ve Linux bunu kendisi yapar). */
export function hidePanel() {
  panel?.hide()
  if (process.platform === 'darwin' && mode === 'panel') app.hide()
}

export function revealPanel() {
  if (mode === 'pill') setMode('panel')
  else showPanel()
}
