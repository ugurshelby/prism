---
kind: model
verified: 2026-11-08
sources: openai-reasoning, openai-latest-model, codex-config
---
# Reasoning effort (OpenAI)

GPT-6 models reason before answering; `reasoning.effort` sets how much. OpenAI frames effort as a tuning knob, not the main way to improve quality: a clear goal, constraints and output contract matter more. [s:openai-reasoning]
Astra and Sol don't accept `none`; migrating `minimal` users should start at `low`. [s:openai-latest-model, openai-reasoning]

| Level | Use it for |
|---|---|
| `none` | Latency-critical work with no reasoning (Terra, Luna). Give precise, explicit instructions and the output format. | [s:openai-latest-model]
| `low` | Quick edits, short tool tasks, simple Q&A, high-volume work. Lowest level on Astra and Sol. | [unverified]
| `medium` | Day-to-day work with a clear scope. Default on Sol, Terra and Luna; start here and raise only if quality gains justify it. | [s:openai-reasoning, openai-latest-model]
| `high` | Debugging, careful analysis, longer agentic tasks. | [unverified]
| `xhigh` / `max` | Long-horizon agentic and coding work; the hardest problems. Highest cost and latency. | [unverified]

Notes:
- `max_output_tokens` covers reasoning plus visible output; reserve at least 25,000 tokens when starting out. A response that hits the limit comes back `incomplete`, possibly with no visible text. [s:openai-reasoning]
- When effort is not `none`, remove `temperature`, `top_p` and `top_logprobs`. [s:openai-latest-model]
- To change effort mid-conversation, use `configuration_update` input items and keep the request-level effort unchanged to preserve the cache. [s:openai-latest-model]
- In Codex: `model_reasoning_effort` in `config.toml`; valid levels vary by model. [s:codex-config]

## How the prompt should change with effort
- **none / low:** explicit and complete: the steps that matter, the exact output format, what to check before answering. [unverified]
- **medium:** goal, scope, constraints, what done looks like and how to verify it. [s:openai-reasoning]
- **high and above:** describe the outcome, not the procedure. Spend words on what is in scope, when to stop, which actions need confirmation and how much testing fits the change. [s:openai-reasoning, openai-latest-model]
