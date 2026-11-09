// Jüride başka aileden ikinci üye: Vertex üzerindeki DeepSeek (Google'ın barındırdığı MaaS, OpenAI uyumlu uç nokta).
// Yalnızca eval kullanır; istek http.ts'in izin listesinden (aiplatform.googleapis.com) ve aynı Vertex key'iyle gider.
import { z } from 'zod'
import type { Usage } from '@shared/types'
import { LlmError, type Credentials } from '../llm/types'
import { readJson, send } from '../llm/http'

export const DEEPSEEK_MODEL = 'deepseek-ai/deepseek-v4.1-flash-maas'

const ResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }), finish_reason: z.string().nullable().optional() })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional()
})

export function deepseekUrl(cred: Credentials) {
  if (!cred.project) throw new LlmError('DeepSeek jürisi için Vertex proje kimliği gerekli')
  return `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(cred.project)}/locations/global/endpoints/openapi/chat/completions`
}

/** JSON nesnesi döndüren tek çağrı; şema metinle istenir (uç nokta json_object modunu destekler). */
export async function deepseekJson(cred: Credentials, system: string, user: string, maxTokens = 8192): Promise<{ text: string; usage: Usage }> {
  const res = await send(
    deepseekUrl(cred),
    {
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cred.key },
      body: {
        model: DEEPSEEK_MODEL,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }
    },
    { label: 'DeepSeek (Vertex)', key: cred.key, timeoutMs: 120_000 }
  )
  const data = await readJson(res, ResponseSchema, 'DeepSeek (Vertex)')
  const choice = data.choices[0]
  const text = choice?.message.content ?? ''
  if (!text.trim()) throw new LlmError('DeepSeek boş yanıt döndü')
  if (choice?.finish_reason === 'length') throw new LlmError('DeepSeek yanıtı token sınırında kesildi')
  // Kullanım bilgisi gelmezse harcama sayılamaz; sayaç sessizce açılmasın diye çağrı başarısız sayılır.
  if (!data.usage) throw new LlmError('DeepSeek yanıtında kullanım bilgisi yok')
  return { text, usage: { promptTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens, thoughtsTokens: 0 } }
}
