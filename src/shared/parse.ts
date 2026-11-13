// Parses the generation stage's <prompt>…</prompt><notes>…</notes> output (also while streaming).

export interface ParsedOutput {
  prompt: string
  notes: string[]
  promptClosed: boolean
}

export function parseGenerated(text: string): ParsedOutput {
  const open = text.indexOf('<prompt>')
  if (open < 0) return { prompt: '', notes: [], promptClosed: false }
  const start = open + '<prompt>'.length
  const close = text.indexOf('</prompt>', start)
  const promptClosed = close >= 0
  let prompt = promptClosed ? text.slice(start, close) : text.slice(start)
    // Do not show a closing tag that is only half received during streaming.
  if (!promptClosed) prompt = prompt.replace(/<\/?p?r?o?m?p?t?$/, '')
  prompt = prompt.replace(/^\s*\n/, '').replace(/\s+$/, '')

  const notesMatch = text.match(/<notes>([\s\S]*?)(?:<\/notes>|$)/)
  const notesBody = notesMatch?.[1]
  const notes = notesBody
    ? notesBody
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
        .filter(Boolean)
    : []
  return { prompt, notes, promptClosed }
}
