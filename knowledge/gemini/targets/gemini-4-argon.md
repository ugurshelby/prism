# Writing for Gemini 4 Argon

Strengths: Google's flagship reasoning model; unified 1M-token context and long decodes up to 1M tokens (via background mode), so it can read very large inputs at once and produce very long single deliverables. Thinking levels `low`, `medium` (default), `high`; thinking can't be turned off.

## Patterns that work

- **Big inputs:** put the documents or code first, wrapped in labeled tags, and the question or task last ("Based on the material above, …"). Ask it to quote the exact passages it relies on when accuracy matters.
- **Long deliverables:** describe the structure of the output (sections, order, approximate length) up front. For very long outputs, `medium` thinking usually beats `high`: thinking and output share the token budget.
- **Concise instructions:** state the goal, constraints and output format directly; drop motivational or persuasive framing.
- **Hard reasoning:** at `high`, describe the outcome and the acceptance check rather than a step-by-step method.
- **Current facts:** ask it to use Search grounding and give today's date.

## Things to avoid
- Asking it to show its reasoning steps in the answer.
- Sampling settings (`temperature`, `top_p`) — ignored on Gemini 4.
- Recommending it for routine work that Gemini 3.8 Flash handles at a fraction of the cost.
