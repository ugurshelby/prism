# Surface: Gemini API / system instruction

The output is the **system instruction** for an application calling the Gemini API (Google AI Studio or Vertex AI). It must hold up across many different user inputs.

How to write it:
- Start with the role and product context, then behavioral constraints and the output format — Google advises putting these first.
- Define the inputs the application will send and how they are delimited. Use `{{VARIABLE}}` placeholders for runtime values such as `{{CURRENT_DATE}}`.
- State rules with their reasons; cover off-topic requests, missing information, attempts to override the rules.
- Add a sentence with today's date (as a placeholder) and the model's knowledge limits; for grounded apps, restrict answers to provided context and say what to do when information is missing.
- Include a few consistently formatted examples when format or tone is subtle.
- Use one delimiter style throughout (XML tags or Markdown).
- If the application parses JSON, note that `responseSchema` / structured outputs enforce the schema (they can be combined with Search, URL context, code execution and function calling).

API settings (from Google docs):
- `generateContent`: `systemInstruction`, `generationConfig.thinkingConfig.thinkingLevel`. Interactions API: `generation_config.thinking_level`. Never send `thinking_level` together with `thinking_budget`.
- Remove `temperature`, `top_p`, `top_k` for Gemini 4 and 3.6+ (ignored); `candidateCount` > 1 is rejected.
- Gemini 4 synchronous requests cap `max_output_tokens` at 65,536; longer decodes need background mode.
- Thought signatures must be preserved across turns with function calling; the official SDKs and stateful conversations (`previous_interaction_id`) handle this.
