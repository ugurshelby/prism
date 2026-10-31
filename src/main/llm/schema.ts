// Motorun tek şemasını sağlayıcıların beklediği biçimlere çevirir.

import type { JsonSchema } from './types'

const TYPES: Record<string, string> = {
  object: 'OBJECT',
  array: 'ARRAY',
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN'
}

/** Gemini (OpenAPI alt kümesi): büyük harfli tipler; propertyOrdering, minimum/maximum korunur. */
export function toGemini(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = { ...schema }
  if (typeof schema.type === 'string') out.type = TYPES[schema.type] ?? schema.type
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties as Record<string, JsonSchema>).map(([k, v]) => [k, toGemini(v)])
    )
  }
  if (schema.items) out.items = toGemini(schema.items as JsonSchema)
  return out
}

/**
 * Katı JSON Schema (Anthropic, OpenAI, xAI): her nesnede additionalProperties: false, tüm alanlar zorunlu,
 * desteklenmeyen sınırlar açıklamaya taşınır. Alanlar propertyOrdering sırasına dizilir; üretim sırası korunur.
 */
export function toStrict(schema: JsonSchema): JsonSchema {
  const { propertyOrdering, minimum, maximum, ...rest } = schema as JsonSchema & {
    propertyOrdering?: string[]
    minimum?: number
    maximum?: number
  }
  const out: JsonSchema = { ...rest }
  if (minimum !== undefined || maximum !== undefined) {
    const range = `Range: ${minimum ?? '-∞'} to ${maximum ?? '∞'}.`
    out.description = rest.description ? `${rest.description} ${range}` : range
  }
  if (rest.properties) {
    const props = rest.properties as Record<string, JsonSchema>
    const order = [...(propertyOrdering ?? []), ...Object.keys(props).filter((k) => !propertyOrdering?.includes(k))]
    out.properties = Object.fromEntries(order.filter((k) => props[k]).map((k) => [k, toStrict(props[k])]))
    out.required = order.filter((k) => props[k])
    out.additionalProperties = false
  }
  if (rest.items) out.items = toStrict(rest.items as JsonSchema)
  return out
}

/** Şemayı istek alanı olarak kabul etmeyen modeller için system talimatına eklenen metin. */
export function schemaInstruction(schema: JsonSchema): string {
  return `Respond with only a JSON object (no code fences, no other text) that matches this JSON Schema:\n${JSON.stringify(toStrict(schema))}`
}
