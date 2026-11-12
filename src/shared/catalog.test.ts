import { describe, expect, it } from 'vitest'
import { setupNote } from './catalog'

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
