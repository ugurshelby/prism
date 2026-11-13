---
kind: model
verified: 2026-11-13
sources: gemini-thinking, gemini-argon-guide, gemini-prompting, vertex-prompt-strategies, gemini-platform-thinking, gemini-hydrogen-blog
---
# Thinking level (Gemini)

Gemini 3.x and 4 models think before answering; `thinking_level` sets how deep that internal reasoning goes. Thinking can't be switched off on these models. [s:gemini-thinking]
Argon, Carbon and 3.8 Flash accept `low`, `medium`, `high`; Hydrogen adds `xhigh` and defaults to `high`. `minimal` and the old numeric `thinking_budget` return an error on Gemini 4. [s:gemini-thinking, gemini-argon-guide, gemini-platform-thinking]

| Level | Use it for |
|---|---|
| `minimal` | Fact lookup, classification, simple transformations (Flash-Lite default). | [s:gemini-thinking]
| `low` | Classification, summarization, metadata extraction, latency-critical work. | [s:gemini-argon-guide]
| `medium` | General coding, tool use, document Q&A. Default on Argon and 3.8 Flash. | [s:gemini-argon-guide, gemini-thinking]
| `high` | Multi-file engineering, formal proofs, architecture design, vulnerability discovery. Default on Hydrogen. | [s:gemini-argon-guide, gemini-platform-thinking]
| `xhigh` | Hydrogen only: hard debugging and deep reasoning; slower, more output tokens. | [s:gemini-hydrogen-blog]

Notes:
- Thought tokens are billed in full and count toward the output limit. If a response is cut off, lower the thinking level rather than shrinking the cap. [s:gemini-argon-guide]
- Gemini 4 and 3.6+ ignore `temperature`, `top_p` and `top_k`; remove them from requests. [s:gemini-prompting, gemini-argon-guide]

## How the prompt should change with thinking level
- **minimal / low:** be explicit about the exact task, the output format and any check that must happen. One plain sentence asking it to think carefully can help a hard problem, at the cost of more thinking tokens. [s:gemini-prompting]
- **medium:** goal, scope, constraints, what done looks like, stated concisely. [s:gemini-prompting]
- **high:** state the goal clearly and leave out step-by-step reasoning instructions; Google suggests testing thinking prompts without them and comparing. [s:gemini-prompting, vertex-prompt-strategies]
- At every level: don't ask it to show its reasoning steps in the visible answer. [s:gemini-prompting]
