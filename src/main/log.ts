// Ana süreç günlüğü. Yalnızca hatanın adı ve mesajı yazılır; key, prompt ya da yanıt içeriği hiçbir zaman.
// Mesajlar sağlayıcıdan geliyorsa key'ler zaten http.ts'te ayıklanmış olur.

function describe(err: unknown): string {
  // V8'in JSON.parse hatası girdiden bir parça (prompt ya da geçmiş metni) içerir: yalnızca adı yazılır.
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
