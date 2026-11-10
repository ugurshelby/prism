---
kind: model
verified: 2026-11-10
sources: openai-models, openai-reasoning, openai-latest-model, openai-prompt-engineering, chatgpt-prompting
---
# Writing for GPT-6 Luna

## How it reads prompts
- One focused task per prompt; the exact output format, plus a few diverse input/output examples when format or category boundaries are subtle. [s:openai-models, openai-prompt-engineering]

## Strengths and weaknesses
- Strong: OpenAI's most efficient model for focused, high-volume tasks; $0.10 / $0.50 per MTok. [s:openai-models]
- Weak fit: complex multi-step work; the docs position Sol for complex work and Astra for the most demanding work. [s:openai-models, openai-latest-model]

## Effort
- `none` to `max`; default `medium`. `none` or `low` fits most Luna work. [s:openai-reasoning, openai-latest-model]

## Tested patterns
- Spell out the rules for edge cases (what to do and never do); for extraction, enforce the schema with structured outputs and say to flag missing information instead of guessing. [s:openai-prompt-engineering, chatgpt-prompting]

## Failure modes
- Running tasks that need judgment at `none`, which is meant for latency-critical work that does not benefit from reasoning. [s:openai-reasoning]
