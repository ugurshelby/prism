# Writing for Gemini 3.5 Flash-Lite

Strengths: the fastest, most cost-effective Gemini 3.5 model, for high-throughput work: classification, extraction, routing, summaries of short texts, simple transformations. Thinking levels `minimal` (default), `low`, `medium`, `high`.

## Patterns that work

- One focused job per prompt with an exact output format.
- Few-shot examples with identical formatting are the most reliable way to fix format and category boundaries; Google recommends them.
- Spell out edge-case rules (what to return when a field is missing or the input is off-topic).
- Raise thinking to `low` or `medium` only when the task needs a bit of reasoning.

## Things to avoid
- Multi-step, judgment-heavy or long agentic tasks: recommend Gemini 3.8 Flash instead.
