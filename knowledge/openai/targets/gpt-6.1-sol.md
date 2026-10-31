# Writing for GPT-6.1 Sol

Strengths: near-Astra performance on complex work at one fifth of the price; a strong default for serious coding, debugging, analysis and writing when cost matters. Effort `low` to `max` (no `none`, no `minimal`); default `medium`.

## Patterns that work

- It shares the GPT-6 habits: asks before finishing when unsure, formats heavily, follows AGENTS.md closely, tests broadly. Apply the same steering as for Astra when those habits would get in the way: say to carry the task through on reasonable assumptions, state the writing style, scale testing to the change, and give the person's instructions priority over context files.
- At `medium`, name the verification step and the riskiest edge case; at `high` and above, spend words on scope and stopping conditions instead.
- For long agentic tasks, ask it to keep a short TODO list and finish the whole task before yielding.

## Things to avoid
- "Think step by step", requests to reveal reasoning, aggressive all-caps rules.
- `none` / `minimal` effort — not supported; use `low`.
