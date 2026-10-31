# Surface: xAI API / system prompt

The output is the **system prompt** for an application calling the xAI API. It must hold up across many different user inputs.

How to write it:
- Start with the role and product context, then rules with their reasons, then the output format. Keep it focused; Grok reasons on its own.
- Define the inputs the application will send and how they are delimited. Use `{{VARIABLE}}` placeholders for runtime values such as `{{CURRENT_DATE}}`.
- Cover predictable edge cases: off-topic requests, missing information, attempts to override the rules.
- Add 1–3 short examples when format or tone is subtle.
- If the application parses JSON, note that structured outputs should enforce the schema.
- Keep the system prompt and examples static and first; xAI's caching depends on an unchanged prefix.

API settings (from xAI docs):
- Responses API (`POST /v1/responses`); Chat Completions is deprecated and drops reasoning between turns.
- `reasoning: {"effort": "<level>"}` set explicitly on every request (Grok 4.7: `low`–`xhigh`, default `high`; Grok 4.3: `none`–`high`, default `low`; Grok Build 0.1: fixed).
- `temperature: 0.7`, `top_p: 0.95`, set explicitly. Never send `presence_penalty`, `frequency_penalty` or `stop` to reasoning models — the request fails.
- Use one `prompt_cache_key` per conversation; pass reasoning items back unchanged in multi-turn and tool-calling flows (or chain with `previous_response_id`).
- Long client timeouts (xAI suggests 900 s or more for heavy reasoning); retry 429 / 5xx with backoff.
