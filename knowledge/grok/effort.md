---
kind: model
verified: 2026-11-10
sources: xai-reasoning, xai-best-practices, xai-grok-4-3, xai-grok-build-model, xai-models
---
# Reasoning effort (Grok)

`reasoning.effort` sets the depth on Grok 4.7 (`low`, `medium`, `high` default, `xhigh`); reasoning can't be disabled there. [s:xai-reasoning]
Grok 4.3 accepts `none`, `low` (default), `medium`, `high`, `xhigh`. [s:xai-grok-4-3, xai-best-practices, xai-models]
Grok Build 0.1 supports reasoning but documents no effort control. [s:xai-grok-build-model]
xAI recommends setting effort explicitly on every request so a default never decides the result. [s:xai-best-practices]

| Level | Use it for (xAI's guidance) |
|---|---|
| `none` | Grok 4.3 only: no reasoning, fastest replies for simple tasks. | [s:xai-grok-4-3]
| `low` | Latency-sensitive agentic work and simple tool calls. | [s:xai-reasoning]
| `medium` | Complex data analysis. | [s:xai-reasoning]
| `high` | Hard math and multi-step logic. Default on Grok 4.7. | [s:xai-reasoning]
| `xhigh` | When answer quality matters more than latency (Grok 4.6 and later). | [s:xai-reasoning]

## How the prompt should change with effort
- At every level: state task, constraints and output format directly; the model reasons before answering. [s:xai-best-practices]
