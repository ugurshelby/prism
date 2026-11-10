import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FAMILIES, SURFACES, modelsOf } from '@shared/catalog'
import { SourcesFileSchema, parseCard } from '@shared/knowledge'

// Uygulamayla dağıtılan kartların hepsi: şema, kaynaklar ve beklenen dosyalar.
describe('knowledge/ cards', () => {
  const dir = join(__dirname, '..', '..', '..', 'knowledge')
  const sources = SourcesFileSchema.parse(JSON.parse(readFileSync(join(dir, 'sources.json'), 'utf8')) as unknown)
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.md')).map((f) => relative(dir, join(dir, f)).replaceAll('\\', '/'))

  it('contains every card the engine loads', () => {
    const expected = [
      'vision.md',
      'routing.md',
      ...FAMILIES.flatMap((f) => [
        ...['models', 'effort', 'principles'].map((n) => `${f}/${n}.md`),
        ...SURFACES.map((s) => `${f}/surfaces/${s}.md`),
        ...modelsOf(f).map((m) => `${f}/targets/${m}.md`)
      ])
    ]
    expect(files.toSorted()).toEqual(expected.toSorted())
  })

  // routing.md bir yöntem kartıdır: kaynaksız olabilen yalnızca Prism'in kendi kuralları; satıcıya dair her satır kaynaklı.
  it('routing.md leaves only its own policy lines unsourced', () => {
    const lines = readFileSync(join(dir, 'routing.md'), 'utf8').split(/\r?\n/)
    const body = lines.slice(lines.indexOf('---', 1) + 1)
    const unsourced = body.filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('|---') && !l.startsWith('| Tier') && !l.includes('[s:'))
    expect(unsourced.map((l) => l.slice(0, 40))).toEqual([
      'Used only when the person lets Prism pic',
      '- If the raw prompt names a tool or fami',
      '- Alternatives may come from other famil'
    ])
  })

  it.each(files)('%s is valid and fully sourced', (f) => {
    const p = parseCard(readFileSync(join(dir, f), 'utf8'), sources)
    expect(p.issues).toEqual([])
    expect(p.body.length).toBeGreaterThan(0)
  })

  it('target cards have the schema sections', () => {
    const sections = ['## How it reads prompts', '## Strengths and weaknesses', '## Effort', '## Tested patterns', '## Failure modes']
    for (const f of files.filter((x) => x.includes('/targets/'))) {
      const text = readFileSync(join(dir, f), 'utf8')
      for (const s of sections) expect(text, `${f}: ${s}`).toContain(s)
    }
  })

  it('every registered source is used by some card', () => {
    const used = new Set(files.flatMap((f) => parseCard(readFileSync(join(dir, f), 'utf8'), sources).meta.sources))
    expect(Object.keys(sources.sources).filter((id) => !used.has(id))).toEqual([])
  })
})
