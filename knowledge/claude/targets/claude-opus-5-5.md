---
kind: model
verified: 2026-11-08
sources: claude-prompting-opus, claude-models-overview, claude-whats-new-opus
---
# Writing for Claude Opus 5.5

## How it reads prompts
- Starts acting quickly; the fact it needs often sits somewhere the task didn't mention, so name the sources to explore in multi-app tasks. [s:claude-prompting-opus]
- Very sensitive to elapsed time in multi-agent setups; time budgets are advisory but change how it parallelizes. [s:claude-prompting-opus]

## Strengths and weaknesses
- Strong: long-running agentic coding and knowledge work, code review, analysis, dense visual inputs, computer use. [s:claude-models-overview]
- Weak fit: trivial or very high-volume work, where Haiku or Sonnet cost far less. [unverified]

## Effort
- Default `medium`; thinking can't be turned off, so effort is the only control. [s:claude-prompting-opus]
- `low` comes close to `medium` on several coding evaluations at much lower cost. [s:claude-prompting-opus]

## Tested patterns
- Remove "think carefully" lines in chat-style prompts; replies start sooner without quality loss. [s:claude-prompting-opus]
- Settle earlier answers in multi-turn chat (only when wanted): "Once you have answered something, treat that answer as done. On later turns, focus your thinking on what the user is asking now, and don't go back over an earlier answer unless the user asks about it or points out a problem with it." [s:claude-prompting-opus]
- Explore before acting in multi-source tasks: "Before taking any action, explore broadly with tool calls: list and open the emails, documents, spreadsheet tabs and records across the available apps that could be relevant to this task, including ones the task does not explicitly mention, and use what you find." [s:claude-prompting-opus]
- Unattended runs: name the unwanted ways of stopping (a summary that announces the next step without doing it, offering to continue, stopping at a milestone) and the stops that are wanted (blocked on the person, destructive actions). [s:claude-prompting-opus]
- Frontend design: name the patterns to avoid, e.g. "Do not use a cream or off-white background, italic accent words in headlines, numbered '01/02/03' section labels, monospace labels, or pill-shaped buttons." [s:claude-prompting-opus]

## Failure modes
- Forced tool use doesn't exist (`tool_choice` only `auto`/`none`); say in the prompt when a tool should be used. [s:claude-whats-new-opus]
- Thinks more per turn than Opus 5 at the same level; an old `max_tokens` can cut replies off. [s:claude-prompting-opus]
