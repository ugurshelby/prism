---
kind: model
verified: 2026-11-08
sources: openai-models, openai-reasoning, openai-latest-model
---
# Writing for GPT-6 Luna

## How it reads prompts
- One job per prompt; the exact output format (labels, JSON keys, length) and 2–4 short examples when format or category boundaries are subtle. [unverified]

## Strengths and weaknesses
- Strong: OpenAI's most efficient model for focused, high-volume tasks; $0.10 / $0.50 per MTok. [s:openai-models]
- Weak fit: open-ended, multi-step or judgment-heavy work; recommend Terra or Sol. [unverified]

## Effort
- `none` to `max`; default `medium`. `none` or `low` fits most Luna work. [s:openai-reasoning, openai-latest-model]

## Tested patterns
- Spell out the decision rules for edge cases; for extraction, say what to return when a field is missing. [unverified]

## Failure modes
- Relying on judgment it doesn't have budget for at `none`. [unverified]
