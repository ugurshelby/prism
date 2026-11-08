---
kind: model
verified: 2026-11-08
sources: xai-models, xai-grok-4-3, xai-best-practices
---
# Writing for Grok 4.3

## How it reads prompts
- One focused job per prompt with an exact output format works best at low effort. [unverified]
- Large inputs: material first in labeled tags, the task last. [unverified]

## Strengths and weaknesses
- Strong: lower cost and a 1M-token window; can run with no reasoning for speed. [s:xai-models, xai-grok-4-3]
- Weak fit: long, judgment-heavy agentic tasks, where Grok 4.7 is the better choice. [unverified]

## Effort
- `none`, `low` (default), `medium`, `high`. Raise to `medium` or `high` only when the task needs real reasoning. [s:xai-grok-4-3, xai-best-practices]

## Tested patterns
- High-volume tasks: a few consistent examples and explicit edge-case rules. [unverified]

## Failure modes
- Relying on the default effort: xAI recommends setting it on every request. [s:xai-best-practices]
