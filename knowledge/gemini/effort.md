---
kind: model
verified: 2026-11-08
sources: gemini-thinking, gemini-argon-guide, gemini-prompting
---
# Thinking level (Gemini)

Gemini 3.x and 4 models think before answering; `thinking_level` sets how deep that internal reasoning goes. Thinking can't be switched off on these models. [s:gemini-thinking]
Argon and 3.8 Flash accept `low`, `medium`, `high`; `minimal` and the old numeric `thinking_budget` return an error on Argon. [s:gemini-thinking, gemini-argon-guide]

| Level | Use it for |
|---|---|
| `minimal` | Fact lookup, classification, simple transformations (Flash-Lite default). | [s:gemini-thinking]
| `low` | Classification, summarization, metadata extraction, latency-critical work. | [s:gemini-argon-guide]
| `medium` | General coding, tool use, document Q&A. Default on Argon and 3.8 Flash. | [s:gemini-argon-guide, gemini-thinking]
| `high` | Multi-file engineering, formal proofs, architecture design, vulnerability discovery. | [s:gemini-argon-guide]

Notes:
- Thought tokens are billed in full and count toward the output limit. If a response is cut off, lower the thinking level rather than shrinking the cap. [s:gemini-argon-guide]
- Gemini 4 and 3.6+ ignore `temperature`, `top_p` and `top_k`; remove them from requests. [s:gemini-prompting, gemini-argon-guide]

## How the prompt should change with thinking level
- **minimal / low:** be explicit about the exact task, the output format and any check that must happen. One plain sentence asking it to think carefully can help a hard problem, at the cost of more thinking tokens. [s:gemini-prompting]
- **medium:** goal, scope, constraints, what done looks like, stated concisely. [s:gemini-prompting]
- **high:** describe the outcome and the acceptance check; spend words on boundaries and stopping conditions rather than a step-by-step method. [unverified]
- At every level: don't ask it to show its reasoning steps in the visible answer. [s:gemini-prompting]
