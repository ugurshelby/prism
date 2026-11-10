---
kind: model
verified: 2026-11-10
sources: xai-models, xai-grok-4-3, xai-best-practices
---
# Writing for Grok 4.3

## How it reads prompts
- Large inputs: put reference documents in the static prefix before the per-request part; caching depends on an unchanged prefix. [s:xai-best-practices]

## Strengths and weaknesses
- Strong: lower cost and a 1M-token window; can run with no reasoning for speed. [s:xai-models, xai-grok-4-3]
- Weak fit next to Grok 4.7: xAI recommends Grok 4.7, its most capable model, for code and chat. [s:xai-models]

## Effort
- `none`, `low` (default), `medium`, `high`, `xhigh`. Raise to `medium` or `high` only when the task needs real reasoning. [s:xai-grok-4-3, xai-best-practices, xai-models]

## Tested patterns
- High-volume tasks: keep few-shot examples fixed at the start of the input so the cached prefix is reused. [s:xai-best-practices]

## Failure modes
- Relying on the default effort: xAI recommends setting it on every request. [s:xai-best-practices]
