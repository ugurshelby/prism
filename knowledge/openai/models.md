---
kind: model
verified: 2026-11-08
sources: openai-models, openai-reasoning, openai-latest-model
---
# Target models (OpenAI, lineup checked 2026-11-08)

All four have a 1.05M-token context window and 128K max output, and support functions, web search, file search and computer use. [s:openai-models]
Reasoning depth is set with `reasoning.effort`; supported levels differ per model. [s:openai-reasoning]

| Model | ID | Positioning | Price (input / output per MTok) | Effort levels | Default effort | Knowledge cutoff |
|---|---|---|---|---|---|---|
| GPT-6 Astra | `gpt-6-astra` | Most capable model for the most demanding work: complex reasoning and coding. | $10 / $50 | `low` `medium` `high` `xhigh` `max` | not documented; always set it | Apr 30, 2026 | [s:openai-models, openai-reasoning]
| GPT-6.1 Sol | `gpt-6.1-sol` | Near-Astra performance for complex work at a lower cost. | $2 / $10 | `low` `medium` `high` `xhigh` `max` | `medium` | Apr 30, 2026 | [s:openai-models, openai-latest-model]
| GPT-6.1 Terra | `gpt-6.1-terra` | Fast and efficient: visual reasoning, precise computer use, natural writing. | $1 / $5 | `none` … `max` | `medium` | Jun 1, 2026 | [s:openai-models, openai-latest-model]
| GPT-6 Luna | `gpt-6-luna` | Most efficient model for focused, high-volume tasks. | $0.10 / $0.50 | `none` … `max` | `medium` | May 18, 2026 | [s:openai-models, openai-reasoning]

## Choosing a model
Choose the cheapest model and effort that will reliably do the job well. [s:openai-reasoning]
- **GPT-6 Astra** for the hardest, highest-stakes work: ambiguous multi-step problems, long autonomous runs where quality dominates cost. It costs five times Sol, so not for ordinary work. [s:openai-models, openai-latest-model]
- **GPT-6.1 Sol** when the work is serious but cost matters: multi-file coding, debugging, analysis, professional writing. [s:openai-models, openai-latest-model]
- **GPT-6.1 Terra** for everyday tasks, natural prose, screenshots and computer use, and latency-sensitive work; it can run with no reasoning. [s:openai-models, openai-latest-model]
- **GPT-6 Luna** for simple, mechanical or high-volume work: classification, extraction with a clear schema, routing, short answers. [s:openai-models]
- Signals that push up: ambiguity the model must resolve alone, many interacting parts, hard-to-verify correctness, long unattended runs. Signals that push down: the person reviews each step, the change is small, speed matters, the task runs many times. [unverified]
