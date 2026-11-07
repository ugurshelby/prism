// `npm run selftest -- "prompt"`: arayüz açmadan analiz + yazım zincirini gerçek sağlayıcıya karşı çalıştırır.
// Seçenekler: --surface=agent|chat|api  --family=auto|claude|openai|gemini|grok  --engine=<sağlayıcı>
//             --discover (yalnızca key'leri doğrulayıp erişilen modelleri listeler)
//             --smoke (ağ ve key olmadan paketin bütünlüğünü dener; CI'da her platformda paketlenmiş uygulamayla çalışır)
import { app } from 'electron'
import { FAMILIES, SURFACES, modelsOf } from '@shared/catalog'
import { FamilyChoiceSchema, ProviderIdSchema, SurfaceSchema } from '@shared/schemas'
import { analyze } from './engine/analyze'
import { generatePrompt } from './engine/generate'
import { card } from './engine/knowledge'
import { assertProviderUrl } from './llm/http'
import { candidatePool, overrideEngine, providerViews, resolveEngine, targetAccess, verify } from './providers'
import { isAppUrl } from './window'

const SAMPLE =
  'prism projesinde ayarlar paneline vertex bağlantısını test eden bir buton ekle, key arayüze inmesin, hata olursa mesajı göster'

export async function selftest(argv: string[]) {
  const args = argv.slice(argv.indexOf('--selftest') + 1).filter((a) => !a.startsWith('--'))
  const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  const prompt = args[0] ?? SAMPLE
  const log = (label: string, data: unknown) => process.stdout.write(`\n=== ${label} ===\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n`)

  try {
    const surface = SurfaceSchema.parse(flag('surface') ?? 'agent')
    const family = FamilyChoiceSchema.parse(flag('family') ?? 'claude')
    const engineFlag = flag('engine')
    if (engineFlag !== undefined) overrideEngine(ProviderIdSchema.parse(engineFlag))

    if (argv.includes('--smoke')) {
      const paths = [
        'routing.md',
        'vision.md',
        ...FAMILIES.flatMap((f) => [
          ...['models', 'effort', 'principles'].map((n) => `${f}/${n}.md`),
          ...SURFACES.map((s) => `${f}/surfaces/${s}.md`),
          ...modelsOf(f).map((m) => `${f}/targets/${m}.md`)
        ])
      ]
      const empty = paths.filter((p) => !card(p))
      if (empty.length) throw new Error(`Boş bilgi kartı: ${empty.join(', ')}`)
      // Paketli uygulamada da güvenlik sınırları yerinde mi: key yalnızca sağlayıcılara gider, IPC yalnızca kendi arayüzünden.
      const leaks = [
        ['https://evil.example/v1', 'https://aiplatform.googleapis.com.evil.example/', 'http://api.openai.com/v1'].some((u) => {
          try {
            assertProviderUrl(u)
            return true
          } catch {
            return false
          }
        }) && 'sağlayıcı adres listesi',
        ['https://evil.example/', 'file:///etc/passwd'].some(isAppUrl) && 'IPC gönderen denetimi',
        ProviderIdSchema.safeParse('../../x').success && 'sağlayıcı kimliği şeması'
      ].filter(Boolean)
      if (leaks.length) throw new Error(`Güvenlik denetimi başarısız: ${leaks.join(', ')}`)
      log('SMOKE', {
        version: app.getVersion(),
        platform: `${process.platform}-${process.arch}`,
        cards: paths.length,
        providers: providerViews().map((p) => `${p.id}:${p.key.source}`)
      })
      return app.exit(0)
    }

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
    const analysis = await analyze({ id: 'selftest-analyze', prompt, surface, family })
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
  } catch (e) {
    log('ERROR', e instanceof Error ? e.message : String(e))
    app.exit(1)
  }
}
