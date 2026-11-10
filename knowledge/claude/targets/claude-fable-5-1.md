---
kind: model
verified: 2026-11-10
sources: claude-prompting-fable, claude-models-overview, claude-whats-new-fable, claude-pricing
---
# Writing for Claude Fable 5.1

## How it reads prompts
- Runs long tasks without much methodology guidance when the goal is clear: describe the outcome, not the steps. [s:claude-prompting-fable]
- Writes fewer user-facing updates during long tool chains, more so at higher effort. [s:claude-prompting-fable]

## Strengths and weaknesses
- Strong: the most capable model; demanding reasoning and long-horizon agentic work. [s:claude-models-overview]
- Weak fit: routine work at its default `high`; per token it costs 2.5 times Opus 5.5, though at `low` it is often competitive on cost per task while scoring higher. [s:claude-pricing, claude-prompting-fable]

## Effort
- Default `high`. At `low` it searches less; at `xhigh`/`max` it may draft long deliverables in thinking and write them again. [s:claude-prompting-fable]

## Tested patterns
- Updates for human-in-the-loop work: remove lines like "hold all findings for the final response" first, then add "Before you start, say in a line what you're about to do; brief updates while you work help the user follow along. Close with a short recap that stands on its own." [s:claude-prompting-fable]
- Autonomous runs: "You are operating autonomously. The user is not watching in real time and cannot answer questions mid-task. For reversible actions that follow from the original request, proceed without asking. Stop only for destructive actions or genuine scope changes the user must decide." [s:claude-prompting-fable]
- Scope as deliverable: "The user's request sets the scope, and the scope is the deliverable: don't quietly narrow, widen, or swap it. If one part turns out to be blocked, complete every other part in full and say exactly what you left out and why." [s:claude-prompting-fable]
- No extras: "If you find a pre-existing bug or behavior the task doesn't mention, don't fix or extend it in this change unless the requested behavior cannot work without it; report it as a follow-up." [s:claude-prompting-fable]
- Small edits: "When it will not affect the end result, try to surgically edit a file rather than rewrite the entire thing." [s:claude-prompting-fable]

## Failure modes
- Ends the turn before the work is done on long asynchronous work ("Next, I'll…", "Shall I apply this?"). [s:claude-prompting-fable]
- Forced tool use returns a 400 error. [s:claude-whats-new-fable]
- Dense, mannered prose; "Please remove all mannered prose." fixes it. [s:claude-prompting-fable]
