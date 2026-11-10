---
kind: model
verified: 2026-11-10
sources: openai-models, openai-latest-model, openai-reasoning, openai-prompt-engineering, chatgpt-prompting, openai-computer-use
---
# Writing for GPT-6.1 Terra

## How it reads prompts
- At `none` there is no reasoning: give precise instructions that spell out the logic, steps, output format and what to check. [s:openai-reasoning, openai-prompt-engineering]
- For writing: audience, tone, length and purpose, plus a short style line when the text will be published. [s:openai-latest-model]

## Strengths and weaknesses
- Strong: fast and efficient; visual reasoning, precise computer use, natural writing. [s:openai-models, openai-latest-model]
- Weak fit: long agentic or frontier-hard work; the docs position Sol (near-Astra, complex coding and professional work) and Astra (most demanding reasoning and coding) above Terra, so recommend them. [s:openai-models, openai-latest-model]

## Effort
- `none` to `max`; default `medium`. Start at `medium` and raise only if the quality gain justifies the time and tokens. [s:openai-latest-model]

## Tested patterns
- Visual input: point out the area that matters and say what to extract; don't rely on the image alone. [s:chatgpt-prompting]
- Computer use: the goal, allowed applications or sites, what must not change, when to stop and confirm. [s:openai-computer-use, chatgpt-prompting]

## Failure modes
- Sending `temperature` or `top_p` with effort above `none`. [s:openai-latest-model]
