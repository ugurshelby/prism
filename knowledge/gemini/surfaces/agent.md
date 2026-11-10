---
kind: model
verified: 2026-11-10
sources: antigravity-permissions, antigravity-models, gemini-prompting, vertex-prompt-strategies, antigravity-cli-modes
---
# Surface: Antigravity (Google's coding agent)

The prompt is a task message to an agent that reads and edits files and runs commands in the person's repository. [s:antigravity-permissions]
Antigravity offers Gemini 4 Argon, 3.8 Flash, 3.7 Flash, 3.6 Flash and 3.1 Pro, plus some Claude models; Gemini 3.5 Flash-Lite is not in its list. [s:antigravity-models]

How to write it:
- Lead with the goal, stated clearly and concisely, then the concrete task. Include the files, commands, errors and tests the person gave; key information must be explicitly in the prompt. [s:gemini-prompting, vertex-prompt-strategies]
- Keep it concise and sectioned; a short brief beats a long rule list. [s:gemini-prompting]
- State what done looks like and have it validate its output against the task before reporting. [s:gemini-prompting]
- Set constraints: what it should and should not do (files to leave alone, whether new dependencies or tests are wanted). [s:gemini-prompting]
- Separate low-risk reads from risky writes; ask before destructive or hard-to-reverse actions. [s:gemini-prompting]
- For investigation requests, ask for the explanation or a plan first and no edits until approved; Antigravity's plan mode investigates read-only and presents an outline before writing code. [s:antigravity-cli-modes]

Setting model and thinking: pick the model in the selector under the prompt box and choose a thinking level (Low, Medium, High). The choice persists within a conversation; switching mid-run applies after the current turn. [s:antigravity-models]
