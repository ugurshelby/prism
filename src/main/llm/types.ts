import type { Effort } from '@shared/catalog'
import type { DiscoveredModel, Usage } from '@shared/types'

/** Sağlayıcıdan bağımsız JSON Schema (küçük harfli tipler; isteğe bağlı propertyOrdering). */
export type JsonSchema = Record<string, unknown>

export interface LlmCall {
  model: string
  system: string
  user: string
  schema?: JsonSchema
  /** Yalnızca bunu kabul eden sağlayıcılarda kullanılır. */
  temperature?: number
  signal?: AbortSignal
  timeoutMs?: number
  maxTokens?: number
  /** Hedef modelin düşünme seviyesi (eval'deki hedef çağrıları). Verilmezse modelin varsayılanı kullanılır; şimdilik yalnızca Gemini istemcisi uygular. */
  effort?: Effort
}

export interface LlmResult {
  text: string
  usage: Usage
}

/** auth: key reddedildi; quota: 429; not_found: model yok; other: geri kalanı. */
export type LlmErrorKind = 'auth' | 'quota' | 'not_found' | 'other'

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly kind: LlmErrorKind = 'other'
  ) {
    super(message)
  }
}

export interface Credentials {
  key: string
  project?: string
  location?: string
}

export interface ProviderClient {
  generate(call: LlmCall, cred: Credentials): Promise<LlmResult>
  stream(call: LlmCall, cred: Credentials, onText: (chunk: string) => void): Promise<LlmResult>
  /** Key'in erişebildiği metin modelleri. */
  discover(cred: Credentials): Promise<DiscoveredModel[]>
}

export const emptyUsage = (): Usage => ({ promptTokens: 0, outputTokens: 0, thoughtsTokens: 0 })
