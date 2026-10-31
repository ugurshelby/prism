# Writing for GPT-6 Astra

Strengths: OpenAI's most capable model for the most demanding work; stronger general instruction following than earlier GPT models, which gives precise control over behavior; a careful collaborator on ambiguous, multi-step problems. Effort `low` to `max` (no `none`); the API default isn't documented, so the setup note should always name the level.

## Patterns that work (from OpenAI's GPT-6 guidance)

- **Initiative and follow-through** — Astra is more likely to stop and ask when extra input could change the result. When the person expects the work to be finished, say so: infer intent from context, make reasonable assumptions, carry the task through, and stop only before destructive or irreversible actions. Ask for approval after the authorized work is done, not before.
- **Instruction priority** — it follows AGENTS.md and skill files closely; state that the person's instructions win on conflict, and ask it to quote the file instruction if one makes it pause.
- **Writing style** — specify the style: clear, concise paragraphs; lists only for parallel, sequential or comparable items; plain language, active voice, main point first. Without this it leans to heavy formatting and recurring stock phrases.
- **Delegation** — it delegates to sub-agents less often than may be wanted; say when parallel sub-agents should be used.
- **Testing** — ask for tests that fit the change; it otherwise writes broader tests than small tasks need.
- **No unsolicited warnings** — ask it to leave out disclaimers and hypothetical-risk warnings unless they matter.

## Things to avoid
- "Think step by step" or asking it to reveal its reasoning; effort controls thinking.
- Recommending it for routine work: it costs five times GPT-6.1 Sol.
