// `npm run selftest -- "prompt"`: arayüz açmadan analiz + yazım zincirini gerçek sağlayıcıya karşı çalıştırır.
// Seçenekler: --surface=agent|chat|api  --family=auto|claude|openai|gemini|grok  --engine=<sağlayıcı>
//             --discover (yalnızca key'leri doğrulayıp erişilen modelleri listeler)
import { app } from 'electron'
import { FAMILIES, PROVIDERS, type FamilyChoice, type ProviderId, type Surface } from '@shared/catalog'
import { analyze } from './engine/analyze'
import { generatePrompt } from './engine/generate'
import { candidatePool, overrideEngine, providerViews, resolveEngine, targetAccess, verify } from './providers'

const SAMPLE =
  'prompter projesinde ayarlar paneline vertex bağlantısını test eden bir buton ekle, key arayüze inmesin, hata olursa mesajı göster'

export async function selftest(argv: string[]) {
  const args = argv.slice(argv.indexOf('--selftest') + 1).filter((a) => !a.startsWith('--'))
  const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  const prompt = args[0] ?? SAMPLE
  const surface = (flag('surface') ?? 'agent') as Surface
  const family = (flag('family') ?? 'claude') as FamilyChoice
  const engine = flag('engine') as ProviderId | undefined
  const log = (label: string, data: unknown) => process.stdout.write(`\n=== ${label} ===\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n`)

  try {
    if (engine && !PROVIDERS.includes(engine)) throw new Error(`Bilinmeyen sağlayıcı: ${engine}`)
    if (family !== 'auto' && !(FAMILIES as readonly string[]).includes(family)) throw new Error(`Bilinmeyen aile: ${family}`)
    if (engine) overrideEngine(engine)

    if (argv.includes('--discover')) {
      for (const p of providerViews().filter((v) => v.ready)) {
        const s = await verify(p.id)
        log(`DISCOVER ${p.id} (${p.key.source} ${p.key.hint})`, s.ok ? s.models.map((m) => m.id) : `HATA: ${s.message}`)
      }
      log('TARGET ACCESS', targetAccess())
      log('POOL (auto)', candidatePool('auto'))
      log('ENGINE', resolveEngine())
      return app.exit(0)
    }

    log('PROMPT', `${prompt}  [${family} · ${surface}]`)
    log('ENGINE', resolveEngine())
    const analysis = await analyze({ prompt, surface, family })
    log(`ANALYSIS (${analysis.elapsedMs} ms)`, analysis)
    const answers = analysis.questions.map((q) => ({ question: q.question, answer: q.options[0] ?? '' }))
    const { model, effort } = analysis.recommendation
    let chunks = 0
    const result = await generatePrompt(
      { id: 'selftest', prompt, surface, model, effort, answers, analysis, family },
      () => chunks++,
      new AbortController().signal
    )
    log(`GENERATED for ${model} · ${effort} (${result.elapsedMs} ms, ${chunks} chunks)`, result.prompt)
    log('NOTES', result.notes)
    log('USAGE', { ...result.usage, engine: result.engine })
    app.exit(0)
  } catch (e: any) {
    log('ERROR', e?.message ?? String(e))
    app.exit(1)
  }
}
