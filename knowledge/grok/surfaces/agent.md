# Surface: Grok Build (agentic coding CLI)

The prompt is a task message to xAI's coding agent, which reads and edits files, runs commands and iterates on multi-step tasks in the person's repository. It runs on Grok Build 0.1, whose reasoning level is fixed.

How to write it:
- Lead with the goal and why, then the concrete task. Use the real names of files, folders, commands, errors and tests the person gave; never invent paths. Keep pasted errors and logs verbatim in a fenced block.
- State what done looks like and how to verify it (which tests, build or command), and ask it to run that check before reporting done.
- Set scope: what not to touch, whether new dependencies are allowed, whether tests or docs should be added.
- Ask before destructive or hard-to-reverse actions (deleting files or branches, force-push, migrations on shared data).
- For investigation requests, the deliverable is the explanation; no fix until asked.
- Ask for a short final report: what changed, how it was verified, what is left open.
- Keep it a natural message with short lists; use tags only to fence pasted material.

Setting model and effort in Grok Build: the agent uses Grok Build 0.1 with fixed reasoning; there is no effort setting. If the CLI offers a model choice, pick the recommended model there.
