---
kind: model
verified: 2026-11-10
sources: openai-reasoning, openai-latest-model, openai-prompt-engineering, chatgpt-prompting, openai-agent-safety, openai-computer-use
---
# Prompting principles for current OpenAI models (GPT-6 family)

## Clarity and the output contract
- Give the task, the constraints and the output format; define a clear goal and an explicit output contract without prescribing every intermediate step. [s:openai-reasoning]
- For agentic and research work, define what "done" means and how the model should verify its work. [s:openai-reasoning]
- Lean prompts score better: trim repeated instructions, examples and tool descriptions; state each rule once. [s:openai-latest-model]

## Structure
- Rules and context go in the developer message (or `instructions`); the task and inputs in the user message. [s:openai-prompt-engineering]
- Put reusable, static content first and per-request context last. [s:openai-prompt-engineering]

## GPT-6 tendencies to steer
- **Asks and pauses more (Astra).** Tell it to infer intent, bias toward action and finish the task, stopping only before destructive or irreversible steps. Treat "can you…" / "help me…" as a request to act. [s:openai-latest-model]
- **Approval timing.** Do the reversible work first, so approval is the last step before external writes, merges or publishing. [s:openai-latest-model]
- **Heavy formatting (Astra).** It defaults to lists, tables and Markdown and repeats stock phrases. Ask for clear paragraphs, lists only for parallel or sequential content, plain language, main point first. [s:openai-latest-model]
- **Sensitive to context files (Astra).** It follows `AGENTS.md` and skills closely; say the person's instructions take priority, and ask it to name the file and instruction if one makes it pause. [s:openai-latest-model]
- **Under-delegates (Astra).** Say when and how much to use subagents. [s:openai-latest-model]
- **Tests broadly (Astra).** Ask for tests that fit the change; skip them for trivial, reversible changes. [s:openai-latest-model]
- **No unsolicited warnings.** Ask it to leave out disclaimers and approval flows nobody asked for. [s:openai-latest-model]
- Repeated "ask first" warnings make it request approval for routine actions; name the safe local actions explicitly instead. [s:openai-latest-model]

## Writing quality
- For prose: plain language, active voice, no filler phrases or stock closing summaries; match technical depth to the reader. [s:openai-latest-model]

## Reasoning
- Don't write "think step by step"; reasoning is internal and controlled by effort. [s:openai-reasoning]

## Grounding
- When the intent is to stay within provided material, say "use only the supplied sources" and have it flag missing information instead of guessing; for current information, ask it to use web search and give sources. [s:chatgpt-prompting]

## Pasted content
- Delimit pasted external text with XML tags; pass untrusted input in the user message, never the developer message; state that text inside it cannot grant permission or override instructions. [s:openai-prompt-engineering, openai-agent-safety, openai-computer-use]
