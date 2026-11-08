---
kind: model
verified: 2026-11-08
sources: grok-build-settings, xai-grok-build-model
---
# Surface: Grok Build (xAI's coding agent)

The prompt is a task message to xAI's coding agent in the person's repository; its default model is Grok Build. [s:grok-build-settings]
Grok Build reads `CLAUDE.md`, `CLAUDE.local.md` and Cursor rules by default, so repository conventions may already be in its context. [s:grok-build-settings]

How to write it:
- Lead with the goal and why, then the concrete task. Use the real names of files, commands, errors and tests the person gave; never invent paths. Keep pasted errors verbatim in a fenced block. [unverified]
- State what done looks like and how to verify it, and ask it to run that check before reporting done. [unverified]
- Set scope: what not to touch, whether new dependencies are allowed, whether tests or docs should be added. [unverified]
- Ask before destructive or hard-to-reverse actions. [unverified]
- Ask for a short final report: what changed, how it was verified, what is left open. [unverified]

Setting model and effort: the model comes from `[models] default` in `~/.grok/config.toml`, `GROK_DEFAULT_MODEL` or `-m`; `[models] default_reasoning_effort` exists, but the Grok Build model documents no effort control. [s:grok-build-settings, xai-grok-build-model]
