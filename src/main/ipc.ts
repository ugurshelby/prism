// Arayüzden gelen her IPC çağrısı buradan geçer: önce gönderen çerçeve uygulamanın kendi arayüzü mü,
// sonra argümanlar şemaya uyuyor mu. Arayüz güvenilmeyen girdi sayılır; tip bildirimi doğrulama değildir.

import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import { describeIssues } from '@shared/schemas'
import { msg } from '@shared/messages'
import { logWarn } from './log'
import { UserError } from './errors'
import { LlmError } from './llm'
import { getPill, getWindow, isAppUrl } from './window'

type Tuple = z.ZodTuple<[z.ZodType, ...z.ZodType[]] | [], null>

/** Kanalı çağırabilecek pencere: panel her şeyi, küre yalnızca kendi işini (sürükleme, panel açma, ayar okuma) yapar. */
export type Caller = 'panel' | 'pill' | 'any'

function trusted(e: IpcMainEvent | IpcMainInvokeEvent, caller: Caller): boolean {
  const frame = e.senderFrame
  // Alt çerçeveler ve başka bir adrese geçmiş sayfa IPC kullanamaz.
  if (!frame || frame !== e.sender.mainFrame || !isAppUrl(frame.url)) return false
  const panel = getWindow()?.webContents
  const pill = getPill()?.webContents
  if (caller === 'panel') return e.sender === panel
  if (caller === 'pill') return e.sender === pill
  return e.sender === panel || e.sender === pill
}

function parse<A extends Tuple>(channel: string, e: IpcMainEvent | IpcMainInvokeEvent, args: A, raw: unknown[], caller: Caller): z.infer<A> {
  if (!trusted(e, caller)) {
    logWarn('ipc', `${channel}: uygulama dışı bir kaynaktan gelen çağrı reddedildi`)
    throw new UserError(msg('err.unauthorized'))
  }
  const parsed = args.safeParse(raw)
  if (!parsed.success) {
    // Değerler günlüğe yazılmaz (key ya da prompt olabilir); yalnızca alan yolları.
    logWarn('ipc', `${channel}: geçersiz argüman (${parsed.error.issues.map((i) => i.path.join('.') || '-').join(', ')})`)
    throw new UserError(msg('err.invalidRequest', { detail: describeIssues(parsed.error) }))
  }
  return parsed.data
}

export function handle<A extends Tuple>(
  channel: string,
  args: A,
  fn: (e: IpcMainInvokeEvent, ...parsed: z.infer<A>) => unknown,
  caller: Caller = 'panel'
) {
  ipcMain.handle(channel, async (e, ...raw: unknown[]) => {
    try {
      return await fn(e, ...parse(channel, e, args, raw, caller))
    } catch (err) {
      throw forRenderer(channel, err)
    }
  })
}

/**
 * Arayüze yalnızca bizim yazdığımız mesajlar gider (izin listesi: UserError, LlmError). Sistem hataları (dosya yolu
 * içeren fs mesajları), şema hatalarının ham metni ve beklenmeyen her hata günlüğe düşer, arayüz genel bir mesaj görür.
 */
function forRenderer(channel: string, err: unknown): Error {
  return new Error(rendererMessage(channel, err))
}

/** IPC dışında arayüze giden hata metinleri de (akış olayı, test sonucu, doğrulama durumu) aynı izin listesinden geçer. */
export function rendererMessage(scope: string, err: unknown): string {
  if (err instanceof UserError || err instanceof LlmError) return err.message
  logWarn('ipc', `${scope} başarısız`, err)
  return msg('err.system')
}

/** Yanıt beklemeyen olaylar (sürükleme): geçersiz çağrı yalnızca günlüğe düşer. */
export function on<A extends Tuple>(channel: string, args: A, fn: (e: IpcMainEvent, ...parsed: z.infer<A>) => void, caller: Caller = 'panel') {
  ipcMain.on(channel, (e, ...raw: unknown[]) => {
    try {
      fn(e, ...parse(channel, e, args, raw, caller))
    } catch (err) {
      logWarn('ipc', `${channel} işlenemedi`, err)
    }
  })
}
