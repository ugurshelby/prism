import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODELS, type Family, type ModelId, type Surface } from '@shared/catalog'
import { knowledgeDir } from '../config'

// Kartlar her istekte diskten okunur: knowledge/ altındaki bir düzenleme bir sonraki istekte geçerli olur.
export function card(path: string): string {
  return readFileSync(join(knowledgeDir(), path), 'utf8').trim()
}

export const familyCard = (family: Family, name: 'models' | 'effort' | 'principles') => card(`${family}/${name}.md`)
export const targetCard = (model: ModelId) => card(`${MODELS[model].family}/targets/${model}.md`)
export const surfaceCard = (family: Family, surface: Surface) => card(`${family}/surfaces/${surface}.md`)
