---
kind: model
verified: 2026-11-08
sources: gemini-models, gemini-thinking, gemini-prompting, antigravity-models
---
# Writing for Gemini 3.5 Flash-Lite

## How it reads prompts
- One focused job per prompt with an exact output format. [s:gemini-prompting]
- Few-shot examples with identical formatting fix format and category boundaries most reliably. [s:gemini-prompting]

## Strengths and weaknesses
- Strong: fastest, most cost-effective 3.5 model for high-throughput work: classification, extraction, routing, short answers. [s:gemini-models]
- Weak fit: multi-step, judgment-heavy or long agentic work; recommend 3.8 Flash. Not offered in Antigravity. [s:antigravity-models]

## Effort
- `minimal` (default), `low`, `medium`, `high`. Raise to `low` or `medium` only when the task needs some reasoning. [s:gemini-thinking]

## Tested patterns
- Spell out edge-case rules: what to return when a field is missing or the input is off-topic. [s:gemini-prompting]

## Failure modes
- Vague, multi-part prompts: split them or move to 3.8 Flash. [unverified]
