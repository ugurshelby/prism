import { app, clipboard, globalShortcut, ipcMain, Menu, nativeImage, Notification, session, shell, Tray } from 'electron'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { FAMILY_INFO, MODELS, PROVIDERS, PROVIDER_INFO, type ProviderId } from '@shared/catalog'
import type { AnalyzeRequest, GenerateRequest, Settings, StreamEvent, WindowMode } from '@shared/types'
import { getSettings, knowledgeDir, updateSettings } from './config'
import { analyze } from './engine/analyze'
import { generatePrompt } from './engine/generate'
import { clearHistory, deleteHistory, listHistory, recordAnalysis, recordOutput } from './history'
import { clearKey, engineGenerate, resolveEngine, saveKey, settingsView, verify, verifyPending } from './providers'
import { selftest } from './selftest'
import {
  applyPin,
  createWindow,
  dragEnd,
  dragMove,
  dragStart,
  getMode,
  getWindow,
  setMode,
  toggleVisible
} from './window'

// Ürünün eski adı Prompter'dı: o adla kurulmuş sürümlerin ayarları, key'leri ve geçmişi olduğu klasörde kullanılır.
// Chromium yeni klasörü açılışta önbellekler için kendisi oluşturduğundan klasöre değil içindeki verilere bakılır.
const legacyData = join(app.getPath('appData'), 'Prompter')
const hasData = (dir: string) => ['settings.json', 'history.json'].some((f) => existsSync(join(dir, f)))
if (!hasData(app.getPath('userData')) && hasData(legacyData)) app.setPath('userData', legacyData)

// Geliştirme ve testte gerçek ayar/geçmiş klasörüne dokunmamak için ayrı bir userData klasörü kullanılabilir.
if (process.env.PRISM_USER_DATA) {
  const dir = resolve(process.env.PRISM_USER_DATA)
  mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)
}

const SELFTEST = process.argv.includes('--selftest')
if (!SELFTEST && !app.requestSingleInstanceLock()) app.quit()

// Ekran görüntüleri retina ekranlarda da net görünsün diye 1,5x çizilir (2x'te panel çoğu ekrana sığmaz).
if (process.env.PRISM_CAPTURE) app.commandLine.appendSwitch('force-device-scale-factor', '1.5')

// Linux'ta saydam pencere (kompozitör varsa) bu anahtarla çalışır.
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-transparent-visuals')

// Uygulama yalnızca kendi arayüzünü yükler: yeni pencere, başka sayfaya geçiş ve webview kapalı.
// Dış bağlantılar (ör. key alma sayfaları) yalnızca https ise sistem tarayıcısında açılır.
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (e, url) => {
    if (url !== contents.getURL()) e.preventDefault()
  })
  contents.on('will-attach-webview', (e) => e.preventDefault())
})

let tray: Tray | null = null
const running = new Map<string, AbortController>()
let active = 0

// Oturum açılışında başlatıldıysa pencere gösterilmez, tray'de bekler.
const START_HIDDEN =
  process.argv.includes('--hidden') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin)

function resource(name: string) {
  return app.isPackaged ? join(process.resourcesPath, name) : join(app.getAppPath(), 'resources', name)
}

function registerHotkey(accelerator: string) {
  globalShortcut.unregisterAll()
  try {
    return globalShortcut.register(accelerator, toggleVisible)
  } catch {
    return false
  }
}

/** Pencereyi panel olarak öne getirir; istenirse arayüzde geçmişi ya da ayarları açar. */
function showPanel(open?: 'settings' | 'history') {
  const win = getWindow()
  if (!win) return
  if (getMode() === 'pill' && open) setMode('panel')
  win.show()
  win.focus()
  if (open) win.webContents.send('ui:open', open)
}

function buildTrayMenu() {
  const s = getSettings()
  const engine = resolveEngine()
  return Menu.buildFromTemplate([
    { label: 'Göster / Gizle', click: toggleVisible },
    { label: getMode() === 'pill' ? 'Paneli aç' : 'Küçült', click: () => setMode(getMode() === 'pill' ? 'panel' : 'pill') },
    { label: 'Geçmiş…', click: () => showPanel('history') },
    { label: 'Ayarlar…', click: () => showPanel('settings') },
    { type: 'separator' },
    {
      label: engine ? `Motor: ${PROVIDER_INFO[engine.provider].label} · ${engine.generation}` : 'Motor: yapılandırılmamış',
      enabled: false
    },
    {
      label: 'Her zaman üstte',
      type: 'checkbox',
      checked: s.alwaysOnTop,
      click: (item) => applySettings({ alwaysOnTop: item.checked })
    },
    { type: 'separator' },
    { label: 'Çıkış', click: () => app.quit() }
  ])
}

function refreshTray() {
  tray?.setContextMenu(buildTrayMenu())
  tray?.setToolTip(active > 0 ? 'Prism — çalışıyor…' : 'Prism')
}

/** Uzun süren analiz/yazım sırasında tray ipucunu günceller. */
async function tracked<T>(work: () => Promise<T>): Promise<T> {
  active++
  refreshTray()
  try {
    return await work()
  } finally {
    active--
    refreshTray()
  }
}

// Panel gizliyken ya da arkadayken bitmiş yazımı bildir; küre modunda rozet yeterli.
function notifyDone(req: GenerateRequest) {
  const win = getWindow()
  if (!getSettings().notifyWhenHidden || !Notification.isSupported() || !win) return
  if (win.isVisible() && !win.isMinimized() && (win.isFocused() || getMode() === 'pill')) return
  const m = MODELS[req.model]
  const n = new Notification({
    title: 'Prompt hazır',
    body: `${m.name} · ${FAMILY_INFO[m.family].surfaces[req.surface].label}`,
    silent: true
  })
  n.on('click', () => showPanel())
  n.show()
}

function createTray() {
  const icon = nativeImage.createFromPath(resource(process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Prism')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', toggleVisible)
}

// Kurulu sürümde uygulamanın kendisi, geliştirmede electron.exe + proje klasörü açılışta başlatılır.
// Windows'ta kayıt adı AppUserModelId olduğu için ikisi aynı kaydı günceller.
function setLaunchAtLogin(on: boolean) {
  if (process.platform === 'linux') return linuxAutostart(on)
  app.setLoginItemSettings(
    app.isPackaged
      ? { openAtLogin: on, args: ['--hidden'] }
      : { openAtLogin: on, path: process.execPath, args: [app.getAppPath(), '--hidden'] }
  )
}

// Electron'un Linux'ta açılış kaydı yok; XDG autostart girdisi yazılır. AppImage'ın gerçek yolu APPIMAGE'dadır.
function linuxAutostart(on: boolean) {
  const file = join(app.getPath('appData'), 'autostart', 'prism.desktop')
  if (!on) return rmSync(file, { force: true })
  const exec = `"${process.env.APPIMAGE ?? process.execPath}"${app.isPackaged ? '' : ` "${app.getAppPath()}"`} --hidden`
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `[Desktop Entry]\nType=Application\nName=Prism\nExec=${exec}\nX-GNOME-Autostart-enabled=true\n`)
}

function applySettings(patch: Partial<Settings>) {
  const before = getSettings()
  const next = updateSettings(patch)
  if (patch.alwaysOnTop !== undefined) applyPin(next.alwaysOnTop)
  if (patch.hotkey && patch.hotkey !== before.hotkey && !registerHotkey(next.hotkey)) {
    updateSettings({ hotkey: before.hotkey })
    registerHotkey(before.hotkey)
    throw new Error(`Kısayol kaydedilemedi: ${patch.hotkey}`)
  }
  if (patch.launchAtLogin !== undefined) setLaunchAtLogin(next.launchAtLogin)
  refreshTray()
  return settingsView()
}

function registerIpc() {
  ipcMain.handle('settings:get', () => settingsView())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => applySettings(patch))
  ipcMain.handle('settings:test', async () => {
    const started = Date.now()
    try {
      const { engine } = await engineGenerate('analysis', {
        system: 'Reply with the single word: ok',
        user: 'ping',
        temperature: 0,
        timeoutMs: 60_000
      })
      return { ok: true, ms: Date.now() - started, engine }
    } catch (e: any) {
      return { ok: false, ms: Date.now() - started, message: e?.message ?? String(e) }
    }
  })
  ipcMain.handle('settings:openKnowledge', () => shell.openPath(knowledgeDir()))

  // Key arayüzden yalnızca kaydetmek için gelir; geri gönderilmez. Kaydedilince bağlantı ve modeller doğrulanır.
  const provider = (id: unknown): ProviderId => {
    if (!(PROVIDERS as readonly unknown[]).includes(id)) throw new Error(`Bilinmeyen sağlayıcı: ${id}`)
    return id as ProviderId
  }
  ipcMain.handle('providers:saveKey', async (_e, id: ProviderId, key: string) => {
    saveKey(provider(id), key)
    await verify(provider(id))
    refreshTray()
    return settingsView()
  })
  ipcMain.handle('providers:clearKey', (_e, id: ProviderId) => {
    clearKey(provider(id))
    refreshTray()
    return settingsView()
  })
  ipcMain.handle('providers:verify', async (_e, id: ProviderId) => {
    await verify(provider(id))
    refreshTray()
    return settingsView()
  })

  ipcMain.handle('engine:analyze', (_e, req: AnalyzeRequest) =>
    tracked(async () => {
      const analysis = await analyze(req)
      return { ...analysis, historyId: recordAnalysis(req, analysis) }
    })
  )
  ipcMain.handle('engine:generate', async (e, req: GenerateRequest) => {
    const controller = new AbortController()
    running.set(req.id, controller)
    const send = (ev: StreamEvent) => {
      if (!e.sender.isDestroyed()) e.sender.send('engine:stream', ev)
    }
    try {
      const result = await tracked(() =>
        generatePrompt(req, (text) => send({ id: req.id, type: 'chunk', text }), controller.signal)
      )
      recordOutput(req, result)
      send({ id: req.id, type: 'done', result })
      notifyDone(req)
    } catch (err: any) {
      send({ id: req.id, type: 'error', message: err?.message ?? String(err) })
    } finally {
      running.delete(req.id)
    }
  })
  ipcMain.handle('engine:cancel', (_e, id: string) => running.get(id)?.abort())

  ipcMain.handle('history:list', () => listHistory())
  ipcMain.handle('history:delete', (_e, id: string) => deleteHistory(id))
  ipcMain.handle('history:clear', () => clearHistory())

  ipcMain.handle('window:setMode', (_e, mode: WindowMode) => {
    setMode(mode)
    refreshTray()
  })
  ipcMain.handle('window:getState', () => ({ mode: getMode(), pinned: getSettings().alwaysOnTop }))
  ipcMain.handle('window:togglePin', () => applySettings({ alwaysOnTop: !getSettings().alwaysOnTop }).alwaysOnTop)
  ipcMain.handle('window:hide', () => getWindow()?.hide())
  ipcMain.handle('window:quit', () => app.quit())
  ipcMain.on('window:dragStart', (_e, kind: 'move' | 'resize') => dragStart(kind))
  ipcMain.on('window:dragMove', () => dragMove())
  ipcMain.on('window:dragEnd', () => dragEnd())

  ipcMain.handle('clipboard:write', (_e, text: string) => clipboard.writeText(text))
}

app.on('second-instance', () => {
  const win = getWindow()
  if (!win) return
  win.show()
  win.focus()
})

app.whenReady().then(() => {
  if (SELFTEST) return selftest(process.argv)
  // Arayüz kamera, mikrofon, konum vb. hiçbir tarayıcı iznine ihtiyaç duymaz.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  if (process.platform === 'win32') app.setAppUserModelId('com.prompter.app')
  if (process.platform === 'darwin') app.dock?.hide()
  registerIpc()
  // Ayar açıksa kaydı bu kopyanın yoluna göre tazele (ör. geliştirmeden kurulu sürüme geçince).
  if (getSettings().launchAtLogin) setLaunchAtLogin(true)
  const win = createWindow({ hidden: START_HIDDEN && !process.env.PRISM_CAPTURE })
  createTray()
  registerHotkey(getSettings().hotkey)
  // Key'i olup hiç doğrulanmamış sağlayıcıların modellerini arka planda getir.
  verifyPending()
    .then(() => {
      refreshTray()
      win.webContents.send('settings:changed')
    })
    .catch(() => {})
  if (process.env.PRISM_CAPTURE) captureStates(win, process.env.PRISM_CAPTURE)
})

/**
 * Geliştirme: panel ve pill hâllerinin ekran görüntüsünü alıp çıkar.
 * PRISM_CAPTURE_PROMPT verilirse arayüz üzerinden gerçek bir analiz → yazım akışı da çalıştırılır.
 */
function captureStates(win: Electron.BrowserWindow, dir: string) {
  const js = (code: string) => win.webContents.executeJavaScript(code)
  const shot = async (name: string) => {
    const img = await win.webContents.capturePage()
    writeFileSync(join(dir, `${name}.png`), img.toPNG())
  }
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const until = async (selector: string, timeoutMs = 240_000) => {
    const end = Date.now() + timeoutMs
    while (Date.now() < end) {
      if (await js(`!!document.querySelector(${JSON.stringify(selector)})`)) return true
      if (await js(`!!document.querySelector('.error')`)) return false
      await wait(500)
    }
    return false
  }
  win.webContents.once('did-finish-load', async () => {
    await wait(1500)
    await shot('panel')
    setMode('pill')
    await wait(900)
    await shot('pill')
    setMode('panel')
    await wait(900)

    const prompt = process.env.PRISM_CAPTURE_PROMPT
    if (prompt) {
      await js(`(() => {
        const ta = document.querySelector('textarea')
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, ${JSON.stringify(prompt)})
        ta.dispatchEvent(new Event('input', { bubbles: true }))
      })()`)
      await wait(300)
      await js(`document.querySelector('.cta').click()`)
      await wait(2500)
      await shot('analyzing')
      const reviewed = await until('.rec')
      await wait(1500)
      await shot(reviewed ? 'review' : 'error')
      if (reviewed) {
        await js(`document.querySelector('.row.sticky .cta').click()`)
        await wait(3000)
        await shot('generating')
        const done = await until('.cta.copy')
        await wait(1500)
        await shot(done ? 'result' : 'error')
        await js(`document.querySelector('.icon-btn[title="Geçmiş"]').click()`)
        await wait(1200)
        await shot('history')
      }
    }
    app.exit(0)
  })
}

// Pencere kapatılınca tray'de yaşamaya devam eder; çıkış tray menüsünden.
app.on('window-all-closed', () => {})
app.on('will-quit', () => globalShortcut.unregisterAll())
