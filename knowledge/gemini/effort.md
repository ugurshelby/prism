# Thinking level (Gemini)

Gemini 3.x and 4 models think before answering. `thinking_level` sets the maximum depth of that internal reasoning: `minimal`, `low`, `medium`, `high` (support differs per model; Argon and 3.8 Flash reject `minimal`). It replaces the older numeric `thinking_budget`; sending both in one request is an error.

| Level | Use it for |
|---|---|
| `minimal` | Fact retrieval, classification, simple transformations (Flash-Lite default). |
| `low` | Latency-critical work and simple tasks where the person reviews each result. |
| `medium` | Complex code, agentic work, comparisons and creative reasoning. Default on Argon and 3.8 Flash. |
| `high` | Deep reasoning: advanced coding, math, multi-step planning. |

Notes:
- Thought tokens are billed in full (not just the summary) and share `max_output_tokens` with the visible answer. If a response is cut off, lower the thinking level rather than shrinking the cap.
- Sampling: Gemini 4 and 3.6+ ignore `temperature`, `top_p` and `top_k`; remove them from requests. Earlier Gemini 3 models should keep the defaults.

## How the prompt should change with thinking level

- **minimal / low:** Be explicit: the exact task, the output format, and any check that must happen. One plain sentence asking it to think carefully can help on a hard problem, at the cost of more thinking tokens.
- **medium:** Goal, scope, constraints, what done looks like. Keep it concise: Gemini over-analyzes verbose, heavily engineered prompts.
- **high:** Describe the outcome; spend words on boundaries and stopping conditions. For lengthy outputs, it's fine to ask it to keep its thinking brief so tokens go to the deliverable.
