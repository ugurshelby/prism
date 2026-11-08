---
kind: model
verified: 2026-11-08
sources: openai-models, openai-latest-model, openai-reasoning
---
# Writing for GPT-6 Astra

## How it reads prompts
- Follows longer instructions better than earlier models but is more sensitive to context, including skills and `AGENTS.md`; unclear or conflicting guidance can make it pause early. [s:openai-latest-model]
- Asks clarifying questions more often and may stop instead of assuming. [s:openai-latest-model]

## Strengths and weaknesses
- Strong: OpenAI's most capable and most aligned model for the most demanding reasoning and coding. [s:openai-models, openai-latest-model]
- Weak fit: routine work; it costs five times GPT-6.1 Sol. [s:openai-models]

## Effort
- `low` to `max`; `none` returns an error. The default isn't documented, so the setup note must name the level. [s:openai-latest-model, openai-reasoning]

## Tested patterns
- Autonomy: infer scope, bias toward action, finish unless the step is destructive. [s:openai-latest-model]
- Instruction priority: the person's instructions beat skill guidance; name any file that causes a pause. [s:openai-latest-model]
- Writing style: concise paragraphs, plain words, main point first. [s:openai-latest-model]
- Delegation: say when to parallelize through subagents. [s:openai-latest-model]

## Failure modes
- Repeated approval requests before acting; blocking on unclear `AGENTS.md` guidance. [s:openai-latest-model]
- Over-testing small changes; heavy formatting and stock phrases; under-use of subagents. [s:openai-latest-model]
