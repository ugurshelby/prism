---
kind: model
verified: 2026-11-13
sources: gemini-carbon-whats-new, gemini-carbon-guide, gemini-carbon-card, gemini-prompting, gemini-argon-guide
---
# Writing for Gemini 4 Carbon

## How it reads prompts
- Same API, tools and request shape as Argon; only the thinking behaviour differs. [s:gemini-carbon-whats-new]
- It works best with direct, sectioned instructions; persuasive framing adds nothing. [s:gemini-prompting]
- Big inputs: material first in labeled tags, the question last. [s:gemini-prompting]

## Strengths and weaknesses
- Strong: long-horizon engineering that coordinates several agents, high-precision documents and artifacts in finance, law and data analysis, spatial reasoning and visual design, physics, mathematics and life sciences. [s:gemini-carbon-card]
- It spends far more thinking tokens per turn than Argon on hard math, science and coding problems. [s:gemini-carbon-whats-new]
- Weak fit: routine work and interfaces that need a short synchronous answer; it costs the same per token as Argon ($4 / $20 per MTok from 2026-12-01) but thinks longer, so a session costs more and long passes can hit HTTP timeouts. [s:gemini-carbon-whats-new, gemini-carbon-card]

## Effort
- `low`, `medium` (default), `high`; thinking can't be turned off. `minimal` and `thinking_budget` return HTTP 400. [s:gemini-carbon-guide]
- Keep `medium` unless the task really needs more; use `high` only for the hardest problems. [s:gemini-carbon-whats-new]

## Tested patterns
- Give the outline of a long deliverable (sections, order, depth) up front instead of a word count. [s:gemini-argon-guide]
- Hard reasoning: state the goal clearly and leave out step-by-step reasoning instructions. [s:gemini-prompting]
- For heavy coding or reasoning in the API, the application should raise `max_output_tokens` to at least 32,768, or to 131,072-262,144 with background execution, because thinking uses much of the output budget. [s:gemini-carbon-whats-new]

## Failure modes
- `temperature`, `top_p` and `top_k` are ignored; don't rely on them for variety or determinism. [s:gemini-carbon-guide]
- A low output cap leaves the visible answer cut off after long thinking. [s:gemini-carbon-whats-new]
- Indirect prompt injection is still an open area; keep untrusted material in labeled tags and say it is data. [s:gemini-carbon-card, gemini-prompting]
