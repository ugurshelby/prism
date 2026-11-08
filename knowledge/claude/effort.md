---
kind: model
verified: 2026-11-08
sources: claude-effort, claude-prompting-opus, claude-prompting-sonnet, claude-prompting-haiku, claude-prompting-fable
---
# Effort (Claude)

Effort is the main control over how much a Claude model thinks, and so over quality, latency and cost. Level names don't mean the same amount of thinking across models. [s:claude-effort, claude-prompting-opus]
Asking for less thinking in the prompt is unreliable; lower the effort instead. Thinking counts toward `max_tokens` and is billed as output. [s:claude-prompting-opus, claude-prompting-haiku]
On the API, effort can change mid-conversation with a per-message `system` entry (beta), which keeps the prompt cache. [s:claude-effort]

| Level | Use it for |
|---|---|
| `low` | Quick exchanges the person reviews: brainstorming, a small change, simple chat, short tool tasks, subagents. The model scopes tightly and may skip verification. | [s:claude-effort]
| `medium` | Day-to-day work with a clear scope. Default on Opus 5.5 and Haiku 5.5, and on Sonnet 5.5 in Claude Code. | [s:claude-effort]
| `high` | Work where verification matters or edge cases are likely: bugs in an existing codebase, knowledge work, strict instruction following. Default on Sonnet 5.5 (API) and Fable 5.1. | [s:claude-effort]
| `xhigh` | Long-horizon agentic and coding tasks where deeper reasoning pays off. | [s:claude-effort]
| `max` | Hard problems to work through alone, such as finding security vulnerabilities. Diminishing returns; reserve it. | [s:claude-effort]

## Per model
- **Opus 5.5:** start at `medium`; thinking can't be turned off. It thinks more than Opus 5 at the same level, especially at `xhigh`/`max`; reserve those for measured gains. For agentic coding, `max_tokens` of 128,000 works well. [s:claude-prompting-opus]
- **Sonnet 5.5:** from `medium` up it thinks briefly before almost every reply, which delays the first token; use `medium` or `low` for chat. At `xhigh`/`max` it starts extra review rounds and reviewer subagents. [s:claude-prompting-sonnet]
- **Haiku 5.5:** start at `medium`. At `xhigh` in multi-turn chat it sometimes ends a turn with no visible text; if a task seems to need `xhigh`/`max`, compare with Sonnet 5.5. [s:claude-prompting-haiku]
- **Fable 5.1:** start at `high`. At `low` it searches less. At `xhigh`/`max` it may draft long deliverables in its thinking and write them again; prefer `high` for single long deliverables. [s:claude-prompting-fable]

## How the prompt should change with effort
- **low:** explicit and complete; the model won't fill gaps. If the work must be verified, say so; at low effort it may report done without a real check. [s:claude-prompting-sonnet]
- **medium:** goal, scope, what done looks like; name the verification step for code changes. [unverified]
- **high:** context, goal, constraints and the finish line matter more than steps; add scope guards for narrow changes. [s:claude-prompting-sonnet]
- **xhigh / max:** spend words on boundaries and stopping conditions, and say extra review rounds or reviewer subagents are not wanted unless asked. [s:claude-prompting-sonnet]
