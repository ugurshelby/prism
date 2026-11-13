// Every IPC call from the UI passes through here: first, is the sending frame the app's own UI,
// then, do the arguments match the schema. The UI counts as untrusted input; a type annotation is not validation.

import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import { describeIssues } from '@shared/schemas'
import { msg } from '@shared/messages'
import { logWarn } from './log'
import { UserError } from './errors'
import { LlmError } from './llm'
import { getPill, getWindow, isAppUrl } from './window'

type Tuple = z.ZodTuple<[z.ZodType, ...z.ZodType[]] | [], null>

/** The window allowed to call the channel: the panel can do everything, the orb only its own work (dragging, opening the panel, reading settings). */
export type Caller = 'panel' | 'pill' | 'any'

function trusted(e: IpcMainEvent | IpcMainInvokeEvent, caller: Caller): boolean {
  const frame = e.senderFrame
  // Subframes and a page that has navigated to another address cannot use IPC.
  if (!frame || frame !== e.sender.mainFrame || !isAppUrl(frame.url)) return false
  const panel = getWindow()?.webContents
  const pill = getPill()?.webContents
  if (caller === 'panel') return e.sender === panel
  if (caller === 'pill') return e.sender === pill
  return e.sender === panel || e.sender === pill
}

function parse<A extends Tuple>(channel: string, e: IpcMainEvent | IpcMainInvokeEvent, args: A, raw: unknown[], caller: Caller): z.infer<A> {
  if (!trusted(e, caller)) {
    logWarn('ipc', `${channel}: call from a source outside the app rejected`)
    throw new UserError(msg('err.unauthorized'))
  }
  const parsed = args.safeParse(raw)
  if (!parsed.success) {
    // Values are not logged (they could be a key or a prompt); only field paths.
    logWarn('ipc', `${channel}: invalid argument (${parsed.error.issues.map((i) => i.path.join('.') || '-').join(', ')})`)
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
 * Only messages we wrote go to the UI (allowlist: UserError, LlmError). System errors (fs messages that contain
 * file paths), the raw text of schema errors and every unexpected error go to the log, and the UI sees a generic message.
 */
function forRenderer(channel: string, err: unknown): Error {
  return new Error(rendererMessage(channel, err))
}

/** Error texts that go to the UI outside IPC (stream event, test result, verification status) also pass through the same allowlist. */
export function rendererMessage(scope: string, err: unknown): string {
  if (err instanceof UserError || err instanceof LlmError) return err.message
  logWarn('ipc', `${scope} failed`, err)
  return msg('err.system')
}

/** Events that expect no reply (dragging): an invalid call goes only to the log. */
export function on<A extends Tuple>(channel: string, args: A, fn: (e: IpcMainEvent, ...parsed: z.infer<A>) => void, caller: Caller = 'panel') {
  ipcMain.on(channel, (e, ...raw: unknown[]) => {
    try {
      fn(e, ...parse(channel, e, args, raw, caller))
    } catch (err) {
      logWarn('ipc', `${channel} could not be processed`, err)
    }
  })
}
