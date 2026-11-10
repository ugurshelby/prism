import { randomBytes } from 'node:crypto'

/**
 * Kullanıcıdan gelen metni, içinden kapatılamayacak bir etiketle sarar: etiket adı her istekte rastgele bir ek alır.
 * Metindeki `</raw_prompt>` gibi bir dize bu yüzden etiketi kapatıp talimat bölümüne taşamaz. Bu yalnızca etiketin
 * kapatılmasını önler; içerideki metne uyulmaması istemdeki kurala bağlıdır (analyze.ts, generate.ts).
 */
export function fence(tag: string, text: string): string {
  const name = `${tag}_${randomBytes(4).toString('hex')}`
  return `<${name}>\n${text}\n</${name}>`
}
