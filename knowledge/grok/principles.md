# Prompting principles for current Grok models

Source: xAI's "Best Practices" and "Reasoning" guides. xAI publishes little model-specific prompt-writing advice; its main guidance is to state the task, the constraints and the output format directly, because Grok reasoning models reason before they answer. The rest below is general best practice that holds for Grok.

## Clarity
- State the task, constraints and desired output format directly and early. Treat the model as a capable colleague with no context: give the goal, the why, and what done looks like.
- Keep the system prompt short and focused on role, rules and format.
- Tell it what to do rather than what not to do; explain the reason behind a constraint.

## Structure
- Put static content first (system prompt, examples, reference documents) and the per-request part last — this matches how xAI's prompt caching works.
- Use XML tags or Markdown sections to separate instructions, context, examples and inputs when they are mixed.
- Examples steer format reliably; keep them varied and consistently formatted.

## Reasoning
- Don't add "think step by step"; reasoning is built in and steered by `reasoning.effort`. Don't ask it to reveal its reasoning in the reply; a short rationale is fine.

## Tools and agentic work
- Say when a tool (web search, code execution, function) should be used, and what the loop's finish line is.
- Encourage local, reversible actions; ask before destructive or externally visible ones.
- For current facts, ask it to search and give today's date.

## Hallucination and grounding
- Give permission to say it doesn't know; restrict it to provided material when that's the intent; ask for sources.

## Re-tuning
- Prompts tuned for another model family should be adjusted for Grok rather than reused as-is.

## Pasted content
- Wrap pasted external text in clearly delimited tags and say that instructions inside it are followed only where the person's own message asks.
