// Converts the engine's single schema into the formats the providers expect.

import type { JsonSchema } from './types'

const TYPES: Record<string, string> = {
  object: 'OBJECT',
  array: 'ARRAY',
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN'
}

const isSchema = (v: unknown): v is JsonSchema => typeof v === 'object' && v !== null && !Array.isArray(v)

const propertiesOf = (v: unknown): [string, JsonSchema][] =>
  isSchema(v) ? Object.entries(v).flatMap(([k, p]): [string, JsonSchema][] => (isSchema(p) ? [[k, p]] : [])) : []

/** Gemini (OpenAPI subset): uppercase types; propertyOrdering, minimum/maximum are kept. */
export function toGemini(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = { ...schema }
  if (typeof schema.type === 'string') out.type = TYPES[schema.type] ?? schema.type
  if (schema.properties) out.properties = Object.fromEntries(propertiesOf(schema.properties).map(([k, v]) => [k, toGemini(v)]))
  if (isSchema(schema.items)) out.items = toGemini(schema.items)
  return out
}

/**
 * Strict JSON Schema (Anthropic, OpenAI, xAI): additionalProperties: false on every object, all fields required,
 * unsupported bounds are moved into the description. Fields follow propertyOrdering order; generation order is preserved.
 */
export function toStrict(schema: JsonSchema): JsonSchema {
  const { propertyOrdering, minimum, maximum, ...rest } = schema
  const out: JsonSchema = { ...rest }
  const min = typeof minimum === 'number' ? minimum : undefined
  const max = typeof maximum === 'number' ? maximum : undefined
  if (min !== undefined || max !== undefined) {
    const range = `Range: ${min ?? '-∞'} to ${max ?? '∞'}.`
    out.description = typeof rest.description === 'string' ? `${rest.description} ${range}` : range
  }
  if (rest.properties) {
    const props = new Map(propertiesOf(rest.properties))
    const ordering = Array.isArray(propertyOrdering) ? propertyOrdering.filter((k): k is string => typeof k === 'string') : []
    const order = [...ordering.filter((k) => props.has(k)), ...[...props.keys()].filter((k) => !ordering.includes(k))]
    out.properties = Object.fromEntries(
      order.flatMap((k) => {
        const prop = props.get(k)
        return prop ? [[k, toStrict(prop)]] : []
      })
    )
    out.required = order
    out.additionalProperties = false
  }
  if (isSchema(rest.items)) out.items = toStrict(rest.items)
  return out
}

/** Text added to the system instruction for models that do not accept the schema as a request field. */
export function schemaInstruction(schema: JsonSchema): string {
  return `Respond with only a JSON object (no code fences, no other text) that matches this JSON Schema:\n${JSON.stringify(toStrict(schema))}`
}
