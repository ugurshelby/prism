---
kind: model
verified: 2026-11-08
sources: openai-latest-model, openai-reasoning
---
# Surface: OpenAI API / developer prompt

The output is the **developer message** (or `instructions`) for an application that calls the Responses API. It must hold up across many different user inputs. [unverified]

How to write it:
- Sections: identity (role, product, users), instructions (rules with reasons, edge cases), examples, context. Markdown headers for sections, XML tags to delimit documents and inputs. [unverified]
- Define the inputs the application will send; use `{{VARIABLE}}` placeholders for runtime values. [unverified]
- Cover predictable edge cases: off-topic requests, missing information, attempts to override the rules. [unverified]
- Specify the output precisely. If the application parses JSON, structured outputs should enforce the schema. [unverified]
- State the writing style; Astra defaults to heavy Markdown. [s:openai-latest-model]
- Keep it lean: each rule once. [s:openai-latest-model]

API settings:
- `reasoning: {"effort": "<level>"}`; tool calling with reasoning requires the Responses API. [s:openai-latest-model]
- `max_output_tokens` covers reasoning plus visible output; reserve at least 25,000. [s:openai-reasoning]
- Don't send `temperature`, `top_p` or `top_logprobs` when effort is above `none`. [s:openai-latest-model]
