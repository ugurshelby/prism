---
kind: model
verified: 2026-11-08
sources: claude-pricing, claude-models-overview, openai-models, gemini-pricing, gemini-models, xai-models, gemini-argon-guide, openai-latest-model, antigravity-models, grok-build-settings
---
# Choosing across model families

Used only when the person lets Prism pick among several families. The candidates are the models the person can actually use; never recommend outside them. [unverified]

## First, respect the person's context
- If the raw prompt names a tool or family ("in Claude Code", "Codex", "ChatGPT", "Gemini", "Antigravity", "Grok"), stay in that family when it is among the candidates. [unverified]
- Otherwise judge the task on its merits: capability needed, cost, latency and the surface. [unverified]

## Rough tiers (list prices per MTok input / output, checked 2026-11-08)

| Tier | Claude | OpenAI | Gemini | Grok |
|---|---|---|---|---|
| Frontier, hardest work | Fable 5.1 ($10 / $50) | GPT-6 Astra ($10 / $50) | Gemini 4 Argon ($4 / $20; $2 / $10 until 2026-11-30) | Grok 4.7 ($2 / $6) | [s:claude-pricing, openai-models, gemini-pricing, xai-models]
| Serious default | Opus 5.5 ($4 / $20) | GPT-6.1 Sol ($2 / $10) | Gemini 3.8 Flash ($1.50 / $7.50; half until 2026-12-31) | Grok 4.7 | [s:claude-pricing, openai-models, gemini-pricing, xai-models]
| Fast everyday | Sonnet 5.5 ($2 / $10) | GPT-6.1 Terra ($1 / $5) | Gemini 3.8 Flash | Grok 4.3 ($1.25 / $2.50) | [s:claude-pricing, openai-models, gemini-pricing, xai-models]
| Cheap, high volume | Haiku 5.5 ($0.10 / $0.50) | GPT-6 Luna ($0.10 / $0.50) | Gemini 3.5 Flash-Lite ($0.30 / $2.50) | Grok 4.3 | [s:claude-pricing, openai-models, gemini-pricing, xai-models]
| Coding agent | Opus / Sonnet in Claude Code | Sol / Astra in Codex | Argon / 3.8 Flash in Antigravity | Grok Build 0.1 ($1 / $2) | [s:antigravity-models, grok-build-settings, xai-models]

Prices alone don't decide: reasoning models bill thinking as output, and some think much longer than others at the same nominal level. [s:gemini-argon-guide, claude-pricing]

## Documented strengths worth matching
- **Claude (Opus 5.5 / Fable 5.1):** long-running agentic coding in a real repository, code review, analysis. [s:claude-models-overview]
- **OpenAI (GPT-6):** Astra and Sol for complex reasoning and coding; Terra for natural writing, visual reasoning and computer use; Luna for focused high-volume tasks. Tends toward heavily formatted answers. [s:openai-models, openai-latest-model]
- **Gemini (4 Argon / 3.8 Flash):** very large inputs and very long outputs (Argon), Google Search grounding. [s:gemini-argon-guide, gemini-models]
- **Grok (4.7):** capable flagship at a low price; 500k context. [s:xai-models]

## How to decide
- Pick the cheapest model and level that will reliably do this task well on this surface. If two families are close, prefer the one matching the surface the person already uses. [unverified]
- Recommend the effort in the chosen model's own scale; level names don't mean the same amount of thinking across families. [unverified]
- Alternatives may come from other families when they are a real trade-off; state it honestly. Don't claim benchmark results you weren't given. [unverified]
