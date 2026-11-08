---
kind: model
verified: 2026-11-08
sources: openai-models, openai-latest-model
---
# Writing for GPT-6.1 Terra

## How it reads prompts
- At `none` it behaves like a classic chat model: be precise about steps, format and what to check. [unverified]
- For writing: audience, tone, length and purpose, plus a short style line when the text will be published. [s:openai-latest-model]

## Strengths and weaknesses
- Strong: fast and efficient; visual reasoning, precise computer use, natural writing. [s:openai-models, openai-latest-model]
- Weak fit: long, deep agentic runs or frontier-hard reasoning; recommend Sol or Astra. [unverified]

## Effort
- `none` to `max`; default `medium`. Start at `medium` and raise only if the quality gain justifies the time and tokens. [s:openai-latest-model]

## Tested patterns
- Visual input: say what to look at and what to extract; ask it to quote the exact values it reads. [unverified]
- Computer use: the goal, allowed applications or sites, what must not change, when to stop and confirm. [unverified]

## Failure modes
- Sending `temperature` or `top_p` with effort above `none`. [s:openai-latest-model]
