import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FAMILIES, MODELS, SURFACES, modelsOf, type Family, type ModelId, type Surface } from '@shared/catalog'
import { SourcesFileSchema, parseCard, type ParsedCard, type SourcesFile } from '@shared/knowledge'
import { knowledgeDir } from '../config'
import { LlmError } from '../llm'
import { logWarn } from '../log'
import { cardIntact, type KnowledgeManifest } from './integrity'
import { msg } from '@shared/messages'

// Build-time card hashes (electron.vite.config.ts define); absent in development and tests.
// oxlint-disable-next-line no-underscore-dangle
declare const __KNOWLEDGE_HASHES__: KnowledgeManifest | undefined
const MANIFEST: KnowledgeManifest | null = typeof __KNOWLEDGE_HASHES__ === 'undefined' ? null : __KNOWLEDGE_HASHES__

// Cards are read from disk on every request: in development an edit under knowledge/ takes effect on the next request.
// If the source record or card format is broken, the engine stops with an explicit error; an unsourced claim never reaches the model.
/** If the file cannot be read or the JSON is corrupt, the raw error (install path, file fragment) does not go to the UI; it goes to the log. */
function readKnowledge(path: string): string {
  let bytes: Buffer
  try {
    bytes = readFileSync(join(knowledgeDir(), path))
  } catch (e) {
    logWarn('knowledge', `could not read card: ${path}`, e)
    throw new LlmError(msg('err.cardUnreadable', { path }))
  }
  if (!cardIntact(path, bytes, MANIFEST)) {
    logWarn('knowledge', `card does not match the build manifest: ${path}`)
    throw new LlmError(msg('err.cardTampered', { path }))
  }
  return bytes.toString('utf8')
}

function sources(): SourcesFile {
  let raw: unknown
  try {
    raw = JSON.parse(readKnowledge('sources.json'))
  } catch (e) {
    if (e instanceof LlmError) throw e
    logWarn('knowledge', 'sources.json is not valid JSON', e)
    throw new LlmError(msg('err.sourcesInvalid'))
  }
  const parsed = SourcesFileSchema.safeParse(raw)
  if (!parsed.success) throw new LlmError(msg('err.sourcesInvalid'))
  return parsed.data
}

/** Only a card that describes Prism's own method may lack sources; the card's own declaration is not trusted. */
// routing.md is Prism's cross-family selection method: vendor claims are sourced, Prism rules are unsourced (K1, 2026-11-10).
const METHOD_CARDS = new Set(['vision.md', 'routing.md'])

function parsedCard(path: string): ParsedCard {
  const parsed = parseCard(readKnowledge(path), sources())
  const expected = METHOD_CARDS.has(path) ? 'method' : 'model'
  if (parsed.meta.kind !== expected) parsed.issues.push(`card kind must be ${expected}`)
  if (parsed.issues.length) throw new LlmError(msg('err.cardInvalid', { path, detail: parsed.issues[0] ?? '' }))
  return parsed
}

export const card = (path: string): string => parsedCard(path).body

/** All cards the engine loads; smoke checks them all up front. */
export const cardPaths = (): string[] => [
  'routing.md',
  'vision.md',
  ...FAMILIES.flatMap((f) => [
    ...['models', 'effort', 'principles'].map((n) => `${f}/${n}.md`),
    ...SURFACES.map((s) => `${f}/surfaces/${s}.md`),
    ...modelsOf(f).map((m) => `${f}/targets/${m}.md`)
  ])
]

export const familyCard =(family: Family, name: 'models' | 'effort' | 'principles') => card(`${family}/${name}.md`)
export const targetCard = (model: ModelId) => card(`${MODELS[model].family}/targets/${model}.md`)
export const surfaceCard = (family: Family, surface: Surface) => card(`${family}/surfaces/${surface}.md`)
