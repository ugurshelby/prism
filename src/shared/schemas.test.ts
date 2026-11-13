import { describe, expect, it } from 'vitest'
import {
  AnalyzeRequestSchema,
  ApiKeySchema,
  GenerateRequestSchema,
  HistoryEntrySchema,
  IdSchema,
  ProviderIdSchema,
  SettingsPatchSchema,
  VertexLocationSchema,
  VertexProjectSchema,
  WindowStateSchema,
  describeIssues
} from './schemas'

// A fake value that does not look like a real key format: so secret scans do not flag the test file.
const KEY = 'Fake_Test_Value_For_Schemas_0123456789'

describe('ProviderIdSchema', () => {
    it('accepts known providers', () => {
    for (const id of ['vertex', 'anthropic', 'gemini', 'openai', 'xai']) expect(ProviderIdSchema.safeParse(id).success).toBe(true)
  })

    it('rejects an ID with a path or an unknown ID (a key file cannot be written outside userData)', () => {
    for (const id of ['../x', '../../anthropic', 'anthropic/../x', 'ANTHROPIC', '', 'anthropic ', 42, null]) {
      expect(ProviderIdSchema.safeParse(id).success).toBe(false)
    }
  })
})

describe('ApiKeySchema', () => {
    it('returns a valid key as is', () => {
    expect(ApiKeySchema.parse(KEY)).toBe(KEY)
  })

    it('rejects a key with whitespace without trimming it', () => {
    for (const k of [` ${KEY}`, `${KEY} `, `${KEY}\n`, `\t${KEY}`, `${KEY.slice(0, 20)} ${KEY.slice(20)}`]) {
      const r = ApiKeySchema.safeParse(k)
      expect(r.success).toBe(false)
    }
  })

    it('rejects invisible and non-ASCII characters', () => {
    for (const k of [`${KEY}​`, `${KEY}\u0000`, `${KEY}é`, `﻿${KEY}`]) expect(ApiKeySchema.safeParse(k).success).toBe(false)
  })

    it('rejects a key that is too short or too long', () => {
    expect(ApiKeySchema.safeParse('sk-short').success).toBe(false)
    expect(ApiKeySchema.safeParse('a'.repeat(513)).success).toBe(false)
  })

    it('the error message does not contain the key itself', () => {
    const r = ApiKeySchema.safeParse(`${KEY} `)
    expect(r.success).toBe(false)
    if (!r.success) expect(describeIssues(r.error)).not.toContain(KEY)
  })
})

describe('Vertex project and location', () => {
    it('accepts valid values', () => {
    for (const l of ['global', 'us-central1', 'europe-west4']) expect(VertexLocationSchema.safeParse(l).success).toBe(true)
    for (const p of ['', 'my-project-123', '123456789012']) expect(VertexProjectSchema.safeParse(p).success).toBe(true)
  })

    it('rejects a location that could redirect the URL to another server', () => {
    for (const l of ['evil.com/', 'evil.com', 'us-central1.evil.com', 'us/../x', 'us-central1?x=', 'us-central1#', '@evil', 'US', '']) {
      expect(VertexLocationSchema.safeParse(l).success).toBe(false)
    }
  })

    it('rejects a project containing a path or query', () => {
    for (const p of ['../x', 'proj/evil', 'proj?x', 'Proj-Upper', 'a@b.com']) expect(VertexProjectSchema.safeParse(p).success).toBe(false)
  })
})

describe('SettingsPatchSchema', () => {
    it('accepts some of the known fields', () => {
    expect(SettingsPatchSchema.safeParse({ alwaysOnTop: true, replyLanguage: 'en' }).success).toBe(true)
  })

    it('rejects an unknown field and the version field', () => {
    expect(SettingsPatchSchema.safeParse({ alwaysOnTop: true, apiKey: 'x' }).success).toBe(false)
    expect(SettingsPatchSchema.safeParse({ __proto__: { polluted: true }, constructor: 'x' }).success).toBe(false)
    expect(SettingsPatchSchema.safeParse({ version: 99 }).success).toBe(false)
  })

    it('accepts privacy settings, rejects the wrong type', () => {
    expect(SettingsPatchSchema.safeParse({ saveHistory: false, contentProtection: true }).success).toBe(true)
    expect(SettingsPatchSchema.safeParse({ saveHistory: 'no' }).success).toBe(false)
  })

    it('Vertex project and location can be sent separately', () => {
    expect(SettingsPatchSchema.safeParse({ vertex: { project: 'my-proj-1' } }).success).toBe(true)
    expect(SettingsPatchSchema.safeParse({ vertex: { location: 'global' } }).success).toBe(true)
    expect(SettingsPatchSchema.safeParse({ vertex: { host: 'evil.com' } }).success).toBe(false)
  })

    it('rejects a value of the wrong type', () => {
    expect(SettingsPatchSchema.safeParse({ alwaysOnTop: 'yes' }).success).toBe(false)
    expect(SettingsPatchSchema.safeParse({ vertex: { project: 'p-ok-123', location: 'evil.com/' } }).success).toBe(false)
  })
})

describe('Request schemas', () => {
    it('an ID cannot carry characters that could become a file path', () => {
    for (const id of ['../x', 'a/b', 'a\\b', 'a.b', '']) expect(IdSchema.safeParse(id).success).toBe(false)
    expect(IdSchema.safeParse('0b7c1f9e-3c2a-4b8d-9e1f-2a3b4c5d6e7f').success).toBe(true)
  })

    it('an analysis request rejects an empty or over-limit prompt and extra fields', () => {
    const ok = { id: 'req-1', prompt: 'merhaba', surface: 'chat', family: 'auto' }
    expect(AnalyzeRequestSchema.safeParse(ok).success).toBe(true)
    expect(AnalyzeRequestSchema.safeParse({ ...ok, prompt: '' }).success).toBe(false)
    expect(AnalyzeRequestSchema.safeParse({ ...ok, prompt: 'a'.repeat(50_001) }).success).toBe(false)
    expect(AnalyzeRequestSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false)
    expect(AnalyzeRequestSchema.safeParse({ ...ok, id: '../x' }).success).toBe(false)
  })

    it('a generation request rejects a model outside the catalog', () => {
    const base = { id: 'req-1', prompt: 'x', surface: 'chat', effort: 'high', answers: [] }
    expect(GenerateRequestSchema.safeParse({ ...base, model: 'not-a-model' }).success).toBe(false)
  })
})

describe('HistoryEntrySchema', () => {
    it('converts the old "claude-code" surface to "agent"', () => {
    const entry = {
      id: 'h1',
      createdAt: 1,
      updatedAt: 1,
      prompt: 'p',
      surface: 'claude-code',
      analysis: {
        intent: 'i',
        taskType: 't',
        complexity: 'moderate',
        recommendation: { model: 'old-model', effort: 'high', confidence: 0.5, reasoning: '', factors: [] },
        alternatives: [],
        questions: []
      },
      answers: [],
      outputs: []
    }
    const r = HistoryEntrySchema.parse(entry)
    expect(r.surface).toBe('agent')
  })
})

describe('WindowStateSchema', () => {
    it('accepts a valid location, rejects a fractional or extreme value', () => {
    expect(WindowStateSchema.safeParse({ panel: { x: -1920, y: 0, width: 440, height: 640 } }).success).toBe(true)
    expect(WindowStateSchema.safeParse({ panel: { x: 0.5, y: 0, width: 440, height: 640 } }).success).toBe(false)
    expect(WindowStateSchema.safeParse({ pill: { x: 1e12, y: 0 } }).success).toBe(false)
    expect(WindowStateSchema.safeParse({ panel: { x: 0, y: 0, width: 0, height: 640 } }).success).toBe(false)
  })
})
