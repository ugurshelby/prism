---
kind: model
verified: 2026-11-10
sources: openai-reasoning, openai-latest-model, codex-config, openai-models, openai-prompt-engineering
---
# Reasoning effort (OpenAI)

GPT-6 models reason before answering; `reasoning.effort` sets how much. OpenAI frames effort as a tuning knob, not the main way to improve quality: a clear goal, constraints and output contract matter more. [s:openai-reasoning]
Astra and Sol don't accept `none`; migrating `minimal` users should start at `low`. [s:openai-latest-model, openai-reasoning]

| Level | Use it for |
|---|---|
| `none` | Latency-critical work with no reasoning (Terra, Luna). Give precise, explicit instructions and the output format. | [s:openai-latest-model]
| `low` | Efficient reasoning with a modest latency increase: data analysis, drafting, execution-oriented coding, support chat. Lowest level on Astra and Sol. | [s:openai-reasoning, openai-models]
| `medium` | Day-to-day work with a clear scope. Default on Sol, Terra and Luna; start here and raise only if quality gains justify it. | [s:openai-reasoning, openai-latest-model]
| `high` | Hard reasoning, complex debugging, deep planning; complex agentic tasks where quality matters more than latency. | [s:openai-reasoning]
| `xhigh` / `max` | `xhigh`: deep research, long-running agentic tasks, code review; use only when your evals show a clear benefit. `max`: maximum reasoning for the most complex tasks; evaluate it against `xhigh`. | [s:openai-reasoning]

Notes:
- `max_output_tokens` covers reasoning plus visible output; reserve at least 25,000 tokens when starting out. A response that hits the limit comes back `incomplete`, possibly with no visible text. [s:openai-reasoning]
- When effort is not `none`, remove `temperature`, `top_p` and `top_logprobs`. [s:openai-latest-model]
- To change effort mid-conversation, use `configuration_update` input items and keep the request-level effort unchanged to preserve the cache. [s:openai-latest-model]
- In Codex: `model_reasoning_effort` in `config.toml`; valid levels vary by model. [s:codex-config]

## How the prompt should change with effort
- **none:** no reasoning, so prompt it as you would a non-reasoning model: precise instructions that spell out the logic, the steps and the exact output format. [s:openai-prompt-engineering, openai-reasoning]
- **medium:** goal, scope, constraints, what done looks like and how to verify it. [s:openai-reasoning]
- **high and above:** describe the outcome, not the procedure. Spend words on what is in scope, when to stop, which actions need confirmation and how much testing fits the change. [s:openai-reasoning, openai-latest-model]
