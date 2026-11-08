---
kind: model
verified: 2026-11-08
sources: codex-config, openai-latest-model
---
# Surface: Codex (agentic coding in a terminal or IDE)

The prompt is a user message to Codex, an agent that reads and edits files and runs commands in the person's repository. Codex loads the repository's `AGENTS.md` as project instructions. [s:codex-config]

How to write it:
- Lead with the goal and why, then the concrete task. Use the real names of files, commands, errors and tests the person gave; never invent paths. Keep pasted errors verbatim in a fenced block. [unverified]
- State what done looks like and how to verify it. At `low`/`medium` add "run a real check before reporting done"; at `high`+ one line naming the check is enough. [unverified]
- Set scope: what not to touch, whether new dependencies are allowed, how much testing fits the change. [s:openai-latest-model]
- If the person wants the task finished without check-ins: infer intent, carry it through, stop only before destructive or irreversible actions. [s:openai-latest-model]
- If the request may conflict with `AGENTS.md`, say the person's instructions take priority. [s:openai-latest-model]
- For investigation requests, the deliverable is the explanation; no fix until asked. [unverified]
- Ask for a short, plain final report: what changed, how it was verified, what is left open. [unverified]

Setting model and effort: `model` and `model_reasoning_effort` in `~/.codex/config.toml`; `plan_mode_reasoning_effort` overrides effort for Plan mode. [s:codex-config]
