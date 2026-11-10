import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FAMILIES, MODELS, SURFACES, modelsOf, type Family, type ModelId, type Surface } from '@shared/catalog'
import { SourcesFileSchema, parseCard, type ParsedCard, type SourcesFile } from '@shared/knowledge'
import { knowledgeDir } from '../config'
import { LlmError } from '../llm'
import { logWarn } from '../log'
import { msg } from '@shared/messages'

// Kartlar her istekte diskten okunur: knowledge/ altındaki bir düzenleme bir sonraki istekte geçerli olur.
// Kaynak kaydı ya da kart biçimi bozuksa motor açık bir hatayla durur; kaynaksız iddia modele gitmez.
/** Dosya okunamazsa ya da JSON bozuksa ham hata (kurulum yolu, dosya parçası) arayüze gitmez; günlüğe düşer. */
function readKnowledge(path: string): string {
  try {
    return readFileSync(join(knowledgeDir(), path), 'utf8')
  } catch (e) {
    logWarn('knowledge', `kart okunamadı: ${path}`, e)
    throw new LlmError(msg('err.cardUnreadable', { path }))
  }
}

function sources(): SourcesFile {
  let raw: unknown
  try {
    raw = JSON.parse(readKnowledge('sources.json'))
  } catch (e) {
    if (e instanceof LlmError) throw e
    logWarn('knowledge', 'sources.json geçerli JSON değil', e)
    throw new LlmError(msg('err.sourcesInvalid'))
  }
  const parsed = SourcesFileSchema.safeParse(raw)
  if (!parsed.success) throw new LlmError(msg('err.sourcesInvalid'))
  return parsed.data
}

/** Yalnızca Prism'in kendi yöntemini anlatan kart kaynaksız olabilir; kartın kendi beyanına güvenilmez. */
// routing.md Prism'in aileler arası seçim yöntemidir: satıcı iddiaları kaynaklı, Prism kuralları kaynaksız (K1, 2026-11-10).
const METHOD_CARDS = new Set(['vision.md', 'routing.md'])

function parsedCard(path: string): ParsedCard {
  const parsed = parseCard(readKnowledge(path), sources())
  const expected = METHOD_CARDS.has(path) ? 'method' : 'model'
  if (parsed.meta.kind !== expected) parsed.issues.push(`kart türü ${expected} olmalı`)
  if (parsed.issues.length) throw new LlmError(msg('err.cardInvalid', { path, detail: parsed.issues[0] ?? '' }))
  return parsed
}

export const card = (path: string): string => parsedCard(path).body

/** Motorun yüklediği bütün kartlar; smoke hepsini önceden denetler. */
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
