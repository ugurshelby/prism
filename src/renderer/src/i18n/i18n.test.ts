import { describe, expect, it } from 'vitest'
import { EFFORTS, MODEL_IDS, MODELS, SURFACES, setupNote } from '@shared/catalog'
import { en } from './en'

describe('dictionaries', () => {
  it('every setupNote key exists in the dictionary', () => {
    const used = new Set<string>()
    const record = (key: string) => {
      used.add(key)
      return key
    }
    for (const m of MODEL_IDS) for (const s of SURFACES) for (const e of EFFORTS) if (!MODELS[m].efforts.length || MODELS[m].efforts.includes(e)) setupNote(m, e, s, record)
    const missing = [...used].filter((k) => !(k in en))
    expect(missing).toEqual([])
  })

  it('has no empty strings', () => {
    expect(Object.entries(en).filter(([, v]) => !v.trim())).toEqual([])
  })
})
