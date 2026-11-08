---
kind: model
verified: 2026-11-08
sources: antigravity-models, gemini-prompting
---
# Surface: Antigravity (Google's coding agent)

The prompt is a task message to an agent that reads and edits files and runs commands in the person's repository. [unverified]
Antigravity offers Gemini 4 Argon, 3.8 Flash, 3.7 Flash, 3.6 Flash and 3.1 Pro, plus some Claude models; Gemini 3.5 Flash-Lite is not in its list. [s:antigravity-models]

How to write it:
- Lead with the goal and why, then the concrete task. Use the real names of files, commands, errors and tests the person gave; never invent paths. Keep pasted errors verbatim in a fenced block. [unverified]
- Keep it concise and sectioned; a short brief beats a long rule list. [s:gemini-prompting]
- State what done looks like and how to verify it (which tests, build or command). At `low`, add an explicit "run a real check before reporting done". [unverified]
- Set scope: what not to touch, whether new dependencies are allowed, whether tests or docs should be added. [unverified]
- Separate low-risk reads from risky writes; ask before destructive or hard-to-reverse actions. [s:gemini-prompting]
- For investigation requests, the deliverable is the explanation; no fix until asked. [unverified]

Setting model and thinking: pick the model in the selector under the prompt box and choose a thinking level (Low, Medium, High). The choice persists within a conversation; switching mid-run applies after the current turn. [s:antigravity-models]
