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

// The product identity is set before any path is read: name, userData and (below) the single-instance lock are
// per product, so Ray and Spectrum run side by side. Each product uses only its own folder. On first launch Spectrum
// copies data created under the old names (Prism 2.x, Prompter) into its own folder once (migrate.ts); the old folder is never written.
app.setName(PRODUCT.name)
const appData = app.getPath('appData')
app.setPath('userData', join(appData, PRODUCT.dataDir))

// A separate userData folder can be used in development and tests so the real settings and history stay untouched.
// In an installed build this and the other PRISM_* variables are ignored (env.ts). No migration runs in development.
const DEV = devEnv()
if (DEV.userData) {
  const dir = resolve(DEV.userData)
  mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)
}

// An installed build does not start with remote-debugging switches: anyone attaching to the UI through them could
// send requests with the keys and read the history.
const UNSAFE_SWITCHES = ['remote-debugging-port', 'remote-debugging-pipe', 'remote-debugging-address', 'inspect', 'inspect-brk']
if (app.isPackaged && UNSAFE_SWITCHES.some((s) => app.commandLine.hasSwitch(s) || process.argv.some((a) => a === `--${s}` || a.startsWith(`--${s}=`)))) {
  logError('app', 'installed build was launched with an unsafe command-line switch; exiting')
  app.exit(1)
}

// An installed build runs only the offline --smoke check; selftest paths that go online with saved keys are development-only.
const SELFTEST = process.argv.includes('--selftest') && (!app.isPackaged || process.argv.includes('--smoke'))
// A second instance exits immediately without starting anything; the first one brings its window to the front (second-instance).
const PRIMARY = SELFTEST || app.requestSingleInstanceLock()
if (!PRIMARY) app.exit(0)

// The one-time migration of old-version data runs only in the instance that holds the lock and only in a real install (so two
// concurrent first launches cannot corrupt each other's migration, and development and smoke never touch real folders).
if (PRIMARY && !SELFTEST && !DEV.userData) {
  const from = migrateLegacyData(appData, PRODUCT)
  if (from) logWarn('migrate', `data in the ${from} folder was copied to the ${PRODUCT.dataDir} folder`)
}

// Screenshots are rendered at 1.5x so they look sharp on retina displays too (at 2x the panel does not fit most screens).
if (DEV.captureDir) app.commandLine.appendSwitch('force-device-scale-factor', '1.5')

// On Linux a transparent window (with a compositor) works with this switch.
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-transparent-visuals')

// The only external links the UI may open are the providers' key pages (origin and path prefix together).
const EXTERNAL_PAGES = PROVIDERS.map((p) => new URL(PROVIDER_INFO[p].keyUrl))
const isKeyPage = (url: URL) =>
  EXTERNAL_PAGES.some((k) => url.origin === k.origin && (k.pathname === '/' || url.pathname === k.pathname || url.pathname.startsWith(`${k.pathname}/`)))

function openExternal(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    logWarn('shell', 'invalid external link rejected')
    return
  }
  if (url.protocol !== 'https:' || !isKeyPage(url)) {
    logWarn('shell', `disallowed external link rejected: ${url.origin}`)
    return
  }
  shell.openExternal(url.href).catch((e: unknown) => logWarn('shell', 'could not open external link', e))
}

// The app loads only its own UI: new windows, navigating elsewhere, redirects and webviews are all blocked.
// External links (key pages) open in the system browser only if they are allowed https addresses.
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
 * A failed history write (keyring error, file lock) must not lose a result that was already paid for:
 * the error is logged and the result still goes to the UI. If no id comes back, the UI cannot find that entry in history, that is all.
 */
function keepRecord<T>(what: string, write: () => T): T | undefined {
  try {
    return write()
  } catch (e) {
    logWarn('history', `${what} could not be written to history`, e)
    return undefined
  }
}

// If launched at login, the window is not shown; it waits in the tray.
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
    if (!ok) logWarn('hotkey', `shortcut could not be registered (another app or Wayland): ${accelerator}`)
  } catch (e) {
    logWarn('hotkey', `shortcut not recognized: ${accelerator}`, e)
  }
  setHotkeyOk(ok)
  return ok
}

/** Brings the window to the front as a panel; optionally opens history or settings in the UI. */
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
          logError('tray', 'could not apply setting', e)
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

/** Updates the tray tooltip during a long analysis/write. */
/** If the tray cannot be refreshed (e.g. an unreadable file), the running or finished job is not affected. */
function safeRefreshTray() {
  try {
    refreshTray()
  } catch (e) {
    logWarn('tray', 'could not refresh tray menu', e)
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

/** The product rule also holds in the main process: the engine does not run for an unselected family; cross-suggestion only in a multi-family product. */
function assertFamily(family: FamilyChoice) {
  const { families } = getSettings()
  const ok = family === 'auto' ? PRODUCT.familyMode === 'multi' : families.includes(family)
  if (!ok) throw new UserError(msg('err.familyNotSelected'))
}

// At most two jobs of the same kind run at once: a UI bug or repeated clicks must not flood the provider
// with requests (the key's quota and the owner's budget).
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

// Notify about a finished write when the panel is hidden or in the background; in orb mode the badge is enough.
// The notification never contains prompt content, only the model and surface name.
function notifyDone(req: GenerateRequest) {
  const win = getWindow()
  // If the panel is not visible (orb or tray), the badge on the orb lights up; it clears when the panel opens.
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

// In an installed build the app itself is started at login; in development, electron.exe + the project folder.
// On Windows the registration name is the product's appId: both update the same entry, and two products never touch each other's entry.
function setLaunchAtLogin(enabled: boolean) {
  if (process.platform === 'linux') return linuxAutostart(enabled)
  const name = PRODUCT.appId
  app.setLoginItemSettings(
    app.isPackaged
      ? { openAtLogin: enabled, name, args: ['--hidden'] }
      : { openAtLogin: enabled, name, path: process.execPath, args: [app.getAppPath(), '--hidden'] }
  )
}

// The product's data: the userData in use and (in Spectrum) folders created under the old names. If a separate
// userData was given in development, only that folder is deleted; folders of real installs are never touched.
function dataDirs(): string[] {
  const dirs = [app.getPath('userData')]
  if (DEV.userData) return dirs
  dirs.push(join(appData, PRODUCT.dataDir))
  // Old folders are touched only if they carry the Prism signature: another app's folder with the same name is never deleted.
  for (const d of PRODUCT.legacyDataDirs) if (inspectDir(join(appData, d)).hasSignature) dirs.push(join(appData, d))
  return dirs
}

/**
 * "Delete all my data". Since the UI is untrusted, confirmation comes from a system dialog in the main process (default
 * Cancel). Then in-flight requests are stopped and disk writes are shut off: in-memory history, settings or model cache
 * cannot write the deleted files back. The login entry is removed, the files are deleted. If a part fails, the remaining files
 * come back as an error and the app stays open with writes disabled; if everything was deleted, the app restarts with empty data.
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
  // With a separate userData in development, the real install's login entry is not touched.
  if (!DEV.userData) {
    try {
      setLaunchAtLogin(false)
    } catch (e) {
      logWarn('wipe', 'could not remove login entry', e)
      failed.push('autostart')
    }
  }
  failed.push(...wipeOwnData(dataDirs()))
  // Even if the migration marker was deleted, migration must not run again: a leftover file in an old folder must not bring the deleted data back.
  if (!DEV.userData && PRODUCT.legacyDataDirs.length) {
    try {
      markMigrationDone(join(appData, PRODUCT.dataDir), 'wiped')
    } catch (e) {
      logWarn('wipe', 'could not write migration marker', e)
      failed.push(MIGRATION_MARKER)
    }
  }
  if (failed.length) throw new UserError(msg('err.deleteData', { files: failed.join(', ') }))
  setImmediate(() => {
    // In an AppImage process.execPath is a temporary mount point; the restart uses the real file.
    // --hidden is dropped: a copy started at login must not come back invisible after the wipe.
    app.relaunch({ execPath: appImagePath() ?? process.execPath, args: process.argv.slice(1).filter((a) => a !== '--hidden') })
    app.exit(0)
  })
  return true
}

// In a double-quoted Exec path, ", backslash, $, backtick, % or a newline allows command injection;
// such a path is rejected. A single quote (e.g. O'Neil) is harmless inside double quotes.
const SAFE_EXEC_PATH = /^[^"`$\\\r\n%]+$/

// Electron has no login entry on Linux; an XDG autostart entry is written. The AppImage's real path is in APPIMAGE.
// The file name is per product: two products never overwrite or delete each other's entry.
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
  // OS-side steps are tried first; if one fails, no part of the patch is saved.
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
    // If the setting could not be saved, what was done on the OS side is rolled back too.
    if (hotkeyChanged) registerHotkey(before.hotkey)
    if (patch.launchAtLogin !== undefined && patch.launchAtLogin !== before.launchAtLogin) {
      try {
        setLaunchAtLogin(before.launchAtLogin)
      } catch (undo) {
        logWarn('autostart', 'could not roll back the launch-at-login setting', undo)
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
  // The orb also gets settings to read the language; it can reach no other channel.
  handle('settings:get', none, () => settingsView(), 'any')
  handle('settings:set', z.tuple([SettingsPatchSchema]), (_e, patch) => applySettings(patch))
  // A test is also a paid call: it is subject to the same concurrency limit as analysis.
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

  // The key comes from the UI only to be saved; it is never sent back. When saved, the connection and models are verified.
  // The format check is in saveKey: the error message should describe the key's problem, not the field name.
  handle('providers:saveKey', z.tuple([ProviderIdSchema, z.string().max(LIMITS.keyMax * 2)]), async (_e, id, key) => {
    // If the same key is saved again, the last successful verification is kept; the paid discovery is not repeated.
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
    // The history setting is applied with its value at the moment the request started: a prompt started while it was off is not saved even if it is turned on later.
    const save = getSettings().saveHistory
    try {
      const analysis = await limited('analyze', () => tracked(() => analyze(req, controller.signal)))
      // A cancelled analysis is not written to history; the UI no longer waits for the response even if it came from the provider.
      if (controller.signal.aborted) throw new LlmError(msg('err.cancelled'))
      return { ...analysis, historyId: save ? keepRecord('analiz', () => recordAnalysis(req, analysis)) : undefined }
    } finally {
      running.delete(req.id)
    }
  })
  handle('engine:generate', z.tuple([GenerateRequestSchema]), async (e, req) => {
    assertFamily(MODELS[req.model].family)
    // A second write with the same id must not overwrite the earlier one's cancel check.
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
      // A write cancelled right after finishing is not saved to history; the user no longer wants it.
      if (save && !controller.signal.aborted) keepRecord('write', () => recordOutput(req, result))
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
  // Dragging happens only in the orb window; the panel is moved and resized natively.
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
// The UI never goes online; provider requests go only from the main process (llm/http.ts). Even if the UI has a bug,
// prompts or history cannot be sent out through it.

function isInsideApp(fileUrl: string): boolean {
  try {
    // Only the built UI folder: in development the app root is the project folder (.env is there).
    const root = resolve(app.getAppPath(), 'out', 'renderer')
    const path = resolve(fileURLToPath(fileUrl))
    return path === root || path.startsWith(root + sep)
  } catch (e) {
    logWarn('session', 'could not resolve file URL', e)
    return false
  }
}

function isLocalRequest(url: string): boolean {
  if (url.startsWith('devtools:') || url.startsWith('data:') || url.startsWith('blob:')) return true
  if (url.startsWith('file:')) return isInsideApp(url)
  const dev = DEV.rendererUrl
  if (!dev) return false
  // In development: the electron-vite server and the HMR socket.
  const devSocket = new URL(dev).origin.replace(/^http/, 'ws')
  return isAppUrl(url) || (URL.canParse(url) && new URL(url).origin === devSocket)
}

function lockDownSession() {
  const ses = session.defaultSession
  // The UI needs no browser permission such as camera, microphone or location.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
  ses.webRequest.onBeforeRequest((details, callback) => {
    const local = isLocalRequest(details.url)
    if (!local) logWarn('session', 'request from the UI to the outside was blocked')
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
    // If the setting is on, refresh the entry for this copy's path (e.g. when switching from development to an installed build).
    if (getSettings().launchAtLogin) {
      // If the entry cannot be refreshed the app still opens; the user can change the setting from the settings screen.
      try {
        setLaunchAtLogin(true)
      } catch (e) {
        logWarn('autostart', 'could not refresh the launch-at-login entry', e)
      }
    }
    const win = createWindow({ hidden: START_HIDDEN && !DEV.captureDir })
    createTray()
    registerHotkey(getSettings().hotkey)
    // Fetch models in the background for providers that have a key but were never verified.
    verifyPending()
      .then(() => {
        refreshTray()
        win.webContents.send('settings:changed')
      })
      .catch((e: unknown) => logWarn('providers', 'startup key verification did not complete', e))
    startUpdateChecks(() => {
      if (!win.isDestroyed()) win.webContents.send('update:changed')
    })
    if (DEV.captureDir) captureStates(win, DEV.captureDir, DEV.capturePrompt)
  })
  .catch((e: unknown) => {
    logError('app', 'launch failed', e)
    app.exit(1)
  })

/**
 * Development: takes screenshots of the panel and pill states and exits.
 * If PRISM_CAPTURE_PROMPT is given, a real analysis → write flow is also run through the UI.
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
        await js(`document.querySelector('.icon-btn[title="History"]').click()`)
        await wait(1200)
        await shot('history')
      }
    }
  }
  win.webContents.once('did-finish-load', () => {
    run()
      .catch((e: unknown) => logError('capture', 'screenshot flow was cut short', e))
      .finally(() => app.exit(0))
  })
}

// The window keeps living in the tray when closed; quitting is from the tray menu.
app.on('window-all-closed', () => {})
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  flushWindowState()
})
