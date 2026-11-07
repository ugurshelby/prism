import { app, clipboard, globalShortcut, Menu, nativeImage, Notification, session, shell, Tray } from 'electron'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { FAMILY_INFO, MODELS, PROVIDERS, PROVIDER_INFO } from '@shared/catalog'
import {
  AnalyzeRequestSchema,
  ClipboardTextSchema,
  DragKindSchema,
  GenerateRequestSchema,
  IdSchema,
  LIMITS,
  ProviderIdSchema,
  SettingsPatchSchema,
  WindowModeSchema
} from '@shared/schemas'
import type { GenerateRequest, StreamEvent } from '@shared/types'
import { getSettings, knowledgeDir, updateSettings } from './config'
import { analyze } from './engine/analyze'
import { generatePrompt } from './engine/generate'
import { appImagePath, devEnv } from './env'
import { clearHistory, deleteHistory, listHistory, recordAnalysis, recordOutput } from './history'
import { handle, on } from './ipc'
import { LlmError } from './llm'
import { logError, logWarn } from './log'
import { clearKey, engineGenerate, resolveEngine, saveKey, settingsView, verify, verifyPending } from './providers'
import { selftest } from './selftest'
import {
  applyContentProtection,
  applyPin,
  createWindow,
  dragEnd,
  dragMove,
  dragStart,
  flushWindowState,
  getMode,
  getWindow,
  isAppUrl,
  setMode,
  toggleVisible
} from './window'

// Ürünün eski adı Prompter'dı: o adla kurulmuş sürümlerin ayarları, key'leri ve geçmişi olduğu klasörde kullanılır.
// Chromium yeni klasörü açılışta önbellekler için kendisi oluşturduğundan klasöre değil içindeki verilere bakılır.
const legacyData = join(app.getPath('appData'), 'Prompter')
const hasData = (dir: string) => ['settings.json', 'history.json', 'history.enc'].some((f) => existsSync(join(dir, f)))
if (!hasData(app.getPath('userData')) && hasData(legacyData)) app.setPath('userData', legacyData)

// Geliştirme ve testte gerçek ayar/geçmiş klasörüne dokunmamak için ayrı bir userData klasörü kullanılabilir.
// Kurulu sürümde bu ve diğer PRISM_* değişkenleri yok sayılır (env.ts).
const DEV = devEnv()
if (DEV.userData) {
  const dir = resolve(DEV.userData)
  mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)
}

// Kurulu sürümde yalnızca çevrimdışı --smoke denetimi çalışır; kayıtlı key'lerle ağa çıkan selftest yolları geliştirmeye özeldir.
const SELFTEST = process.argv.includes('--selftest') && (!app.isPackaged || process.argv.includes('--smoke'))
// İkinci kopya hiçbir şey başlatmadan hemen çıkar; ilk kopya pencereyi öne getirir (second-instance).
if (!SELFTEST && !app.requestSingleInstanceLock()) app.exit(0)

// Ekran görüntüleri retina ekranlarda da net görünsün diye 1,5x çizilir (2x'te panel çoğu ekrana sığmaz).
if (DEV.captureDir) app.commandLine.appendSwitch('force-device-scale-factor', '1.5')

// Linux'ta saydam pencere (kompozitör varsa) bu anahtarla çalışır.
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-transparent-visuals')

// Arayüzün açabileceği tek dış bağlantılar sağlayıcıların key sayfalarıdır.
const EXTERNAL_ORIGINS = new Set(PROVIDERS.map((p) => new URL(PROVIDER_INFO[p].keyUrl).origin))

function openExternal(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    logWarn('shell', 'geçersiz dış bağlantı reddedildi')
    return
  }
  if (url.protocol !== 'https:' || !EXTERNAL_ORIGINS.has(url.origin)) {
    logWarn('shell', `izin verilmeyen dış bağlantı reddedildi: ${url.origin}`)
    return
  }
  shell.openExternal(url.href).catch((e: unknown) => logWarn('shell', 'dış bağlantı açılamadı', e))
}

// Uygulama yalnızca kendi arayüzünü yükler: yeni pencere, başka sayfaya geçiş, yönlendirme ve webview kapalı.
// Dış bağlantılar (key alma sayfaları) yalnızca izinli https adresleriyse sistem tarayıcısında açılır.
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (e, url) => {
    if (url !== contents.getURL()) e.preventDefault()
  })
  contents.on('will-redirect', (e) => e.preventDefault())
  contents.on('will-attach-webview', (e) => e.preventDefault())
})

let tray: Tray | null = null
const running = new Map<string, AbortController>()
let active = 0

/**
 * Geçmişe yazılamaması (anahtarlık hatası, dosya kilidi) ücreti ödenmiş sonucu kaybettirmez:
 * hata günlüğe düşer, sonuç arayüze yine gider. Kimlik dönmezse arayüz o girdiyi geçmişte bulamaz, o kadar.
 */
function keepRecord<T>(what: string, write: () => T): T | undefined {
  try {
    return write()
  } catch (e) {
    logWarn('history', `${what} geçmişe yazılamadı`, e)
    return undefined
  }
}

// Oturum açılışında başlatıldıysa pencere gösterilmez, tray'de bekler.
const START_HIDDEN =
  process.argv.includes('--hidden') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin)

function resource(name: string) {
  return app.isPackaged ? join(process.resourcesPath, name) : join(app.getAppPath(), 'resources', name)
}

function registerHotkey(accelerator: string) {
  globalShortcut.unregisterAll()
  try {
    const ok = globalShortcut.register(accelerator, toggleVisible)
    if (!ok) logWarn('hotkey', `kısayol başka bir uygulamada kayıtlı: ${accelerator}`)
    return ok
  } catch (e) {
    logWarn('hotkey', `kısayol tanınmadı: ${accelerator}`, e)
    return false
  }
}

/** Pencereyi panel olarak öne getirir; istenirse arayüzde geçmişi ya da ayarları açar. */
function showPanel(open?: 'settings' | 'history') {
  const win = getWindow() ?? createWindow()
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
      click: (item) => {
        try {
          applySettings({ alwaysOnTop: item.checked })
        } catch (e) {
          logError('tray', 'ayar uygulanamadı', e)
        }
      }
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
/** Tray yenilenemezse (ör. okunamayan bir dosya) yürüyen ya da biten iş bundan etkilenmez. */
function safeRefreshTray() {
  try {
    refreshTray()
  } catch (e) {
    logWarn('tray', 'tray menüsü yenilenemedi', e)
  }
}

async function tracked<T>(work: () => Promise<T>): Promise<T> {
  active++
  safeRefreshTray()
  try {
    return await work()
  } finally {
    active--
    safeRefreshTray()
  }
}

// Panel gizliyken ya da arkadayken bitmiş yazımı bildir; küre modunda rozet yeterli.
// Bildirimde prompt içeriği yer almaz, yalnızca model ve yüzey adı.
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
function setLaunchAtLogin(enabled: boolean) {
  if (process.platform === 'linux') return linuxAutostart(enabled)
  app.setLoginItemSettings(
    app.isPackaged
      ? { openAtLogin: enabled, args: ['--hidden'] }
      : { openAtLogin: enabled, path: process.execPath, args: [app.getAppPath(), '--hidden'] }
  )
}

// Exec satırında çift tırnak içindeki yolda ", ters bölü, $, ters tırnak, % ya da satır sonu komut enjeksiyonuna
// yol açar; böyle bir yol kabul edilmez. Tek tırnak (ör. O'Neil) çift tırnak içinde zararsızdır.
const SAFE_EXEC_PATH = /^[^"`$\\\r\n%]+$/

// Electron'un Linux'ta açılış kaydı yok; XDG autostart girdisi yazılır. AppImage'ın gerçek yolu APPIMAGE'dadır.
function linuxAutostart(enabled: boolean) {
  const file = join(app.getPath('appData'), 'autostart', 'prism.desktop')
  if (!enabled) return rmSync(file, { force: true })
  const paths = [appImagePath() ?? process.execPath, ...(app.isPackaged ? [] : [app.getAppPath()])]
  if (!paths.every((p) => SAFE_EXEC_PATH.test(p))) throw new Error('Uygulama yolu açılışta başlatma için uygun değil.')
  const exec = `${paths.map((p) => `"${p}"`).join(' ')} --hidden`
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `[Desktop Entry]\nType=Application\nName=Prism\nExec=${exec}\nX-GNOME-Autostart-enabled=true\n`)
}

function applySettings(patch: z.infer<typeof SettingsPatchSchema>) {
  const before = getSettings()
  // İşletim sistemi tarafındaki adımlar önce denenir; biri başarısız olursa yamanın hiçbir parçası kaydedilmez.
  const hotkeyChanged = !!patch.hotkey && patch.hotkey !== before.hotkey
  if (patch.hotkey && hotkeyChanged && !registerHotkey(patch.hotkey)) {
    registerHotkey(before.hotkey)
    throw new Error(`Kısayol kaydedilemedi: ${patch.hotkey}`)
  }
  if (patch.launchAtLogin !== undefined) {
    try {
      setLaunchAtLogin(patch.launchAtLogin)
    } catch (e) {
      if (hotkeyChanged) registerHotkey(before.hotkey)
      throw e
    }
  }
  let next: ReturnType<typeof updateSettings>
  try {
    next = updateSettings(patch)
  } catch (e) {
    // Ayar kaydedilemediyse işletim sistemi tarafında yapılanlar da geri alınır.
    if (hotkeyChanged) registerHotkey(before.hotkey)
    if (patch.launchAtLogin !== undefined && patch.launchAtLogin !== before.launchAtLogin) {
      try {
        setLaunchAtLogin(before.launchAtLogin)
      } catch (undo) {
        logWarn('autostart', 'açılışta başlatma ayarı geri alınamadı', undo)
      }
    }
    throw e
  }
  if (patch.alwaysOnTop !== undefined) applyPin(next.alwaysOnTop)
  if (patch.contentProtection !== undefined) applyContentProtection(next.contentProtection)
  refreshTray()
  return settingsView()
}

const none = z.tuple([])

function registerIpc() {
  handle('settings:get', none, () => settingsView())
  handle('settings:set', z.tuple([SettingsPatchSchema]), (_e, patch) => applySettings(patch))
  handle('settings:test', none, async () => {
    const started = Date.now()
    try {
      const { engine } = await engineGenerate('analysis', {
        system: 'Reply with the single word: ok',
        user: 'ping',
        temperature: 0,
        timeoutMs: 60_000
      })
      return { ok: true, ms: Date.now() - started, engine }
    } catch (e) {
      return { ok: false, ms: Date.now() - started, message: e instanceof Error ? e.message : 'Bağlantı denemesi başarısız.' }
    }
  })
  handle('settings:openKnowledge', none, () => shell.openPath(knowledgeDir()))

  // Key arayüzden yalnızca kaydetmek için gelir; geri gönderilmez. Kaydedilince bağlantı ve modeller doğrulanır.
  // Biçim denetimi saveKey'de: hata mesajı alan adını değil key'in sorununu anlatsın.
  handle('providers:saveKey', z.tuple([ProviderIdSchema, z.string().max(LIMITS.keyMax * 2)]), async (_e, id, key) => {
    saveKey(id, key)
    await verify(id)
    refreshTray()
    return settingsView()
  })
  handle('providers:clearKey', z.tuple([ProviderIdSchema]), (_e, id) => {
    clearKey(id)
    refreshTray()
    return settingsView()
  })
  handle('providers:verify', z.tuple([ProviderIdSchema]), async (_e, id) => {
    await verify(id)
    refreshTray()
    return settingsView()
  })

  handle('engine:analyze', z.tuple([AnalyzeRequestSchema]), async (_e, req) => {
    if (running.has(req.id)) throw new Error('Bu istek zaten çalışıyor.')
    const controller = new AbortController()
    running.set(req.id, controller)
    // Geçmiş ayarı istek başladığı anki değeriyle uygulanır: kapalıyken başlatılan prompt sonradan açılsa da kaydedilmez.
    const save = getSettings().saveHistory
    try {
      const analysis = await tracked(() => analyze(req, controller.signal))
      // İptal edilmiş analiz geçmişe yazılmaz; yanıt sağlayıcıdan gelmiş olsa bile arayüz onu artık beklemiyor.
      if (controller.signal.aborted) throw new LlmError('İptal edildi.')
      return { ...analysis, historyId: save ? keepRecord('analiz', () => recordAnalysis(req, analysis)) : undefined }
    } finally {
      running.delete(req.id)
    }
  })
  handle('engine:generate', z.tuple([GenerateRequestSchema]), async (e, req) => {
    // Aynı kimlikle ikinci bir yazım, öncekinin iptal denetimini ezmesin.
    if (running.has(req.id)) throw new Error('Bu istek zaten çalışıyor.')
    const controller = new AbortController()
    running.set(req.id, controller)
    const save = getSettings().saveHistory
    const send = (ev: StreamEvent) => {
      if (!e.sender.isDestroyed()) e.sender.send('engine:stream', ev)
    }
    try {
      const result = await tracked(() =>
        generatePrompt(req, (text) => send({ id: req.id, type: 'chunk', text }), controller.signal)
      )
      // Bittikten hemen sonra iptal edilmiş yazım geçmişe yazılmaz; kullanıcı onu artık istemiyor.
      if (save && !controller.signal.aborted) keepRecord('yazım', () => recordOutput(req, result))
      send({ id: req.id, type: 'done', result })
      notifyDone(req)
    } catch (err) {
      send({ id: req.id, type: 'error', message: err instanceof Error ? err.message : 'Yazım başarısız.' })
    } finally {
      running.delete(req.id)
    }
  })
  handle('engine:cancel', z.tuple([IdSchema]), (_e, id) => running.get(id)?.abort())

  handle('history:list', none, () => listHistory())
  handle('history:delete', z.tuple([IdSchema]), (_e, id) => deleteHistory(id))
  handle('history:clear', none, () => clearHistory())

  handle('window:setMode', z.tuple([WindowModeSchema]), (_e, mode) => {
    setMode(mode)
    refreshTray()
  })
  handle('window:getState', none, () => ({ mode: getMode(), pinned: getSettings().alwaysOnTop }))
  handle('window:togglePin', none, () => applySettings({ alwaysOnTop: !getSettings().alwaysOnTop }).alwaysOnTop)
  handle('window:hide', none, () => getWindow()?.hide())
  handle('window:quit', none, () => app.quit())
  on('window:dragStart', z.tuple([DragKindSchema]), (_e, kind) => dragStart(kind))
  on('window:dragMove', none, () => dragMove())
  on('window:dragEnd', none, () => dragEnd())

  handle('clipboard:write', z.tuple([ClipboardTextSchema]), (_e, text) => clipboard.writeText(text))
}

// --- Oturum kilidi ------------------------------------------------------------------
// Arayüz ağa hiç çıkmaz; sağlayıcı istekleri yalnızca ana süreçten gider (llm/http.ts). Arayüzde bir hata
// olsa bile prompt ya da geçmiş arayüz üzerinden dışarı gönderilemez.

function isInsideApp(fileUrl: string): boolean {
  try {
    const root = resolve(app.getAppPath())
    const path = resolve(fileURLToPath(fileUrl))
    return path === root || path.startsWith(root + sep)
  } catch (e) {
    logWarn('session', 'dosya adresi çözülemedi', e)
    return false
  }
}

function isLocalRequest(url: string): boolean {
  if (url.startsWith('devtools:') || url.startsWith('data:') || url.startsWith('blob:')) return true
  if (url.startsWith('file:')) return isInsideApp(url)
  const dev = DEV.rendererUrl
  if (!dev) return false
  // Geliştirmede electron-vite sunucusu ve HMR soketi.
  const devSocket = new URL(dev).origin.replace(/^http/, 'ws')
  return isAppUrl(url) || (URL.canParse(url) && new URL(url).origin === devSocket)
}

function lockDownSession() {
  const ses = session.defaultSession
  // Arayüz kamera, mikrofon, konum vb. hiçbir tarayıcı iznine ihtiyaç duymaz.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
  ses.webRequest.onBeforeRequest((details, callback) => {
    const local = isLocalRequest(details.url)
    if (!local) logWarn('session', 'arayüzden dışarı istek engellendi')
    callback({ cancel: !local })
  })
}

app.on('second-instance', () => {
  const win = getWindow()
  if (!win) return
  win.show()
  win.focus()
})

app
  .whenReady()
  .then(() => {
    if (SELFTEST) return selftest(process.argv)
    lockDownSession()
    if (process.platform === 'win32') app.setAppUserModelId('com.prompter.app')
    if (process.platform === 'darwin') app.dock?.hide()
    registerIpc()
    // Ayar açıksa kaydı bu kopyanın yoluna göre tazele (ör. geliştirmeden kurulu sürüme geçince).
    if (getSettings().launchAtLogin) {
      // Kayıt tazelenemezse uygulama yine açılır; kullanıcı ayarı ayarlar ekranından değiştirebilir.
      try {
        setLaunchAtLogin(true)
      } catch (e) {
        logWarn('autostart', 'açılışta başlatma kaydı tazelenemedi', e)
      }
    }
    const win = createWindow({ hidden: START_HIDDEN && !DEV.captureDir })
    createTray()
    registerHotkey(getSettings().hotkey)
    // Key'i olup hiç doğrulanmamış sağlayıcıların modellerini arka planda getir.
    verifyPending()
      .then(() => {
        refreshTray()
        win.webContents.send('settings:changed')
      })
      .catch((e: unknown) => logWarn('providers', 'açılıştaki key doğrulaması tamamlanamadı', e))
    if (DEV.captureDir) captureStates(win, DEV.captureDir, DEV.capturePrompt)
  })
  .catch((e: unknown) => {
    logError('app', 'açılış başarısız', e)
    app.exit(1)
  })

/**
 * Geliştirme: panel ve pill hâllerinin ekran görüntüsünü alıp çıkar.
 * PRISM_CAPTURE_PROMPT verilirse arayüz üzerinden gerçek bir analiz → yazım akışı da çalıştırılır.
 */
function captureStates(win: Electron.BrowserWindow, dir: string, prompt: string | undefined) {
  const js = (code: string): Promise<unknown> => win.webContents.executeJavaScript(code)
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
  const run = async () => {
    await wait(1500)
    await shot('panel')
    setMode('pill')
    await wait(900)
    await shot('pill')
    setMode('panel')
    await wait(900)

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
  }
  win.webContents.once('did-finish-load', () => {
    run()
      .catch((e: unknown) => logError('capture', 'ekran görüntüsü akışı yarıda kaldı', e))
      .finally(() => app.exit(0))
  })
}

// Pencere kapatılınca tray'de yaşamaya devam eder; çıkış tray menüsünden.
app.on('window-all-closed', () => {})
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  flushWindowState()
})
