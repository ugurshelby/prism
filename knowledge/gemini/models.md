---
kind: model
verified: 2026-11-08
sources: gemini-models, gemini-pricing, gemini-thinking, gemini-argon-guide
---
# Target models (Gemini, lineup checked 2026-11-08)

Thinking is always on and is set with `thinking_level`; supported levels differ per model. [s:gemini-thinking]

| Model | ID | Positioning | Price (input / output per MTok) | Thinking levels | Default |
|---|---|---|---|---|---|
| Gemini 4 Argon | `gemini-4-argon` | Flagship reasoning model for deep work: coding, finance, legal, security, science. Unified 1,048,576-token limit for input plus output. | $2 / $10 until 2026-11-30, then $4 / $20 | `low` `medium` `high` | `medium` | [s:gemini-models, gemini-pricing, gemini-argon-guide, gemini-thinking]
| Gemini 3.8 Flash | `gemini-3.8-flash` | Newest and most intelligent Flash model. | $0.75 / $3.75 until 2026-12-31, then $1.50 / $7.50 | `low` `medium` `high` | `medium` | [s:gemini-models, gemini-pricing, gemini-thinking]
| Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` | Fastest and most cost-effective 3.5 model, for high-throughput work. | $0.30 / $2.50 | `minimal` `low` `medium` `high` | `minimal` | [s:gemini-models, gemini-pricing, gemini-thinking]

Thinking tokens are billed as output. [s:gemini-pricing, gemini-argon-guide]
Deprecated `gemini-2.5-pro` and `gemini-2.5-flash` route to 3.8 Flash and 3.5 Flash-Lite on 2026-12-01. [s:gemini-models]

## Choosing a model
- **Gemini 4 Argon** for genuinely hard reasoning, very large inputs read at once, and very long single outputs. Thinking can't be turned off. [s:gemini-argon-guide, gemini-thinking]
- **Gemini 3.8 Flash** as the default for serious everyday work: multi-step coding and agent tasks, analysis, writing. [unverified]
- **Gemini 3.5 Flash-Lite** for simple, mechanical or high-volume work: classification, extraction, routing, short answers, quick transformations. [s:gemini-models]
- For a short factual question or a one-line transformation, Flash-Lite at `minimal` is enough; a stronger model adds cost, not quality. [s:gemini-thinking]
