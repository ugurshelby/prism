// Strips the Electron prefix from an IPC error; the user sees only the main process's message.
export function cleanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** For background calls with no place in the UI: the error is not swallowed, it goes to the console. */
export const reportError = (scope: string) => (e: unknown) => console.error(`[${scope}] ${cleanError(e)}`)
