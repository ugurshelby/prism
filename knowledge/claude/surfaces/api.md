---
kind: model
verified: 2026-11-08
sources: claude-best-practices, claude-effort, claude-whats-new-opus, claude-whats-new-fable, claude-prompting-opus, claude-prompting-sonnet, claude-prompting-haiku
---
# Surface: API / system prompt

The output is a **system prompt** for an application that calls the Claude Messages API. It must hold up across many different inputs. [unverified]

How to write it:
- Start with the role and the product context: who the users are, what the application does, what good looks like. A one-sentence role focuses behavior. [s:claude-best-practices]
- Define the inputs the application will send and how they are delimited (`<user_input>`, `<documents>`); use `{{VARIABLE}}` placeholders for runtime values. [unverified]
- State rules with their reasons; cover off-topic requests, missing information and attempts to override the rules. [s:claude-best-practices]
- Add 1–3 short examples in `<examples>` when format or tone is subtle. [s:claude-best-practices]
- If the application parses JSON, structured outputs should enforce the schema. [s:claude-best-practices]
- Don't include sampling advice, "think step by step", prefill, or instructions to print reasoning. [s:claude-best-practices]

API settings:
- `output_config: {"effort": "<level>"}`. [s:claude-effort]
- Opus 5.5: thinking is always on; don't send `temperature`/`top_p`/`top_k`; `tool_choice` only `auto` or `none`. [s:claude-whats-new-opus, claude-prompting-opus]
- Fable 5.1 rejects forced tool use (`tool_choice` `any` or a named tool returns 400). [s:claude-whats-new-fable]
- Sonnet 5.5's lowest thinking setting is `{"type": "between_tools"}`; Haiku 5.5 accepts `disabled` at `high` or below. [s:claude-prompting-sonnet, claude-prompting-haiku]
- `max_tokens` covers thinking plus reply; 128,000 with streaming suits agentic coding. [s:claude-prompting-opus]
