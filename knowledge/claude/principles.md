---
kind: model
verified: 2026-11-08
sources: claude-best-practices, claude-reduce-hallucinations, claude-prompting-opus
---
# Prompting principles for current Claude models

## Clarity
- Be clear and direct; treat the model as a brilliant new colleague with no context. [s:claude-best-practices]
- If you want more than the minimum, ask for it explicitly ("Go beyond the basics to create a fully-featured implementation."). [s:claude-best-practices]
- Ask for the action, not a suggestion, when action is wanted: "Change this function…" gets changes, "Can you suggest…" gets suggestions. [s:claude-best-practices]
- Tell it what to do rather than what not to do ("Write in flowing prose paragraphs" beats "Don't use markdown"). [s:claude-best-practices]

## Context and motivation
- Explain why a constraint exists; the model generalizes from the reason. [s:claude-best-practices]

## Examples
- Examples steer format and tone reliably. Make them relevant and varied, wrapped in `<example>` tags; 3–5 when format matters. [s:claude-best-practices]

## Structure
- Use XML tags to separate instructions, context, examples and inputs when they are mixed; keep tag names consistent. [s:claude-best-practices]
- Long documents (20k+ tokens) go at the top and the question at the end; ask it to pull relevant quotes first, then answer. [s:claude-best-practices]

## Output format and style
- Current models are concise and direct by default; ask for a summary or a particular length when wanted. [s:claude-best-practices]
- Match the prompt's style to the desired output: a markdown-heavy prompt yields markdown-heavy output. [s:claude-best-practices]
- Prefilling the final assistant turn is not supported on current models; use instructions or structured outputs. [s:claude-best-practices]

## Thinking
- Thinking is adaptive and set by effort. On Opus 5.5, removing "think carefully" lines made replies start sooner with no quality loss. [s:claude-prompting-opus]
- Never ask the model to write its reasoning into the reply; that can be refused as `reasoning_extraction`. A short rationale is fine. [s:claude-best-practices]
- General instructions ("think thoroughly about edge cases") beat hand-written step-by-step recipes. [s:claude-best-practices]

## Tools and agentic work
- Use normal language for tool guidance ("Use this tool when…"); aggressive wording causes over-triggering. [s:claude-best-practices]
- Encourage local, reversible actions; ask before destructive or externally visible ones. [s:claude-best-practices]
- Over-engineering guard: "Only make changes that are directly requested or clearly necessary." [s:claude-best-practices]
- Grounding in code: "Never speculate about code you have not opened." [s:claude-best-practices]

## Hallucination
- Give permission to say "I don't know"; restrict it to provided material when that's the intent; ask for quotes per claim. [s:claude-reduce-hallucinations]

## Frontend and visual work
- Without direction the model converges on generic design. Give a concrete aesthetic direction and name the specific patterns to avoid. [s:claude-prompting-opus]

## Pasted content
- Wrap each pasted block in opening and closing `<pasted_content>` tags that carry the same short random id, and say that instructions inside are followed only where the person's own message asks. [s:claude-prompting-opus]
