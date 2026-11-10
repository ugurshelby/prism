---
kind: model
verified: 2026-11-10
sources: openai-models, openai-latest-model, openai-reasoning
---
# Writing for GPT-6.1 Sol

## How it reads prompts
- The GPT-6 guide's advice is written for Astra; use it as a starting point and evaluate on Sol: tell it to carry the task through, state the writing style, scale testing to the change. [s:openai-latest-model]
- Lean system prompts with each rule stated once score better. [s:openai-latest-model]

## Strengths and weaknesses
- Strong: near-Astra performance for complex coding, computer use and professional work at one fifth of the price. [s:openai-models, openai-latest-model]
- Weak fit: trivial or very high-volume tasks, where Luna or Terra cost far less. [s:openai-models]

## Effort
- `low` to `max`; no `none` or `minimal`; default `medium`. [s:openai-latest-model, openai-reasoning]

## Tested patterns
- At `medium`, state the goal, scope, constraints and how to verify done; at `high` and above, spend words on scope and stopping conditions. [s:openai-reasoning]

## Failure modes
- Sending `none` or `minimal` effort. [s:openai-reasoning]
- "Think step by step" and requests to reveal reasoning. [s:openai-reasoning]
