# Surface: Codex (agentic coding in a terminal / IDE)

The prompt is a user message to Codex, an agent that reads and edits files and runs commands and tests in the person's repository. Codex also loads the repository's `AGENTS.md`, which GPT-6 models follow closely.

How to write it:
- Lead with the goal and why, then the concrete task. Use the real names of files, folders, commands, errors and tests the person gave; never invent paths. Keep pasted errors and logs verbatim in a fenced block.
- State what done looks like and how to verify it (which tests, build or command). At `low`/`medium` add an explicit "run a real check before reporting done"; at `high`+ one line naming the check is enough.
- Set scope: what not to touch, whether new dependencies are allowed, how much testing fits the change.
- GPT-6 asks questions and seeks approval more readily than earlier models. If the person wants the task finished without check-ins, say: make reasonable assumptions, carry it through, and only stop before destructive or irreversible actions (deleting files or branches, force-push, migrations on shared data).
- If the request may conflict with `AGENTS.md`, say that the person's instructions take precedence.
- For investigation requests ("why does X happen?"), the deliverable is the explanation; no fix until asked.
- Ask for a short, plain final report: what changed, how it was verified, anything left open.
- Keep it a natural message with short lists where useful; use tags only to fence pasted material.

Setting model and effort in Codex:
- In a session: `/model` to pick the model and reasoning effort.
- Persistent: `~/.codex/config.toml` → `model = "gpt-6.1-sol"`, `model_reasoning_effort = "medium"`. A `-c model_reasoning_effort="high"` flag overrides it for one run.
