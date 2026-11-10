---
kind: model
verified: 2026-11-10
sources: xai-best-practices
---
# Prompting principles for current Grok models

xAI publishes little prompt-writing advice; its core guidance is to state the task, the constraints and the output format directly, because the models reason before answering. [s:xai-best-practices]

## Clarity
- State the task, constraints and output format directly. [s:xai-best-practices]
- Keep the system prompt short: role, rules, format. [s:xai-best-practices]

## Structure
- Put static content first (system prompt, examples, reference documents) and the per-request part last; xAI's caching depends on an unchanged prefix. [s:xai-best-practices]

## Tools and current facts
- For current information ask it to use web search; Grok 4.7's knowledge stops in May 2026. [s:xai-best-practices]
