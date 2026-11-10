---
kind: model
verified: 2026-11-10
sources: xai-grok-build-model, xai-models, grok-build-settings
---
# Writing for Grok Build 0.1

## How it reads prompts
- In the Grok Build agent, repository rules from `CLAUDE.md` and Cursor rules are already loaded; don't repeat them. [s:grok-build-settings]

## Strengths and weaknesses
- Strong: agentic software, engineering and workflow tasks; 256k context; low price. [s:xai-grok-build-model, xai-models]
- Weak fit outside coding: built for agentic software, engineering and workflow tasks; xAI recommends Grok 4.7 for chat. [s:xai-grok-build-model, xai-models]

## Effort
- Reasoning is supported but no effort control is documented; treat the level as fixed. [s:xai-grok-build-model]

## Tested patterns
- xAI publishes no prompt patterns for this model; the general rules above apply. [s:xai-grok-build-model]

## Failure modes
- Prompts that depend on an effort setting. [s:xai-grok-build-model]
