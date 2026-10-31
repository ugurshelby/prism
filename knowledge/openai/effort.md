# Reasoning effort (OpenAI)

GPT-6 models reason before answering. `reasoning.effort` sets how much: `none`, `low`, `medium`, `high`, `xhigh`, `max` (support differs per model; `minimal` from older models maps to `low`). OpenAI frames effort as a tuning knob, not the main way to improve quality: a clear goal, constraints and output contract matter more.

| Level | Use it for |
|---|---|
| `none` | Latency-critical work with no reasoning (Terra, Luna only). Behaves like a classic chat model: give precise, explicit instructions and the output format. |
| `low` | Efficient reasoning: quick edits, short tool tasks, simple Q&A, high-volume work. Lowest level on Astra and Sol. |
| `medium` | Planning and judgment. Day-to-day work with a clear scope. Default on Sol and Terra. |
| `high` | Verification-heavy work: debugging, careful analysis, strict instruction following, longer agentic tasks. |
| `xhigh` | Long-horizon agentic and coding work where deeper reasoning pays off. |
| `max` | The most complex problems the model works through alone. Highest cost and latency. |

Notes:
- Reasoning tokens are billed as output and count toward `max_output_tokens`; reserve at least ~25k tokens when starting out. A response that hits the limit comes back `incomplete`, possibly with no visible text.
- `temperature`, `top_p` and logprobs are not accepted when effort is above `none`.
- To change effort in the middle of a conversation, the API offers a `configuration_update` input item (keeps the cached prefix).
- In Codex: `model_reasoning_effort` in `config.toml`, or the `/model` picker in a session.

## How the prompt should change with effort

- **none / low:** Be explicit and complete: the steps that matter, the exact output format, what to check before answering. Keep it short.
- **medium:** Goal, scope, constraints, what done looks like and how to verify it. Mention the riskiest edge case.
- **high and above:** Describe the outcome, not the procedure. Spend words on boundaries: what is in scope, what must not be touched, when to stop and report, which actions need confirmation. Say how much testing fits the change, since GPT-6 models tend to write broader tests than small tasks need.
