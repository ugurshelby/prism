# Target models (xAI Grok, current lineup, October 2026)

All are reasoning models served through the xAI API (Responses API recommended; Chat Completions is deprecated). Reasoning depth is set with `reasoning.effort` where the model allows it.

| Model | ID | Positioning | Context | Price (input / output per MTok) | Effort levels | Default |
|---|---|---|---|---|---|---|
| Grok 4.7 | `grok-4.7` | xAI's most capable model; recommended for code and chat. Knowledge cutoff May 2026. | 500k | $2 / $6 (prompts ≥200k: $4 / $12) | `low` `medium` `high` `xhigh` | `high` |
| Grok 4.3 | `grok-4.3` | Lower-cost model with a 1M context window; light reasoning by default and can run without reasoning. | 1M | $1.25 / $2.50 (≥200k: $2.50 / $5) | `none` `low` `medium` `high` | `low` |
| Grok Build 0.1 | `grok-build-0.1` | Coding-agent model behind the Grok Build CLI: refactors, calls tools, produces structured outputs and iterates on multi-step tasks to completion. Early access. | 256k | $1 / $2 | fixed — reasoning always on, not adjustable | — |

## Choosing a model

- **Grok 4.7** for most serious work: coding, debugging, analysis, writing, chat. A flagship at a low list price; reasoning can't be turned off.
- **Grok 4.3** for cheaper, faster or very long-context work: summaries of large inputs, extraction, simple Q&A, high-volume tasks.
- **Grok Build 0.1** when the prompt is for the Grok Build coding agent.

Reasoning tokens are billed as output. In the API, `max_output_tokens` caps only the visible answer, so reasoning can run long; client timeouts should be generous.
