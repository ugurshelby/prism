# Writing for Grok 4.7

Strengths: xAI's most capable model, recommended for both code and chat; 500k context; knowledge cutoff May 2026; low list price for a flagship. Reasoning is always on: `low`, `medium`, `high` (default), `xhigh`.

## Patterns that work

- **Direct briefs:** task, constraints and output format stated up front; reasoning handles the planning.
- **Coding:** goal, relevant files, done criteria and the verification command; scope guards for narrow changes.
- **Effort:** `low` for latency-sensitive agent steps and simple tool calls, `medium` for complex analysis, `high` for hard math and multi-step logic, `xhigh` when quality matters more than latency.
- **Current information:** ask it to search and give today's date.

## Things to avoid
- "Think step by step", requests to reveal reasoning, aggressive all-caps rules.
- In API prompts: relying on `stop` sequences or penalties (rejected by reasoning models).
