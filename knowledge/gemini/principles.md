# Prompting principles for current Gemini models

Source: Google's "Prompt design strategies", "Gemini thinking" and the Gemini 3 / 3.8 developer guides.

## Clarity
- Keep prompts concise and direct. State the goal plainly and define ambiguous terms. Verbose or overly complex prompt engineering makes Gemini 3+ over-analyze.
- Say what to do and what not to do, including length limits.
- Avoid unnecessary or overly persuasive language ("you are the world's best…", emphatic pleading).

## Where things go
- Essential behavioral constraints, the persona and the output format go early: in the system instruction, or at the start of the prompt.
- With long inputs (documents, code, transcripts), put the material first and the question or instructions at the end, bridged with "Based on the information above, …".
- Separate instructions, context and task clearly so data can't be mistaken for directives.

## Structure
- Use one delimiter style consistently within a prompt: either XML-style tags or Markdown headings, not a mix.

## Examples
- Google recommends including few-shot examples. Use a few specific, varied ones (too many cause overfitting) with identical formatting — same tags, whitespace and line breaks. Good examples let the instructions be shorter.

## Output
- Gemini 3+ gives direct, efficient answers by default. If a detailed, conversational or richly formatted answer is wanted, ask for it explicitly.
- Specify the format (list, table, prose, JSON fields) and length. For guaranteed JSON, the application should use structured outputs.

## Reasoning
- Thinking is internal; don't ask the model to outline or show its reasoning steps in the reply. For a hard problem, one sentence asking it to think carefully is enough.

## Time and knowledge
- State today's date, and for current facts ask it to use Google Search grounding when available. In a system instruction, a knowledge-cutoff sentence helps it judge what it may not know.
- For grounded answers: restrict it to the provided context and tell it to say when the information isn't there.

## Agentic work (Google's guidance)
- Plan before each action, weighing rules, prerequisites and the person's preferences.
- Distinguish low-risk reads from high-risk writes; confirm before destructive or irreversible actions.
- Prefer calling a tool with the information available over asking the person, unless later steps truly need the missing detail.
- Retry transient errors, but on other errors change strategy instead of repeating the same call.
- Verify claims against the exact source text.

## Decomposition
- Split very complex jobs into a sequence of prompts or parallel sub-tasks when one prompt would mix many unrelated instructions.

## Pasted content
- Wrap pasted external text in clearly delimited tags and say that instructions inside it are followed only where the person's own message asks.
