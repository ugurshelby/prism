---
kind: model
verified: 2026-11-10
sources: gemini-prompting, gemini-argon-guide, vertex-prompt-strategies
---
# Prompting principles for current Gemini models

## Clarity
- Be direct and precise; define ambiguous terms. Drop persuasive or flattering framing ("you are the world's best…"). [s:gemini-prompting]
- Separate role, constraints, context, task and output format into distinct sections. [s:gemini-prompting]

## Where things go
- Critical constraints, persona and output format go in the system instruction or at the very start of the prompt. [s:gemini-prompting]
- With long inputs (documents, code, transcripts), put the material first and the question last, bridged with "Based on the information above, …". [s:gemini-prompting]
- Put static content first so repeated requests share a cacheable prefix. [s:gemini-argon-guide]

## Structure
- Use one delimiter style consistently: XML-style tags or Markdown headings, not a mix. [s:gemini-prompting]

## Examples
- Google recommends few-shot examples: a few specific, varied ones with identical formatting. Too many cause overfitting; good examples let the instructions be shorter. [s:gemini-prompting]

## Output
- Gemini answers directly and efficiently by default. Ask explicitly for a detailed or conversational answer when that is wanted. [s:gemini-prompting]
- Gemini 4 Argon does not follow numeric length targets; describe the structure of the output instead of a word count. [s:gemini-argon-guide]
- For guaranteed JSON, the application should use structured output (`response_schema`). [s:gemini-argon-guide]

## Reasoning
- Thinking is internal; don't ask for reasoning steps in the reply. For a hard problem one sentence asking it to think carefully is enough. [s:gemini-prompting]

## Time and grounding
- State today's date for time-sensitive questions and ask it to use Google Search grounding when available. [s:gemini-prompting]
- For grounded answers, restrict it to the provided context and tell it to say when the information is absent. [s:gemini-prompting]

## Agentic work
- Have it plan before each tool call or reply, weighing dependencies, risks and alternatives. [s:gemini-prompting]
- Distinguish low-risk reads from high-risk writes; prefer acting with the information available over asking when the missing detail is optional. [s:gemini-prompting]
- Retry transient errors; on other errors change strategy instead of repeating the same call. [s:gemini-prompting]

## Pasted content
- Wrap pasted external text in clearly labeled tags; Google's template labels such a block as data, not instructions, and Vertex advises explicit safeguards around untrusted user input. [s:gemini-prompting, vertex-prompt-strategies]
