import type { DiscoveredModel, Usage } from '@shared/types'

/** Provider-independent JSON Schema (lowercase types; optional propertyOrdering). */
export type JsonSchema = Record<string, unknown>

export interface LlmCall {
  model: string
  system: string
  user: string
  schema?: JsonSchema
  /** Used only by providers that accept it. */
  temperature?: number
  signal?: AbortSignal
  timeoutMs?: number
  maxTokens?: number
}

export interface LlmResult {
  text: string
  usage: Usage
}

/** auth: key rejected; quota: 429; not_found: no such model; other: everything else. */
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
  /** Text models the key can access. */
  discover(cred: Credentials): Promise<DiscoveredModel[]>
}

export const emptyUsage = (): Usage => ({ promptTokens: 0, outputTokens: 0, thoughtsTokens: 0 })
