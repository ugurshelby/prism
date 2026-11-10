---
kind: model
verified: 2026-11-10
sources: claude-code-model-config, claude-best-practices, claude-code-overview, claude-code-best-practices, claude-prompting-sonnet, claude-prompting-haiku, claude-prompting-opus
---
# Surface: Claude Code (agentic coding in a terminal or IDE)

The prompt is a user message to an agent that reads the codebase, edits files and runs commands in the person's repository. The person can stop and redirect it mid-task (Esc, /rewind). [s:claude-code-overview, claude-code-best-practices]

How to write it:
- Lead with the goal and why, then the concrete task. Name the files, the symptom and what "fixed" looks like, using the names the person gave; never invent paths. Hand over pasted errors and output as-is. [s:claude-best-practices, claude-code-best-practices]
- Give a check that comes back pass or fail, and ask for evidence (the command and its output). At `low` (Sonnet 5.5) or `low`/`medium` (Haiku 5.5) add the explicit "run a real check before reporting done" paragraph. [s:claude-code-best-practices, claude-prompting-sonnet, claude-prompting-haiku]
- Set scope: what not to touch, whether new dependencies are allowed, whether tests or docs should be added. [s:claude-best-practices]
- For investigation requests, the deliverable is the explanation; no fix until asked. [s:claude-best-practices]
- Ask before destructive or hard-to-reverse actions. [s:claude-best-practices]
- Keep it a plain message; tell it only what it can't find by reading the repo, and don't restate what Claude Code already does. Wrap pasted outside text in tags. [s:claude-code-best-practices, claude-prompting-opus]

Setting model and effort in Claude Code:
- Model: `/model claude-opus-5-5` (full IDs are unambiguous). [s:claude-code-model-config]
- Effort: `/effort low|medium|high|xhigh|max`; `max` applies to the current session only; `/effort status` shows the active level. [s:claude-code-model-config]
- Defaults: Opus 5.5, Sonnet 5.5 and Haiku 5.5 start at `medium`, Fable 5.1 at `high`. [s:claude-code-model-config]
