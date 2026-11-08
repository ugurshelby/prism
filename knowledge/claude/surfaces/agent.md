---
kind: model
verified: 2026-11-08
sources: claude-code-model-config, claude-best-practices
---
# Surface: Claude Code (agentic coding in a terminal or IDE)

The prompt is a user message to an agent that reads and edits files and runs commands in the person's repository. The person usually stays in the loop and can steer between turns. [unverified]

How to write it:
- Lead with the goal and why, then the concrete task. Use real names of files, commands, errors and tests the person gave; never invent paths. Keep pasted errors verbatim in a fenced block. [unverified]
- State what done looks like and how to verify it. At `low`/`medium` add the explicit "run a real check before reporting done"; at `high`+ one line naming the check is enough. [unverified]
- Set scope: what not to touch, whether new dependencies are allowed, whether tests or docs should be added. [s:claude-best-practices]
- For investigation requests, the deliverable is the explanation; no fix until asked. [s:claude-best-practices]
- Ask before destructive or hard-to-reverse actions. [s:claude-best-practices]
- Keep it a natural message with short lists; use tags only to fence pasted material. Don't restate what Claude Code does by default. [unverified]

Setting model and effort in Claude Code:
- Model: `/model claude-opus-5-5` (full IDs are unambiguous). [s:claude-code-model-config]
- Effort: `/effort low|medium|high|xhigh|max`; `max` applies to the current session only; `/effort status` shows the active level. [s:claude-code-model-config]
- Defaults: Opus 5.5, Sonnet 5.5 and Haiku 5.5 start at `medium`, Fable 5.1 at `high`. [s:claude-code-model-config]
