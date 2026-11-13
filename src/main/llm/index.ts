import type { ProviderId } from '@shared/catalog'
import { msg } from '@shared/messages'
import { anthropic } from './anthropic'
import { aiStudio, vertex } from './google'
import { openai, xai } from './openai'
import { schemaInstruction } from './schema'
import { LlmError, type Credentials, type LlmCall, type LlmResult, type ProviderClient } from './types'

export { LlmError, type Credentials, type LlmCall, type LlmResult } from './types'

const CLIENTS: Record<ProviderId, ProviderClient> = { vertex, gemini: aiStudio, anthropic, openai, xai }

export const client = (provider: ProviderId) => CLIENTS[provider]

/**
 * Structured request; if the provider or model rejects the schema field (400), writes the schema into the instruction and retries once.
 * A key rejection is also a 400 for some providers; it is not retried then (so the prompt is not sent twice).
 */
export async function generate(provider: ProviderId, call: LlmCall, cred: Credentials): Promise<LlmResult> {
  try {
    return await CLIENTS[provider].generate(call, cred)
  } catch (e) {
    if (!call.schema || !(e instanceof LlmError) || e.status !== 400 || e.kind === 'auth') throw e
    return CLIENTS[provider].generate({ ...call, schema: undefined, system: `${call.system}\n\n${schemaInstruction(call.schema)}` }, cred)
  }
}

/** Parses JSON output defensively: strips code-fence markers and takes the span from the first { to the last }. Result must be validated with the schema. */
export function parseJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new LlmError(msg('err.noJson'))
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown
  } catch {
    throw new LlmError(msg('err.invalidJson'))
  }
}
