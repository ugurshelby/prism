---
kind: model
verified: 2026-11-08
sources: xai-grok-build-model, xai-models, grok-build-settings
---
# Writing for Grok Build 0.1

## How it reads prompts
- An engineering brief: goal and why, relevant files and commands, what done looks like, the verification command, scope limits. [unverified]
- In the Grok Build agent, repository rules from `CLAUDE.md` and Cursor rules are already loaded; don't repeat them. [s:grok-build-settings]

## Strengths and weaknesses
- Strong: agentic software, engineering and workflow tasks; 256k context; low price. [s:xai-grok-build-model, xai-models]
- Weak fit: writing, research or chat; recommend Grok 4.7. [unverified]

## Effort
- Reasoning is supported but no effort control is documented; treat the level as fixed. [s:xai-grok-build-model]

## Tested patterns
- Define the finish line precisely and when to stop and report. [unverified]

## Failure modes
- Prompts that depend on an effort setting. [s:xai-grok-build-model]
