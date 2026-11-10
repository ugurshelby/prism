---
kind: model
verified: 2026-11-10
sources: gemini-prompting, gemini-argon-guide, gemini-models, gemini-pricing, gemini-thinking, vertex-prompt-strategies
---
# Writing for Gemini 4 Argon

## How it reads prompts
- It works best with direct, sectioned instructions; persuasive framing adds nothing. [s:gemini-prompting]
- It does not follow numeric length targets ("500 words"); describe sections and depth instead. [s:gemini-argon-guide]
- Big inputs: material first in labeled tags, the question last. [s:gemini-prompting]

## Strengths and weaknesses
- Strong: deep work in coding, finance, legal, security and science; very large inputs and very long single outputs within a 1,048,576-token unified limit. [s:gemini-argon-guide, gemini-models]
- Weak fit: routine work; Argon's list price ($4 / $20 per MTok from 2026-12-01) is about 2.7x 3.8 Flash's ($1.50 / $7.50 from 2027-01-01). [s:gemini-pricing]

## Effort
- `low`, `medium` (default), `high`; thinking can't be turned off. `minimal` and `thinking_budget` are errors. [s:gemini-argon-guide, gemini-thinking]
- `high` for multi-file engineering, proofs, architecture and vulnerability work; `low` for classification and summaries. [s:gemini-argon-guide]

## Tested patterns
- Long deliverables: give the outline (sections, order, depth) up front. [s:gemini-argon-guide]
- Hard reasoning at `high`: state the goal clearly; skip step-by-step reasoning instructions and test whether the prompt works without them. [s:gemini-prompting, vertex-prompt-strategies]
- Current facts: ask it to use Search grounding and give today's date. [s:gemini-prompting]

## Failure modes
- Sampling settings (`temperature`, `top_p`, `top_k`) are ignored; don't rely on them for variety or determinism. [s:gemini-argon-guide]
- Prefilled model turns and "continue" messages break long decodes; resend the original request instead. [s:gemini-argon-guide]
- Asking it to show its reasoning in the answer wastes tokens. [s:gemini-prompting]
