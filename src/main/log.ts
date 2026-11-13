// Main-process log. Only the error's name and message are written; never key, prompt or response content.
// If messages come from a provider, keys have already been stripped in http.ts.

function describe(err: unknown): string {
  // V8's JSON.parse error includes a fragment of the input (prompt or history text): only the name is written.
  if (err instanceof SyntaxError) return err.name
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return typeof err === 'string' ? err : 'bilinmeyen hata'
}

export function logWarn(scope: string, message: string, err?: unknown) {
  console.warn(`[${scope}] ${message}${err === undefined ? '' : ` (${describe(err)})`}`)
}

export function logError(scope: string, message: string, err?: unknown) {
  console.error(`[${scope}] ${message}${err === undefined ? '' : ` (${describe(err)})`}`)
}
