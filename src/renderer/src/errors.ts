// IPC hatasının başındaki Electron önekini atar; kullanıcıya yalnızca ana sürecin mesajı görünür.
export function cleanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** Arayüzde gösterilecek yeri olmayan arka plan çağrıları için: hata yutulmaz, konsola düşer. */
export const reportError = (scope: string) => (e: unknown) => console.error(`[${scope}] ${cleanError(e)}`)
