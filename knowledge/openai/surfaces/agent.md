---
kind: model
verified: 2026-11-10
sources: codex-config, openai-latest-model, chatgpt-prompting, codex-best-practices, openai-gpt56-guide
---
# Surface: Codex (agentic coding in a terminal or IDE)

The prompt is a user message to Codex, an agent that reads and edits files and runs commands in the person's repository. Codex loads the repository's `AGENTS.md` as project instructions. [s:codex-config]

How to write it:
- Lead with the goal (the behavior wanted), then point to the relevant files, errors or reproduction steps the person gave, and the constraints to preserve. [s:chatgpt-prompting, codex-best-practices]
- State what done looks like and how to verify it (tests pass, the repro no longer fails); ask it to run the relevant checks and confirm behavior matches the request. [s:codex-best-practices, chatgpt-prompting]
- Set scope: what not to touch, whether new dependencies are allowed, how much testing fits the change. [s:openai-latest-model]
- If the person wants the task finished without check-ins: infer intent, carry it through, stop only before destructive or irreversible actions. [s:openai-latest-model]
- If the request may conflict with `AGENTS.md`, say the person's instructions take priority. [s:openai-latest-model]
- For investigation requests, the deliverable is the explanation; no fix until asked. [s:openai-gpt56-guide, chatgpt-prompting]
- Ask for a short, legible final report that names the checks run and their results. [s:openai-latest-model, chatgpt-prompting]

Setting model and effort: `model` and `model_reasoning_effort` in `~/.codex/config.toml`; `plan_mode_reasoning_effort` overrides effort for Plan mode. [s:codex-config]
