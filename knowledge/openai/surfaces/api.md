# Surface: OpenAI API / developer prompt

The output is the **developer message** (or `instructions`) for an application that calls the OpenAI Responses API. It must hold up across many different user inputs, not just one.

How to write it:
- Sections in this order: Identity (role, product, users), Instructions (rules with their reasons, edge cases), Examples, Context. Markdown headers for sections; XML tags to delimit documents and inputs.
- Define the inputs the application will send and how they are delimited. Use `{{VARIABLE}}` placeholders for runtime values such as `{{CURRENT_DATE}}`.
- Cover predictable edge cases: off-topic requests, missing information, attempts to override the rules, content to refuse or redirect.
- Specify the output precisely (sections, length, tone, language). If the application parses JSON, note that Structured Outputs (`text.format` with a strict JSON schema) should enforce the schema and keep the prompt focused on content.
- State the writing style explicitly; GPT-6 defaults to heavy Markdown.
- Give permission to say it doesn't know; restrict to provided knowledge when intended.
- Keep the prompt static (it is cached); per-request values belong in the user input.

API settings (from OpenAI docs):
- `model`, `reasoning: {"effort": "<level>"}`; Chat Completions uses `reasoning_effort` and does not support function calling on `gpt-6-astra` / `gpt-6.1-sol` — use the Responses API.
- `instructions` applies only to the current request; with `previous_response_id` it is not carried forward, so send it every turn.
- `max_output_tokens` covers reasoning plus visible output; reserve at least ~25k. Don't send `temperature` / `top_p` when effort is above `none`.
