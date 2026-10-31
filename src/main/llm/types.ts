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
}

export interface LlmResult {
  text: string
  usage: Usage
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number
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
