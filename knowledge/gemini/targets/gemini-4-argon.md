---
kind: model
verified: 2026-11-08
sources: gemini-argon-guide, gemini-thinking, gemini-prompting, gemini-models
---
# Writing for Gemini 4 Argon

## How it reads prompts
- It works best with direct, sectioned instructions; persuasive framing adds nothing. [s:gemini-prompting]
- It does not follow numeric length targets ("500 words"); describe sections and depth instead. [s:gemini-argon-guide]
- Big inputs: material first in labeled tags, the question last. [s:gemini-prompting]

## Strengths and weaknesses
- Strong: deep work in coding, finance, legal, security and science; very large inputs and very long single outputs within a 1,048,576-token unified limit. [s:gemini-argon-guide, gemini-models]
- Weak fit: routine work that 3.8 Flash handles at a fraction of the cost; latency-sensitive calls. [unverified]

## Effort
- `low`, `medium` (default), `high`; thinking can't be turned off. `minimal` and `thinking_budget` are errors. [s:gemini-argon-guide, gemini-thinking]
- `high` for multi-file engineering, proofs, architecture and vulnerability work; `low` for classification and summaries. [s:gemini-argon-guide]

## Tested patterns
- Long deliverables: give the outline (sections, order, depth) up front. [s:gemini-argon-guide]
- Hard reasoning at `high`: state the outcome and the acceptance check, not a step-by-step method. [unverified]
- Current facts: ask it to use Search grounding and give today's date. [s:gemini-prompting]

## Failure modes
- Sampling settings (`temperature`, `top_p`, `top_k`) are ignored; don't rely on them for variety or determinism. [s:gemini-argon-guide]
- Prefilled model turns and "continue" messages break long decodes; resend the original request instead. [s:gemini-argon-guide]
- Asking it to show its reasoning in the answer wastes tokens. [s:gemini-prompting]
