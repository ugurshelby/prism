import { describe, expect, it } from 'vitest'
import { EFFORTS, MODEL_IDS, MODELS, SURFACES, setupNote } from '@shared/catalog'
import { en } from './en'
import { tr } from './tr'

describe('dictionaries', () => {
  it('every setupNote key exists in both languages', () => {
    const used = new Set<string>()
    const record = (key: string) => {
      used.add(key)
      return key
    }
    for (const m of MODEL_IDS) for (const s of SURFACES) for (const e of EFFORTS) if (!MODELS[m].efforts.length || MODELS[m].efforts.includes(e)) setupNote(m, e, s, record)
    const missing = [...used].filter((k) => !(k in en) || !(k in tr))
    expect(missing).toEqual([])
  })

  it('placeholders match between languages', () => {
    const vars = (s: string) =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').toSorted((a, b) => a.localeCompare(b))
    const mismatched = Object.entries(tr).filter(([k, v]) => {
      const source: unknown = Object.getOwnPropertyDescriptor(en, k)?.value
      return typeof source !== 'string' || JSON.stringify(vars(source)) !== JSON.stringify(vars(v))
    })
    expect(mismatched).toEqual([])
  })

  it('has no empty strings', () => {
    expect(Object.entries(tr).filter(([, v]) => !v.trim())).toEqual([])
    expect(Object.entries(en).filter(([, v]) => !v.trim())).toEqual([])
  })
})
