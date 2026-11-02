// `npm run selftest -- "prompt"`: arayüz açmadan analiz + yazım zincirini gerçek Vertex'e karşı çalıştırır.
import { app } from 'electron'
import { readdirSync } from 'node:fs'
import { knowledgeDir } from './config'
import type { Surface } from '@shared/catalog'
import { analyze } from './engine/analyze'
import { generatePrompt } from './engine/generate'

const SAMPLE =
  'prompter projesinde ayarlar paneline vertex bağlantısını test eden bir buton ekle, key arayüze inmesin, hata olursa mesajı göster'

export async function selftest(argv: string[]) {
  const args = argv.slice(argv.indexOf('--selftest') + 1).filter((a) => !a.startsWith('--'))
  const prompt = args[0] ?? SAMPLE
  const surface = (argv.find((a) => a.startsWith('--surface='))?.split('=')[1] ?? 'claude-code') as Surface
  const log = (label: string, data: unknown) => process.stdout.write(`\n=== ${label} ===\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n`)

  // --smoke: ağ ve key olmadan paketin bütünlüğünü dener (CI'da paketlenmiş uygulamayla çalışır).
  if (argv.includes('--smoke')) {
    const cards = readdirSync(knowledgeDir(), { recursive: true }).filter((f) => String(f).endsWith('.md')).length
    log('SMOKE', { version: app.getVersion(), platform: `${process.platform}-${process.arch}`, cards })
    return app.exit(cards > 0 ? 0 : 1)
  }

  try {
    log('PROMPT', `${prompt}  [${surface}]`)
    const analysis = await analyze({ prompt, surface })
    log(`ANALYSIS (${analysis.elapsedMs} ms)`, analysis)
    const answers = analysis.questions.map((q) => ({ question: q.question, answer: q.options[0] ?? '' }))
    const { model, effort } = analysis.recommendation
    let chunks = 0
    const result = await generatePrompt(
      { id: 'selftest', prompt, surface, model, effort, answers, analysis },
      () => chunks++,
      new AbortController().signal
    )
    log(`GENERATED for ${model} · ${effort} (${result.elapsedMs} ms, ${chunks} chunks)`, result.prompt)
    log('NOTES', result.notes)
    log('USAGE', result.usage)
    app.exit(0)
  } catch (e: any) {
    log('ERROR', e?.message ?? String(e))
    app.exit(1)
  }
}
