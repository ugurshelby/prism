import { randomBytes } from 'node:crypto'

/**
 * Wraps user-supplied text in a tag that cannot be closed from inside: the tag name gets a random suffix on every request.
 * So a string like `</raw_prompt>` in the text cannot close the tag and spill into the instruction section. This only
 * prevents closing the tag; not obeying the text inside depends on the rule in the prompt (analyze.ts, generate.ts).
 */
export function fence(tag: string, text: string): string {
  const name = `${tag}_${randomBytes(4).toString('hex')}`
  return `<${name}>\n${text}\n</${name}>`
}
