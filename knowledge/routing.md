# Choosing across model families

Used only when the person lets Prism pick among several families. The candidates are the models the person can actually use (their verified API keys plus the apps they said they use); never recommend outside them.

## First, respect the person's context

- If the raw prompt names a tool or family ("in Claude Code", "Codex", "ChatGPT", "Gemini", "Antigravity", "Grok"), stay in that family when it is among the candidates.
- Otherwise judge the task on its merits: capability needed, cost, latency and the surface.

## Rough tiers (October 2026, documented positioning and list prices per MTok input / output)

| Tier | Claude | OpenAI | Gemini | Grok |
|---|---|---|---|---|
| Frontier, hardest work | Fable 5.1 ($10 / $50) | GPT-6 Astra ($10 / $50) | Gemini 4 Argon ($4 / $20) | Grok 4.7 ($2 / $6) |
| Serious default | Opus 5.5 ($4 / $20) | GPT-6.1 Sol ($2 / $10) | Gemini 3.8 Flash ($1.50 / $7.50) | Grok 4.7 |
| Fast everyday | Sonnet 5.5 ($2 / $10) | GPT-6.1 Terra ($1 / $5) | Gemini 3.8 Flash | Grok 4.3 ($1.25 / $2.50) |
| Cheap, high volume | Haiku 5.5 ($0.10 / $0.50) | GPT-6 Luna ($0.10 / $0.50) | Gemini 3.5 Flash-Lite ($0.30 / $2.50) | Grok 4.3 |
| Coding-agent specific | (Opus / Sonnet in Claude Code) | (Sol / Astra in Codex) | (3.8 Flash in Antigravity) | Grok Build 0.1 ($1 / $2) |

Prices alone don't decide: reasoning models bill thinking tokens as output, and some models think much longer than others at the same nominal level.

## Documented strengths worth matching

- **Claude (Opus 5.5 / Fable 5.1):** long-running agentic coding in a real repository, careful code review with few false alarms, financial and analytical work, catching small details in large inputs. Strong default for Claude Code work.
- **OpenAI (GPT-6 family):** strong instruction following and collaboration; Terra for clear natural writing, visual reasoning and computer use; Luna for focused high-volume tasks. Tends toward detailed, heavily formatted answers.
- **Gemini (4 Argon / 3.8 Flash):** very long context (1M tokens) and very long outputs (Argon), native multimodal input (images, PDFs, video, audio), Google Search grounding. 3.8 Flash is built for long-horizon software engineering and agents at a low price.
- **Grok (4.7):** capable flagship at a low price, recommended by xAI for code and chat; 500k context.

## How to decide

- Pick the cheapest model + level that will reliably do this task well on this surface. If two families are close, prefer the one that matches the surface the person is already using.
- Recommend the effort / thinking level in the chosen model's own scale; level names do not mean the same amount of thinking across families.
- Alternatives may come from other families when they are a real trade-off (much cheaper, much faster, or clearly stronger for this task); say the trade-off honestly.
- Don't claim benchmark results you weren't given. Base the reasoning on the documented positioning above and in the family cards.
