---
kind: model
verified: 2026-11-10
sources: openai-latest-model, openai-reasoning, openai-prompt-engineering, openai-agent-safety
---
# Surface: OpenAI API / developer prompt

The output is the **developer message** (or `instructions`) for an application that calls the Responses API. It must hold up across many different user inputs. [s:openai-prompt-engineering]

How to write it:
- Sections: identity (purpose, style, goals), instructions (rules: what to do and never do), examples (inputs with desired outputs), context (supporting data, near the end). Markdown headers for sections, XML tags to delimit documents and inputs. [s:openai-prompt-engineering]
- Define the inputs the application will send; pass dynamic values as typed function arguments or schema fields and build the prompt in code. [s:openai-prompt-engineering]
- Cover attempts in user input to override the rules (developer instructions outrank user messages) and extract only validated fields from untrusted input. [s:openai-prompt-engineering, openai-agent-safety]
- Specify the output precisely. If the application parses JSON, structured outputs should enforce the schema. [s:openai-prompt-engineering]
- State the writing style; Astra defaults to heavy Markdown. [s:openai-latest-model]
- Keep it lean: each rule once. [s:openai-latest-model]

API settings:
- `reasoning: {"effort": "<level>"}`; tool calling with reasoning requires the Responses API. [s:openai-latest-model]
- `max_output_tokens` covers reasoning plus visible output; reserve at least 25,000. [s:openai-reasoning]
- Don't send `temperature`, `top_p` or `top_logprobs` when effort is above `none`. [s:openai-latest-model]
