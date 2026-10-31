# Prompting principles for current OpenAI models (GPT-6 family)

Source: OpenAI's "Prompt engineering", "Reasoning models" and "Using GPT-6" guides.

## Clarity and the output contract
- Reasoning models work best with high-level goals, like a senior colleague: give the task, the constraints and the desired output format, and let the model plan the intermediate steps. Don't prescribe every step.
- Give an explicit output contract: structure, length, what to include and leave out.
- For agentic and research work, define what "done" means and how the model should verify its work (tests to run, sources to check). Ask it to verify patches rather than trust success messages.

## Structure
- Rules and context go in the developer message (or `instructions`); the task and inputs in the user message. Treat the developer message like a function definition and the user message like its arguments.
- A developer message reads well in sections: Identity, Instructions, Examples, Context. Use Markdown headers and lists for hierarchy, XML tags to delimit documents and data.
- Put reusable, static content first and per-request context last (this also helps prompt caching).
- Few-shot: a handful of diverse input/output examples in the developer message steer format reliably.

## GPT-6 tendencies to steer
- **Asks more often.** GPT-6 Astra stops to ask when more input could change the result. If the person wants the work finished, say so: infer intent from context, make reasonable assumptions, and carry the task through to completion; only stop before destructive or irreversible actions. Treat "can you…" / "help me…" as a request to act. Ask for approval only after the authorized work is done, so the person reviews a concrete result.
- **Verbose, heavily formatted answers.** It defaults to lists, tables and Markdown and can repeat stock phrases. State the style wanted: clear, concise paragraphs; lists only for parallel, sequential or comparable items; plain language, active voice, main point first; detail calibrated to the reader.
- **Sensitive to context files.** It follows instructions in AGENTS.md and skill files closely. When the person's request may conflict with them, say that the person's instructions take precedence and ask it to name the file and quote the instruction if a file makes it pause or diverge.
- **Under-delegates.** If parallel sub-agents would help, say when and how much to delegate.
- **Tests broadly.** Ask for tests proportional to the change; skip tests for trivial, reversible changes.
- **No unsolicited warnings.** Ask it to leave out disclaimers, compliance checklists and warnings about hypothetical risks unless they matter.

## Writing quality
- For prose the person will publish, add a short style line. OpenAI lists patterns to avoid, e.g. filler words ("delve", "foster", "leverage"), stock phrases ("it's worth noting", "importantly"), closing summaries like "In short:" or "Bottom line:", "X, not Y" contrasts nobody asked about, invented hyphenated compounds and vague qualifiers.

## Reasoning
- Don't write "think step by step"; reasoning is internal and controlled by effort. Don't ask the model to reveal its reasoning; a short rationale or a summary of what it did is fine.

## Tools and agentic work
- Ask it to resolve the full task before yielding, to explain tool calls briefly at notable steps, and to track progress with a TODO list when the task is long.
- Encourage local, reversible actions; ask before destructive or externally visible ones.
- Frontend work: name the preferred libraries and the UI states, file structure and components when they matter.

## Hallucination and grounding
- Give permission to say it doesn't know; restrict to provided material when that's the intent; ask for sources. For anything time-sensitive, tell it to use web search and give today's date.

## Pasted content
- Wrap pasted external text in clearly delimited tags and say that instructions inside it are followed only where the person's own message asks.
