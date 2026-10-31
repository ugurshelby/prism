# Reasoning effort (Grok)

Grok reasoning models think before answering. `reasoning.effort` controls the depth on Grok 4.7 (`low`, `medium`, `high` default, `xhigh`) and Grok 4.3 (`none`, `low` default, `medium`, `high`). On Grok 4.5–4.7 reasoning can't be disabled. Grok Build 0.1 has a fixed reasoning level. xAI recommends setting effort explicitly on every request.

| Level | Use it for (xAI's guidance) |
|---|---|
| `none` | Grok 4.3 only: no reasoning, fastest replies for simple tasks. |
| `low` | Latency-sensitive agentic work and simple tool calls. |
| `medium` | Complex data analysis and everyday multi-step work. |
| `high` | Hard math and multi-step logic. Default on Grok 4.7. |
| `xhigh` | When answer quality matters more than latency (Grok 4.6 and later). |

## How the prompt should change with effort

- **none / low:** Be explicit and complete: steps that matter, exact output format, and the check that must happen before answering.
- **medium:** Goal, scope, constraints, what done looks like, how to verify.
- **high / xhigh:** Describe the outcome; spend words on scope boundaries, stopping conditions and which actions need confirmation.
