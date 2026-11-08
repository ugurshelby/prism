import { FAMILY_INFO, MODELS } from '@shared/catalog'
import { parseGenerated } from '@shared/parse'
import type { GenerateRequest, GenerateResult, ReplyLanguage } from '@shared/types'
import { getSettings } from '../config'
import { engineStream } from '../providers'
import { fence } from './fence'
import { card, familyCard, surfaceCard, targetCard } from './knowledge'

function languageRule(lang: ReplyLanguage, surface: GenerateRequest['surface']): string {
  if (lang === 'none' || surface === 'api') return ''
  if (lang === 'tr') {
    return surface === 'agent'
      ? '- The person wants the agent to talk to them in Turkish. Add one natural line asking it to write its messages in Turkish while keeping code, identifiers and commit messages as the repository already does.'
      : '- The person wants the reply in Turkish. Add one natural line asking for the answer in Turkish.'
  }
  return '- The person wants the reply in English; no language line is needed.'
}

function systemPrompt(req: GenerateRequest, lang: ReplyLanguage) {
  const model = MODELS[req.model]
  const family = FAMILY_INFO[model.family]
  const surface = family.surfaces[req.surface].label
  const level = model.efforts.length ? `at \`${req.effort}\` ${family.effortLabel}` : 'with its fixed reasoning level'
  return `You are the writing stage of Prism. You write the final prompt the person will paste into ${surface} for ${model.name} running ${level}. Write the prompt that a senior engineer who knows this model well would write for this exact intent.

<vision>
${card('vision.md')}
</vision>

<principles>
${familyCard(model.family, 'principles')}
</principles>

<target_model name="${model.name}">
${targetCard(req.model)}
</target_model>

<effort selected="${model.efforts.length ? req.effort : 'fixed'}">
${familyCard(model.family, 'effort')}
</effort>

<surface name="${surface}">
${surfaceCard(model.family, req.surface)}
</surface>

Rules:
- Write the prompt in English. Keep verbatim anything that must stay as written: code, identifiers, file paths, commands, error messages, quoted text, and user-facing strings the person wrote in Turkish.
- Keep every concrete detail and requirement the person gave, plus their answers to the clarifying questions. Don't invent facts, files or requirements. Where something only the person could know is still missing, put a short placeholder in double brackets, e.g. [[file path]].
- Shape the prompt for the selected effort level and the target model as the cards describe. Use a tested snippet from the target model card only when the behavior it addresses is likely for this task, and keep its wording.
- Length follows the task: a small request gets a few sentences; a large agentic task gets a structured brief.
${languageRule(lang, req.surface)}
- Never mention Prism, this analysis, effort levels or model names inside the prompt unless the surface needs them (an API system prompt may state the model identity).
- Don't wrap the prompt in code fences.

Output exactly this, nothing before or after:
<prompt>
(the final prompt)
</prompt>
<notes>
- (2 to 4 very short bullets in Turkish: the most important things you changed or added and why; mention any placeholder)
</notes>`
}

function userPrompt(req: GenerateRequest) {
  const answers = req.answers.filter((a) => a.answer.trim())
  const clarifications = answers.length
    ? `\n${fence('clarifications', answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n'))}\n`
    : ''
  // Niyet metni modelin çıktısıdır ama kullanıcı metninden türer; o da sınırlanır.
  const analysis = req.analysis
    ? `\n${fence('analysis', `Intent: ${req.analysis.intent}\nTask type: ${req.analysis.taskType}\nComplexity: ${req.analysis.complexity}`)}\n`
    : ''
  const surface = FAMILY_INFO[MODELS[req.model].family].surfaces[req.surface].label
  return `<target surface="${surface}" model="${req.model}" effort="${req.effort}" />
${analysis}
${fence('raw_prompt', req.prompt)}
${clarifications}`
}

// Argon nadiren çıktıya başka alfabeden harf karıştırıyor; girdide olmayanları işaretle.
function foreignScript(output: string, input: string): string[] {
  const re = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/gu
  const allowed = new Set(input.match(re) ?? [])
  return [...new Set((output.match(re) ?? []).filter((ch) => !allowed.has(ch)))]
}

export async function generatePrompt(
  req: GenerateRequest,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<GenerateResult> {
  const started = Date.now()
  const settings = getSettings()
  const { text, usage, engine } = await engineStream(
    'generation',
    {
      system: systemPrompt(req, settings.replyLanguage),
      user: userPrompt(req),
      temperature: 0.6,
      signal
    },
    onChunk
  )
  const parsed = parseGenerated(text)
  const prompt = parsed.prompt || text.replace(/<\/?(prompt|notes)>/g, '').trim()
  const notes = [...parsed.notes]
  const strange = foreignScript(prompt, req.prompt + req.answers.map((a) => a.answer).join(' '))
  if (strange.length) notes.push(`Uyarı: çıktıda beklenmeyen karakterler var (${strange.join(' ')}). Kopyalamadan önce kontrol et.`)
  return { prompt, notes, usage, engine, elapsedMs: Date.now() - started }
}
