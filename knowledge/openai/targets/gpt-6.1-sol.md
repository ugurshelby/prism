---
kind: model
verified: 2026-11-08
sources: openai-models, openai-latest-model, openai-reasoning
---
# Writing for GPT-6.1 Sol

## How it reads prompts
- Same family habits as Astra; when they would get in the way, say to carry the task through, state the writing style and scale testing to the change. [unverified]
- Lean system prompts with each rule stated once score better. [s:openai-latest-model]

## Strengths and weaknesses
- Strong: near-Astra performance for complex coding, computer use and professional work at one fifth of the price. [s:openai-models, openai-latest-model]
- Weak fit: trivial or very high-volume tasks, where Luna or Terra cost far less. [s:openai-models]

## Effort
- `low` to `max`; no `none` or `minimal`; default `medium`. [s:openai-latest-model, openai-reasoning]

## Tested patterns
- At `medium`, name the verification step and the riskiest edge case; at `high` and above, spend words on scope and stopping conditions. [unverified]

## Failure modes
- Sending `none` or `minimal` effort. [s:openai-reasoning]
- "Think step by step" and requests to reveal reasoning. [s:openai-reasoning]
