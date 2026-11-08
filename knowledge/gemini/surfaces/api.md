---
kind: model
verified: 2026-11-08
sources: gemini-prompting, gemini-argon-guide, gemini-thinking
---
# Surface: Gemini API / system instruction

The output is the **system instruction** for an application calling the Gemini API (Google AI Studio or Vertex AI). It must hold up across many different user inputs. [unverified]

How to write it:
- Start with role and product context, then behavioral constraints and the output format; Google advises putting these first. [s:gemini-prompting]
- Define the inputs the application will send and how they are delimited. Use `{{VARIABLE}}` placeholders for runtime values such as `{{CURRENT_DATE}}`. [unverified]
- State rules with their reasons; cover off-topic requests, missing information and attempts to override the rules. [unverified]
- For grounded apps, restrict answers to the provided context and say what to do when the information is missing. [s:gemini-prompting]
- Include a few consistently formatted examples when format or tone is subtle. [s:gemini-prompting]
- Keep the static part first and unchanged so requests share a cached prefix. [s:gemini-argon-guide]
- If the application parses JSON, structured output (`response_schema`) enforces the schema. [s:gemini-argon-guide]

API settings:
- `generateContent`: `system_instruction`, and `thinking_level` in the generation config. `thinking_budget` and `MINIMAL` are rejected on Argon. [s:gemini-thinking, gemini-argon-guide]
- Remove `temperature`, `top_p`, `top_k` for Gemini 4 and 3.6+; `frequency_penalty`, `presence_penalty` and `candidate_count` are rejected on Argon. [s:gemini-prompting, gemini-argon-guide]
- Argon's default single-request output is 65,536 tokens when streaming and 32,768 otherwise; longer outputs use long decodes on `v1beta1`. [s:gemini-argon-guide]
- Prefilled model turns are not supported on Argon; history can't end with a model turn. [s:gemini-argon-guide]
