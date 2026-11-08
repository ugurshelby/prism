import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FAMILIES, MODELS, SURFACES, modelsOf, type Family, type ModelId, type Surface } from '@shared/catalog'
import { SourcesFileSchema, parseCard, type ParsedCard, type SourcesFile } from '@shared/knowledge'
import { knowledgeDir } from '../config'
import { LlmError } from '../llm'

// Kartlar her istekte diskten okunur: knowledge/ altındaki bir düzenleme bir sonraki istekte geçerli olur.
// Kaynak kaydı ya da kart biçimi bozuksa motor açık bir hatayla durur; kaynaksız iddia modele gitmez.
function sources(): SourcesFile {
  const parsed = SourcesFileSchema.safeParse(JSON.parse(readFileSync(join(knowledgeDir(), 'sources.json'), 'utf8')) as unknown)
  if (!parsed.success) throw new LlmError('Bilgi tabanının kaynak kaydı bozuk (knowledge/sources.json).')
  return parsed.data
}

export function parsedCard(path: string): ParsedCard {
  const parsed = parseCard(readFileSync(join(knowledgeDir(), path), 'utf8'), sources())
  if (parsed.issues.length) throw new LlmError(`Bilgi kartı geçersiz (${path}): ${parsed.issues[0] ?? ''}`)
  return parsed
}

export const card = (path: string): string => parsedCard(path).body

/** Motorun yüklediği bütün kartlar; smoke ve eval hepsini önceden denetler. */
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
