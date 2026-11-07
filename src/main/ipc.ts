// Arayüzden gelen her IPC çağrısı buradan geçer: önce gönderen çerçeve uygulamanın kendi arayüzü mü,
// sonra argümanlar şemaya uyuyor mu. Arayüz güvenilmeyen girdi sayılır; tip bildirimi doğrulama değildir.

import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import { describeIssues } from '@shared/schemas'
import { logWarn } from './log'
import { isAppUrl } from './window'

type Tuple = z.ZodTuple<[z.ZodType, ...z.ZodType[]] | [], null>

function trusted(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const frame = e.senderFrame
  // Alt çerçeveler ve başka bir adrese geçmiş sayfa IPC kullanamaz.
  return !!frame && frame === e.sender.mainFrame && isAppUrl(frame.url)
}

function parse<A extends Tuple>(channel: string, e: IpcMainEvent | IpcMainInvokeEvent, args: A, raw: unknown[]): z.infer<A> {
  if (!trusted(e)) {
    logWarn('ipc', `${channel}: uygulama dışı bir kaynaktan gelen çağrı reddedildi`)
    throw new Error('Yetkisiz istek.')
  }
  const parsed = args.safeParse(raw)
  if (!parsed.success) {
    // Değerler günlüğe yazılmaz (key ya da prompt olabilir); yalnızca alan yolları.
    logWarn('ipc', `${channel}: geçersiz argüman (${parsed.error.issues.map((i) => i.path.join('.') || '-').join(', ')})`)
    throw new Error(`Geçersiz istek: ${describeIssues(parsed.error)}`)
  }
  return parsed.data
}

export function handle<A extends Tuple>(
  channel: string,
  args: A,
  fn: (e: IpcMainInvokeEvent, ...parsed: z.infer<A>) => unknown
) {
  ipcMain.handle(channel, async (e, ...raw: unknown[]) => {
    try {
      return await fn(e, ...parse(channel, e, args, raw))
    } catch (err) {
      throw forRenderer(channel, err)
    }
  })
}

/**
 * Arayüze yalnızca bizim yazdığımız mesajlar gider. Sistem hataları (dosya yolu içeren fs mesajları) ve
 * şema hatalarının ham metni günlüğe düşer, arayüz genel bir mesaj görür.
 */
function forRenderer(channel: string, err: unknown): Error {
  const system = err instanceof Error && ('code' in err || err.name === 'ZodError')
  if (err instanceof Error && !system) return err
  logWarn('ipc', `${channel} başarısız`, err)
  return new Error('İşlem tamamlanamadı (sistem hatası). Ayrıntı uygulama günlüğünde.')
}

/** Yanıt beklemeyen olaylar (sürükleme): geçersiz çağrı yalnızca günlüğe düşer. */
export function on<A extends Tuple>(channel: string, args: A, fn: (e: IpcMainEvent, ...parsed: z.infer<A>) => void) {
  ipcMain.on(channel, (e, ...raw: unknown[]) => {
    try {
      fn(e, ...parse(channel, e, args, raw))
    } catch (err) {
      logWarn('ipc', `${channel} işlenemedi`, err)
    }
  })
}
