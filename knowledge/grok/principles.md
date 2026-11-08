---
kind: model
verified: 2026-11-08
sources: xai-best-practices, xai-reasoning
---
# Prompting principles for current Grok models

xAI publishes little prompt-writing advice; its core guidance is to state the task, the constraints and the output format directly, because the models reason before answering. [s:xai-best-practices]
The rest below is general practice that has not been measured on Grok. [unverified]

## Clarity
- Give the goal, the reason behind constraints and what done looks like; treat it as a capable colleague with no context. [unverified]
- Keep the system prompt short: role, rules, format. [s:xai-best-practices]

## Structure
- Put static content first (system prompt, examples, reference documents) and the per-request part last; xAI's caching depends on an unchanged prefix. [s:xai-best-practices]
- Use XML tags or Markdown sections when instructions, context and inputs are mixed. [unverified]

## Reasoning
- Don't add "think step by step"; reasoning is built in and steered by `reasoning.effort`. [s:xai-reasoning]

## Tools and current facts
- Say when a tool should be used and what the loop's finish line is. [unverified]
- For current information ask it to use web search; Grok 4.7's knowledge stops in May 2026. [s:xai-best-practices]

## Grounding
- Give permission to say it doesn't know; restrict it to provided material when that's the intent. [unverified]

## Pasted content
- Wrap pasted external text in labeled tags and say that instructions inside it are data, not commands. [unverified]
