# Writing for Grok 4.3

Strengths: lower cost and a 1M-token context window; light reasoning by default (`low`), and it can run with no reasoning (`none`). Levels: `none`, `low`, `medium`, `high`.

## Patterns that work

- Large inputs: put the material first in labeled tags and the task last; ask for quotes when accuracy matters.
- High-volume or simple tasks: one focused job per prompt, exact output format, a few consistent examples, explicit edge-case rules.
- Raise effort to `medium` / `high` only when the task needs real reasoning; otherwise recommend Grok 4.7 for hard work.

## Things to avoid
- Long, judgment-heavy agentic tasks: Grok 4.7 is the better fit.
