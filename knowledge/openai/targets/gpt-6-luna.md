# Writing for GPT-6 Luna

Strengths: OpenAI's most efficient model for focused, high-volume tasks — classification, extraction, routing, short answers, sub-agents. Effort `none` to `max`; the default isn't documented, so always name the level (`none` or `low` fits most Luna work).

## Patterns that work

- Keep each prompt focused on one job. Give the exact output format (labels, JSON keys, length) and 2–4 short examples when the format or the category boundaries are subtle.
- Spell out the decision rules for edge cases instead of relying on judgment.
- For extraction, say what to return when a field is missing.
- If the application parses JSON, rely on Structured Outputs for the schema.

## Things to avoid
- Open-ended, multi-step or judgment-heavy work: recommend Terra or Sol instead.
