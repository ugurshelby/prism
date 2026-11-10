---
kind: model
verified: 2026-11-10
sources: xai-models, xai-reasoning, xai-best-practices
---
# Writing for Grok 4.7

## How it reads prompts
- Direct briefs: task, constraints and output format up front; the model plans in its own reasoning. [s:xai-best-practices]

## Strengths and weaknesses
- Strong: xAI's newest flagship at a low list price; 500k context; knowledge to May 2026. [s:xai-models]
- Weak fit: very long inputs near or above 200k tokens cost double; Grok 4.3 has a 1M window and is cheaper. [s:xai-models]

## Effort
- Always reasoning: `low`, `medium`, `high` (default), `xhigh`. [s:xai-reasoning]
- `low` for latency-sensitive agent steps, `medium` for complex analysis, `high` for hard math and multi-step logic, `xhigh` when quality matters more than latency. [s:xai-reasoning]

## Tested patterns
- Current information: ask it to search and give today's date. [s:xai-best-practices]

## Failure modes
- "Think step by step" and requests to reveal reasoning add nothing. [s:xai-reasoning]
- API prompts that rely on `stop` sequences or penalties fail on this model. [s:xai-reasoning]
- High-effort requests can run long; short client timeouts look like failures. [s:xai-best-practices]
