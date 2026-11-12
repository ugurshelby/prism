import { app, clipboard, dialog, globalShortcut, Menu, nativeImage, Notification, session, shell, Tray } from 'electron'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { FAMILY_INFO, MODELS, PROVIDERS, PROVIDER_INFO, type FamilyChoice } from '@shared/catalog'
import { PRODUCT } from '@shared/product'
import { msg } from '@shared/messages'
import {
  AnalyzeRequestSchema,
  ClipboardTextSchema,
  GenerateRequestSchema,
  IdSchema,
  LIMITS,
  ProviderIdSchema,
  SettingsPatchSchema,
  WindowModeSchema
} from '@shared/schemas'
import type { GenerateRequest, StreamEvent } from '@shared/types'
import { blockWrites, getSettings, knowledgeDir, updateSettings } from './config'
import { analyze } from './engine/analyze'
import { generatePrompt } from './engine/generate'
import { appImagePath, devEnv } from './env'
import { clearHistory, deleteHistory, listHistory, recordAnalysis, recordOutput } from './history'
import { handle, on, rendererMessage } from './ipc'
import { LlmError } from './llm'
import { UserError } from './errors'
import { logError, logWarn } from './log'
import { clearKey, engineGenerate, forgetAllKeys, resolveEngine, needsVerify, saveKey, setHotkeyOk, settingsView, verify, verifyPending } from './providers'
import { MIGRATION_MARKER, inspectDir, markMigrationDone, migrateLegacyData } from './migrate'
import { selftest } from './selftest'
import { checkForUpdate, openReleasePage, startUpdateChecks, updateView } from './update'
import { wipeOwnData } from './wipe'
import {
  applyContentProtection,
  applyPin,
  createWindow,
  dragEnd,
  dragMove,
  dragStart,
  flushWindowState,
  hidePanel,
  revealPanel,
  setPillState,
  getMode,
  getPill,
  getWindow,
  isAppUrl,
  setMode,
  toggleVisible
} from './window'

// Ürün kimliği hiçbir yol okunmadan önce kurulur: ad, userData ve (aşağıda) tek kopya kilidi ürüne özeldir,
// böylece Ray ve Spectrum yan yana çalışır. Her ürün yalnızca kendi klasörünü kullanır. Spectrum ilk açılışta eski
// adlarla (Prism 2.x, Prompter) kurulmuş veriyi bir kez kendi klasörüne kopyalar (migrate.ts); eski klasöre yazılmaz.
app.setName(PRODUCT.name)
const appData = app.getPath('appData')
app.setPath('userData', join(appData, PRODUCT.dataDir))

// Geliştirme ve testte gerçek ayar/geçmiş klasörüne dokunmamak için ayrı bir userData klasörü kullanılabilir.
// Kurulu sürümde bu ve diğer PRISM_* değişkenleri yok sayılır (env.ts). Geliştirmede gerçek klasörlere göç yapılmaz.
const DEV = devEnv()
if (DEV.userData) {
  const dir = resolve(DEV.userData)
  mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)
}

// Kurulu sürüm uzaktan hata ayıklama anahtarlarıyla açılmaz: bu anahtarlarla arayüze bağlanan biri key'lerle istek
// başlatabilir, geçmişi okuyabilir.
const UNSAFE_SWITCHES = ['remote-debugging-port', 'remote-debugging-pipe', 'remote-debugging-address', 'inspect', 'inspect-brk']
if (app.isPackaged && UNSAFE_SWITCHES.some((s) => app.commandLine.hasSwitch(s) || process.argv.some((a) => a === `--${s}` || a.startsWith(`--${s}=`)))) {
  logError('app', 'kurulu sürüm güvenli olmayan bir komut satırı anahtarıyla açılmak istendi; çıkılıyor')
  app.exit(1)
}

// Kurulu sürümde yalnızca çevrimdışı --smoke denetimi çalışır; kayıtlı key'lerle ağa çıkan selftest yolları geliştirmeye özeldir.
const SELFTEST = process.argv.includes('--selftest') && (!app.isPackaged || process.argv.includes('--smoke'))
// İkinci kopya hiçbir şey başlatmadan hemen çıkar; ilk kopya pencereyi öne getirir (second-instance).
const PRIMARY = SELFTEST || app.requestSingleInstanceLock()
if (!PRIMARY) app.exit(0)

// Eski sürüm verisinin bir kerelik göçü yalnızca kilidi alan kopyada ve gerçek kurulumda yapılır (iki eşzamanlı ilk
// açılış birbirinin göçünü bozmasın; geliştirme ve smoke gerçek klasörlere dokunmasın).
if (PRIMARY && !SELFTEST && !DEV.userData) {
  const from = migrateLegacyData(appData, PRODUCT)
  if (from) logWarn('migrate', `${from} klasöründeki veriler ${PRODUCT.dataDir} klasörüne kopyalandı`)
}

// Ekran görüntüleri retina ekranlarda da net görünsün diye 1,5x çizilir (2x'te panel çoğu ekrana sığmaz).
if (DEV.captureDir) app.commandLine.appendSwitch('force-device-scale-factor', '1.5')

// Linux'ta saydam pencere (kompozitör varsa) bu anahtarla çalışır.
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-transparent-visuals')

// Arayüzün açabileceği tek dış bağlantılar sağlayıcıların key sayfalarıdır (köken ve yol öneki birlikte).
const EXTERNAL_PAGES = PROVIDERS.map((p) => new URL(PROVIDER_INFO[p].keyUrl))
const isKeyPage = (url: URL) =>
  EXTERNAL_PAGES.some((k) => url.origin === k.origin && (k.pathname === '/' || url.pathname === k.pathname || url.pathname.startsWith(`${k.pathname}/`)))

function openExternal(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    logWarn('shell', 'geçersiz dış bağlantı reddedildi')
    return
  }
  if (url.protocol !== 'https:' || !isKeyPage(url)) {
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
  let ok = false
  try {
    ok = globalShortcut.register(accelerator, toggleVisible)
    if (!ok) logWarn('hotkey', `kısayol kaydedilemedi (başka uygulama ya da Wayland): ${accelerator}`)
  } catch (e) {
    logWarn('hotkey', `kısayol tanınmadı: ${accelerator}`, e)
  }
  setHotkeyOk(ok)
  return ok
}

/** Pencereyi panel olarak öne getirir; istenirse arayüzde geçmişi ya da ayarları açar. */
function showPanel(open?: 'settings' | 'history') {
  const win = getWindow() ?? createWindow()
  revealPanel()
  if (open) win.webContents.send('ui:open', open)
}

function buildTrayMenu() {
  const s = getSettings()
  const engine = resolveEngine()
  return Menu.buildFromTemplate([
    { label: PRODUCT.name, enabled: false },
    { label: active > 0 ? msg('tray.working') : msg('tray.ready'), enabled: false },
    { type: 'separator' },
    { label: msg('tray.showHide'), click: toggleVisible },
    { label: getMode() === 'pill' ? msg('tray.openPanel') : msg('tray.minimize'), click: () => setMode(getMode() === 'pill' ? 'panel' : 'pill') },
    { label: msg('tray.history'), click: () => showPanel('history') },
    { label: msg('tray.settings'), click: () => showPanel('settings') },
    { type: 'separator' },
    {
      label: engine ? msg('tray.engine', { engine: `${PROVIDER_INFO[engine.provider].label} · ${engine.generation}` }) : msg('tray.engineNone'),
      enabled: false
    },
    {
      label: msg('tray.alwaysOnTop'),
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
    { label: msg('tray.quit'), click: () => app.quit() }
  ])
}

function refreshTray() {
  tray?.setContextMenu(buildTrayMenu())
  tray?.setToolTip(active > 0 ? msg('tray.tooltipBusy', { product: PRODUCT.name }) : PRODUCT.name)
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
  setPillState({ busy: true })
  try {
    return await work()
  } finally {
    active--
    safeRefreshTray()
    setPillState({ busy: active > 0 })
  }
}

/** Ürün kuralı ana süreçte de geçerli: seçili olmayan aile için motor çalışmaz; çapraz öneri yalnızca çok aileli üründe. */
function assertFamily(family: FamilyChoice) {
  const { families } = getSettings()
  const ok = family === 'auto' ? PRODUCT.familyMode === 'multi' : families.includes(family)
  if (!ok) throw new UserError(msg('err.familyNotSelected'))
}

// Aynı türden en fazla iki iş aynı anda çalışır: arayüz hatası ya da tekrarlanan tıklama sağlayıcıya yığın
// istek göndermesin (key'in kotası ve owner'ın bütçesi).
const MAX_PER_KIND = 2
const kinds = { analyze: 0, generate: 0 }
async function limited<T>(kind: keyof typeof kinds, work: () => Promise<T>): Promise<T> {
  if (kinds[kind] >= MAX_PER_KIND) throw new UserError(msg('err.tooMany'))
  kinds[kind]++
  try {
    return await work()
  } finally {
    kinds[kind]--
  }
}

// Panel gizliyken ya da arkadayken bitmiş yazımı bildir; küre modunda rozet yeterli.
// Bildirimde prompt içeriği yer almaz, yalnızca model ve yüzey adı.
function notifyDone(req: GenerateRequest) {
  const win = getWindow()
  // Panel görünmüyorsa (küre ya da tray) kürede rozet yanar; panel açılınca söner.
  if (!win?.isVisible()) setPillState({ badge: true })
  if (!getSettings().notifyWhenHidden || !Notification.isSupported() || !win) return
  if (win.isVisible() && !win.isMinimized() && (win.isFocused() || getMode() === 'pill')) return
  const m = MODELS[req.model]
  const n = new Notification({
    title: msg('notify.ready'),
    body: `${m.name} · ${FAMILY_INFO[m.family].surfaces[req.surface].label}`,
    silent: true
  })
  n.on('click', () => showPanel())
  n.show()
}

function createTray() {
  const icon = nativeImage.createFromPath(resource(process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip(PRODUCT.name)
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', toggleVisible)
}

// Kurulu sürümde uygulamanın kendisi, geliştirmede electron.exe + proje klasörü açılışta başlatılır.
// Windows'ta kayıt adı ürünün appId'sidir: ikisi aynı kaydı günceller, iki ürün birbirinin kaydına dokunmaz.
function setLaunchAtLogin(enabled: boolean) {
  if (process.platform === 'linux') return linuxAutostart(enabled)
  const name = PRODUCT.appId
  app.setLoginItemSettings(
    app.isPackaged
      ? { openAtLogin: enabled, name, args: ['--hidden'] }
      : { openAtLogin: enabled, name, path: process.execPath, args: [app.getAppPath(), '--hidden'] }
  )
}

// Ürünün verisi: kullanılan userData ve (Spectrum'da) eski adlarla kurulmuş klasörler. Geliştirmede ayrı bir
// userData verildiyse yalnızca o klasör silinir; gerçek kurulumların klasörlerine dokunulmaz.
function dataDirs(): string[] {
  const dirs = [app.getPath('userData')]
  if (DEV.userData) return dirs
  dirs.push(join(appData, PRODUCT.dataDir))
  // Eski klasörlere yalnızca Prism imzası taşıyorlarsa dokunulur: aynı adlı başka bir uygulamanın klasörü silinmez.
  for (const d of PRODUCT.legacyDataDirs) if (inspectDir(join(appData, d)).hasSignature) dirs.push(join(appData, d))
  return dirs
}

/**
 * "Tüm verilerimi sil". Arayüz güvenilmez sayıldığı için onay ana süreçteki sistem penceresinden alınır (varsayılan
 * Vazgeç). Sonra süren istekler durdurulur ve diske yazım kapatılır: bellekteki geçmiş, ayar ya da model önbelleği
 * silinen dosyaları geri yazamaz. Açılış kaydı kaldırılır, dosyalar silinir. Bir parça başarısız olursa kalan dosyalar
 * hata olarak döner ve uygulama yazımsız açık kalır; her şey silindiyse uygulama boş verilerle yeniden başlar.
 */
async function deleteAllData(): Promise<boolean> {
  const win = getWindow()
  const options = {
    type: 'warning' as const,
    title: PRODUCT.name,
    message: msg('wipe.confirmTitle'),
    detail: msg('wipe.confirmBody'),
    buttons: [msg('wipe.cancel'), msg('wipe.confirm')],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  }
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
  if (response !== 1) return false
  for (const controller of running.values()) controller.abort()
  blockWrites()
  forgetAllKeys()
  const failed: string[] = []
  // Geliştirmede ayrı userData ile çalışılıyorsa gerçek kurulumun açılış kaydına dokunulmaz.
  if (!DEV.userData) {
    try {
      setLaunchAtLogin(false)
    } catch (e) {
      logWarn('wipe', 'açılış kaydı kaldırılamadı', e)
      failed.push('autostart')
    }
  }
  failed.push(...wipeOwnData(dataDirs()))
  // Göç işareti silinmiş olsa da göç bir daha çalışmasın: eski klasörde kalan bir dosya silinen verileri geri getirmesin.
  if (!DEV.userData && PRODUCT.legacyDataDirs.length) {
    try {
      markMigrationDone(join(appData, PRODUCT.dataDir), 'wiped')
    } catch (e) {
      logWarn('wipe', 'göç işareti yazılamadı', e)
      failed.push(MIGRATION_MARKER)
    }
  }
  if (failed.length) throw new UserError(msg('err.deleteData', { files: failed.join(', ') }))
  setImmediate(() => {
    // AppImage'da process.execPath geçici bağlama noktasıdır; yeniden başlatma gerçek dosyadan yapılır.
    // --hidden atılır: açılışta başlamış bir kopya silmeden sonra görünmez dönmesin.
    app.relaunch({ execPath: appImagePath() ?? process.execPath, args: process.argv.slice(1).filter((a) => a !== '--hidden') })
    app.exit(0)
  })
  return true
}

// Exec satırında çift tırnak içindeki yolda ", ters bölü, $, ters tırnak, % ya da satır sonu komut enjeksiyonuna
// yol açar; böyle bir yol kabul edilmez. Tek tırnak (ör. O'Neil) çift tırnak içinde zararsızdır.
const SAFE_EXEC_PATH = /^[^"`$\\\r\n%]+$/

// Electron'un Linux'ta açılış kaydı yok; XDG autostart girdisi yazılır. AppImage'ın gerçek yolu APPIMAGE'dadır.
// Dosya adı ürüne özeldir: iki ürün birbirinin girdisini ezmez ya da silmez.
function linuxAutostart(enabled: boolean) {
  const file = join(app.getPath('appData'), 'autostart', `prism-${PRODUCT.id}.desktop`)
  if (!enabled) return rmSync(file, { force: true })
  const paths = [appImagePath() ?? process.execPath, ...(app.isPackaged ? [] : [app.getAppPath()])]
  if (!paths.every((p) => SAFE_EXEC_PATH.test(p))) throw new UserError(msg('err.autostartPath'))
  const exec = `${paths.map((p) => `"${p}"`).join(' ')} --hidden`
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `[Desktop Entry]\nType=Application\nName=${PRODUCT.name}\nExec=${exec}\nX-GNOME-Autostart-enabled=true\n`)
}

function applySettings(patch: z.infer<typeof SettingsPatchSchema>) {
  const before = getSettings()
  // İşletim sistemi tarafındaki adımlar önce denenir; biri başarısız olursa yamanın hiçbir parçası kaydedilmez.
  const hotkeyChanged = !!patch.hotkey && patch.hotkey !== before.hotkey
  if (patch.hotkey && hotkeyChanged && !registerHotkey(patch.hotkey)) {
    registerHotkey(before.hotkey)
    throw new UserError(msg('err.hotkey', { hotkey: patch.hotkey }))
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
  // Küre de dili okumak için ayarları alır; başka hiçbir kanala erişemez.
  handle('settings:get', none, () => settingsView(), 'any')
  handle('settings:set', z.tuple([SettingsPatchSchema]), (_e, patch) => applySettings(patch))
  // Test de ücretli bir çağrıdır: analizle aynı eşzamanlılık sınırına tabi.
  handle('settings:test', none, async () => {
    const started = Date.now()
    try {
      const { engine } = await limited('analyze', () => engineGenerate('analysis', {
        system: 'Reply with the single word: ok',
        user: 'ping',
        temperature: 0,
        timeoutMs: 60_000
      }))
      return { ok: true, ms: Date.now() - started, engine }
    } catch (e) {
      return { ok: false, ms: Date.now() - started, message: rendererMessage('settings:test', e) }
    }
  })
  handle('settings:openKnowledge', none, () => shell.openPath(knowledgeDir()))

  // Key arayüzden yalnızca kaydetmek için gelir; geri gönderilmez. Kaydedilince bağlantı ve modeller doğrulanır.
  // Biçim denetimi saveKey'de: hata mesajı alan adını değil key'in sorununu anlatsın.
  handle('providers:saveKey', z.tuple([ProviderIdSchema, z.string().max(LIMITS.keyMax * 2)]), async (_e, id, key) => {
    // Aynı key yeniden kaydedilirse başarılı son doğrulama korunur; ücretli keşif yinelenmez.
    if (saveKey(id, key) || needsVerify(id)) await verify(id)
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
    assertFamily(req.family)
    if (req.manual) assertFamily(MODELS[req.manual.model].family)
    if (running.has(req.id)) throw new UserError(msg('err.running'))
    const controller = new AbortController()
    running.set(req.id, controller)
    // Geçmiş ayarı istek başladığı anki değeriyle uygulanır: kapalıyken başlatılan prompt sonradan açılsa da kaydedilmez.
    const save = getSettings().saveHistory
    try {
      const analysis = await limited('analyze', () => tracked(() => analyze(req, controller.signal)))
      // İptal edilmiş analiz geçmişe yazılmaz; yanıt sağlayıcıdan gelmiş olsa bile arayüz onu artık beklemiyor.
      if (controller.signal.aborted) throw new LlmError(msg('err.cancelled'))
      return { ...analysis, historyId: save ? keepRecord('analiz', () => recordAnalysis(req, analysis)) : undefined }
    } finally {
      running.delete(req.id)
    }
  })
  handle('engine:generate', z.tuple([GenerateRequestSchema]), async (e, req) => {
    assertFamily(MODELS[req.model].family)
    // Aynı kimlikle ikinci bir yazım, öncekinin iptal denetimini ezmesin.
    if (running.has(req.id)) throw new UserError(msg('err.running'))
    const controller = new AbortController()
    running.set(req.id, controller)
    const save = getSettings().saveHistory
    const send = (ev: StreamEvent) => {
      if (!e.sender.isDestroyed()) e.sender.send('engine:stream', ev)
    }
    try {
      const result = await limited('generate', () =>
        tracked(() => generatePrompt(req, (text) => send({ id: req.id, type: 'chunk', text }), controller.signal))
      )
      // Bittikten hemen sonra iptal edilmiş yazım geçmişe yazılmaz; kullanıcı onu artık istemiyor.
      if (save && !controller.signal.aborted) keepRecord('yazım', () => recordOutput(req, result))
      if (controller.signal.aborted) {
        send({ id: req.id, type: 'error', message: msg('err.cancelled') })
        return
      }
      send({ id: req.id, type: 'done', result })
      notifyDone(req)
    } catch (err) {
      send({ id: req.id, type: 'error', message: rendererMessage('engine:generate', err) })
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
  }, 'any')
  handle('window:getState', none, () => ({ mode: getMode(), pinned: getSettings().alwaysOnTop }))
  handle('window:togglePin', none, () => applySettings({ alwaysOnTop: !getSettings().alwaysOnTop }).alwaysOnTop)
  handle('window:hide', none, () => hidePanel())
  handle('window:quit', none, () => app.quit())
  // Sürükleme yalnızca küre penceresinde; panel yerel olarak taşınır ve boyutlandırılır.
  on('window:dragStart', none, () => dragStart(), 'pill')
  on('window:dragMove', none, () => dragMove(), 'pill')
  on('window:dragEnd', z.tuple([z.boolean()]), (_e, animate) => dragEnd(animate), 'pill')

  handle('clipboard:write', z.tuple([ClipboardTextSchema]), (_e, text) => clipboard.writeText(text))

  handle('update:get', none, () => updateView())
  handle('update:check', none, () => checkForUpdate())
  handle('update:openRelease', none, () => openReleasePage())

  handle('data:deleteAll', none, () => deleteAllData())
}

// --- Oturum kilidi ------------------------------------------------------------------
// Arayüz ağa hiç çıkmaz; sağlayıcı istekleri yalnızca ana süreçten gider (llm/http.ts). Arayüzde bir hata
// olsa bile prompt ya da geçmiş arayüz üzerinden dışarı gönderilemez.

function isInsideApp(fileUrl: string): boolean {
  try {
    // Yalnızca derlenmiş arayüz klasörü: geliştirmede uygulama kökü proje klasörüdür (.env orada).
    const root = resolve(app.getAppPath(), 'out', 'renderer')
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
  if (getWindow()) revealPanel()
})

app
  .whenReady()
  .then(() => {
    if (SELFTEST) return selftest(process.argv)
    lockDownSession()
    if (process.platform === 'win32') app.setAppUserModelId(PRODUCT.appId)
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
    startUpdateChecks(() => {
      if (!win.isDestroyed()) win.webContents.send('update:changed')
    })
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
  const shot = async (name: string, from: Electron.BrowserWindow | null = win) => {
    if (!from) return
    const img = await from.webContents.capturePage()
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
    await wait(1500)
    await shot('pill', getPill())
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
