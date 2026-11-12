import { describe, expect, it } from 'vitest'
import { MODELS, candidatePool, modelsOf, setupNote } from './catalog'

const t = (key: string, vars?: Record<string, string | number>) => `${key}${vars ? JSON.stringify(vars) : ''}`

describe('setupNote: ChatGPT chat', () => {
  it('maps Astra to the Pro thinking setting without a model picker line', () => {
    const n = setupNote('gpt-6-astra', 'high', 'chat', t)
    expect(n.lines).toEqual(['note.chatgpt.pick{"thinking":"Pro"}'])
  })

  it('maps effort to the Thinking slider and says the model is not in chat', () => {
    const n = setupNote('gpt-6.1-sol', 'xhigh', 'chat', t)
    expect(n.lines[0]).toBe('note.chatgpt.pick{"thinking":"Extra High"}')
    expect(n.lines[1]).toContain('note.chatgpt.notInChat')
    expect(setupNote('gpt-6-luna', 'none', 'chat', t).lines[0]).toBe('note.chatgpt.pick{"thinking":"Instant"}')
  })

  it('never tells the person to pick a model by name in ChatGPT', () => {
    for (const id of ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-luna'] as const) {
      expect(setupNote(id, 'medium', 'chat', t).lines.join()).not.toContain('note.pickModel')
    }
  })
})

describe('candidatePool: family-limited pool (Spectrum)', () => {
  it('keeps cross-family recommendations inside the families the person selected', () => {
    const pool = candidatePool('auto', {}, ['claude', 'gemini'])
    expect(new Set(pool.map((m) => MODELS[m].family))).toEqual(new Set(['claude', 'gemini']))
  })

  it('prefers models the person can reach, and falls back to the selected families when none is reachable', () => {
    expect(candidatePool('auto', { 'gemini-3.8-flash': 'key' }, ['claude', 'gemini'])).toEqual(['gemini-3.8-flash'])
    expect(candidatePool('auto', { 'grok-4.7': 'key' }, ['claude'])).toEqual(modelsOf('claude'))
  })

  it('a named family returns only that family', () => {
    expect(candidatePool('openai', {}, ['claude']).every((m) => MODELS[m].family === 'openai')).toBe(true)
  })
})
