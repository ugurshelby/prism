---
kind: model
verified: 2026-11-08
sources: xai-reasoning, xai-best-practices, xai-grok-4-3, xai-grok-build-model
---
# Reasoning effort (Grok)

`reasoning.effort` sets the depth on Grok 4.7 (`low`, `medium`, `high` default, `xhigh`); reasoning can't be disabled there. [s:xai-reasoning]
Grok 4.3 accepts `none`, `low` (default), `medium`, `high`. [s:xai-grok-4-3, xai-best-practices]
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
- **none / low:** be explicit and complete: the steps that matter, the exact output format, the check before answering. [unverified]
- **medium:** goal, scope, constraints, what done looks like. [unverified]
- **high / xhigh:** describe the outcome; spend words on scope boundaries and stopping conditions. [unverified]
- At every level: state task, constraints and output format directly; the model reasons before answering. [s:xai-best-practices]
