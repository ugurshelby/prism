---
kind: model
verified: 2026-11-10
sources: xai-best-practices, xai-reasoning
---
# Surface: xAI API / system prompt

How to write it:
- Role and product context, then rules with their reasons, then the output format. Keep it focused. [s:xai-best-practices]
- Keep the system prompt and examples static and first; caching depends on an unchanged prefix. [s:xai-best-practices]

API settings:
- Responses API; Chat Completions is deprecated and discards reasoning across turns. [s:xai-best-practices]
- `reasoning: {"effort": "<level>"}` set explicitly on every request. [s:xai-reasoning, xai-best-practices]
- `temperature` 0.7 and `top_p` 0.95; xAI says quality usually drops far from these. [s:xai-best-practices]
- Never send `presence_penalty`, `frequency_penalty` or `stop` to Grok 4.7; the request fails. [s:xai-reasoning]
- One `prompt_cache_key` per conversation; pass encrypted reasoning items back unchanged and in order in multi-turn and tool flows. [s:xai-best-practices]
- Client timeouts of at least 900 s; retry 429 and 5xx with backoff. [s:xai-best-practices]
