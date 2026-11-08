---
kind: model
verified: 2026-11-08
sources: xai-models, xai-reasoning, xai-best-practices, xai-grok-4-3, xai-grok-build-model
---
# Target models (xAI Grok, lineup checked 2026-11-08)

All are reasoning models served through the xAI API; the Responses API is recommended and Chat Completions is deprecated. [s:xai-best-practices]

| Model | ID | Positioning | Context | Price (input / output per MTok) | Effort levels | Default |
|---|---|---|---|---|---|---|
| Grok 4.7 | `grok-4.7` | xAI's newest flagship; knowledge cutoff May 2026. | 500k | $2 / $6 (prompts ≥200k: $4 / $12) | `low` `medium` `high` `xhigh` | `high` | [s:xai-models, xai-reasoning]
| Grok 4.3 | `grok-4.3` | Lower-cost model with a 1M window; light reasoning by default and can run without reasoning. | 1M | $1.25 / $2.50 (≥200k: $2.50 / $5) | `none` `low` `medium` `high` | `low` | [s:xai-models, xai-grok-4-3, xai-best-practices]
| Grok Build 0.1 | `grok-build-0.1` | Coding model for agentic software, engineering and workflow tasks. | 256k | $1 / $2 (≥200k: $2 / $4) | no documented control | — | [s:xai-models, xai-grok-build-model]

Prompts of 200k tokens or more are billed at the higher rate for every token in the request. [s:xai-models]
Reasoning tokens are billed; `max_output_tokens` caps only the visible answer, so reasoning can run long. [s:xai-reasoning, xai-best-practices]

## Choosing a model
- **Grok 4.7** for most serious work: coding, debugging, analysis, writing. Reasoning can't be turned off. [s:xai-reasoning]
- **Grok 4.3** for cheaper, faster or very long-context work: summaries of large inputs, extraction, simple Q&A, high volume. [s:xai-models, xai-grok-4-3]
- **Grok Build 0.1** for agentic coding, mainly through the Grok Build agent. [s:xai-grok-build-model]
