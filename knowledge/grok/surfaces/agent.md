---
kind: model
verified: 2026-11-10
sources: grok-build-settings, xai-grok-build-model, grok-build-permissions
---
# Surface: Grok Build (xAI's coding agent)

The prompt is a task message to xAI's coding agent in the person's repository; its default model is Grok Build. [s:grok-build-settings]
Grok Build reads `CLAUDE.md`, `CLAUDE.local.md` and Cursor rules by default, so repository conventions may already be in its context. [s:grok-build-settings]

How to write it:
- Grok Build's default Ask mode prompts before tool calls not already allowed, and still prompts for dangerous commands such as rm and git push. [s:grok-build-permissions]

Setting model and effort: the model comes from `[models] default` in `~/.grok/config.toml`, `GROK_DEFAULT_MODEL` or `-m`; `[models] default_reasoning_effort` exists, but the Grok Build model documents no effort control. [s:grok-build-settings, xai-grok-build-model]
