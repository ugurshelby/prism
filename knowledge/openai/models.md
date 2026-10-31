# Target models (OpenAI, current lineup, October 2026)

All four have a 1.05M-token context window, 128K max output, and support function calling, web search, file search and computer use through the Responses API. Reasoning depth is set with `reasoning.effort` (Responses API) or `reasoning_effort` (Chat Completions); supported levels differ per model.

| Model | ID | Positioning | Price (input / output per MTok) | Effort levels | Default effort | Knowledge cutoff |
|---|---|---|---|---|---|---|
| GPT-6 Astra | `gpt-6-astra` | Flagship. Most capable model for the most demanding work. OpenAI's recommended starting point when unsure. | $10 / $50 | `low` `medium` `high` `xhigh` `max` (no `none`) | not documented — set it explicitly | Apr 30, 2026 |
| GPT-6.1 Sol | `gpt-6.1-sol` | Near-Astra performance for complex work at a lower cost. | $2 / $10 | `low` `medium` `high` `xhigh` `max` | `medium` | Apr 30, 2026 |
| GPT-6.1 Terra | `gpt-6.1-terra` | Fast and efficient: visual reasoning, precise computer use, clear and natural writing. | $1 / $5 | `none` … `max` | `medium` | Jun 1, 2026 |
| GPT-6 Luna | `gpt-6-luna` | Most efficient: focused, high-volume tasks. | $0.10 / $0.50 | `none` … `max` | not documented — set it explicitly | May 18, 2026 |

## Choosing a model

Choose the cheapest model and effort that will reliably do the job well.

- **GPT-6 Astra** for the hardest, highest-stakes work: ambiguous multi-step problems, long autonomous agentic runs where quality dominates cost, deep analysis. It is five times Sol's price, so don't recommend it for ordinary work.
- **GPT-6.1 Sol** when the work is serious but cost matters: multi-file coding with a clear goal, debugging, analysis, careful writing. Near-Astra results for one fifth of the price.
- **GPT-6.1 Terra** for everyday tasks, natural prose, screenshot / visual reasoning and computer use, and anything latency-sensitive. Can run with no reasoning (`none`).
- **GPT-6 Luna** for simple, mechanical or high-volume work: classification, extraction with a clear schema, routing, short answers, sub-agents.
- GPT-5.6 and GPT-6 models also accept `reasoning.mode: "pro"` (API), which spends more model work at higher cost — only for the hardest single problems.

Signals that push up: ambiguity the model must resolve alone, many interacting parts, hard-to-verify correctness, long unattended runs, money or security at stake. Signals that push down: the person reviews each step, the change is small, speed matters, the task runs many times.
