import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { FAMILIES, MODELS, SURFACES, defaultEffortFor, modelsOf, type Family, type ModelId } from '@shared/catalog'
import type { AnalyzeRequest, GenerateRequest } from '@shared/types'

// Electron'a bağlı modüller kesilir: kartlar repodaki knowledge/ klasöründen okunur, günlük ve sağlayıcı katmanı boştur.
vi.mock('../config', () => ({ knowledgeDir: () => join(__dirname, '..', '..', '..', 'knowledge'), getSettings: () => ({}) }))
vi.mock('../log', () => ({ logWarn: () => undefined, logError: () => undefined, logInfo: () => undefined }))
vi.mock('../providers', () => ({ candidatePool: () => [], engineGenerate: () => undefined, engineStream: () => undefined }))

const { analyzeSystemPrompt, analyzeUserPrompt } = await import('./analyze')
const { generateSystemPrompt, generateUserPrompt } = await import('./generate')
const { card, familyCard, surfaceCard, targetCard } = await import('./knowledge')

// Her ailenin sabit bir modeli; snapshot'lar bu seçime bağlıdır.
const MODEL: Record<Family, ModelId> = { claude: 'claude-opus-5-5', openai: 'gpt-6.1-sol', gemini: 'gemini-3.8-flash', grok: 'grok-4.7' }
const RAW = 'bana bir login sayfası yaz'

// Rastgele etiket eki (fence) snapshot'ı kararsız yapmasın diye maskelenir.
const mask = (s: string) => s.replace(/_[0-9a-f]{8}>/g, '_NONCE>')
// RAW ile aynı metin; lint kuralı (detect-non-literal-regexp) yüzünden düz regex.
const fenced = /<raw_prompt_([0-9a-f]{8})>\nbana bir login sayfası yaz\n<\/raw_prompt_\1>/
// matchAll grupları string | undefined döner; sıralama ikisini de kabul eder.
const byText = (a: string | undefined, b: string | undefined) => (a ?? '').localeCompare(b ?? '')
const nonces = (s: string) => [...s.matchAll(/<(raw_prompt|analysis|clarifications)_([0-9a-f]{8})>/g)].map((m) => m[2])

const analyzeReq = (family: Family, surface: AnalyzeRequest['surface']): AnalyzeRequest => ({ id: 't', prompt: RAW, surface, family })
const generateReq = (family: Family, surface: GenerateRequest['surface']): GenerateRequest => {
  const model = MODEL[family]
  return {
    id: 't',
    prompt: RAW,
    surface,
    model,
    effort: defaultEffortFor(model, surface),
    answers: [{ question: 'Hangi dil?', answer: 'TypeScript' }],
    analysis: { intent: 'Login sayfası', taskType: 'coding', complexity: 'moderate' }
  }
}

describe.each(FAMILIES)('%s', (family) => {
  describe.each(SURFACES)('%s', (surface) => {
    it('analyze system prompt', () => {
      const pool = modelsOf(family)
      const p = analyzeSystemPrompt(analyzeReq(family, surface), pool)
      expect(p).toMatchSnapshot()
      expect(p).toContain(familyCard(family, 'models'))
      expect(p).toContain(surfaceCard(family, surface))
      // Tek aileli havuzda başka ailenin kartı ve yönlendirme bölümü yok.
      for (const other of FAMILIES.filter((f) => f !== family)) expect(p).not.toContain(familyCard(other, 'models'))
      expect(p).not.toContain('<routing>')
      // Aday listesi yalnızca havuzdaki modelleri sayar.
      const listed = [...p.matchAll(/^- `([^`]+)` — /gm)].map((m) => m[1])
      expect(listed.toSorted(byText)).toEqual(pool.toSorted(byText))
      expect(p).toContain('How to ask:')
      expect(p).toContain('<candidates>')
    })

    it('generate system prompt', () => {
      const req = generateReq(family, surface)
      const p = generateSystemPrompt(req, 'none')
      expect(p).toMatchSnapshot()
      expect(p).toContain(targetCard(req.model))
      expect(p).toContain(familyCard(family, 'principles'))
      expect(p).toContain(surfaceCard(family, surface))
      for (const other of FAMILIES.filter((f) => f !== family)) {
        expect(p).not.toContain(targetCard(MODEL[other]))
        expect(p).not.toContain(familyCard(other, 'principles'))
      }
      expect(p).toContain(card('vision.md'))
      expect(p).toContain('<prompt>\n(the final prompt)\n</prompt>\n<notes>')
      expect(p).toContain('</notes>')
    })

    it('user prompts fence the raw text and the nonce changes per call', () => {
      const a1 = analyzeUserPrompt(analyzeReq(family, surface))
      const a2 = analyzeUserPrompt(analyzeReq(family, surface))
      expect(mask(a1)).toMatchSnapshot()
      expect(a1).toMatch(fenced)
      expect(nonces(a1)).not.toEqual(nonces(a2))

      const req = generateReq(family, surface)
      const g1 = generateUserPrompt(req)
      const g2 = generateUserPrompt(req)
      expect(mask(g1)).toMatchSnapshot()
      expect(g1).toMatch(fenced)
      expect(g1).toContain('Q: Hangi dil?\nA: TypeScript')
      expect(nonces(g1)).not.toEqual(nonces(g2))
    })
  })
})

describe('analyze: çoklu aile havuzu', () => {
  it('adds routing and every family block, candidates cover the whole pool', () => {
    const pool = FAMILIES.flatMap((f) => modelsOf(f))
    const p = analyzeSystemPrompt({ id: 't', prompt: RAW, surface: 'chat', family: 'auto' }, pool)
    expect(mask(p)).toMatchSnapshot()
    expect(p).toContain('<routing>')
    for (const f of FAMILIES) expect(p).toContain(familyCard(f, 'models'))
    expect([...p.matchAll(/^- `([^`]+)` — /gm)].map((m) => m[1]).toSorted(byText)).toEqual(pool.toSorted(byText))
  })

  it('manual choice adds the clarifying-only note', () => {
    const p = analyzeSystemPrompt({ ...analyzeReq('claude', 'chat'), manual: { model: 'claude-opus-5-5', effort: 'high' } }, modelsOf('claude'))
    expect(p).toContain(`already chosen ${MODELS['claude-opus-5-5'].name} at \`high\` effort`)
  })
})
